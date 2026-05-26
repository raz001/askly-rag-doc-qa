import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Document as PdfDocument, Page as PdfPage, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import api, { getErrorMessage } from "../api/axios.js";
import styles from "../styles/App.module.css";

// Pin pdf.js worker to the version bundled with react-pdf 10.x.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// Cache of object URLs so we don't re-download the file on every preview event.
function useDocumentBlobUrl(documentId, isPdf) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!documentId || !isPdf) {
      setUrl(null);
      return undefined;
    }
    let active = true;
    let createdUrl = null;
    setError(null);
    (async () => {
      try {
        const response = await api.get(`/api/documents/${documentId}/file`, {
          responseType: "blob",
        });
        if (!active) return;
        createdUrl = URL.createObjectURL(response.data);
        setUrl(createdUrl);
      } catch (err) {
        if (!active) return;
        setError(getErrorMessage(err));
      }
    })();
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [documentId, isPdf]);

  return { url, error };
}

function useDocumentChunks(documentId, isText) {
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!documentId || !isText) {
      setChunks([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get(`/api/documents/${documentId}/chunks`)
      .then(({ data }) => {
        if (!active) return;
        setChunks(Array.isArray(data?.chunks) ? data.chunks : []);
      })
      .catch((err) => {
        if (!active) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [documentId, isText]);

  return { chunks, loading, error };
}

// Observe the rendered width of an element and return it (debounced via rAF).
function useContainerWidth(ref) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const target = ref.current;
    const update = () => setWidth(target.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(target);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

function PdfPreview({ url, focusPage, focusKey }) {
  const [numPages, setNumPages] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const containerRef = useRef(null);
  const pageRefs = useRef(new Map());
  const [highlightPage, setHighlightPage] = useState(null);

  // PDF pages render at the available column width minus padding, with a sensible cap
  // so they don't get absurdly large on ultra-wide screens.
  const containerWidth = useContainerWidth(containerRef);
  const pageWidth = containerWidth ? Math.min(containerWidth - 32, 900) : 0;

  // react-pdf 10 requires an options object that's stable across renders.
  const pdfOptions = useMemo(
    () => ({
      cMapUrl: "https://unpkg.com/pdfjs-dist@5.4.296/cmaps/",
      cMapPacked: true,
    }),
    []
  );

  useEffect(() => {
    if (!focusPage) return;
    const node = pageRefs.current.get(focusPage);
    if (node && containerRef.current) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlightPage(focusPage);
      const timer = window.setTimeout(() => setHighlightPage(null), 1800);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [focusPage, focusKey, numPages]);

  if (loadError) {
    return <p className={styles.previewError}>Could not load PDF: {loadError}</p>;
  }

  return (
    <div className={styles.pdfScroller} ref={containerRef}>
      <PdfDocument
        file={url}
        options={pdfOptions}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        onLoadError={(err) => setLoadError(err.message || "PDF failed to load")}
        loading={<p className={styles.previewMuted}>Loading PDF…</p>}
      >
        {numPages && pageWidth > 0 &&
          Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
            <div
              key={page}
              ref={(node) => {
                if (node) pageRefs.current.set(page, node);
                else pageRefs.current.delete(page);
              }}
              className={`${styles.pdfPageWrapper} ${highlightPage === page ? styles.pdfPageHighlight : ""}`}
            >
              <div className={styles.pdfPageLabel}>Page {page}</div>
              <PdfPage
                pageNumber={page}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                width={pageWidth}
              />
            </div>
          ))}
      </PdfDocument>
    </div>
  );
}

function TextPreview({ chunks, loading, error, focusChunk, focusKey }) {
  const containerRef = useRef(null);
  const chunkRefs = useRef(new Map());
  const [highlightChunk, setHighlightChunk] = useState(null);

  useEffect(() => {
    if (focusChunk == null) return;
    const node = chunkRefs.current.get(focusChunk);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightChunk(focusChunk);
      const timer = window.setTimeout(() => setHighlightChunk(null), 1800);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [focusChunk, focusKey]);

  if (loading) return <p className={styles.previewMuted}>Loading document…</p>;
  if (error) return <p className={styles.previewError}>{error}</p>;
  if (!chunks.length) return <p className={styles.previewMuted}>No preview available.</p>;

  return (
    <div className={styles.textPreview} ref={containerRef}>
      {chunks.map((chunk) => (
        <div
          key={chunk.chunk_index}
          ref={(node) => {
            if (node) chunkRefs.current.set(chunk.chunk_index, node);
            else chunkRefs.current.delete(chunk.chunk_index);
          }}
          className={`${styles.textChunk} ${
            highlightChunk === chunk.chunk_index ? styles.textChunkHighlight : ""
          }`}
        >
          <div className={styles.textChunkLabel}>
            Chunk {chunk.chunk_index + 1}
            {chunk.page ? ` · Page ${chunk.page}` : ""}
          </div>
          <p>{chunk.text}</p>
        </div>
      ))}
    </div>
  );
}

function PreviewPane({ document, focusTarget }) {
  const isPdf = document?.originalName?.toLowerCase().endsWith(".pdf");
  const { url, error: fileError } = useDocumentBlobUrl(document?._id, isPdf);
  const { chunks, loading: chunksLoading, error: chunksError } = useDocumentChunks(
    document?._id,
    !isPdf
  );

  if (!document) {
    return (
      <aside className={styles.previewPane}>
        <header className={styles.previewHeader}>
          <h2>Source preview</h2>
        </header>
        <p className={styles.previewMuted}>Loading document…</p>
      </aside>
    );
  }

  return (
    <aside className={styles.previewPane} aria-label="Document preview">
      <header className={styles.previewHeader}>
        <h2>{document.originalName}</h2>
        <p className={styles.previewSub}>
          {isPdf
            ? "Click a citation to jump to its page"
            : "Click a citation to highlight its source chunk"}
        </p>
      </header>
      <div className={styles.previewBody}>
        {isPdf ? (
          fileError ? (
            <p className={styles.previewError}>{fileError}</p>
          ) : url ? (
            <PdfPreview url={url} focusPage={focusTarget?.page} focusKey={focusTarget?.key} />
          ) : (
            <p className={styles.previewMuted}>Loading PDF…</p>
          )
        ) : (
          <TextPreview
            chunks={chunks}
            loading={chunksLoading}
            error={chunksError}
            focusChunk={focusTarget?.chunkIndex}
            focusKey={focusTarget?.key}
          />
        )}
      </div>
    </aside>
  );
}

export default PreviewPane;
