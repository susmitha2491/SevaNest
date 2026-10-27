import { QueryClient } from '@tanstack/react-query';

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
      retry: 1, // Safe retry on query reads
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false, // Disallow automatic retries on writes without idempotency
    },
  },
});
