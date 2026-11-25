import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../core/auth/authStore';
import { getDefaultLandingRoute } from '../../core/rbac/permissions';
import { isPopStateNavigation } from '../router/popstateTracker';

export const PublicLayout: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && user && !isPopStateNavigation()) {
    return <Navigate to={getDefaultLandingRoute(user)} replace />;
  }

  return (
    <div className="public-layout-container">
      <div className="public-layout-content">
        <header
          role="banner"
          style={{
            marginBottom: '10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <img
            src="/SevaNest_logo-removebg-preview.png"
            alt="SevaNest logo"
            style={{
              height: '38px',
              maxHeight: '42px',
              maxWidth: '160px',
              width: 'auto',
              objectFit: 'contain',
              display: 'block',
            }}
          />
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
              fontWeight: 500,
              marginTop: '4px',
              letterSpacing: '0.01em',
            }}
          >
            Operations & Administration Portal
          </span>
        </header>

        <main role="main" className="login-card">
          <Outlet />
        </main>

        <footer
          style={{
            marginTop: '10px',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
            lineHeight: 1.2,
            flexShrink: 0,
          }}
        >
          Verified Help. Trusted Homes. &bull; SevaNest Admin
        </footer>
      </div>
    </div>
  );
};
