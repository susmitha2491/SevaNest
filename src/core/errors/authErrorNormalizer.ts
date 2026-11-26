import axios, { AxiosError } from 'axios';
import {
  DomainError,
  UnauthorizedError,
  RateLimitExceededError,
  ServerFailureError,
  NetworkError,
  TimeoutError,
  OfflineError,
} from './DomainError';
import { readHeaderValue } from './errorMapper';

export const AUTH_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email id or password',
  CLOUDFLARE_CHALLENGE: 'Unable to connect to the authentication service. Please try again later.',
  BACKEND_UNAVAILABLE: 'Authentication service is temporarily unavailable. Please try again later.',
  UNEXPECTED_ERROR: 'Unable to sign in. Please try again.',
} as const;

export interface NormalizedAuthError {
  userMessage: string;
  isRetryable: boolean;
  cooldownSeconds: number;
  isCredentialError: boolean;
  errorCode: string;
  correlationId?: string;
}

/**
 * Checks whether an unknown response represents a Cloudflare challenge
 * (Managed Challenge, Bot Fight Mode, or Turnstile gate).
 */
export function isCloudflareChallengeResponse(error: unknown): boolean {
  if (error instanceof RateLimitExceededError && error.errorCode === 'CLOUDFLARE_CHALLENGE') {
    return true;
  }
  if (error instanceof DomainError && error.errorCode === 'CLOUDFLARE_CHALLENGE') {
    return true;
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const headers = axiosError.response?.headers;
    const data = axiosError.response?.data;

    const cfMitigated = readHeaderValue(headers, 'cf-mitigated');
    if (cfMitigated && cfMitigated.toLowerCase() === 'challenge') {
      return true;
    }

    if (typeof data === 'string') {
      if (
        /<title>Just a moment\.\.\.<\/title>/i.test(data) ||
        /challenges\.cloudflare\.com/i.test(data) ||
        /turnstile/i.test(data) ||
        /cf-chl/i.test(data)
      ) {
        return true;
      }
    }
  }

  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (lower.includes('cloudflare') || lower.includes('security challenge')) {
      return true;
    }
  }

  return false;
}

/**
 * Centralized authentication error normalizer.
 * Maps all HTTP/network/backend errors to strict, safe, user-facing error contracts:
 * - Never appends reference IDs (Ref: ...) or request IDs to the UI message.
 * - Never displays raw backend stack traces or raw Cloudflare HTML.
 * - Does not disclose whether the email address exists in the system.
 */
export function normalizeAuthError(error: unknown): NormalizedAuthError {
  // 1. Cloudflare / Bot Protection Challenge
  if (isCloudflareChallengeResponse(error)) {
    return {
      userMessage: AUTH_ERROR_MESSAGES.CLOUDFLARE_CHALLENGE,
      isRetryable: true,
      cooldownSeconds: 10,
      isCredentialError: false,
      errorCode: 'CLOUDFLARE_CHALLENGE',
    };
  }

  // Extract HTTP status and domain error code if present
  let status: number | undefined;
  let code: string | undefined;
  let rawMessage = '';

  if (axios.isAxiosError(error)) {
    status = error.response?.status;
    const data = error.response?.data;
    if (data && typeof data === 'object') {
      code = (data as { code?: string; errorCode?: string }).code || (data as { code?: string; errorCode?: string }).errorCode;
      rawMessage = String((data as { message?: string }).message || '');
    } else if (typeof data === 'string') {
      rawMessage = data;
    }
  }

  if (error instanceof DomainError) {
    code = error.errorCode || error.code;
    rawMessage = error.message || '';
  } else if (error instanceof Error) {
    rawMessage = error.message || '';
  }

  const rawLower = rawMessage.toLowerCase();

  // 2. Invalid Credentials / Unauthorized
  // Backend returns 401 with INVALID_CREDENTIALS or 400 with BAD_REQUEST: "Invalid request"
  const isCredentialFailure =
    error instanceof UnauthorizedError ||
    status === 401 ||
    code === 'INVALID_CREDENTIALS' ||
    code === 'UNAUTHORIZED' ||
    code === 'UNAUTHENTICATED' ||
    (status === 400 && (
      code === 'BAD_REQUEST' ||
      rawLower.includes('invalid request') ||
      rawLower.includes('invalid credentials') ||
      rawLower.includes('invalid email') ||
      rawLower.includes('invalid password') ||
      rawLower.includes('password')
    )) ||
    rawLower.includes('invalid email') ||
    rawLower.includes('invalid password') ||
    rawLower.includes('invalid credentials') ||
    rawLower.includes('bad credentials') ||
    rawLower.includes('credentials are required');

  if (isCredentialFailure) {
    return {
      userMessage: AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS,
      isRetryable: false,
      cooldownSeconds: 0,
      isCredentialError: true,
      errorCode: 'INVALID_CREDENTIALS',
    };
  }

  // 3. Backend Unavailable / Offline / Network Error
  const isOffline =
    error instanceof OfflineError ||
    (error instanceof DomainError && error.code === 'OFFLINE_ERROR') ||
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    rawLower.includes('no internet connection');

  if (isOffline) {
    return {
      userMessage: 'No internet connection. Please check your network and try again.',
      isRetryable: true,
      cooldownSeconds: 0,
      isCredentialError: false,
      errorCode: 'OFFLINE',
    };
  }

  const isBackendUnavailable =
    error instanceof ServerFailureError ||
    error instanceof NetworkError ||
    error instanceof TimeoutError ||
    (status !== undefined && (status === 500 || status === 502 || status === 503 || status === 504)) ||
    code === 'BACKEND_WAKING_UP' ||
    code === 'NETWORK_ERROR' ||
    code === 'TIMEOUT' ||
    rawLower.includes('waking up on render') ||
    rawLower.includes('temporarily unavailable') ||
    rawLower.includes('network') ||
    rawLower.includes('timeout') ||
    rawLower.includes('econnrefused') ||
    rawLower.includes('failed to fetch');

  if (isBackendUnavailable) {
    return {
      userMessage: AUTH_ERROR_MESSAGES.BACKEND_UNAVAILABLE,
      isRetryable: true,
      cooldownSeconds: 0,
      isCredentialError: false,
      errorCode: 'BACKEND_UNAVAILABLE',
    };
  }

  // 4. Rate Limiting (standard non-Cloudflare 429)
  if (status === 429 || error instanceof RateLimitExceededError || code === 'RATE_LIMIT_EXCEEDED') {
    return {
      userMessage: AUTH_ERROR_MESSAGES.BACKEND_UNAVAILABLE,
      isRetryable: true,
      cooldownSeconds: 10,
      isCredentialError: false,
      errorCode: 'RATE_LIMIT_EXCEEDED',
    };
  }

  // 5. Unexpected / Default Error
  return {
    userMessage: AUTH_ERROR_MESSAGES.UNEXPECTED_ERROR,
    isRetryable: true,
    cooldownSeconds: 0,
    isCredentialError: false,
    errorCode: code || 'UNEXPECTED_ERROR',
  };
}

