import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { mapHttpErrorToDomainError } from '../core/errors/errorMapper';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConcurrencyConflictError,
  ValidationError,
  RateLimitExceededError,
  ServerFailureError,
} from '../core/errors/DomainError';

function createMockAxiosError(status: number, data: Record<string, unknown>, headers: Record<string, string> = {}) {
  const axiosHeaders = new AxiosHeaders(headers);
  const error = new AxiosError(
    'Request failed',
    String(status),
    undefined,
    undefined,
    {
      data,
      status,
      statusText: 'Error',
      headers: axiosHeaders,
      config: { headers: axiosHeaders },
    }
  );
  return error;
}

describe('HTTP-to-Domain Error Mapper', () => {
  it('maps HTTP 401 to UnauthorizedError', () => {
    const error = createMockAxiosError(401, { message: 'Token expired' }, { 'x-correlation-id': 'corr-123' });
    const domainError = mapHttpErrorToDomainError(error);
    expect(domainError).toBeInstanceOf(UnauthorizedError);
    expect(domainError.code).toBe('UNAUTHORIZED');
    expect(domainError.correlationId).toBe('corr-123');
  });

  it('maps HTTP 403 to ForbiddenError', () => {
    const error = createMockAxiosError(403, { message: 'Permission denied' });
    const domainError = mapHttpErrorToDomainError(error);
    expect(domainError).toBeInstanceOf(ForbiddenError);
    expect(domainError.code).toBe('FORBIDDEN');
  });

  it('maps HTTP 404 to NotFoundError', () => {
    const error = createMockAxiosError(404, { message: 'Worker record not found' });
    const domainError = mapHttpErrorToDomainError(error);
    expect(domainError).toBeInstanceOf(NotFoundError);
    expect(domainError.code).toBe('NOT_FOUND');
  });

  it('maps HTTP 409 to ConcurrencyConflictError', () => {
    const error = createMockAxiosError(409, { message: 'Version conflict' });
    const domainError = mapHttpErrorToDomainError(error);
    expect(domainError).toBeInstanceOf(ConcurrencyConflictError);
    expect(domainError.code).toBe('CONCURRENCY_CONFLICT');
  });

  it('maps HTTP 422 to ValidationError', () => {
    const error = createMockAxiosError(422, {
      message: 'Invalid schema payload',
      fieldErrors: { email: ['Invalid email format'] },
    });
    const domainError = mapHttpErrorToDomainError(error);
    expect(domainError).toBeInstanceOf(ValidationError);
    expect(domainError.code).toBe('VALIDATION_ERROR');
    expect((domainError as ValidationError).fieldErrors).toHaveProperty('email');
  });

  it('maps HTTP 429 to RateLimitExceededError', () => {
    const error = createMockAxiosError(429, { message: 'Too many requests' });
    const domainError = mapHttpErrorToDomainError(error);
    expect(domainError).toBeInstanceOf(RateLimitExceededError);
    expect(domainError.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('maps HTTP 500 to ServerFailureError', () => {
    const error = createMockAxiosError(500, { message: 'Database connection failed' });
    const domainError = mapHttpErrorToDomainError(error);
    expect(domainError).toBeInstanceOf(ServerFailureError);
    expect(domainError.code).toBe('SERVER_FAILURE');
  });
});
