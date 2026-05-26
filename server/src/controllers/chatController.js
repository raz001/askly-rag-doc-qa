import axios from "axios";
import ChatMessage from "../models/ChatMessage.js";
import Document from "../models/Document.js";
import asyncHandler from "../middleware/asyncHandler.js";

const fastApiClient = axios.create({
  baseURL: process.env.FASTAPI_URL || "http://localhost:8000",
  timeout: 120000,
});

const fastApiBaseUrl = process.env.FASTAPI_URL || "http://localhost:8000";

const getFastApiMessage = (error) => {
  return error.response?.data?.detail || error.response?.data?.message || error.message || "AI service request failed";
};

const writeSse = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const askQuestion = asyncHandler(async (req, res) => {
  const { documentId, question } = req.body;

  if (!documentId || !question?.trim()) {
    res.status(400);
    throw new Error("Document id and question are required");
  }

  const document = await Document.findOne({
    _id: documentId,
    userId: req.user._id,
  });

  if (!document) {
    res.status(404);
    throw new Error("Document not found");
  }

  if (document.status !== "ready") {
    res.status(409);
    throw new Error("Document is not ready for chat");
  }

  // Fetch the last 10 messages (5 exchanges) for conversation memory.
  // Exclude the current question — it's sent as the new message, not part of history.
  const recentMessages = await ChatMessage.find({
    documentId: document._id,
    userId: req.user._id,
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const history = recentMessages
    .reverse()
    .map((msg) => ({ role: msg.role, content: msg.content }));

  let answer;
  let citations = [];

  try {
    const { data } = await fastApiClient.post("/query", {
      document_id: document._id.toString(),
      question: question.trim(),
      history,
    });
    answer = data.answer;
    citations = Array.isArray(data.citations) ? data.citations : [];
  } catch (error) {
    res.status(502);
    throw new Error(getFastApiMessage(error));
  }

  const messages = await ChatMessage.insertMany([
    {
      userId: req.user._id,
      documentId: document._id,
      role: "user",
      content: question.trim(),
    },
    {
      userId: req.user._id,
      documentId: document._id,
      role: "assistant",
      content: answer,
      citations,
    },
  ]);

  res.json({
    answer,
    citations,
    messages,
  });
});

const getChatHistory = asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.documentId,
    userId: req.user._id,
  });

  if (!document) {
    res.status(404);
    throw new Error("Document not found");
  }

  const messages = await ChatMessage.find({
    documentId: document._id,
    userId: req.user._id,
  }).sort({ createdAt: 1 });

  res.json(messages);
});

const askQuestionStream = asyncHandler(async (req, res) => {
  const { documentId, question } = req.body;

  if (!documentId || !question?.trim()) {
    res.status(400);
    throw new Error("Document id and question are required");
  }

  const document = await Document.findOne({
    _id: documentId,
    userId: req.user._id,
  });

  if (!document) {
    res.status(404);
    throw new Error("Document not found");
  }

  if (document.status !== "ready") {
    res.status(409);
    throw new Error("Document is not ready for chat");
  }

  // Persist user message immediately so it's saved even if the client drops mid-stream.
  const userMessage = await ChatMessage.create({
    userId: req.user._id,
    documentId: document._id,
    role: "user",
    content: question.trim(),
  });

  // Fetch history AFTER saving the user message so the current question is NOT in history —
  // it's being sent as the new message. Limit to 10 messages (5 exchanges).
  const recentMessages = await ChatMessage.find({
    documentId: document._id,
    userId: req.user._id,
    _id: { $ne: userMessage._id }, // exclude the message we just created
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const history = recentMessages
    .reverse()
    .map((msg) => ({ role: msg.role, content: msg.content }));

  // Set up SSE response.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  writeSse(res, "user", userMessage);

  let upstream;
  try {
    upstream = await axios.post(
      `${fastApiBaseUrl}/query/stream`,
      {
        document_id: document._id.toString(),
        question: question.trim(),
        history,
      },
      {
        responseType: "stream",
        timeout: 120000,
        headers: { Accept: "text/event-stream" },
      }
    );
  } catch (error) {
    writeSse(res, "error", { message: getFastApiMessage(error) });
    res.end();
    return;
  }

  let buffer = "";
  let finalAnswer = "";
  let finalCitations = [];

  // Re-emit upstream SSE frames to the browser, while collecting the final answer + citations
  // from the 'done' event so we can persist the assistant message at the end.
  upstream.data.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    res.write(text);
    buffer += text;

    // SSE frames are separated by blank lines.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";
    for (const frame of frames) {
      const eventMatch = frame.match(/^event:\s*(\S+)/m);
      const dataMatch = frame.match(/^data:\s*(.+)$/m);
      if (!eventMatch || !dataMatch) continue;
      const eventName = eventMatch[1];
      let data;
      try {
        data = JSON.parse(dataMatch[1]);
      } catch {
        continue;
      }
      if (eventName === "done") {
        finalAnswer = data.answer || "";
        finalCitations = Array.isArray(data.citations) ? data.citations : [];
      }
    }
  });

  upstream.data.on("end", async () => {
    try {
      const assistantMessage = await ChatMessage.create({
        userId: req.user._id,
        documentId: document._id,
        role: "assistant",
        content: finalAnswer || "I could not find that in the document.",
        citations: finalCitations,
      });
      writeSse(res, "assistant", assistantMessage);
    } catch (saveError) {
      console.error("Failed to persist assistant message:", saveError.message);
      writeSse(res, "error", { message: "Failed to save assistant message" });
    }
    res.end();
  });

  upstream.data.on("error", (error) => {
    console.error("Upstream stream error:", error.message);
    writeSse(res, "error", { message: error.message });
    res.end();
  });

  // If the client disconnects, cancel the upstream stream so we don't keep consuming Gemini quota.
  req.on("close", () => {
    upstream.data.destroy?.();
  });
});

export { askQuestion, askQuestionStream, getChatHistory };
