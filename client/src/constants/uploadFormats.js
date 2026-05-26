/** Browser file input `accept` attribute. */
export const UPLOAD_ACCEPT =
  ".pdf,.md,.markdown,.mdx,.txt,.csv,.tsv,.json,.html,.htm,.xml,application/pdf,text/plain,text/markdown,text/csv,application/json,text/html";

const EXT_RE = /\.(pdf|md|markdown|mdx|txt|csv|tsv|json|html|htm|xml)$/i;

export function isAllowedUploadFile(file) {
  if (!file?.name) {
    return false;
  }
  return EXT_RE.test(file.name);
}
