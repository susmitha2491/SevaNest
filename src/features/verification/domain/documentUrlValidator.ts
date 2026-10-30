import { ServerFailureError } from '../../../core/errors/DomainError';

/**
 * Validates signed document URLs returned from the secure document vault.
 *
 * Rules:
 * - Must be a valid, parseable URL string.
 * - In production and general environments, HTTPS is strictly enforced.
 * - HTTP is permitted only for documented local-development loopback hosts (localhost, 127.0.0.1, [::1]).
 * - Non-HTTP(S) schemes (javascript:, data:, vbscript:, file:, ftp:, etc.) are rejected.
 * - Does not log sensitive URL contents, query tokens, or PII.
 */
export function validateDocumentSignedUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    throw new ServerFailureError('Authorized signed document URL is missing or empty.');
  }

  const trimmed = rawUrl.trim();

  let parsed: InstanceType<typeof globalThis.URL>;
  try {
    if (trimmed.startsWith('/')) {
      const base =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'http://localhost';
      parsed = new globalThis.URL(trimmed, base);
    } else {
      parsed = new globalThis.URL(trimmed);
    }
  } catch {
    throw new ServerFailureError('Authorized signed document URL returned by vault is malformed.');
  }

  const protocol = parsed.protocol.toLowerCase();

  if (protocol === 'https:') {
    return parsed.toString();
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocalDevHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost');

  if (protocol === 'http:' && isLocalDevHost) {
    return parsed.toString();
  }

  throw new ServerFailureError(
    `Insecure or unsupported document URL protocol "${protocol}". Only HTTPS (or local development HTTP) is permitted.`
  );
}

/**
 * Safe boolean check for UI components before opening or linking to a URL.
 */
export function isSafeDocumentUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    validateDocumentSignedUrl(url);
    return true;
  } catch {
    return false;
  }
}
