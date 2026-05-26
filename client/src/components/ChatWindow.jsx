import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bot, MessageSquareText, Plus, ChevronDown } from "lucide-react";
import MessageBubble from "./MessageBubble.jsx";
import styles from "../styles/App.module.css";

function ChatIllustration() {
  return <MessageSquareText size={28} strokeWidth={1.6} aria-hidden="true" />;
}

const SUGGESTED_QUESTIONS = [
  "Summarize this document in a few bullet points",
  "What are the key insights or takeaways?",
  "Are there any important dates, numbers, or names mentioned?",
  "What questions does this document leave unanswered?",
];

const NEAR_BOTTOM_THRESHOLD = 80;

function ChatWindow({
  messages,
  loading,
  historyLoading,
  onStop,
  onRegenerate,
  onFocusCitation,
  onPickSuggestion,
  suggestedQuestions = [],
}) {
  const scrollerRef = useRef(null);
  const bottomRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const [showJumpButton, setShowJumpButton] = useState(false);

  const measureAtBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return true;
    // If the content fits with no overflow, treat as "at bottom" so the button doesn't appear.
    if (el.scrollHeight <= el.clientHeight + 1) return true;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance <= NEAR_BOTTOM_THRESHOLD;
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      const atBottom = measureAtBottom();
      isAtBottomRef.current = atBottom;
      setShowJumpButton(!atBottom);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [measureAtBottom]);

  // Re-evaluate visibility when content changes (a long answer might suddenly need it).
  useEffect(() => {
    const atBottom = measureAtBottom();
    isAtBottomRef.current = atBottom;
    setShowJumpButton(!atBottom);
  }, [messages, loading, measureAtBottom]);

  useLayoutEffect(() => {
    if (!isAtBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  if (historyLoading) {
    return (
      <section className={styles.chatWindow} aria-busy="true" aria-label="Loading messages">
        <div className={styles.skeletonMessageRow}>
          <div className={styles.skeletonAvatar} />
          <div className={styles.skeletonBubbleColumn}>
            <div className={`${styles.skeletonBubble} ${styles.skeletonBubbleShort}`} />
          </div>
        </div>
        <div className={`${styles.skeletonMessageRow} ${styles.skeletonMessageRowAssistant}`}>
          <div className={styles.skeletonAvatar} />
          <div className={styles.skeletonBubbleColumn}>
            <div className={styles.skeletonBubble} />
            <div className={`${styles.skeletonBubble} ${styles.skeletonBubbleMedium}`} />
          </div>
        </div>
        <div className={styles.skeletonMessageRow}>
          <div className={styles.skeletonAvatar} />
          <div className={styles.skeletonBubbleColumn}>
            <div className={`${styles.skeletonBubble} ${styles.skeletonBubbleMedium}`} />
          </div>
        </div>
        <div className={`${styles.skeletonMessageRow} ${styles.skeletonMessageRowAssistant}`}>
          <div className={styles.skeletonAvatar} />
          <div className={styles.skeletonBubbleColumn}>
            <div className={styles.skeletonBubble} />
            <div className={styles.skeletonBubble} />
            <div className={`${styles.skeletonBubble} ${styles.skeletonBubbleShort}`} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className={styles.chatWindowWrapper}>
      <section className={styles.chatWindow} aria-label="Chat messages" ref={scrollerRef}>
        {messages.length === 0 && (
          <div className={styles.chatEmptyState}>
            <div className={styles.chatEmptyIcon}>
              <ChatIllustration />
            </div>
            <h2 className={styles.chatEmptyTitle}>Ask anything about this document</h2>

            {onPickSuggestion && (
              <div className={styles.chatSuggestionsSection}>
                <span className={styles.chatSuggestionsLabel}>Suggested questions</span>
                <ul className={styles.suggestedList} aria-label="Suggested questions">
                  {(suggestedQuestions.length > 0 ? suggestedQuestions : SUGGESTED_QUESTIONS).map((question) => (
                    <li key={question}>
                      <button
                        type="button"
                        className={styles.suggestedChip}
                        onClick={() => onPickSuggestion(question)}
                      >
                        <Plus size={14} strokeWidth={2} />
                        {question}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {messages.map((message, idx) => {
          const isLastAssistant =
            message.role === "assistant" && idx === messages.length - 1 && !message.streaming;
          return (
            <MessageBubble
              key={message._id}
              message={message}
              onStop={message.streaming ? onStop : undefined}
              onRegenerate={isLastAssistant ? onRegenerate : undefined}
              canRegenerate={isLastAssistant && !loading}
              onFocusCitation={onFocusCitation}
            />
          );
        })}
        {loading && !messages.some((m) => m.streaming) && (
          <div className={styles.typingRow} aria-live="polite" aria-busy="true">
            <div className={`${styles.messageAvatar} ${styles.avatarAssistant}`} aria-hidden="true">
              <Bot size={14} strokeWidth={2} />
            </div>
            <div className={styles.typingBubble}>
              <span className={styles.visuallyHidden}>Assistant is typing</span>
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </section>
      {showJumpButton && (
        <button
          type="button"
          className={styles.jumpToLatest}
          onClick={scrollToBottom}
          aria-label="Scroll to latest message"
          title="Scroll to latest"
        >
          <ChevronDown size={18} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

export default ChatWindow;
