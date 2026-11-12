import { QueryClient } from '@tanstack/react-query';
import {
  ForbiddenError,
  NotFoundError,
  RateLimitExceededError,
  UnauthorizedError,
  ValidationError,
} from '../errors/DomainError';

/**
 * Authoritative global QueryClient instance for SevaNest Admin Portal.
 * Configured with caching thresholds and fail-safe retry policies.
 * Purged automatically on logout and session revocation to prevent cross-session data leakage.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes fresh cache
      gcTime: 1000 * 60 * 30, // 30 minutes garbage collection
      retry: (failureCount, error) => {
        if (
          error instanceof RateLimitExceededError ||
          error instanceof UnauthorizedError ||
          error instanceof ForbiddenError ||
          error instanceof NotFoundError ||
          error instanceof ValidationError
        ) {
          return false;
        }
        const status =
          (error as { statusCode?: number; response?: { status?: number } })?.statusCode ||
          (error as { response?: { status?: number } })?.response?.status;
        // Do not retry client authorization, rate-limit, validation, or not-found errors
        if (
          status === 404 ||
          status === 403 ||
          status === 401 ||
          status === 400 ||
          status === 422 ||
          status === 429
        ) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false, // Disallow automatic retries on writes without idempotency
    },
  },
});
