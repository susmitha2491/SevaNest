/**
 * Standard Domain Error hierarchy for SevaNest Admin Portal.
 * Maps backend failure states into strongly-typed domain failures.
 */

export abstract class DomainError extends Error {
  public abstract readonly code: string;
  public readonly correlationId?: string;

  constructor(message: string, correlationId?: string) {
    super(message);
    this.name = this.constructor.name;
    this.correlationId = correlationId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnauthorizedError extends DomainError {
  public readonly code = 'UNAUTHORIZED';
  constructor(message = 'Session expired or unauthenticated. Please sign in to continue.', correlationId?: string) {
    super(message, correlationId);
  }
}

export class ForbiddenError extends DomainError {
  public readonly code = 'FORBIDDEN';
  public readonly requiredPermission?: string;

  constructor(message = 'You do not have permission to perform this action.', requiredPermission?: string, correlationId?: string) {
    super(message, correlationId);
    this.requiredPermission = requiredPermission;
  }
}

export class NotFoundError extends DomainError {
  public readonly code = 'NOT_FOUND';
  public readonly errorCode?: string;
  constructor(
    message = 'The requested record could not be found.',
    correlationId?: string | { correlationId?: string; errorCode?: string },
    errorCode?: string
  ) {
    if (typeof correlationId === 'object' && correlationId !== null) {
      super(message, correlationId.correlationId);
      this.errorCode = correlationId.errorCode ?? errorCode;
    } else {
      super(message, correlationId);
      this.errorCode = errorCode;
    }
  }
}

export class ConcurrencyConflictError extends DomainError {
  public readonly code = 'CONCURRENCY_CONFLICT';
  public readonly statusCode?: number;
  public readonly errorCode?: string;
  constructor(
    message = 'This record was modified by another user. Please reload the latest data.',
    correlationId?: string | { correlationId?: string; statusCode?: number; errorCode?: string },
    statusCode?: number,
    errorCode?: string
  ) {
    if (typeof correlationId === 'object' && correlationId !== null) {
      super(message, correlationId.correlationId);
      this.statusCode = correlationId.statusCode ?? statusCode;
      this.errorCode = correlationId.errorCode ?? errorCode;
    } else {
      super(message, correlationId);
      this.statusCode = statusCode;
      this.errorCode = errorCode;
    }
  }
}

export class ValidationError extends DomainError {
  public readonly code = 'VALIDATION_ERROR';
  public readonly fieldErrors?: Record<string, string[]>;
  public readonly errorCode?: string;
  public readonly details?: unknown;

  constructor(
    message = 'Validation failed. Please review the highlighted fields.',
    fieldErrors?: Record<string, string[]> | { correlationId?: string; errorCode?: string; details?: unknown; fieldErrors?: Record<string, string[]> },
    correlationId?: string,
    errorCode?: string,
    details?: unknown
  ) {
    if (
      typeof fieldErrors === 'object' &&
      fieldErrors !== null &&
      ('errorCode' in fieldErrors || 'details' in fieldErrors || 'correlationId' in fieldErrors)
    ) {
      const opts = fieldErrors as { correlationId?: string; errorCode?: string; details?: unknown; fieldErrors?: Record<string, string[]> };
      super(message, opts.correlationId ?? correlationId);
      this.fieldErrors = opts.fieldErrors;
      this.errorCode = opts.errorCode ?? errorCode;
      this.details = opts.details ?? details;
    } else {
      super(message, correlationId);
      this.fieldErrors = fieldErrors as Record<string, string[]> | undefined;
      this.errorCode = errorCode;
      this.details = details;
    }
  }
}

export class RateLimitExceededError extends DomainError {
  public readonly code = 'RATE_LIMIT_EXCEEDED';
  constructor(message = 'Too many requests. Please wait a moment before trying again.', correlationId?: string) {
    super(message, correlationId);
  }
}

export class ServerFailureError extends DomainError {
  public readonly code = 'SERVER_FAILURE';
  public readonly errorCode?: string;
  constructor(
    message = 'A server error occurred. Please try again later.',
    correlationId?: string | { correlationId?: string; errorCode?: string },
    errorCode?: string
  ) {
    if (typeof correlationId === 'object' && correlationId !== null) {
      super(message, correlationId.correlationId);
      this.errorCode = correlationId.errorCode ?? errorCode;
    } else {
      super(message, correlationId);
      this.errorCode = errorCode;
    }
  }
}

export class NetworkError extends DomainError {
  public readonly code = 'NETWORK_ERROR';
  constructor(message = 'Unable to reach the server. Please check your network connection.', correlationId?: string) {
    super(message, correlationId);
  }
}
