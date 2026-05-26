import csv
import html as html_module
import io
import json
import math
import os
import re
import time
from pathlib import Path
from typing import List

import fitz
import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.errors import OperationFailure
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "rag_document_qa")
VECTOR_INDEX_NAME = os.getenv("VECTOR_INDEX_NAME", "embedding_vector_index")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
# models/embedding-001 is no longer served on the current Gemini API; use gemini-embedding-*.
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
EMBEDDING_OUTPUT_DIMENSIONALITY = int(
    os.getenv("EMBEDDING_OUTPUT_DIMENSIONALITY", "768")
)

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is required")

if not MONGO_URI:
    raise RuntimeError("MONGO_URI is required")

genai.configure(api_key=GEMINI_API_KEY)

mongo_client = MongoClient(MONGO_URI)
db = mongo_client[MONGO_DB_NAME]
embeddings_collection = db["embeddings"]

embedding_model = GoogleGenerativeAIEmbeddings(
    model=GEMINI_EMBEDDING_MODEL,
    google_api_key=GEMINI_API_KEY,
    output_dimensionality=EMBEDDING_OUTPUT_DIMENSIONALITY,
)
SYSTEM_INSTRUCTION = (
    "You are a helpful document assistant. Answer questions based only "
    "on the provided context. When you use information from a source, "
    "cite it inline like [1] or [2]. If the answer is not in the context, "
    "say 'I could not find that in the document.' "
    "Keep answers concise and accurate."
)

llm = genai.GenerativeModel(GEMINI_MODEL, system_instruction=SYSTEM_INSTRUCTION)

app = FastAPI(title="Askly AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessRequest(BaseModel):
    file_path: str = Field(..., min_length=1)
    document_id: str = Field(..., min_length=1)


class QueryRequest(BaseModel):
    document_id: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)
    history: list[dict] = []


class DeleteDocumentRequest(BaseModel):
    document_id: str = Field(..., min_length=1)


class SummariseRequest(BaseModel):
    document_id: str = Field(..., min_length=1)
    max_chunks: int = 20


TEXT_LIKE_EXTENSIONS = {".md", ".markdown", ".mdx", ".txt"}


def _strip_tags_markup(raw: str) -> str:
    text = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", raw)
    text = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html_module.unescape(text)).strip()


def extract_csv_text(file_path: Path) -> str:
    raw = file_path.read_text(encoding="utf-8", errors="replace")
    if file_path.suffix.lower() == ".tsv":
        delimiter = "\t"
    else:
        try:
            dialect = csv.Sniffer().sniff(raw[:8192])
            delimiter = dialect.delimiter
        except csv.Error:
            delimiter = ","
    reader = csv.reader(io.StringIO(raw), delimiter=delimiter)
    rows = list(reader)
    if not rows:
        return ""
    lines = [" | ".join((c if isinstance(c, str) else str(c)).strip() for c in row) for row in rows]
    return "\n".join(lines)


def extract_json_text(file_path: Path) -> str:
    raw = file_path.read_text(encoding="utf-8", errors="replace").strip()
    if not raw:
        return ""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return raw
    if isinstance(data, (dict, list)):
        return json.dumps(data, indent=2, ensure_ascii=False)
    return str(data)


def extract_pdf_pages(file_path: Path) -> List[dict]:
    """Return a list of page-tagged segments: [{'page': int, 'text': str}, ...]"""
    segments: List[dict] = []
    try:
        with fitz.open(file_path) as document:
            for page_number, page in enumerate(document, start=1):
                text = page.get_text("text").strip()
                if text:
                    segments.append({"page": page_number, "text": text})
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to read PDF: {exc}") from exc
    return segments


def extract_document_segments(file_path: str) -> List[dict]:
    """Returns a list of {'page': int|None, 'text': str} segments.
    Non-PDF files have a single segment with page=None.
    """
    source = Path(file_path)
    if not source.exists():
        raise HTTPException(status_code=404, detail="File not found")

    ext = source.suffix.lower()

    if ext == ".pdf":
        return extract_pdf_pages(source)

    if ext in TEXT_LIKE_EXTENSIONS:
        text = source.read_text(encoding="utf-8", errors="replace").strip()
        return [{"page": None, "text": text}] if text else []

    if ext in {".csv", ".tsv"}:
        text = extract_csv_text(source)
        return [{"page": None, "text": text}] if text else []

    if ext == ".json":
        text = extract_json_text(source)
        return [{"page": None, "text": text}] if text else []

    if ext in {".html", ".htm", ".xml"}:
        raw = source.read_text(encoding="utf-8", errors="replace")
        text = _strip_tags_markup(raw)
        return [{"page": None, "text": text}] if text else []

    raise HTTPException(
        status_code=400,
        detail=(
            f"Unsupported file extension '{ext}'. "
            "Allowed: .pdf, .md, .markdown, .mdx, .txt, .csv, .tsv, .json, .html, .htm, .xml"
        ),
    )


