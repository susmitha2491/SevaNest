import React, { Suspense, Component, ErrorInfo } from 'react';
import { LoadingSpinner } from '../../shared/components/LoadingSpinner/LoadingSpinner';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackLabel?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ChunkErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('LazyRoute chunk loading or runtime error caught:', error, errorInfo);
    // If it's a dynamic module import failure (e.g. after a redeployment), reload once automatically
    const isChunkFailure =
      error.message &&
      (error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Loading chunk') ||
        error.message.includes('error loading dynamically imported module'));

    if (isChunkFailure && typeof window !== 'undefined' && !window.sessionStorage.getItem('chunk_retry_attempted')) {
      window.sessionStorage.setItem('chunk_retry_attempted', 'true');
      window.location.reload();
    }
  }

  handleRetry = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('chunk_retry_attempted');
    }
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '300px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-lg)',
            margin: 'var(--space-4)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-status-danger-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 'var(--space-3)',
              color: 'var(--color-status-danger-text)',
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
            Module Temporarily Unavailable
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', maxWidth: '440px', marginBottom: 'var(--space-4)' }}>
            {this.state.error?.message?.includes('dynamically imported module')
              ? 'A newer version of this module is available. Please reload to load the latest bundle.'
              : 'The requested module encountered an issue while loading. Please retry.'}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-brand-600)',
              color: '#ffffff',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
            <span>Reload Module</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface LazyRouteProps {
  children: React.ReactNode;
  label?: string;
}

export const LazyRoute: React.FC<LazyRouteProps> = ({ children, label = 'Loading module...' }) => {
  return (
    <ChunkErrorBoundary fallbackLabel={label}>
      <Suspense fallback={<LoadingSpinner message={label} />}>
        {children}
      </Suspense>
    </ChunkErrorBoundary>
  );
};
