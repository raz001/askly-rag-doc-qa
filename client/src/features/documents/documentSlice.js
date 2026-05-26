import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api, { getErrorMessage } from "../../api/axios.js";

const initialState = {
  items: [],
  loading: false,
  uploadLoading: false,
  deleteLoadingId: null,
  error: null,
};

export const fetchDocuments = createAsyncThunk("documents/fetch", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/api/documents");
    return data;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const uploadDocument = createAsyncThunk(
  "documents/upload",
  async ({ file, onUploadProgress }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data } = await api.post("/api/documents/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress,
      });

      return data.document;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const deleteDocument = createAsyncThunk("documents/delete", async (documentId, { rejectWithValue }) => {
  try {
    await api.delete(`/api/documents/${documentId}`);
    return documentId;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

const documentSlice = createSlice({
  name: "documents",
  initialState,
  reducers: {
    clearDocumentError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDocuments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(uploadDocument.pending, (state) => {
        state.uploadLoading = true;
        state.error = null;
      })
      .addCase(uploadDocument.fulfilled, (state, action) => {
        state.uploadLoading = false;
        state.items = [action.payload, ...state.items];
      })
      .addCase(uploadDocument.rejected, (state, action) => {
        state.uploadLoading = false;
        state.error = action.payload;
      })
      .addCase(deleteDocument.pending, (state, action) => {
        state.deleteLoadingId = action.meta.arg;
        state.error = null;
      })
      .addCase(deleteDocument.fulfilled, (state, action) => {
        state.deleteLoadingId = null;
        state.items = state.items.filter((document) => document._id !== action.payload);
      })
      .addCase(deleteDocument.rejected, (state, action) => {
        state.deleteLoadingId = null;
        state.error = action.payload;
      });
  },
});

export const { clearDocumentError } = documentSlice.actions;

export default documentSlice.reducer;