def split_text(text: str) -> List[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["\n\n", "\n", " | ", ". ", " ", ""],
    )
    return splitter.split_text(text)


def split_segments(segments: List[dict]) -> List[dict]:
    """Chunk each segment independently so we can preserve page numbers per chunk."""
    chunks: List[dict] = []
    for segment in segments:
        page = segment.get("page")
        for piece in split_text(segment["text"]):
            chunks.append({"page": page, "text": piece})
    return chunks


def _embed_with_retry(fn, *args, max_retries: int = 5, **kwargs):
    """Call an embedding function with exponential backoff on 429 rate-limit errors."""
    delay = 30  # start with 30 s — matches the API's suggested retryDelay
    for attempt in range(max_retries):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            err_str = str(exc)
            is_rate_limit = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str
            if is_rate_limit and attempt < max_retries - 1:
                # Try to parse the suggested retryDelay from the error message
                match = re.search(r"retryDelay.*?(\d+)s", err_str)
                suggested = int(match.group(1)) if match else 0
                wait = max(delay, suggested) + 5  # add a small buffer
                print(f"[embed] Rate limited (attempt {attempt + 1}/{max_retries}). Retrying in {wait}s...")
                time.sleep(wait)
                delay = min(delay * 2, 120)  # exponential backoff, cap at 2 min
            else:
                raise exc


