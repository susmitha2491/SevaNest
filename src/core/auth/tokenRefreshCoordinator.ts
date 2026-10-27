import axios from 'axios';
import { httpClient } from '../api/httpClient';
import { useAuthStore } from './authStore';
import { AdminUser } from './authTypes';
import { getStoredRefreshToken, setStoredRefreshToken, clearStoredRefreshToken } from './tokenStorage';
import { mapBackendUserToAdminUser } from '../../features/auth/data/authRepository';
import { mapHttpErrorToDomainError } from '../errors/errorMapper';
import { UnauthorizedError, ServerFailureError } from '../errors/DomainError';
import { logger } from '../logging/logger';

export interface TokenRefreshResult {
  accessToken: string;
  refreshToken?: string;
  user?: AdminUser;
}

// In-flight refresh promise to deduplicate concurrent refresh calls in memory (e.g. StrictMode, parallel requests)
let inFlightRefreshPromise: Promise<TokenRefreshResult> | null = null;
let lastRefreshedAt = 0;
let lastRefreshResult: TokenRefreshResult | null = null;

// Multi-tab synchronization channel
let syncChannel: { postMessage: (msg: unknown) => void; onmessage?: (e: { data?: unknown }) => void } | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    const ChannelConstructor = (window as unknown as { BroadcastChannel: new (name: string) => typeof syncChannel }).BroadcastChannel;
    syncChannel = new ChannelConstructor('sevanest_auth_sync');
    if (syncChannel) {
      syncChannel.onmessage = (event: { data?: unknown }) => {
        const data = event.data as Record<string, unknown> | undefined;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'REFRESH_SUCCESS') {
          const { accessToken, refreshToken, user } = data as { accessToken?: string; refreshToken?: string; user?: AdminUser };
          if (accessToken) {
            if (user) {
              useAuthStore.getState().setSession(user, accessToken, refreshToken);
            } else {
              useAuthStore.getState().setTokens(accessToken, refreshToken);
            }
            lastRefreshedAt = Date.now();
            lastRefreshResult = { accessToken, refreshToken, user };
          }
        } else if (data.type === 'LOGOUT') {
          clearStoredRefreshToken();
          useAuthStore.getState().clearSession(false);
        }
      };
    }
  } catch {
    syncChannel = null;
  }
}

/**
 * Broadcasts a logout event across all open tabs via BroadcastChannel.
 */
export function broadcastLogout(): void {
  if (syncChannel) {
    try {
      syncChannel.postMessage({ type: 'LOGOUT' });
    } catch {
      // Ignore broadcast failure
    }
  }
}

/**
 * Returns true if a refresh request is currently in-flight.
 */
export function isRefreshInProgress(): boolean {
  return inFlightRefreshPromise !== null;
}

/**
 * Resets coordinator state (primarily for isolated unit tests).
 */
export function resetRefreshCoordinator(): void {
  inFlightRefreshPromise = null;
  lastRefreshedAt = 0;
  lastRefreshResult = null;
}

/**
 * Authoritatively executes a token refresh request.
 * - Deduplicates concurrent calls into a single in-flight HTTP request.
 * - Coordinates across tabs using Web Locks when supported to avoid submitting the same rotating refresh token.
 * - Maps permissions and roles returned in the refresh response.
 * - Never clears a valid session unless the server explicitly reports expiration or revocation (401/403).
 */
export async function requestTokenRefresh(explicitToken?: string): Promise<TokenRefreshResult> {
  // If a refresh is already in-flight in this JS context, return the existing promise
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  const tokenToRefresh = explicitToken || useAuthStore.getState().refreshToken || getStoredRefreshToken();
  if (!tokenToRefresh) {
    throw new UnauthorizedError('No active refresh token available.');
  }

  // If another tab refreshed within the last 2 seconds and storage token updated, reuse that fresh session
  const storedNow = getStoredRefreshToken();
  if (
    lastRefreshResult &&
    Date.now() - lastRefreshedAt < 2000 &&
    storedNow &&
    storedNow !== tokenToRefresh
  ) {
    return lastRefreshResult;
  }

  // Execution runner with cross-tab locking if navigator.locks is supported
  const executeRefreshWithLock = async (): Promise<TokenRefreshResult> => {
    // If Web Locks API is available, serialize cross-tab refresh
    if (
      typeof navigator !== 'undefined' &&
      navigator.locks &&
      typeof navigator.locks.request === 'function'
    ) {
      return navigator.locks.request('sevanest_refresh_token_lock', async () => {
        // Double-check: Did another tab finish refreshing while we were waiting for the lock?
        const currentStored = getStoredRefreshToken();
        if (currentStored && currentStored !== tokenToRefresh && lastRefreshResult) {
          return lastRefreshResult;
        }
        return performHttpRefresh(tokenToRefresh);
      });
    }

    return performHttpRefresh(tokenToRefresh);
  };

  inFlightRefreshPromise = executeRefreshWithLock().finally(() => {
    inFlightRefreshPromise = null;
  });

  return inFlightRefreshPromise;
}

