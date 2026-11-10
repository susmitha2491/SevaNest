/**
 * Safe client-side storage management for SevaNest session restoration.
 *
 * Tab-Scoped Session Policy:
 * - Refresh tokens are persisted exclusively in window.sessionStorage to support session
 *   restoration across page reloads (F5 / browser refresh) within the active browser tab.
 * - Closing the browser tab terminates that tab's session because sessionStorage is automatically
 *   discarded by the browser upon tab closure.
 * - Opening a new browser tab starts with an empty sessionStorage, preventing session leakage
 *   or unauthorized resurrection of closed sessions.
 * - Stale/legacy localStorage tokens are actively purged to prevent any cross-tab restoration.
 * - Sensitive access tokens and user passwords are NEVER stored in browser storage.
 * - Storage operations gracefully handle private browsing, quotas, and disabled storage.
 */

const REFRESH_TOKEN_KEY = 'sevanest_refresh_token';

/**
 * Purges any legacy or accidental refresh tokens in localStorage so they cannot
 * survive tab closures or leak across browsing contexts.
 */
const purgeLegacyLocalStorage = (): void => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Gracefully handle storage access exceptions (private browsing / disabled storage)
  }
};

export const getStoredRefreshToken = (): string | null => {
  try {
    purgeLegacyLocalStorage();
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredRefreshToken = (token: string | null | undefined): void => {
  try {
    purgeLegacyLocalStorage();
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    if (token) {
      window.sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // Gracefully handle storage quota or private browsing exceptions
  }
};

export const clearStoredRefreshToken = (): void => {
  try {
    purgeLegacyLocalStorage();
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Gracefully handle storage quota or private browsing exceptions
  }
};
