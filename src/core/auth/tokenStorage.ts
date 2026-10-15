/**
 * Safe client-side storage management for SevaNest session restoration.
 *
 * Security Policy:
 * - Refresh tokens are persisted exclusively to support session restoration across page refreshes.
 * - Sensitive access tokens and user passwords are NEVER stored in browser storage.
 * - Storage operations gracefully handle private browsing, quotas, and disabled cookies.
 */

const REFRESH_TOKEN_KEY = 'sevanest_refresh_token';

export const getStoredRefreshToken = (): string | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredRefreshToken = (token: string | null | undefined): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (token) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Gracefully handle storage quota or private browsing exceptions
  }
};

export const clearStoredRefreshToken = (): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Gracefully handle storage quota or private browsing exceptions
  }
};
