import express from "express";
import {
  changePassword,
  deleteMe,
  getMe,
  login,
  register,
  updateMe,
} from "../controllers/authController.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

// Protected — current user management
router.get("/me", auth, getMe);
router.patch("/me", auth, updateMe);
router.post("/change-password", auth, changePassword);
router.delete("/me", auth, deleteMe);

export default router;
