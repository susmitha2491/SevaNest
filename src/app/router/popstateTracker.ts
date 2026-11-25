import { useAuthStore } from '../../core/auth/authStore';
import { getStoredRefreshToken } from '../../core/auth/tokenStorage';
import { queryClient } from '../../core/api/queryClient';
import { invalidateSessionOnServer } from '../../features/auth/data/authRepository';

// Global popstate / history traversal tracker
let isPopStateActive = false;
let popStateResetTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Validates that unauthenticated users traversing browser history
 * are prevented from restoring protected views or sensitive cached data.
 */
export function handleSecurityNavigationCheck(): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  const isPublic = path.startsWith('/auth');
  const hasToken = Boolean(getStoredRefreshToken());
  const isAuth = useAuthStore.getState().isAuthenticated;

  // If attempting to access a protected path via history without an active session or stored token
  if (!isPublic && !hasToken && !isAuth) {
    try {
      queryClient.cancelQueries();
      queryClient.clear();
    } catch {
      // Ignore query client exceptions
    }
    useAuthStore.getState().clearSession(false);
    try {
      if (import.meta.env.MODE !== 'test' && typeof window.location.replace === 'function') {
        window.location.replace('/auth/login');
      }
    } catch {
      // Graceful fallback for non-browser/test environments
    }
  }
}

if (typeof window !== 'undefined') {
  // 1. Back-Forward Cache (bfcache) trapping on pageshow
  window.addEventListener('pageshow', (event) => {
    const hasToken = Boolean(getStoredRefreshToken());
    const path = window.location.pathname;
    const isPublic = path.startsWith('/auth');

    if (event.persisted) {
      // Page restored from browser bfcache
      if (!hasToken && !isPublic) {
        try {
          queryClient.cancelQueries();
          queryClient.clear();
        } catch {
          // Ignore
        }
        useAuthStore.getState().clearSession(false);
        try {
          if (import.meta.env.MODE !== 'test' && typeof window.location.replace === 'function') {
            window.location.replace('/auth/login');
          }
        } catch {
          // Graceful fallback for non-browser/test environments
        }
      } else if (hasToken) {
        try {
          queryClient.invalidateQueries();
        } catch {
          // Ignore
        }
      }
    }
  });

  // 2. Popstate tracking & unauthorized history traversal guard
  window.addEventListener('popstate', () => {
    isPopStateActive = true;
    if (popStateResetTimer) clearTimeout(popStateResetTimer);
    popStateResetTimer = setTimeout(() => {
      isPopStateActive = false;
    }, 500);

    const path = window.location.pathname;
    const isAuthPage = path === '/auth/login' || path === '/auth';
    const hasActiveSession = useAuthStore.getState().isAuthenticated || Boolean(getStoredRefreshToken());

    // If browser Back navigates into the sign-in page from an authenticated session:
    if (isAuthPage && hasActiveSession) {
      const currentToken = useAuthStore.getState().accessToken;
      invalidateSessionOnServer(currentToken ?? undefined).finally(() => {
        useAuthStore.getState().clearSession(true);
      });
      useAuthStore.getState().clearSession(false);
      try {
        queryClient.cancelQueries();
        queryClient.clear();
      } catch {
        // Ignore
      }
      return;
    }

    handleSecurityNavigationCheck();
  });
}

export function isPopStateNavigation(): boolean {
  return isPopStateActive;
}

export function triggerPopStateForTesting(): void {
  isPopStateActive = true;
  if (popStateResetTimer) clearTimeout(popStateResetTimer);
  popStateResetTimer = setTimeout(() => {
    isPopStateActive = false;
  }, 500);
}
