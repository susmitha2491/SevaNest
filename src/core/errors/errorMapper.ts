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
        if (payload?.code === 'DOCUMENT_OBJECT_MISSING') {
          return new NotFoundError(
            serverMessage || 'The document file is missing from storage. Please request the worker to re-upload.',
            correlationId,
            payload.code
          );
        }
        return new NotFoundError(serverMessage || 'Resource not found.', correlationId, payload?.code);
      case 409:
        if (payload?.code === 'CHECK_ALREADY_ASSIGNED') {
          return new ConcurrencyConflictError(serverMessage || 'Check is already assigned to another reviewer.', correlationId, 409, payload.code);
        }
        if (payload?.code === 'CHECK_NOT_ASSIGNED_TO_YOU') {
          return new ConcurrencyConflictError(serverMessage || 'This check is assigned to another reviewer. You must be assigned to decide this check.', correlationId, 409, payload.code);
        }
        if (payload?.code === 'INVALID_TRANSITION') {
          return new ConcurrencyConflictError(serverMessage || 'Invalid check transition. The check must be claimed and in review before a decision can be made.', correlationId, 409, payload.code);
        }
        if (payload?.code === 'DOCUMENT_NOT_AVAILABLE') {
          return new ConcurrencyConflictError(serverMessage || 'The requested document is not currently available for inspection.', correlationId, 409, payload.code);
        }
        if (payload?.code === 'NOT_FULLY_VERIFIED') {
          return new ConcurrencyConflictError(serverMessage || 'Cannot sign off: all required verification checks must be approved first.', correlationId, 409, payload.code);
        }
        if (payload?.code === 'WORKER_DISQUALIFIED') {
          return new ConcurrencyConflictError(serverMessage || 'Worker disqualified: application cannot be signed off due to a rejected check.', correlationId, 409, payload.code);
        }
        if (payload?.code === 'NOT_SIGNED_OFF') {
          return new ConcurrencyConflictError(serverMessage || 'Worker verification has not been signed off. Complete supervisor sign-off before activation.', correlationId, 409, payload.code);
        }
        return new ConcurrencyConflictError(serverMessage || 'Concurrent modification conflict.', correlationId, 409, payload?.code);
      case 412:
        return new ConcurrencyConflictError(
          serverMessage || 'STALE_VERSION: This record was modified by another user or session. Please reload the latest data and retry.',
          correlationId,
          412,
          payload?.code
        );
      case 422:
        if (payload?.code === 'APPROVAL_REQUIREMENTS_MISSING') {
          return new ValidationError(
            serverMessage || 'Approval requirements missing: required fields must be recorded before approval.',
            fieldErrors,
            correlationId,
            payload.code,
            payload.details
          );
        }
        if (payload?.code === 'DOCUMENT_INTEGRITY_FAILED') {
          return new ValidationError(
            serverMessage || 'Document integrity check failed. The file may be corrupted.',
            fieldErrors,
            correlationId,
            payload.code,
            payload.details
          );
        }
        if (payload?.code === 'ACTIVATION_REQUIREMENTS_MISSING') {
          return new ValidationError(serverMessage || 'Missing authoritative prerequisites for worker activation.', fieldErrors, correlationId, payload.code, payload.details);
        }
        if (payload?.code === 'PROFILE_NOT_SUBMITTED') {
          return new ValidationError(serverMessage || 'Worker profile has not been submitted yet.', fieldErrors, correlationId, payload.code, payload.details);
        }
        return new ValidationError(serverMessage || 'Validation rules violated.', fieldErrors, correlationId, payload?.code, payload?.details);
      case 428:
        return new ConcurrencyConflictError(
          serverMessage || 'PRECONDITION_REQUIRED: Concurrency version precondition (ETag/If-Match) is required for this mutation.',
          correlationId,
          428,
          payload?.code
        );
      case 429:
        return new RateLimitExceededError(serverMessage || 'Rate limit exceeded.', correlationId);
      case 500:
      case 502:
      case 503:
      case 504:
      default:
        if (payload?.code === 'STORAGE_NOT_CONFIGURED') {
          return new ServerFailureError(
            serverMessage || 'Storage service is not configured. Please contact the system administrator.',
            correlationId,
            payload.code
          );
        }
        if (payload?.code === 'DOCUMENT_INTEGRITY_FAILED') {
          return new ServerFailureError(
            serverMessage || 'Document integrity check failed. The file may be corrupted.',
            correlationId,
            payload.code
          );
        }
        return new ServerFailureError(serverMessage || 'Internal server error occurred.', correlationId, payload?.code);
    }
  }

  return new ServerFailureError(
    error instanceof Error ? error.message : 'An unexpected error occurred.'
  );
}
