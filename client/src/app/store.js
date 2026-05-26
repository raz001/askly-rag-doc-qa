import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice.js";
import chatReducer from "../features/chat/chatSlice.js";
import documentReducer from "../features/documents/documentSlice.js";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    documents: documentReducer,
    chat: chatReducer,
  },
});
