import axios from "axios";
import fs from "fs/promises";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import ChatMessage from "../models/ChatMessage.js";
import Document from "../models/Document.js";
import User from "../models/User.js";
import asyncHandler from "../middleware/asyncHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../../uploads");

const fastApiClient = axios.create({
  baseURL: process.env.FASTAPI_URL || "http://localhost:8000",
  timeout: 60000,
});

const signToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const serializeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
});

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Name, email, and password are required");
  }

  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    res.status(409);
    throw new Error("Email is already registered");
  }

  const user = await User.create({ name, email, password });

  res.status(201).json({
    user: serializeUser(user),
    token: signToken(user._id),
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  const user = await User.findOne({ email });

  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  res.json({
    user: serializeUser(user),
    token: signToken(user._id),
  });
});

// GET /api/auth/me — current user with usage stats.
const getMe = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [documentCount, readyCount, messageCount] = await Promise.all([
    Document.countDocuments({ userId }),
    Document.countDocuments({ userId, status: "ready" }),
    ChatMessage.countDocuments({ userId }),
  ]);

  res.json({
    user: serializeUser(req.user),
    stats: {
      documents: documentCount,
      readyDocuments: readyCount,
      messages: messageCount,
    },
  });
});

// PATCH /api/auth/me — update profile (name only for now).
const updateMe = asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (typeof name !== "string" || !name.trim()) {
    res.status(400);
    throw new Error("Name is required");
  }

  if (name.trim().length > 80) {
    res.status(400);
    throw new Error("Name is too long");
  }

  req.user.name = name.trim();
  await req.user.save();

  res.json({ user: serializeUser(req.user) });
});

// POST /api/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error("Current and new password are required");
  }

  if (newPassword.length < 6) {
    res.status(400);
    throw new Error("New password must be at least 6 characters");
  }

  // We need to refetch with the password field included since auth middleware strips it.
  const user = await User.findById(req.user._id);
  if (!user || !(await user.comparePassword(currentPassword))) {
    res.status(401);
    throw new Error("Current password is incorrect");
  }

  user.password = newPassword;
  await user.save();

  res.json({ message: "Password updated" });
});

// DELETE /api/auth/me — delete user and cascade everything they own.
const deleteMe = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // 1. Find all documents to clean up files + remote embeddings.
  const documents = await Document.find({ userId });

  // 2. Tell the AI service to drop each document's embeddings (best effort).
  await Promise.allSettled(
    documents.map((doc) =>
      fastApiClient.delete("/document", {
        data: { document_id: doc._id.toString() },
      })
    )
  );

  // 3. Unlink uploaded files (best effort).
  await Promise.allSettled(
    documents.map(async (doc) => {
      const filePath = path.join(uploadsDir, doc.filename);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.error(`Failed to delete file ${filePath}:`, err.message);
        }
      }
    })
  );

  // 4. Delete database records.
  await Promise.all([
    ChatMessage.deleteMany({ userId }),
    Document.deleteMany({ userId }),
    User.deleteOne({ _id: userId }),
  ]);

  res.json({ message: "Account deleted" });
});

export { changePassword, deleteMe, getMe, login, register, updateMe };
