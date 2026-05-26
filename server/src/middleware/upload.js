import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import multer from "multer";
import { isAllowedUploadFile, UPLOAD_TYPE_ERROR_MESSAGE } from "../constants/uploadFormats.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../../uploads");

// Ensure the uploads directory exists (Render ephemeral filesystem needs this on cold start).
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (isAllowedUploadFile(file)) {
    cb(null, true);
    return;
  }
  cb(new Error(UPLOAD_TYPE_ERROR_MESSAGE));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export default upload;
