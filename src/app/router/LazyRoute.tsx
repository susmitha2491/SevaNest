import React, { Suspense } from 'react';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner/LoadingSpinner';

export interface LazyRouteProps {
  children: React.ReactNode;
  label?: string;
}

export const LazyRoute: React.FC<LazyRouteProps> = ({ children, label = 'Loading module...' }) => {
  return (
    <Suspense fallback={<LoadingSpinner message={label} />}>
      {children}
    </Suspense>
  );
};
