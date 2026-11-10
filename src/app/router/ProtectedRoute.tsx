import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../core/auth/authStore';
import { restoreSession } from '../../core/auth/sessionRestoration';
import { hasPermission, PermissionKey, getDefaultLandingRoute } from '../../core/rbac/permissions';
import { isRouteAccessibleForUser, getRequiredPermissionForRoute } from '../../core/rbac/navigationRegistry';
import { NoAccessView } from '../../shared/components/NoAccessView/NoAccessView';
import { isPopStateNavigation } from './popstateTracker';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: PermissionKey;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission }) => {
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isRestoring = useAuthStore((state) => state.isRestoring);
  const restorationError = useAuthStore((state) => state.restorationError);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  useEffect(() => {
    if (!isInitialized) {
      restoreSession();
    }
  }, [isInitialized]);

  // While session restoration is active or uninitialized, do NOT prematurely redirect to login
  if (!isInitialized || isRestoring) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--color-bg-app)',
          gap: 'var(--space-3)',
        }}
        aria-busy="true"
        aria-label="Restoring session"
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid var(--color-border)',
            borderTopColor: 'var(--color-brand-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          Verifying administrative session...
        </span>
      </div>
    );
  }

  // Graceful error state when session verification fails due to server or network downtime
  // (distinguishes server/network failure from expected unauthenticated state)
  if (restorationError && !isAuthenticated) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--color-bg-app)',
          padding: 'var(--space-4)',
          textAlign: 'center',
          gap: 'var(--space-3)',
        }}
        role="alert"
        aria-label="Authentication Service Error"
      >
        <div style={{ color: 'var(--color-status-danger-text)' }}>
          <AlertCircle size={48} />
        </div>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
          Authentication Service Unavailable
        </h2>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', maxWidth: '440px' }}>
          {restorationError}
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          <button
            type="button"
            onClick={() => restoreSession()}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--color-brand-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry Connection
          </button>
          <button
            type="button"
            onClick={() => {
              useAuthStore.getState().clearSession();
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              borderRadius: 'var(--radius-md)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Sign In with Credentials
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    const isRootOrAuth = location.pathname === '/' || location.pathname.startsWith('/auth');
    return <Navigate to="/auth/login" state={isRootOrAuth ? undefined : { from: location }} replace />;
  }

  const isAccessible = isRouteAccessibleForUser(location.pathname, user);
  const isPermissionSatisfied = !permission || hasPermission(user.permissions, permission);

  if (!isAccessible || !isPermissionSatisfied) {
    // When navigated via browser Back or Forward buttons (popstate) or history traversal to an unauthorized route:
    if (isPopStateNavigation()) {
      const fallback = getDefaultLandingRoute(user);
      return <Navigate to={fallback} replace state={{ fromUnauthorized: location.pathname }} />;
    }
    const required = permission || getRequiredPermissionForRoute(location.pathname);
    return <NoAccessView requiredPermission={required} />;
  }

  return <>{children}</>;
};
