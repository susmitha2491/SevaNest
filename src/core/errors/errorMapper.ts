import axios, { AxiosError } from 'axios';
import {
  DomainError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConcurrencyConflictError,
  ValidationError,
  RateLimitExceededError,
  ServerFailureError,
  NetworkError,
} from './DomainError';

interface ApiErrorPayload {
  code?: string;
  message?: string;
  requestId?: string;
  fieldErrors?: Record<string, string[]>;
  details?: Array<{ field: string; messages: string[] }>;
}

export function mapHttpErrorToDomainError(error: unknown): DomainError {
  if (error instanceof DomainError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorPayload>;
    const headers = axiosError.response?.headers;
    const payload = axiosError.response?.data;
    
    // Extract correlation ID from x-correlation-id, x-request-id or payload.requestId
    const correlationId = headers
      ? ((headers['x-correlation-id'] || headers['x-request-id']) as string)
      : payload?.requestId;

    const status = axiosError.response?.status;
    const serverMessage = payload?.message;

    // Network / CORS connectivity failure
    if (!axiosError.response) {
      const isCorsOrNetwork = axiosError.code === 'ERR_NETWORK' || axiosError.message?.toLowerCase().includes('network');
      const networkMsg = isCorsOrNetwork
        ? 'Unable to connect to SevaNest Backend API. Please check your network connection or CORS configuration.'
        : axiosError.message || 'Network connectivity failure.';
      return new NetworkError(networkMsg, correlationId);
    }

    // Extract field-level validation errors from details array if present
    let fieldErrors = payload?.fieldErrors;
    if (!fieldErrors && Array.isArray(payload?.details)) {
      fieldErrors = {};
      for (const item of payload.details) {
        if (item.field && Array.isArray(item.messages)) {
          fieldErrors[item.field] = item.messages;
        }
      }
    }

    switch (status) {
      case 400:
        return new ValidationError(serverMessage || 'Malformed request payload.', fieldErrors, correlationId);
      case 401:
        return new UnauthorizedError(serverMessage || 'Session expired or unauthenticated.', correlationId);
      case 403:
        return new ForbiddenError(serverMessage || 'Action forbidden by server authorization policy.', undefined, correlationId);
      case 404:
        return new NotFoundError(serverMessage || 'Resource not found.', correlationId);
      case 409:
        return new ConcurrencyConflictError(serverMessage || 'Concurrent modification conflict.', correlationId);
      case 422:
        return new ValidationError(serverMessage || 'Validation rules violated.', fieldErrors, correlationId);
      case 429:
        return new RateLimitExceededError(serverMessage || 'Rate limit exceeded.', correlationId);
      case 500:
      case 502:
      case 503:
      case 504:
      default:
        return new ServerFailureError(serverMessage || 'Internal server error occurred.', correlationId);
    }
  }

  return new ServerFailureError(
    error instanceof Error ? error.message : 'An unexpected error occurred.'
  );
}
