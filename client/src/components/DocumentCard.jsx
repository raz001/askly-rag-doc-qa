import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import FileTypeIcon from "./FileTypeIcon.jsx";
import StatusBadge from "./StatusBadge.jsx";
import styles from "../styles/App.module.css";

function DocumentCard({ document, deleteLoading, onDelete, index = 0 }) {
  const uploadedAt = document.uploadedAt || document.createdAt;

  return (
    <motion.article
      className={styles.documentCard}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.25), ease: [0.16, 1, 0.3, 1] }}
      layout
    >
      <div className={styles.documentMeta}>
        <div>
          <div className={styles.documentCardIcon}>
            <FileTypeIcon filename={document.originalName} />
          </div>
          <div>
            <h2>{document.originalName}</h2>
            <p>{uploadedAt ? new Date(uploadedAt).toLocaleString() : "Just now"}</p>
            {document.status === "ready" && document.summary && (
              <p className={styles.documentSummary}>{document.summary}</p>
            )}
          </div>
        </div>
        <StatusBadge status={document.status} />
      </div>
      <div className={styles.cardActions}>
        <Link
          className={`${styles.primaryButton} ${document.status !== "ready" ? styles.disabledLink : ""}`}
          to={`/chat/${document._id}`}
          aria-disabled={document.status !== "ready"}
          onClick={(event) => {
            if (document.status !== "ready") {
              event.preventDefault();
            }
          }}
        >
          Open chat
        </Link>
        <button
          className={styles.dangerButton}
          type="button"
          disabled={deleteLoading}
          onClick={() => onDelete(document._id)}
        >
          {deleteLoading ? "Removing…" : "Delete"}
        </button>
      </div>
    </motion.article>
  );
}

export default DocumentCard;
