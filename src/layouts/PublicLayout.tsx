import React from 'react';
import { Outlet } from 'react-router-dom';

export const PublicLayout: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg-app)',
        padding: 'var(--space-1)',
      }}
    >
      <div
        style={{
          marginBottom: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <img
          src="/sevanest-logo.png"
          alt="SevaNest logo"
          style={{
            width: '100%',
            maxWidth: '220px',
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
          }}
        />
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            fontWeight: 500,
            marginTop: 'var(--space-2)',
          }}
        >
          Operations & Administration Portal
        </span>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-6)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <Outlet />
      </div>

      <footer style={{ marginTop: 'var(--space-6)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-disabled)' }}>
        Verified Help. Trusted Homes. &bull; SevaNest Admin
      </footer>
    </div>
  );
};
