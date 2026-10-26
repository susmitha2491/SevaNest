import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Key,
  LogOut,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Mail,
  Fingerprint,
} from 'lucide-react';
import { useAuthStore } from '../../../core/auth/authStore';
import { authRepository } from '../data/authRepository';
import { getRoleLabel, getDefaultLandingRoute } from '../../../core/rbac/permissions';
import { env } from '../../../core/config/env';

export const MyAccountPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.clearSession);

  const handleLogout = async () => {
    try {
      await authRepository.logout();
    } catch (err: unknown) {
      console.warn('Logout notification error encountered:', err);
    } finally {
      clearSession();
      navigate('/auth/login', { replace: true, state: null });
    }
  };

  const handleBackToWorkstation = () => {
    const target = getDefaultLandingRoute(user);
    navigate(target);
  };

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>No active authenticated user session found.</p>
        <button
          onClick={() => navigate('/auth/login')}
          style={{
            marginTop: 'var(--space-4)',
            padding: '8px 16px',
            backgroundColor: 'var(--color-brand-600)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '960px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            My Account & Staff Profile
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Operational profile, security credentials, assigned permissions, and active session telemetry.
          </p>
        </div>
        <button
          onClick={handleBackToWorkstation}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-surface)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <ArrowLeft size={16} />
          <span>Return to Workstation</span>
        </button>
      </div>

      {/* Staff Identity Card */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: 'var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-subtle)',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-brand-100, #e0f2fe)',
              color: 'var(--color-brand-700, #0369a1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '24px',
              border: '2px solid var(--color-brand-600)',
            }}
          >
            {user.name.charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0 }}>
                {user.name}
              </h2>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-primary-subtle)',
                  color: 'var(--color-primary)',
                  border: '1px solid var(--color-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {getRoleLabel(user.role)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginTop: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Mail size={14} color="var(--color-text-muted)" />
                {user.email}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace' }}>
                <Fingerprint size={14} color="var(--color-text-muted)" />
                Staff ID: {user.id}
              </span>
              <span>Environment: <strong>{env.VITE_APP_ENV}</strong></span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-status-danger-bg)',
              color: 'var(--color-status-danger-text)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              border: '1px solid var(--color-status-danger-border)',
              cursor: 'pointer',
            }}
          >
            <LogOut size={16} />
            <span>Sign Out Session</span>
          </button>
        </div>

        {/* Account Details Grid */}
        <div
          style={{
            padding: 'var(--space-6)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'var(--space-6)',
          }}
        >
          {/* Security & Access Box */}
          <div
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-subtle)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <Lock size={18} color="var(--color-brand-600)" />
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, margin: 0 }}>
                Security & Session Telemetry
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--font-size-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Authentication Standard:</span>
                <span style={{ fontWeight: 600 }}>Bearer JWT (RFC 7519)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Storage Security:</span>
                <span style={{ fontWeight: 600 }}>In-Memory + Session Storage</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Session Integrity:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-status-success-text)' }}>Active & Validated</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Platform Scope:</span>
                <span style={{ fontWeight: 600 }}>SevaNest Admin Workstation</span>
              </div>
            </div>
          </div>

          {/* Operational Boundaries Box */}
          <div
            style={{
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-bg-subtle)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <Shield size={18} color="var(--color-accent)" />
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, margin: 0 }}>
                Operational Role Boundaries
              </h3>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Your account operates under strict role-based access controls. Authorized actions include inspecting worker dossiers, verifying KYC credentials, conducting employer telephonic checks, and issuing compliance determinations.
            </p>
          </div>
        </div>
      </div>

      {/* Granted Server-Issued Permissions Matrix */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--color-border)',
          padding: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <Key size={20} color="var(--color-brand-600)" />
          <h2 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, margin: 0 }}>
            Server-Issued Permissions Matrix ({user.permissions?.length || 0})
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
          {(user.permissions || []).map((perm) => (
            <div
              key={perm}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-subtle)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-xs)',
              }}
            >
              <CheckCircle2 size={16} color="var(--color-status-success-text)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                  {perm}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  Granted by Authorization Provider
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
