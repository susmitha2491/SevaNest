import { useAuthStore } from './authStore';
import { authRepository } from '../../features/auth/data/authRepository';
import { getStoredRefreshToken, clearStoredRefreshToken, setStoredRefreshToken } from './tokenStorage';
import { logger } from '../logging/logger';

let restoreSessionPromise: Promise<boolean> | null = null;

/**
 * Authoritatively restores an authenticated session across browser reloads.
 * Uses stored refresh token to negotiate a new short-lived access token,
 * then retrieves the authoritative user profile with roles & permissions.
 * Prevents race conditions by deduplicating concurrent restoration attempts.
 */
export async function restoreSession(): Promise<boolean> {
  const state = useAuthStore.getState();

  // If already authenticated in-memory, session is intact
  if (state.isAuthenticated && state.user && state.accessToken) {
    if (!state.isInitialized || state.isRestoring) {
      useAuthStore.getState().setInitialized(true);
      useAuthStore.getState().setRestoring(false);
    }
    return true;
  }

  // Deduplicate concurrent restoration requests
  if (restoreSessionPromise) {
    return restoreSessionPromise;
  }

  restoreSessionPromise = (async () => {
    useAuthStore.getState().setRestoring(true);

    const storedRefreshToken = getStoredRefreshToken();

    // If no stored refresh token, check whether an HttpOnly cookie session exists
    if (!storedRefreshToken) {
      try {
        const user = await authRepository.getCurrentSession();
        if (user) {
          useAuthStore.getState().setSession(user, '', null);
          return true;
        }
      } catch {
        // No active cookie session
      }
      useAuthStore.getState().setInitialized(true);
      useAuthStore.getState().setRestoring(false);
      return false;
    }

    try {
      // 1. Obtain fresh access token using the stored refresh token
      const { accessToken, refreshToken: newRefreshToken, user: refreshedUser } = await authRepository.refreshToken(storedRefreshToken);

      if (!accessToken) {
        throw new Error('No access token received during session restoration.');
      }

      // If a rotated refresh token was returned, persist it
      if (newRefreshToken) {
        setStoredRefreshToken(newRefreshToken);
      }

      // 2. Fetch authoritative user profile with roles & permissions if not already returned
      let user = refreshedUser || null;
      if (!user) {
        user = await authRepository.getCurrentSession(accessToken);
      }

      if (!user) {
        throw new Error('Unable to retrieve authoritative user profile.');
      }

      // 3. Populate authenticated Zustand store
      useAuthStore.getState().setSession(user, accessToken, newRefreshToken || storedRefreshToken);
      return true;
    } catch (err: unknown) {
      logger.warn('Failed to restore administrative session from refresh token', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Clean up session ONLY if the session is not already valid/authenticated
      if (!useAuthStore.getState().isAuthenticated) {
        clearStoredRefreshToken();
        useAuthStore.getState().clearSession();
      }
      return false;
    } finally {
      useAuthStore.getState().setInitialized(true);
      useAuthStore.getState().setRestoring(false);
      restoreSessionPromise = null;
    }
  })();

  return restoreSessionPromise;
}