# Free tier limit: 100 embed requests/min. We batch chunks and throttle to stay safe.
_EMBED_BATCH_SIZE = int(os.getenv("EMBED_BATCH_SIZE", "20"))   # chunks per API call
_EMBED_BATCH_DELAY = float(os.getenv("EMBED_BATCH_DELAY", "15"))  # seconds between batches


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Embed a list of texts in small batches with rate-limit retry logic."""
    all_embeddings: List[List[float]] = []
    total_batches = math.ceil(len(texts) / _EMBED_BATCH_SIZE)

    for i in range(0, len(texts), _EMBED_BATCH_SIZE):
        batch = texts[i: i + _EMBED_BATCH_SIZE]
        batch_num = i // _EMBED_BATCH_SIZE + 1
        print(f"[embed] Embedding batch {batch_num}/{total_batches} ({len(batch)} chunks)...")
        try:
            result = _embed_with_retry(embedding_model.embed_documents, batch)
            all_embeddings.extend(result)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Embedding generation failed: {exc}") from exc

        # Throttle between batches to avoid hitting the per-minute quota
        if i + _EMBED_BATCH_SIZE < len(texts):
            time.sleep(_EMBED_BATCH_DELAY)

    return all_embeddings


def embed_question(question: str) -> List[float]:
    try:
        return _embed_with_retry(embedding_model.embed_query, question)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Question embedding failed: {exc}") from exc


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


def _vector_search_unsupported(exc: BaseException) -> bool:
    if isinstance(exc, OperationFailure):
        if getattr(exc, "code", None) == 31082:
            return True
        details = getattr(exc, "details", None) or {}
        if isinstance(details, dict) and details.get("code") == 31082:
            return True
    msg = str(exc).lower()
    return (
        "searchnotenabled" in msg
        or "requires additional configuration" in msg
        or "index not found" in msg
        or "$vectorsearch" in msg
        or "no such index" in msg
        or "queryfailed" in msg
    )


def _retrieve_chunks_local(document_id: str, question_embedding: List[float], limit: int = 5) -> List[dict]:
    """Atlas $vectorSearch is unavailable on standalone mongod; rank in-process."""
    scored: List[dict] = []
    for doc in embeddings_collection.find(
        {"document_id": document_id},
        {"document_id": 1, "chunk_index": 1, "page": 1, "text": 1, "embedding": 1, "_id": 0},
    ):
        emb = doc.get("embedding")
        if not isinstance(emb, list) or not emb:
            continue
        scored.append(
            {
                "document_id": doc.get("document_id"),
                "chunk_index": doc.get("chunk_index"),
                "page": doc.get("page"),
                "text": doc.get("text", ""),
                "score": _cosine_similarity(question_embedding, emb),
            }
        )
    scored.sort(key=lambda row: row["score"], reverse=True)
    return scored[:limit]


def retrieve_chunks(document_id: str, question_embedding: List[float]) -> List[dict]:
    # MongoDB Atlas setup:
    # Create a Vector Search index on the "embeddings" collection.
    # Index field: "embedding", dimensions: 768, similarity: cosine.
    # Add "document_id" as a filter field so queries can isolate one PDF.
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": "embedding",
                "queryVector": question_embedding,
                "numCandidates": 100,
                "limit": 5,
                "filter": {"document_id": document_id},
            }
        },
        {
            "$project": {
                "_id": 0,
                "document_id": 1,
                "chunk_index": 1,
                "page": 1,
                "text": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    try:
        results = list(embeddings_collection.aggregate(pipeline))
        print(f"[retrieve] Vector search returned {len(results)} chunks for document {document_id}")
        return results
    except Exception as exc:
        print(f"[retrieve] $vectorSearch failed ({type(exc).__name__}): {exc}")
        if _vector_search_unsupported(exc):
            print("[retrieve] Falling back to local cosine similarity search")
            return _retrieve_chunks_local(document_id, question_embedding)
        raise HTTPException(status_code=502, detail=f"Vector search failed: {exc}") from exc


def generate_answer(context: str, question: str, history: list[dict] | None = None) -> str:
    recent_history = (history or [])[-10:]

    gemini_history = [
        {
            "role": "user" if msg["role"] == "user" else "model",
            "parts": [{"text": msg["content"]}],
        }
        for msg in recent_history
    ]

    chat = llm.start_chat(history=gemini_history)

    try:
        response = chat.send_message(f"Context:\n{context}\n\nQuestion: {question}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini generation failed: {exc}") from exc

    answer = getattr(response, "text", "").strip()
    return answer or "I could not find that in the document."


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/process")
def process_document(payload: ProcessRequest):
    segments = extract_document_segments(payload.file_path)

    if not segments:
        raise HTTPException(status_code=400, detail="No extractable text found in file")

    chunks = split_segments(segments)

    if not chunks:
        raise HTTPException(status_code=400, detail="No chunks could be created from this file")

    embeddings = embed_texts([chunk["text"] for chunk in chunks])

    records = [
        {
            "document_id": payload.document_id,
            "chunk_index": index,
            "page": chunk.get("page"),
            "text": chunk["text"],
            "embedding": embedding,
        }
        for index, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]

    try:
        embeddings_collection.delete_many({"document_id": payload.document_id})
        embeddings_collection.insert_many(records)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to store embeddings: {exc}") from exc

    return {"status": "success", "chunks_processed": len(records)}


_SNIPPET_MAX_CHARS = 220


def _make_snippet(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if len(cleaned) <= _SNIPPET_MAX_CHARS:
        return cleaned
    return cleaned[:_SNIPPET_MAX_CHARS].rsplit(" ", 1)[0] + "…"


@app.post("/query")
def query_document(payload: QueryRequest):
    question_embedding = embed_question(payload.question)
    chunks = retrieve_chunks(payload.document_id, question_embedding)

    if not chunks:
        return {"answer": "I could not find that in the document.", "citations": []}

    context_blocks = []
    citations = []
    for i, chunk in enumerate(chunks, start=1):
        page = chunk.get("page")
        location = f"page {page}" if page else "document"
        context_blocks.append(f"[Source {i}] ({location})\n{chunk['text']}")
        citations.append(
            {
                "index": i,
                "page": page,
                "chunk_index": chunk.get("chunk_index"),
                "snippet": _make_snippet(chunk["text"]),
                "score": float(chunk.get("score", 0.0)),
            }
        )

    context = "\n\n".join(context_blocks)
    answer = generate_answer(context, payload.question, payload.history)
    return {"answer": answer, "citations": citations}


@app.delete("/document")
def delete_document(payload: DeleteDocumentRequest):
    result = embeddings_collection.delete_many({"document_id": payload.document_id})
    return {"status": "success", "deleted_count": result.deleted_count}


# === Streaming query endpoint ============================================

def _sse(event: str, data: dict) -> str:
    """Format a Server-Sent Event frame."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _stream_answer(context: str, question: str, history: list[dict] | None = None):
    """Yield Gemini response tokens as they arrive using multi-turn chat."""
    recent_history = (history or [])[-10:]

    gemini_history = [
        {
            "role": "user" if msg["role"] == "user" else "model",
            "parts": [{"text": msg["content"]}],
        }
        for msg in recent_history
    ]

    chat = llm.start_chat(history=gemini_history)

    try:
        response = chat.send_message(
            f"Context:\n{context}\n\nQuestion: {question}",
            stream=True,
        )
        for chunk in response:
            text = getattr(chunk, "text", "") or ""
            if text:
                yield text
    except Exception as exc:
        yield f"\n[error] Gemini generation failed: {exc}"


