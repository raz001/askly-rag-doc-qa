import { Fragment, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Square, RotateCcw, Copy, Check, User, Bot } from "lucide-react";
import styles from "../styles/App.module.css";

// Splits a string on [N] markers and returns an array of text fragments + chip elements.
function injectCitationChips(text, citations, onCitationClick) {
  if (!citations?.length || typeof text !== "string") {
    return [text];
  }
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, idx) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return <Fragment key={idx}>{part}</Fragment>;
    const refIndex = Number(match[1]);
    const citation = citations.find((c) => c.index === refIndex);
    if (!citation) return <Fragment key={idx}>{part}</Fragment>;
    return (
      <button
        key={idx}
        type="button"
        className={styles.citationChip}
        onClick={() => onCitationClick?.(refIndex)}
        aria-label={`Source ${refIndex}${citation.page ? `, page ${citation.page}` : ""}`}
      >
        {refIndex}
      </button>
    );
  });
}

// Walks react-markdown's children array, replacing [N] markers inside text nodes.
function processChildren(children, citations, onCitationClick) {
  if (!citations?.length) return children;
  return Array.isArray(children)
    ? children.flatMap((child, i) =>
        typeof child === "string"
          ? injectCitationChips(child, citations, onCitationClick).map((node, j) => (
              <Fragment key={`${i}-${j}`}>{node}</Fragment>
            ))
          : [<Fragment key={i}>{child}</Fragment>]
      )
    : typeof children === "string"
      ? injectCitationChips(children, citations, onCitationClick)
      : children;
}

function MessageBubble({ message, onStop, onRegenerate, canRegenerate, onFocusCitation }) {
  const isUser = message.role === "user";
  const label = isUser ? "You" : "Assistant";
  const citations = useMemo(() => message.citations || [], [message.citations]);
  const [showSources, setShowSources] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCitationClick = (index) => {
    setShowSources(true);
    setHighlightIndex(index);
    const citation = citations.find((c) => c.index === index);
    if (citation && onFocusCitation) {
      onFocusCitation(citation);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  // Markdown component overrides — every child-rendering element runs its kids through citation injection.
  const mdComponents = useMemo(() => {
    const wrap = (Tag) => (props) => {
      // eslint-disable-next-line react/prop-types
      const { children, ...rest } = props;
      return <Tag {...rest}>{processChildren(children, citations, handleCitationClick)}</Tag>;
    };
    return {
      p: wrap("p"),
      li: wrap("li"),
      strong: wrap("strong"),
      em: wrap("em"),
      h1: wrap("h1"),
      h2: wrap("h2"),
      h3: wrap("h3"),
      h4: wrap("h4"),
      td: wrap("td"),
      th: wrap("th"),
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {processChildren(children, citations, handleCitationClick)}
        </a>
      ),
      code: ({ inline, children, ...rest }) => (
        <code className={inline ? styles.inlineCode : styles.codeBlock} {...rest}>
          {children}
        </code>
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citations]);

  return (
    <div className={`${styles.messageRow} ${isUser ? styles.messageRowUser : ""}`}>
      <div className={styles.messageBlock}>
        <div className={`${styles.messageAvatar} ${isUser ? styles.avatarUser : styles.avatarAssistant}`} aria-hidden="true">
          {isUser ? <User size={14} strokeWidth={2} /> : <Bot size={14} strokeWidth={2} />}
        </div>
        <div className={styles.messageContent}>
          <span className={styles.messageLabel}>{label}</span>
          <div className={`${styles.messageBubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
            {isUser ? (
              <span>{message.content}</span>
            ) : (
              <div className={styles.markdownBody}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {message.content || ""}
                </ReactMarkdown>
              </div>
            )}
            {message.streaming && <span className={styles.streamingCursor} aria-hidden="true">▍</span>}
            {!isUser && !message.streaming && message.content && (
              <button
                type="button"
                className={`${styles.copyCorner} ${copied ? styles.copyCornerSuccess : ""}`}
                onClick={handleCopy}
                aria-label={copied ? "Copied" : "Copy answer"}
                title={copied ? "Copied" : "Copy answer"}
              >
                {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.7} />}
              </button>
            )}
          </div>

          {!isUser && (
            <div className={styles.messageToolbar}>
              {message.streaming ? (
                onStop && (
                  <button type="button" className={styles.iconActionButton} onClick={onStop} aria-label="Stop generating">
                    <Square size={14} strokeWidth={2} />
                    Stop
                  </button>
                )
              ) : (
                canRegenerate && onRegenerate && (
                  <button
                    type="button"
                    className={styles.iconActionButton}
                    onClick={onRegenerate}
                    aria-label="Regenerate answer"
                  >
                    <RotateCcw size={14} strokeWidth={1.7} />
                    Regenerate
                  </button>
                )
              )}
            </div>
          )}

          {!isUser && citations.length > 0 && (
            <div className={styles.sourcesContainer}>
              <button
                type="button"
                className={styles.sourcesToggle}
                onClick={() => setShowSources((prev) => !prev)}
                aria-expanded={showSources}
              >
                {showSources ? "Hide sources" : `Show ${citations.length} source${citations.length > 1 ? "s" : ""}`}
              </button>
              {showSources && (
                <ol className={styles.sourceList}>
                  {citations.map((citation) => (
                    <li
                      key={citation.index}
                      className={`${styles.sourceItem} ${
                        highlightIndex === citation.index ? styles.sourceItemActive : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={styles.sourceItemButton}
                        onClick={() => handleCitationClick(citation.index)}
                      >
                        <div className={styles.sourceMeta}>
                          <span className={styles.sourceIndex}>[{citation.index}]</span>
                          {citation.page ? (
                            <span className={styles.sourcePage}>Page {citation.page}</span>
                          ) : (
                            <span className={styles.sourcePage}>Document</span>
                          )}
                          {typeof citation.score === "number" && citation.score > 0 && (
                            <span className={styles.sourceScore}>
                              {(citation.score * 100).toFixed(1)}% match
                            </span>
                          )}
                        </div>
                        <p className={styles.sourceSnippet}>{citation.snippet}</p>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageBubble;
