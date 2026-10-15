import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';
import { useAuthStore } from '../auth/authStore';
import { mapHttpErrorToDomainError } from '../errors/errorMapper';
import { logger } from '../logging/logger';
import { getStoredRefreshToken } from '../auth/tokenStorage';
import { requestTokenRefresh, isRefreshInProgress } from '../auth/tokenRefreshCoordinator';

declare module 'axios' {
  export interface AxiosRequestConfig {
    idempotencyKey?: string;
    entityVersion?: number | string;
    _retry?: boolean;
  }
}

/**
 * In-flight token refresh state management to protect against concurrent refresh requests.
 */
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

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

      // If a refresh is already in progress, enqueue this request
      if (isRefreshing || isRefreshInProgress()) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return httpClient(originalRequest);
          })
          .catch((err) => Promise.reject(mapHttpErrorToDomainError(err)));
      }

      const currentRefreshToken = useAuthStore.getState().refreshToken || getStoredRefreshToken();

      // If no refresh token is stored in-memory or persistently, session has expired
      if (!currentRefreshToken) {
        useAuthStore.getState().clearSession();
        return Promise.reject(mapHttpErrorToDomainError(error));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { accessToken } = await requestTokenRefresh(currentRefreshToken);
        processQueue(null, accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return httpClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        return Promise.reject(mapHttpErrorToDomainError(refreshErr));
      } finally {
        isRefreshing = false;
      }
    }

    logger.warn('HTTP Response Error occurred', {
      status: error.response?.status,
      url: error.config?.url,
    });
    return Promise.reject(mapHttpErrorToDomainError(error));
  }
);
