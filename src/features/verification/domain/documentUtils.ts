/**
 * Utility functions for KYC document formatting, byte-size calculation,
 * and detection of empty or minimal placeholder document stubs.
 */

/**
 * Accurately formats document file size into a human-readable string.
 * Ensures non-zero byte files (such as 193 B or 328 B stubs) are never
 * deceptively rounded down to "0 KB".
 *
 * @param bytes - Size in bytes from backend document metadata.
 * @returns Formatted size string (e.g. "193 B", "145.2 KB", "1.50 MB", "0 B (Empty)")
 */
export function formatDocumentSize(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) {
    return '';
  }

  if (bytes === 0) {
    return '0 B (Empty)';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }

  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

/**
 * Checks whether a document file size represents a minimal structural stub
 * (typically a minimal PDF skeleton of < 500 bytes with no content streams,
 * which renders as a blank white page).
 */
export function isSuspiciousMinimalDocument(bytes?: number | null): boolean {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) {
    return false;
  }
  return bytes > 0 && bytes < 500;
}

/**
 * Checks whether a document is completely empty (0 bytes).
 */
export function isEmptyDocument(bytes?: number | null): boolean {
  return bytes === 0;
}

