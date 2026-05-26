import axios from "axios";
import fs from "fs";
import fsp from "fs/promises";
import mime from "mime-types";
import path from "path";
import { fileURLToPath } from "url";
import ChatMessage from "../models/ChatMessage.js";
import Document from "../models/Document.js";
import asyncHandler from "../middleware/asyncHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../../uploads");

const fastApiClient = axios.create({
  baseURL: process.env.FASTAPI_URL || "http://localhost:8000",
  timeout: 120000,
});

const getFastApiMessage = (error) => {
  return error.response?.data?.detail || error.response?.data?.message || error.message || "AI service request failed";
};

const processDocumentInBackground = async (documentId, filePath) => {
  try {
    await fastApiClient.post("/process", {
      file_path: filePath,
      document_id: documentId.toString(),
    });

    // Generate summary and suggested questions now that embeddings are ready.
    try {
      const { data: summaryData } = await fastApiClient.post("/summarise", {
        document_id: documentId.toString(),
      });
      await Document.findByIdAndUpdate(documentId, {
        status: "ready",
        summary: summaryData.summary || null,
        suggestedQuestions: Array.isArray(summaryData.questions)
          ? summaryData.questions
          : [],
      });
    } catch (summaryError) {
      console.error(
        `Summary generation failed for document ${documentId}:`,
        summaryError.message
      );
      // Still mark as ready even if summary fails.
      await Document.findByIdAndUpdate(documentId, { status: "ready" });
    }
  } catch (error) {
    console.error(`Document processing failed for document ${documentId}:`, getFastApiMessage(error));
    await Document.findByIdAndUpdate(documentId, { status: "failed" });
  }
};

const uploadDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("A supported document file is required");
  }

  const document = await Document.create({
    userId: req.user._id,
    filename: req.file.filename,
    originalName: req.file.originalname,
    status: "processing",
  });

  processDocumentInBackground(document._id, req.file.path);

  res.status(202).json({
    documentId: document._id,
    document,
  });
});

const getDocuments = asyncHandler(async (req, res) => {
  const documents = await Document.find({ userId: req.user._id }).sort({ uploadedAt: -1 });
  res.json(documents);
});

// Stream the original uploaded file back to the owner. Used by the preview pane.
const getDocumentFile = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!document) {
    res.status(404);
    throw new Error("Document not found");
  }

  // Resolve safely under uploadsDir to defend against any future filename tampering.
  const resolved = path.resolve(uploadsDir, document.filename);
  if (!resolved.startsWith(path.resolve(uploadsDir) + path.sep)) {
    res.status(400);
    throw new Error("Invalid document path");
  }

  try {
    await fsp.access(resolved);
  } catch {
    res.status(404);
    throw new Error("File missing on disk");
  }

  const contentType = mime.lookup(resolved) || "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(document.originalName)}"`);
  res.setHeader("Cache-Control", "private, max-age=300");
  fs.createReadStream(resolved).pipe(res);
});

// Proxy the AI service's chunk listing for non-PDF preview rendering.
const getDocumentChunks = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!document) {
    res.status(404);
    throw new Error("Document not found");
  }

  try {
    const { data } = await fastApiClient.get(`/chunks/${document._id.toString()}`);
    res.json(data);
  } catch (error) {
    res.status(502);
    throw new Error(getFastApiMessage(error));
  }
});

const deleteDocument = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!document) {
    res.status(404);
    throw new Error("Document not found");
  }

  try {
    await fastApiClient.delete("/document", {
      data: { document_id: document._id.toString() },
    });
  } catch (error) {
    console.error(`Embedding cleanup failed for document ${document._id}:`, getFastApiMessage(error));
  }

  await ChatMessage.deleteMany({ documentId: document._id, userId: req.user._id });
  await document.deleteOne();

  const filePath = path.join(uploadsDir, document.filename);
  try {
    await fsp.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(`Unable to delete uploaded file ${filePath}:`, error.message);
    }
  }

  res.json({ message: "Document deleted" });
});

export { deleteDocument, getDocumentChunks, getDocumentFile, getDocuments, uploadDocument };
