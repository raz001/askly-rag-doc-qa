import express from "express";
import { askQuestion, askQuestionStream, getChatHistory } from "../controllers/chatController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.use(auth);

router.post("/", askQuestion);
router.post("/stream", askQuestionStream);
router.get("/:documentId", getChatHistory);

export default router;
