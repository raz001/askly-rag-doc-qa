import path from "path";

/** Lowercase extensions (with dot) allowed for RAG uploads. */
export const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".pdf",
  ".md",
  ".markdown",
  ".mdx",
  ".txt",
  ".csv",
  ".tsv",
  ".json",
  ".html",
  ".htm",
  ".xml",
]);

/** MIME types we accept (extension is authoritative; octet-stream allowed when ext matches). */
export const ALLOWED_UPLOAD_MIMETYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "text/csv",
  "text/tab-separated-values",
  "application/csv",
  "application/json",
  "text/html",
  "application/xhtml+xml",
  "application/xml",
  "text/xml",
  "application/vnd.ms-excel",
  "text/comma-separated-values",
]);
export function isAllowedUploadFile(file) {
  if (!file?.originalname) {
    return false;
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
    return false;
  }
  if (!file.mimetype) {
    return true;
  }
  return ALLOWED_UPLOAD_MIMETYPES.has(file.mimetype);
}

export const UPLOAD_TYPE_ERROR_MESSAGE =
  "Unsupported file type. Allowed: PDF, Markdown (.md), plain text (.txt), CSV/TSV, JSON, HTML, XML — max 10MB.";