@app.post("/query/stream")
def query_document_stream(payload: QueryRequest):
    """SSE endpoint: emits 'meta' (with citations), 'chunk' (text deltas), 'done'."""

    def event_stream():
        try:
            question_embedding = embed_question(payload.question)
        except HTTPException as exc:
            yield _sse("error", {"message": exc.detail})
            return

        chunks = retrieve_chunks(payload.document_id, question_embedding)

        if not chunks:
            yield _sse("meta", {"citations": []})
            yield _sse("chunk", {"text": "I could not find that in the document."})
            yield _sse("done", {"answer": "I could not find that in the document.", "citations": []})
            return

        context_blocks = []
        citations = []
        for i, chunk in enumerate(chunks, start=1):
            page = chunk.get("page")
            location = f"page {page}" if page else "document"
            context_blocks.append(f"[Source {i}] ({location})\n{chunk['text']}")
            citations.append(
                {
                    "index": i,
                    "page": page,
                    "chunk_index": chunk.get("chunk_index"),
                    "snippet": _make_snippet(chunk["text"]),
                    "score": float(chunk.get("score", 0.0)),
                }
            )

        # Send citations up-front so the UI can prepare the sources panel.
        yield _sse("meta", {"citations": citations})

        context = "\n\n".join(context_blocks)
        full_answer_parts: List[str] = []

        for token in _stream_answer(context, payload.question, payload.history):
            full_answer_parts.append(token)
            yield _sse("chunk", {"text": token})

        full_answer = "".join(full_answer_parts).strip() or "I could not find that in the document."
        yield _sse("done", {"answer": full_answer, "citations": citations})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable proxy buffering (nginx)
        },
    )


@app.get("/chunks/{document_id}")
def list_chunks(document_id: str):
    """Return all stored chunks (without embeddings) ordered by chunk_index.
    Used by the client preview pane to render non-PDF documents and highlight cited spans.
    """
    cursor = embeddings_collection.find(
        {"document_id": document_id},
        {"_id": 0, "chunk_index": 1, "page": 1, "text": 1},
    ).sort("chunk_index", 1)
    return {"chunks": list(cursor)}


# Separate model instance for summarisation — no system_instruction so citation
# markers from SYSTEM_INSTRUCTION don't bleed into the summary text.
_summarise_llm = genai.GenerativeModel(GEMINI_MODEL)


@app.post("/summarise")
def summarise_document(payload: SummariseRequest):
    """Generate a summary and suggested questions for a processed document."""
    cursor = embeddings_collection.find(
        {"document_id": payload.document_id},
        {"_id": 0, "chunk_index": 1, "text": 1},
    ).sort("chunk_index", 1).limit(payload.max_chunks)

    chunks = list(cursor)
    if not chunks:
        raise HTTPException(status_code=404, detail="No chunks found for this document")

    context = "\n\n".join(chunk["text"] for chunk in chunks)
    # Truncate to stay within token limits.
    context = context[:12000]

    prompt = (
        "Based on the following document content, provide:\n"
        "1. A concise summary in 3-4 sentences covering the main topic and key points\n"
        "2. Exactly 3 specific questions a user would find useful to ask about this document\n\n"
        "Format your response as valid JSON only, no markdown, no extra text:\n"
        '{"summary": "...", "questions": ["...", "...", "..."]}\n\n'
        f"Document content:\n{context}"
    )

    try:
        response = _summarise_llm.generate_content(prompt)
        raw = getattr(response, "text", "").strip()
        # Strip markdown code fences if Gemini wraps the JSON anyway.
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        result = json.loads(raw)
        summary = str(result.get("summary", "")).strip() or None
        questions = [str(q).strip() for q in result.get("questions", []) if str(q).strip()]
    except Exception as exc:
        print(f"[summarise] Failed to parse Gemini response: {exc}")
        summary = "Document processed successfully."
        questions = []

    return {"summary": summary, "questions": questions}
