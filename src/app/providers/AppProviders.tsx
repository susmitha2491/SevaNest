import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '../../shared/components/ErrorBoundary/ErrorBoundary';
import { restoreSession } from '../../core/auth/sessionRestoration';

const queryClient = new QueryClient({
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

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  useEffect(() => {
    restoreSession();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

