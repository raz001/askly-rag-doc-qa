import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ChevronLeft } from "lucide-react";
import ChatInput from "../components/ChatInput.jsx";
import ChatWindow from "../components/ChatWindow.jsx";
import Navbar from "../components/Navbar.jsx";
import PreviewPane from "../components/PreviewPane.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import {
  abortActiveStream,
  clearChat,
  fetchChatHistory,
  sendQuestionStreaming,
} from "../features/chat/chatSlice.js";
import { fetchDocuments } from "../features/documents/documentSlice.js";
import styles from "../styles/App.module.css";

function ChatPage() {
  const { documentId } = useParams();
  const dispatch = useDispatch();
  const { messages, loading, historyLoading, error } = useSelector((state) => state.chat);
  const documents = useSelector((state) => state.documents.items);
  const document = documents.find((item) => item._id === documentId);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  // focusTarget = { page?, chunkIndex?, key } where `key` changes on every click so the
  // preview pane re-fires the scroll-to effect even if the same page/chunk is clicked twice.
  const [focusTarget, setFocusTarget] = useState(null);

  // Surface chat errors as toasts (in addition to the inline banner).
  const lastErrorRef = useRef(null);
  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      toast.error(error);
    }
    if (!error) lastErrorRef.current = null;
  }, [error]);

  useEffect(() => {
    dispatch(fetchDocuments());
    dispatch(fetchChatHistory(documentId));

    return () => {
      dispatch(clearChat());
    };
  }, [dispatch, documentId]);

  const chatDisabled = loading || document?.status !== "ready";

  const handleSend = (question) => {
    dispatch(sendQuestionStreaming({ documentId, question }));
  };

  const handlePickSuggestion = (question) => {
    if (chatDisabled) return;
    dispatch(sendQuestionStreaming({ documentId, question }));
  };

  const handleStop = () => {
    abortActiveStream();
  };

  const handleRegenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    dispatch(sendQuestionStreaming({ documentId, question: lastUser.content }));
  };

  const handleFocusCitation = (citation) => {
    if (!citation) return;
    setPreviewVisible(true);
    setFocusTarget({
      page: citation.page ?? null,
      chunkIndex: citation.chunk_index ?? null,
      key: Date.now(),
    });
  };

  let statusHint = "";
  if (document?.status === "processing") {
    statusHint = "Indexing in progress — chat unlocks when this document is ready.";
  } else if (document?.status === "failed") {
    statusHint = "Processing failed for this file. Try uploading again or check server logs.";
  } else if (!document) {
    statusHint = "Loading document details…";
  }

  return (
    <div className={styles.appShell}>
      <Navbar />
      <main
        className={`${styles.page} ${styles.chatPage} ${previewVisible ? styles.chatPageWide : ""}`}
        id="main-content"
      >
        <header className={styles.chatHeader}>
          <div className={styles.chatHeaderTop}>
            <Link to="/dashboard" className={styles.backButton}>
              <ChevronLeft size={18} strokeWidth={2} />
              Library
            </Link>
            <div className={styles.chatTitleBlock}>
              <h1>{document?.originalName || "Document"}</h1>
              {document && <StatusBadge status={document.status} />}
              {statusHint ? <p className={styles.chatSubtitle}>{statusHint}</p> : null}
              {!statusHint && document?.summary && (
                <div className={styles.chatHeaderSummaryWrapper}>
                  <p className={`${styles.chatHeaderSummary} ${summaryExpanded ? styles.chatHeaderSummaryExpanded : ""}`}>
                    {document.summary}
                  </p>
                  <button
                    type="button"
                    className={styles.chatHeaderSummaryToggle}
                    onClick={() => setSummaryExpanded((prev) => !prev)}
                    aria-expanded={summaryExpanded}
                  >
                    {summaryExpanded ? "Show less" : "Show more"}
                  </button>
                </div>
              )}
            </div>
            <div className={styles.chatHeaderActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setPreviewVisible((prev) => !prev)}
              >
                {previewVisible ? "Hide preview" : "Show preview"}
              </button>
            </div>
          </div>
        </header>

        {error && (
          <p className={styles.errorBanner} role="alert">
            {error}
          </p>
        )}

        <div className={`${styles.chatLayout} ${previewVisible ? styles.chatLayoutSplit : ""}`}>
          <div className={styles.chatColumn}>
            <ChatWindow
              messages={messages}
              loading={loading}
              historyLoading={historyLoading}
              onStop={handleStop}
              onRegenerate={handleRegenerate}
              onFocusCitation={handleFocusCitation}
              onPickSuggestion={chatDisabled ? undefined : handlePickSuggestion}
              suggestedQuestions={document?.suggestedQuestions ?? []}
            />
            <ChatInput onSend={handleSend} disabled={chatDisabled} />
          </div>
          {previewVisible && document && (
            <div className={styles.previewColumn}>
              <PreviewPane document={document} focusTarget={focusTarget} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ChatPage;
