import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
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
