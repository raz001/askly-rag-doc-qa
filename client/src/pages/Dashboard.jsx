import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { Search, FilePlus2, FileSearch } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import DocumentCard from "../components/DocumentCard.jsx";
import Navbar from "../components/Navbar.jsx";
import UploadModal from "../components/UploadModal.jsx";
import { deleteDocument, fetchDocuments, uploadDocument } from "../features/documents/documentSlice.js";
import styles from "../styles/App.module.css";

function EmptyLibraryIcon() {
  return <FilePlus2 size={28} strokeWidth={1.6} aria-hidden="true" />;
}

function Dashboard() {
  const dispatch = useDispatch();
  const { items, loading, uploadLoading, deleteLoadingId, error } = useSelector((state) => state.documents);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmDoc, setConfirmDoc] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | ready | processing | failed

  // Track which docs we've already toasted about so we don't fire repeatedly while polling.
  const notifiedDocsRef = useRef(new Set());

  useEffect(() => {
    dispatch(fetchDocuments());
  }, [dispatch]);

  useEffect(() => {
    if (!items.some((document) => document.status === "processing")) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      dispatch(fetchDocuments());
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [dispatch, items]);

  // Surface processing transitions as toasts.
  useEffect(() => {
    items.forEach((document) => {
      if (document.status !== "ready" && document.status !== "failed") return;
      const key = `${document._id}:${document.status}`;
      if (notifiedDocsRef.current.has(key)) return;
      // Only notify if we previously saw a different status — skip first-load.
      const opposite = `${document._id}:${document.status === "ready" ? "failed" : "ready"}`;
      const seenAny = [...notifiedDocsRef.current].some((entry) => entry.startsWith(`${document._id}:`));
      const wasProcessing = !seenAny;
      notifiedDocsRef.current.add(key);
      notifiedDocsRef.current.delete(opposite);
      if (!wasProcessing) {
        // Subsequent state change.
        if (document.status === "ready") {
          toast.success(`${document.originalName} is ready to chat`);
        } else if (document.status === "failed") {
          toast.error(`${document.originalName} failed to process`);
        }
      }
    });
  }, [items]);

  const handleUpload = async (file, onUploadProgress) => {
    const result = await dispatch(uploadDocument({ file, onUploadProgress }));

    if (uploadDocument.fulfilled.match(result)) {
      setUploadOpen(false);
      toast.success(`${file.name} uploaded — indexing now`);
    } else if (uploadDocument.rejected.match(result)) {
      toast.error(result.payload || "Upload failed");
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDoc) return;
    const docToDelete = confirmDoc;
    const result = await dispatch(deleteDocument(docToDelete._id));
    setConfirmDoc(null);
    if (deleteDocument.fulfilled.match(result)) {
      toast.success(`Deleted ${docToDelete.originalName}`);
    } else if (deleteDocument.rejected.match(result)) {
      toast.error(result.payload || "Could not delete document");
    }
  };

  const readyCount = items.filter((d) => d.status === "ready").length;
  const processingCount = items.filter((d) => d.status === "processing").length;
  const failedCount = items.filter((d) => d.status === "failed").length;

  const filteredItems = items.filter((doc) => {
    if (statusFilter !== "all" && doc.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      return doc.originalName?.toLowerCase().includes(searchQuery.trim().toLowerCase());
    }
    return true;
  });

  return (
    <div className={styles.appShell}>
      <Navbar />
      <main className={styles.page} id="main-content">
        <div className={styles.pageHeader}>
          <div>
            <h1>Document library</h1>
            <p>
              Upload PDFs, Markdown, CSV, JSON, HTML, and other text-based files for semantic indexing, then ask
              grounded questions powered by retrieval-augmented generation.
            </p>
          </div>
          <div className={styles.pageHeaderActions}>
            <button className={styles.primaryButton} type="button" onClick={() => setUploadOpen(true)}>
              Upload document
            </button>
          </div>
        </div>

        {!loading || items.length > 0 ? (
          <div className={styles.statsRow} aria-live="polite">
            <div className={styles.statCard}>
              <div>
                <div className={styles.statValue}>{items.length}</div>
                <div className={styles.statLabel}>Documents</div>
              </div>
            </div>
            <div className={styles.statCard}>
              <div>
                <div className={styles.statValue}>{readyCount}</div>
                <div className={styles.statLabel}>Ready to chat</div>
              </div>
            </div>
            {processingCount > 0 && (
              <div className={styles.statCard}>
                <div>
                  <div className={styles.statValue}>{processingCount}</div>
                  <div className={styles.statLabel}>Processing</div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {error && (
          <p className={styles.errorBanner} role="alert">
            {error}
          </p>
        )}

        {loading && items.length === 0 ? (
          <div className={styles.skeletonGrid} aria-busy="true" aria-label="Loading documents">
            {[1, 2, 3].map((key) => (
              <div key={key} className={styles.documentSkeleton} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>
              <EmptyLibraryIcon />
            </div>
            <h2 className={styles.emptyStateTitle}>No documents yet</h2>
            <span>
              Upload a supported file to extract text, build embeddings, and start a grounded Q&amp;A session.
            </span>
            <button className={styles.primaryButton} type="button" onClick={() => setUploadOpen(true)}>
              Upload your first document
            </button>
          </div>
        ) : (
          <>
            <div className={styles.libraryToolbar}>
              <div className={styles.searchInputWrapper}>
                <Search className={styles.searchIcon} size={16} strokeWidth={2} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search documents…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                  aria-label="Search documents"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className={styles.searchClear}
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className={styles.filterChips} role="tablist" aria-label="Filter by status">
                {[
                  { key: "all", label: "All", count: items.length },
                  { key: "ready", label: "Ready", count: readyCount },
                  { key: "processing", label: "Processing", count: processingCount },
                  { key: "failed", label: "Failed", count: failedCount },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === option.key}
                    className={`${styles.filterChip} ${
                      statusFilter === option.key ? styles.filterChipActive : ""
                    }`}
                    onClick={() => setStatusFilter(option.key)}
                  >
                    {option.label}
                    <span className={styles.filterChipCount}>{option.count}</span>
                  </button>
                ))}
              </div>
            </div>
            {filteredItems.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>
                  <FileSearch size={28} strokeWidth={1.6} />
                </div>
                <h2 className={styles.emptyStateTitle}>No matches</h2>
                <span>
                  No documents match{" "}
                  {searchQuery ? `"${searchQuery}"` : "the selected filter"}.
                </span>
              </div>
            ) : (
              <div className={styles.documentGrid}>
                {filteredItems.map((document, index) => (
                  <DocumentCard
                    key={document._id}
                    index={index}
                    document={document}
                    deleteLoading={deleteLoadingId === document._id}
                    onDelete={() => setConfirmDoc(document)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <UploadModal
        open={uploadOpen}
        loading={uploadLoading}
        onClose={() => setUploadOpen(false)}
        onUpload={handleUpload}
      />
      <ConfirmDialog
        open={!!confirmDoc}
        title="Delete this document?"
        description={
          confirmDoc
            ? `"${confirmDoc.originalName}" and all its chat history will be permanently removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        loading={deleteLoadingId === confirmDoc?._id}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDoc(null)}
      />
    </div>
  );
}

export default Dashboard;
