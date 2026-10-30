import React from 'react';
import { Outlet } from 'react-router-dom';

export const PublicLayout: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg-app)',
        padding: '12px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          marginBottom: '10px',
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
            maxWidth: '180px',
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
            marginTop: '3px',
          }}
        >
          Operations & Administration Portal
        </span>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '16px 20px',
          boxShadow: 'var(--shadow-md)',
          boxSizing: 'border-box',
        }}
      >
        <Outlet />
      </div>

      <footer
        style={{
          marginTop: '10px',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-disabled)',
          textAlign: 'center',
          lineHeight: 1.2,
        }}
      >
        Verified Help. Trusted Homes. &bull; SevaNest Admin
      </footer>
    </div>
  );
};
