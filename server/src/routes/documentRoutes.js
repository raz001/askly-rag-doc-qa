import express from "express";
import {
  deleteDocument,
  getDocumentChunks,
  getDocumentFile,
  getDocuments,
  uploadDocument,
} from "../controllers/documentController.js";
import auth from "../middleware/auth.js";
import upload from "../middleware/upload.js";

const router = express.Router();

router.use(auth);

router.post("/upload", upload.single("file"), uploadDocument);
router.get("/", getDocuments);
router.get("/:id/file", getDocumentFile);
router.get("/:id/chunks", getDocumentChunks);
router.delete("/:id", deleteDocument);

export default router;
