import styles from "../styles/App.module.css";

// Map of extension → { label, color, icon }. Icons render as a colored badge with the
// 2-3 letter format label and a small page-corner glyph.
const TYPE_MAP = {
  pdf: { label: "PDF", tone: "red" },
  md: { label: "MD", tone: "blue" },
  markdown: { label: "MD", tone: "blue" },
  mdx: { label: "MDX", tone: "blue" },
  txt: { label: "TXT", tone: "slate" },
  csv: { label: "CSV", tone: "green" },
  tsv: { label: "TSV", tone: "green" },
  json: { label: "JSON", tone: "amber" },
  html: { label: "HTML", tone: "orange" },
  htm: { label: "HTML", tone: "orange" },
  xml: { label: "XML", tone: "orange" },
};

const DEFAULT_TYPE = { label: "DOC", tone: "slate" };

function getType(filename) {
  if (!filename) return DEFAULT_TYPE;
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!match) return DEFAULT_TYPE;
  return TYPE_MAP[match[1]] || DEFAULT_TYPE;
}

function FileTypeIcon({ filename, size = "md" }) {
  const type = getType(filename);
  const sizeClass = size === "sm" ? styles.fileIconSm : styles.fileIconMd;
  return (
    <div
      className={`${styles.fileIcon} ${sizeClass} ${styles[`fileIcon_${type.tone}`]}`}
      aria-hidden="true"
    >
      {/* Page-corner-fold glyph behind the label */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={styles.fileIconBg}
        aria-hidden="true"
      >
        <path
          d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          opacity="0.45"
        />
        <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.4" opacity="0.45" />
      </svg>
      <span className={styles.fileIconLabel}>{type.label}</span>
    </div>
  );
}

export default FileTypeIcon;
