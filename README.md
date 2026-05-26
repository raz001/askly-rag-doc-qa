# Askly — Document Q&A

> Chat with your documents. Grounded answers, every time.

Askly is a full-stack **Retrieval-Augmented Generation (RAG)** app that lets you upload documents, index them with vector embeddings, and ask questions with inline citations that link back to the exact source passage.

---

## Features

- **Multi-format ingestion** — PDF, Markdown, CSV/TSV, JSON, HTML, XML, plain text
- **Streaming answers** — tokens render as they arrive via Server-Sent Events; stop or regenerate anytime
- **Inline citations** — every answer cites `[1]`, `[2]` … click a chip to jump to the source page or chunk in the preview pane
- **Document preview pane** — side-by-side PDF rendering or text chunk view with citation-jump highlighting
- **Multi-turn conversation memory** — follow-up questions like "tell me more about that" work because the last 5 exchanges are passed to Gemini as chat history
- **Auto-generated summary & suggested questions** — generated automatically after processing; shown in the library card and chat header
- **Account management** — update profile, change password, delete account (cascades all data)
- **Dark mode** — follows OS preference, persisted to `localStorage`, toggle in the navbar
- **Responsive** — works on desktop, tablet, and mobile

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Redux Toolkit, Framer Motion, Lucide React, CSS Modules |
| Backend API | Node.js, Express, Mongoose, JWT, Multer |
| AI Service | Python, FastAPI, LangChain, PyMuPDF |
| LLM | Google Gemini `gemini-2.5-flash` |
| Embeddings | Google Generative AI `gemini-embedding-001` (768 dimensions) |
| Vector Store | MongoDB Atlas Vector Search (cosine similarity) |
| Database | MongoDB Atlas |

---

## Project Structure

```
askly/
├── client/          # React + Vite frontend
├── server/          # Node.js + Express API
└── ai_service/      # Python FastAPI RAG service
```

---

## Prerequisites

- Node.js 18+
- Python 3.11+
- A [MongoDB Atlas](https://cloud.mongodb.com) cluster (free tier works)
- A [Google AI Studio](https://aistudio.google.com) API key

---

## Environment Setup

### `server/.env`

```env
PORT=5001
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/askly?appName=Cluster0
JWT_SECRET=<random-64-char-hex>
FASTAPI_URL=http://localhost:8000
```

### `ai_service/.env`

```env
GEMINI_API_KEY=<your-google-ai-studio-key>
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/askly?appName=Cluster0
MONGO_DB_NAME=askly
VECTOR_INDEX_NAME=embedding_vector_index
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_OUTPUT_DIMENSIONALITY=768
```

### `client/.env`

```env
VITE_API_BASE_URL=http://localhost:5001
```

---

## MongoDB Atlas — Vector Search Index

Create a **Vector Search** index on the `embeddings` collection in your Atlas cluster:

**Index name:** `embedding_vector_index`

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "document_id"
    }
  ]
}
```

> Without this index the app falls back to in-process cosine similarity (slower, works on any MongoDB).

---

## Installation

```bash
# 1. Backend API
cd server
npm install

# 2. Frontend
cd ../client
npm install

# 3. AI service
cd ../ai_service
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

---

## Running Locally

Open three terminals:

```bash
# Terminal 1 — Node API
cd server && npm run dev

# Terminal 2 — FastAPI AI service
cd ai_service && uvicorn main:app --reload

# Terminal 3 — React client
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## How It Works

```
Upload → /process → chunk + embed → MongoDB Atlas
                                          ↓
Question → embed question → $vectorSearch → top-5 chunks
                                          ↓
                              Gemini chat (with history)
                                          ↓
                              Streaming answer + citations
```

1. **Register / sign in** at the landing page
2. **Upload** a document from the library — the API saves the file, creates a `Document` record, and calls FastAPI `/process` in the background
3. FastAPI extracts text (format-specific), splits into 1 000-char chunks, embeds each with Gemini, and stores vectors in Atlas
4. After embedding, `/summarise` auto-generates a 3–4 sentence summary and 3 suggested questions stored on the document
5. The dashboard polls every 3 s until status is `ready`
6. **Open chat** — questions are embedded, the top-5 chunks are retrieved via Atlas `$vectorSearch`, and Gemini answers with the last 5 conversation turns as context
7. Answers stream token-by-token with inline `[N]` citation chips; click a chip to jump to the source in the preview pane

---

## Supported Upload Formats

| Type | Extensions |
|---|---|
| PDF | `.pdf` |
| Markdown / text | `.md` `.markdown` `.mdx` `.txt` |
| Tabular | `.csv` `.tsv` |
| JSON | `.json` |
| Markup | `.html` `.htm` `.xml` |

Max file size: **10 MB**

---

## API Reference

### Auth — `POST /api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Create account |
| POST | `/login` | — | Sign in, returns JWT |
| GET | `/me` | ✓ | Current user + usage stats |
| PATCH | `/me` | ✓ | Update display name |
| POST | `/change-password` | ✓ | Change password |
| DELETE | `/me` | ✓ | Delete account (cascades all data) |

### Documents — `POST /api/documents`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/upload` | ✓ | Upload a document (field: `file`) |
| GET | `/` | ✓ | List all documents |
| GET | `/:id/file` | ✓ | Stream the original file (preview pane) |
| GET | `/:id/chunks` | ✓ | List stored text chunks |
| DELETE | `/:id` | ✓ | Delete document + embeddings + chat history |

### Chat — `/api/chat`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | ✓ | Ask a question (non-streaming) |
| POST | `/stream` | ✓ | Ask a question (SSE streaming) |
| GET | `/:documentId` | ✓ | Fetch chat history |

### FastAPI (internal)

| Method | Path | Description |
|---|---|---|
| POST | `/process` | Extract, chunk, and embed a document |
| POST | `/query` | Retrieve chunks + generate answer |
| POST | `/query/stream` | Streaming version of `/query` |
| POST | `/summarise` | Generate summary + suggested questions |
| GET | `/chunks/:document_id` | List stored chunks |
| DELETE | `/document` | Delete all embeddings for a document |

---

## Troubleshooting

**Gemini 429 RESOURCE_EXHAUSTED**
The free tier allows 100 embedding requests/min. The app handles this automatically with exponential backoff and batched embedding (20 chunks per call, 15 s between batches). Large documents will take longer — this is expected.

**"I could not find that in the document"**
The Atlas Vector Search index may not be active yet. Check the Atlas UI — the index status must be **Active** before queries work. It can take 1–2 minutes after creation.

**`ModuleNotFoundError: No module named 'langchain_text_splitters'`**
Run `pip install -r requirements.txt` again — `langchain-text-splitters` is a separate package from `langchain` since v0.2.

**Document stuck on "Processing"**
The FastAPI service may not be running or unreachable. Check that `uvicorn main:app --reload` is running and `FASTAPI_URL` in `server/.env` points to it.