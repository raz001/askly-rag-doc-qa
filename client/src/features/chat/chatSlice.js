import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api, { getErrorMessage } from "../../api/axios.js";

const initialState = {
  messages: [],
  loading: false,
  historyLoading: false,
  streamingId: null,
  error: null,
};

export const fetchChatHistory = createAsyncThunk("chat/history", async (documentId, { rejectWithValue }) => {
  try {
    const { data } = await api.get(`/api/chat/${documentId}`);
    return data;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

// Non-streaming fallback (kept for compatibility / tests).
export const sendQuestion = createAsyncThunk("chat/send", async ({ documentId, question }, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/api/chat", { documentId, question });
    return data.messages;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// Module-level abort controller for the active stream so we can cancel from UI.
let activeStreamController = null;

export function abortActiveStream() {
  if (activeStreamController) {
    activeStreamController.abort();
    activeStreamController = null;
  }
}

// Parses an SSE buffer and returns [parsedFrames, leftoverBuffer].
function parseSseBuffer(buffer) {
  const frames = [];
  const parts = buffer.split("\n\n");
  const leftover = parts.pop() || "";
  for (const raw of parts) {
    const eventMatch = raw.match(/^event:\s*(\S+)/m);
    const dataMatch = raw.match(/^data:\s*(.+)$/m);
    if (!eventMatch || !dataMatch) continue;
    try {
      frames.push({ event: eventMatch[1], data: JSON.parse(dataMatch[1]) });
    } catch {
      // skip malformed frame
    }
  }
  return [frames, leftover];
}

/**
 * Streaming question thunk. Dispatches incremental updates as tokens arrive.
 * Lifecycle:
 *   - pending: pushes optimistic user + empty assistant placeholder
 *   - chat/streamToken: appends a delta to the assistant placeholder
 *   - chat/streamMeta: attaches citations to the assistant placeholder
 *   - fulfilled: replaces placeholder pair with the persisted DB messages
 *   - rejected: removes the placeholder pair
 */
export const sendQuestionStreaming = createAsyncThunk(
  "chat/sendStream",
  async ({ documentId, question }, { dispatch, rejectWithValue }) => {
    const placeholderId = `streaming-${Date.now()}`;
    dispatch(chatSlice.actions._beginStream({ placeholderId, question }));

    const controller = new AbortController();
    activeStreamController = controller;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${baseUrl}/api/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ documentId, question }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "");
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }
        throw new Error(parsed?.message || text || `Request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let userMessage = null;
      let assistantMessage = null;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const [frames, leftover] = parseSseBuffer(buffer);
        buffer = leftover;

        for (const { event, data } of frames) {
          switch (event) {
            case "user":
              userMessage = data;
              break;
            case "meta":
              dispatch(chatSlice.actions._streamMeta({ placeholderId, citations: data.citations || [] }));
              break;
            case "chunk":
              if (data.text) {
                dispatch(chatSlice.actions._streamToken({ placeholderId, delta: data.text }));
              }
              break;
            case "assistant":
              assistantMessage = data;
              break;
            case "error":
              throw new Error(data.message || "Streaming error");
            default:
              break;
          }
        }
      }

      activeStreamController = null;
      return { placeholderId, userMessage, assistantMessage };
    } catch (error) {
      activeStreamController = null;
      // User-initiated abort: keep whatever we streamed, don't show as error.
      if (error.name === "AbortError" || controller.signal.aborted) {
        dispatch(chatSlice.actions._finalizeStreamPartial({ placeholderId }));
        return { placeholderId, userMessage: null, assistantMessage: null, aborted: true };
      }
      dispatch(chatSlice.actions._removeStreamPair({ placeholderId }));
      return rejectWithValue(error.message || "Streaming failed");
    }
  }
);

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    clearChat(state) {
      state.messages = [];
      state.error = null;
      state.streamingId = null;
    },
    clearChatError(state) {
      state.error = null;
    },
    _beginStream(state, action) {
      const { placeholderId, question } = action.payload;
      state.loading = true;
      state.streamingId = placeholderId;
      state.error = null;
      state.messages.push({
        _id: `${placeholderId}-user`,
        role: "user",
        content: question,
        createdAt: new Date().toISOString(),
      });
      state.messages.push({
        _id: placeholderId,
        role: "assistant",
        content: "",
        citations: [],
        streaming: true,
        createdAt: new Date().toISOString(),
      });
    },
    _streamToken(state, action) {
      const { placeholderId, delta } = action.payload;
      const message = state.messages.find((m) => m._id === placeholderId);
      if (message) {
        message.content += delta;
      }
    },
    _streamMeta(state, action) {
      const { placeholderId, citations } = action.payload;
      const message = state.messages.find((m) => m._id === placeholderId);
      if (message) {
        message.citations = citations;
      }
    },
    _removeStreamPair(state, action) {
      const { placeholderId } = action.payload;
      state.messages = state.messages.filter(
        (m) => m._id !== placeholderId && m._id !== `${placeholderId}-user`
      );
      state.loading = false;
      state.streamingId = null;
    },
    _finalizeStreamPartial(state, action) {
      // User aborted mid-stream — keep the partial answer but stop the cursor + loading state.
      const { placeholderId } = action.payload;
      const message = state.messages.find((m) => m._id === placeholderId);
      if (message) {
        message.streaming = false;
        if (!message.content?.trim()) {
          message.content = "_(stopped)_";
        }
      }
      state.loading = false;
      state.streamingId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChatHistory.pending, (state) => {
        state.historyLoading = true;
        state.error = null;
      })
      .addCase(fetchChatHistory.fulfilled, (state, action) => {
        state.historyLoading = false;
        state.messages = action.payload;
      })
      .addCase(fetchChatHistory.rejected, (state, action) => {
        state.historyLoading = false;
        state.error = action.payload;
      })
      // Non-streaming fallback (legacy)
      .addCase(sendQuestion.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.messages.push({
          _id: `optimistic-${Date.now()}`,
          role: "user",
          content: action.meta.arg.question,
          createdAt: new Date().toISOString(),
        });
      })
      .addCase(sendQuestion.fulfilled, (state, action) => {
        state.loading = false;
        state.messages = [
          ...state.messages.filter((message) => !message._id.startsWith?.("optimistic-")),
          ...action.payload,
        ];
      })
      .addCase(sendQuestion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.messages = state.messages.filter((message) => !message._id.startsWith?.("optimistic-"));
      })
      // Streaming
      .addCase(sendQuestionStreaming.fulfilled, (state, action) => {
        const { placeholderId, userMessage, assistantMessage, aborted } = action.payload;
        state.loading = false;
        state.streamingId = null;
        if (aborted) {
          // _finalizeStreamPartial already updated the placeholder; nothing else to do.
          return;
        }
        state.messages = state.messages.filter(
          (m) => m._id !== placeholderId && m._id !== `${placeholderId}-user`
        );
        if (userMessage) state.messages.push(userMessage);
        if (assistantMessage) state.messages.push(assistantMessage);
      })
      .addCase(sendQuestionStreaming.rejected, (state, action) => {
        state.loading = false;
        state.streamingId = null;
        state.error = action.payload;
      });
  },
});

export const { clearChat, clearChatError } = chatSlice.actions;

export default chatSlice.reducer;
