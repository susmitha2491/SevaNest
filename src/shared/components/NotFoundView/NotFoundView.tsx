import React from 'react';
import { HelpCircle, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../../core/auth/authStore';
import { getDefaultLandingRoute } from '../../../core/rbac/permissions';

export const NotFoundView: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const landingRoute = getDefaultLandingRoute(user);
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
      aria-label="Page Not Found"
    >
      <div style={{ color: 'var(--color-text-muted)' }}>
        <HelpCircle size={56} />
      </div>
      <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
        404 — Page Not Found
      </h1>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', maxWidth: '440px' }}>
        The administrative route you requested does not exist or has been moved.
      </p>
      <Link
        to={landingRoute}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          backgroundColor: 'var(--color-primary)',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-sm)',
          fontWeight: 600,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <Home size={16} />
        <span>Back to Portal Home</span>
      </Link>
    </div>
  );
};