/**
 * Dispatches the raw HTTP POST /auth/token/refresh call and processes the response.
 */
async function performHttpRefresh(currentToken: string): Promise<TokenRefreshResult> {
  try {
    const response = await httpClient.post<Record<string, unknown>>(
      '/auth/token/refresh',
      { refreshToken: currentToken }
    );

    const rawData = response.data;
    if (!rawData || typeof rawData !== 'object') {
      throw new ServerFailureError('Invalid response received from token refresh endpoint.');
    }

    const payload = (rawData.data && typeof rawData.data === 'object' && !Array.isArray(rawData.data))
      ? (rawData.data as Record<string, unknown>)
      : (rawData.tokens && typeof rawData.tokens === 'object' && !Array.isArray(rawData.tokens))
        ? (rawData.tokens as Record<string, unknown>)
        : rawData;

    const accessToken = (payload.accessToken || payload.token || payload.access_token || rawData.accessToken) as string | undefined;
    const newRefreshToken = (payload.refreshToken || payload.refresh_token || rawData.refreshToken || currentToken) as string;

    if (!accessToken || typeof accessToken !== 'string') {
      throw new ServerFailureError('Unexpected response from token refresh endpoint: missing accessToken.');
    }

    // Backend contract: refresh now returns user roles and permissions
    let refreshedUser: AdminUser | undefined;
    const userSource = payload.user || rawData.user;
    const hasRoleOrPermissions =
      payload.permissions !== undefined ||
      rawData.permissions !== undefined ||
      payload.role !== undefined ||
      rawData.role !== undefined ||
      payload.roles !== undefined ||
      rawData.roles !== undefined;

    if (userSource || hasRoleOrPermissions) {
      const currentUser = useAuthStore.getState().user;
      const mergedUserData = {
        ...(currentUser || {}),
        ...((typeof userSource === 'object' && userSource) || {}),
        ...(payload.permissions !== undefined ? { permissions: payload.permissions } : rawData.permissions !== undefined ? { permissions: rawData.permissions } : {}),
        ...(payload.role !== undefined ? { role: payload.role } : rawData.role !== undefined ? { role: rawData.role } : {}),
        ...(payload.roles !== undefined ? { roles: payload.roles } : rawData.roles !== undefined ? { roles: rawData.roles } : {}),
      };
      try {
        refreshedUser = mapBackendUserToAdminUser(mergedUserData, currentUser?.email);
      } catch {
        // If mapping fails, keep existing user
      }
    }

    // Persist new tokens and update Zustand store
    setStoredRefreshToken(newRefreshToken);
    if (refreshedUser) {
      useAuthStore.getState().setSession(refreshedUser, accessToken, newRefreshToken);
    } else {
      useAuthStore.getState().setTokens(accessToken, newRefreshToken);
    }

    const result: TokenRefreshResult = {
      accessToken,
      refreshToken: newRefreshToken,
      user: refreshedUser,
    };

    lastRefreshedAt = Date.now();
    lastRefreshResult = result;

    // Broadcast update to other tabs
    if (syncChannel) {
      try {
        syncChannel.postMessage({
          type: 'REFRESH_SUCCESS',
          accessToken,
          refreshToken: newRefreshToken,
          user: refreshedUser,
        });
      } catch {
        // Ignore broadcast failure
      }
    }

    return result;
  } catch (err: unknown) {
    const domainError = mapHttpErrorToDomainError(err);
    const isExplicitAuthFailure =
      domainError instanceof UnauthorizedError ||
      (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403));

    // Only clear session when server explicitly rejects refresh token as expired or revoked
    if (isExplicitAuthFailure) {
      logger.warn('Token refresh failed with explicit authorization error. Revoking session.');
      clearStoredRefreshToken();
      useAuthStore.getState().clearSession();

      if (syncChannel) {
        try {
          syncChannel.postMessage({ type: 'LOGOUT' });
        } catch {
          // Ignore broadcast failure
        }
      }
    } else {
      logger.warn('Token refresh encountered temporary network or server error. Retaining local session state.', {
        error: domainError.message,
      });
    }

    throw domainError;
  }
}
