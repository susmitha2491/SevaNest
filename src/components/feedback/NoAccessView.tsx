import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../core/auth/authStore';
import { getDefaultLandingRoute, PERMISSIONS } from '../../core/rbac/permissions';

interface NoAccessViewProps {
  requiredPermission?: string;
  moduleName?: string;
}

export const NoAccessView: React.FC<NoAccessViewProps> = ({ requiredPermission, moduleName }) => {
  const user = useAuthStore((state) => state.user);
  let landingRoute = getDefaultLandingRoute(user);

  // If the user was denied access specifically to the Dashboard, provide fallback to their authorized workstation
  if (landingRoute === '/dashboard' && (requiredPermission === PERMISSIONS.DASHBOARD_VIEW || requiredPermission === 'dashboard.view')) {
    if (user?.permissions?.includes(PERMISSIONS.VERIFICATION_REVIEW) || user?.role === 'VERIFICATION_EXECUTIVE') {
      landingRoute = '/verification';
    } else if (user?.permissions?.includes(PERMISSIONS.SUPPORT_VIEW) || user?.role === 'SUPPORT_EXECUTIVE') {
      landingRoute = '/support';
    } else if (user?.permissions?.includes(PERMISSIONS.BOOKINGS_VIEW)) {
      landingRoute = '/bookings';
    } else if (user?.permissions?.includes(PERMISSIONS.WORKER_VIEW)) {
      landingRoute = '/workers';
    } else {
      landingRoute = '/account';
    }
  }

  const returnLabel = landingRoute === '/dashboard' ? 'Return to Dashboard' : 'Return to Primary Workstation';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        padding: 'var(--space-8)',
        textAlign: 'center',
        gap: 'var(--space-4)',
      }}
      role="region"
      aria-label="Access Denied"
    >
      <div style={{ color: 'var(--color-warning)' }}>
        <ShieldAlert size={56} />
      </div>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
        Access Restricted
      </h1>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', maxWidth: '480px' }}>
        You do not have the required server-issued permissions to view {moduleName ? `the ${moduleName} module` : 'this module'}.
        {requiredPermission && (
          <span style={{ display: 'block', marginTop: 'var(--space-2)', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
            Required permission: {requiredPermission}
          </span>
        )}
      </p>
      <Link
        to={landingRoute}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-primary)',
          padding: '10px 20px',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 600,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <ArrowLeft size={16} />
        <span>{returnLabel}</span>
      </Link>
    </div>
  );
};
