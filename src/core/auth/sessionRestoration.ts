import axios from 'axios';
import { useAuthStore } from './authStore';
import { authRepository } from '../../features/auth/data/authRepository';
import { getStoredRefreshToken, clearStoredRefreshToken, setStoredRefreshToken } from './tokenStorage';
import { logger } from '../logging/logger';
import { mapHttpErrorToDomainError } from '../errors/errorMapper';
import { UnauthorizedError, ForbiddenError } from '../errors/DomainError';

let restoreSessionPromise: Promise<boolean> | null = null;

/**
 * Resets the in-flight restoration promise. Used primarily in test environments
 * to ensure complete isolation between consecutive test cases.
 */
export function resetSessionRestorationState(): void {
  restoreSessionPromise = null;
}

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
      useAuthStore.getState().setRestorationError(null);
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

    // If no stored refresh token, there is NO session to restore.
    // Complete bootstrap immediately without attempting any unauthenticated network calls.
    if (!storedRefreshToken) {
      useAuthStore.getState().setRestorationError(null);
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
      useAuthStore.getState().setRestorationError(null);
      return true;
    } catch (err: unknown) {
      const domainError = mapHttpErrorToDomainError(err);
      const isExplicitAuthFailure =
        domainError instanceof UnauthorizedError ||
        domainError instanceof ForbiddenError ||
        (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) ||
        (err instanceof Error && /expired|invalid|unauthorized/i.test(err.message));

      logger.warn('Failed to restore administrative session from refresh token', {
        error: err instanceof Error ? err.message : String(err),
        isExplicitAuthFailure,
      });

      if (isExplicitAuthFailure) {
        // Explicit 401/403: Refresh token is expired, revoked, or invalid.
        // Wipe local storage token and clear in-memory session.
        if (!useAuthStore.getState().isAuthenticated) {
          clearStoredRefreshToken();
          useAuthStore.getState().clearSession();
        }
        useAuthStore.getState().setRestorationError(null);
      } else {
        // Transient network or server failure (5xx, offline, timeout):
        // Preserve the stored token so user can retry or recover when connection is restored.
        // Do not silently treat server downtime as an unauthenticated session.
        logger.error('Temporary server or network failure during session restoration. Refresh token preserved.', {
          error: domainError.message,
        });
        useAuthStore.getState().setRestorationError(
          domainError.message || 'Unable to connect to the authentication server. Please check your network connection.'
        );
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
