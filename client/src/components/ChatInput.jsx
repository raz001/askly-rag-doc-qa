import { useState } from "react";
import styles from "../styles/App.module.css";

function ChatInput({ onSend, disabled }) {
  const [question, setQuestion] = useState("");

  const submit = (event) => {
    event.preventDefault();

    if (!question.trim() || disabled) {
      return;
    }

    onSend(question.trim());
    setQuestion("");
  };

  return (
    <form className={styles.chatInputBar} onSubmit={submit}>
      <label htmlFor="chat-question" className={styles.visuallyHidden}>
        Your question about the document
      </label>
      <input
        id="chat-question"
        name="question"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder={disabled ? "Waiting for document to be ready…" : "Ask a question about this document…"}
        disabled={disabled}
        autoComplete="off"
        aria-describedby="chat-input-hint"
      />
      <span id="chat-input-hint" className={styles.visuallyHidden}>
        Press Enter or use the send button to submit.
      </span>
      <button className={styles.primaryButton} type="submit" disabled={disabled || !question.trim()}>
        Send
      </button>
    </form>
  );
}

export default ChatInput;
