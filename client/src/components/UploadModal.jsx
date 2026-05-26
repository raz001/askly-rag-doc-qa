import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud } from "lucide-react";
import { isAllowedUploadFile, UPLOAD_ACCEPT } from "../constants/uploadFormats.js";
import styles from "../styles/App.module.css";

function UploadModal({ open, onClose, onUpload, loading }) {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKey = (event) => {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) {
    return null;
  }

  const selectFile = (selectedFile) => {
    if (isAllowedUploadFile(selectedFile)) {
      setFile(selectedFile);
      setProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      return;
    }

    await onUpload(file, (event) => {
      if (event.total) {
        setProgress(Math.round((event.loaded * 100) / event.total));
      }
    });
    setFile(null);
    setProgress(0);
  };

  const handleBackdropClick = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={handleBackdropClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-title"
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="upload-title">Upload document</h2>
                <p className={styles.modalDescription}>Text is extracted, chunked, and embedded for semantic search.</p>
              </div>
              <button
                className={styles.iconButton}
                type="button"
                onClick={onClose}
                disabled={loading}
                aria-label="Close upload dialog"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <label
              className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                selectFile(event.dataTransfer.files?.[0]);
              }}
            >
              <input type="file" accept={UPLOAD_ACCEPT} onChange={(event) => selectFile(event.target.files?.[0])} />
              <UploadCloud size={32} strokeWidth={1.5} className={styles.dropZoneIcon} />
              <span>{file ? file.name : "Drop a file here or click to browse"}</span>
              <small>
                PDF, Markdown, CSV/TSV, JSON, HTML, XML, plain text · max 10MB
              </small>
            </label>
            {loading && (
              <div className={styles.progressTrack} aria-label="Upload progress">
                <div className={styles.progressBar} style={{ width: `${progress}%` }} />
              </div>
            )}
            <div className={styles.modalActions}>
              <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button className={styles.primaryButton} type="button" disabled={!file || loading} onClick={handleUpload}>
                {loading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default UploadModal;
