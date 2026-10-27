import React, { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../core/api/queryClient';
import { ErrorBoundary } from '../../shared/components/ErrorBoundary/ErrorBoundary';
import { restoreSession } from '../../core/auth/sessionRestoration';

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

