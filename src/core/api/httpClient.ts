import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';
import { useAuthStore } from '../auth/authStore';
import { mapHttpErrorToDomainError } from '../errors/errorMapper';
import { logger } from '../logging/logger';
import { getStoredRefreshToken } from '../auth/tokenStorage';
import { requestTokenRefresh } from '../auth/tokenRefreshCoordinator';

declare module 'axios' {
  export interface AxiosRequestConfig {
    idempotencyKey?: string;
    entityVersion?: number | string;
    _retry?: boolean;
  }
}

function readAuthHeader(headers: InternalAxiosRequestConfig['headers']): string | undefined {
  if (!headers) return undefined;
  const viaGet = typeof headers.get === 'function' ? headers.get('Authorization') : undefined;
  if (typeof viaGet === 'string') return viaGet;
  const raw = headers.Authorization ?? headers.authorization;
  return typeof raw === 'string' ? raw : undefined;
}

function setAuthHeader(headers: InternalAxiosRequestConfig['headers'], token: string): void {
  if (typeof headers.set === 'function') {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.Authorization = `Bearer ${token}`;
  }
}

/**
 * Standard HTTP Client for SevaNest Admin Portal.
 * Enforces correlation tracking, in-memory token injection, safe token refresh, and domain error mapping.
 */
export const httpClient: AxiosInstance = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: env.VITE_API_TIMEOUT_MS,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request Interceptor Pipeline
httpClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 1. Correlation ID
    if (!config.headers['X-Correlation-ID']) {
      const correlationId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      config.headers['X-Correlation-ID'] = correlationId;
    }

    // 2. Attach In-Memory Bearer Token
    const token = useAuthStore.getState().accessToken;
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 3. Attach Idempotency Key if specified
    if (config.idempotencyKey) {
      config.headers['Idempotency-Key'] = config.idempotencyKey;
    }

    // 4. Attach Optimistic Concurrency Version if specified
    if (config.entityVersion !== undefined) {
      config.headers['If-Match'] = `"${config.entityVersion}"`;
    }

    return config;
  },
  (error) => {
    logger.error('HTTP Request Interceptor Error', error);
    return Promise.reject(mapHttpErrorToDomainError(error));
  }
);

// Response Interceptor Pipeline with Safe Token Refresh
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    // Check if error is 401 Unauthorized and request is eligible for token refresh
    if (error.response?.status === 401 && originalRequest) {
      const url = originalRequest.url || '';
      const isAuthEndpoint =
        url.includes('/auth/admin/login') ||
        url.includes('/auth/token/refresh') ||
        url.includes('/auth/logout');

      // Do NOT retry authentication endpoints; propagate credentials failure directly
      if (isAuthEndpoint) {
        if (url.includes('/auth/token/refresh')) {
          useAuthStore.getState().clearSession();
        }
        return Promise.reject(mapHttpErrorToDomainError(error));
      }

      // Avoid infinite retry loop
      if (originalRequest._retry) {
        useAuthStore.getState().clearSession();
        return Promise.reject(mapHttpErrorToDomainError(error));
      }

      // If another concurrent call already rotated the in-memory access token after this request was sent,
      // replay directly with the newer token instead of triggering another /refresh request
      const sentAuth = readAuthHeader(originalRequest.headers);
      const latestAccessToken = useAuthStore.getState().accessToken;
      if (sentAuth && latestAccessToken && sentAuth !== `Bearer ${latestAccessToken}`) {
        originalRequest._retry = true;
        originalRequest.headers = originalRequest.headers ?? ({} as InternalAxiosRequestConfig['headers']);
        setAuthHeader(originalRequest.headers, latestAccessToken);
        return httpClient(originalRequest);
      }

      const currentRefreshToken = useAuthStore.getState().refreshToken || getStoredRefreshToken();

      // If no refresh token is stored in-memory or persistently, session has expired
      if (!currentRefreshToken) {
        useAuthStore.getState().clearSession();
        return Promise.reject(mapHttpErrorToDomainError(error));
      }

      originalRequest._retry = true;

      try {
        // Deduplicated shared refresh coordinator handles concurrency, Web Locks, and 429 cooldowns
        const { accessToken } = await requestTokenRefresh(currentRefreshToken);
        originalRequest.headers = originalRequest.headers ?? ({} as InternalAxiosRequestConfig['headers']);
        setAuthHeader(originalRequest.headers, accessToken);
        return httpClient(originalRequest);
      } catch (refreshErr) {
        return Promise.reject(mapHttpErrorToDomainError(refreshErr));
      }
    }

    logger.warn('HTTP Response Error occurred', {
      status: error.response?.status,
      url: error.config?.url,
    });
    return Promise.reject(mapHttpErrorToDomainError(error));
  }
);
