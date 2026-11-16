import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { RequiredIndicator } from '../../../components/common/RequiredIndicator';
import { authRepository, invalidateSessionOnServer } from '../data/authRepository';
import { useAuthStore } from '../../../core/auth/authStore';
import { queryClient } from '../../../core/api/queryClient';
import { getStoredRefreshToken } from '../../../core/auth/tokenStorage';
import { DomainError } from '../../../core/errors/DomainError';
import { getDefaultLandingRoute } from '../../../core/rbac/permissions';
import { isQuickLoginEnabled } from '../../../core/config/env';
import { QuickLoginSection } from './QuickLoginSection';
import { QuickLoginRole } from './quickLoginRoles';

const signInSchema = z.object({
  email: z.string().email('Please enter a valid administrative email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export const SignInPage: React.FC = () => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [authCorrelationId, setAuthCorrelationId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const showQuickLogin = isQuickLoginEnabled();
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();

  // Clean up any lingering history state from logout redirects
  useEffect(() => {
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      if (window.history.state?.usr?.from) {
        const cleanState = { ...window.history.state };
        if (cleanState.usr) {
          cleanState.usr = { ...cleanState.usr };
          delete cleanState.usr.from;
        }
        try {
          window.history.replaceState(cleanState, document.title, window.location.href);
        } catch {
          // Ignore
        }
      }
    }
  }, []);

  // When Sign-In page is accessed (e.g. browser Back button from dashboard):
  // Authoritatively invalidate any existing session on backend and frontend,
  // clear query caches, and enforce fresh authentication.
  useEffect(() => {
    const hasActiveSession = useAuthStore.getState().isAuthenticated || Boolean(getStoredRefreshToken());
    if (hasActiveSession) {
      invalidateSessionOnServer().finally(() => {
        useAuthStore.getState().clearSession(true);
      });
      useAuthStore.getState().clearSession(false);
      try {
        queryClient.cancelQueries();
        queryClient.clear();
      } catch {
        // Ignore
      }
    }
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleSelectRole = (role: QuickLoginRole) => {
    // Populate form fields with role email and credentials without auto-submitting
    setValue('email', role.email, { shouldValidate: true, shouldDirty: true });
    setValue('password', role.password, { shouldValidate: true, shouldDirty: true });
    setAuthError(null);
    setAuthCorrelationId(null);
    setSelectedRoleId(role.id);
  };

  const onSubmit = async (values: SignInFormValues) => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      setAuthError(null);
      setAuthCorrelationId(null);
      const { user: loggedInUser, accessToken, refreshToken } = await authRepository.login(values);
      setSession(loggedInUser, accessToken, refreshToken);
      const userLanding = getDefaultLandingRoute(loggedInUser);
      // Fresh sign-in navigates to the authenticated user's designated role dashboard,
      // creating a history entry so browser Back returns to the sign-in page.
      navigate(userLanding, { replace: false, state: null });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.';
      setAuthError(errorMessage);
      setAuthCorrelationId(err instanceof DomainError && err.correlationId ? err.correlationId : null);
      // Security: Clear password input on failed login attempt while preserving entered email
      setValue('password', '');
      setSelectedRoleId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-navy)', lineHeight: 1.2, margin: 0 }}>
          Staff Sign In
        </h1>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px', lineHeight: 1.3 }}>
          Enter your administrative credentials to access operations queues.
        </p>
      </div>

      {authError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            backgroundColor: 'var(--color-status-danger-bg)',
            border: '1px solid var(--color-status-danger-border)',
            color: 'var(--color-status-danger-text)',
            padding: '6px 10px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-xs)',
          }}
          role="alert"
        >
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>
            {authError}
            {authCorrelationId ? ` (Ref: ${authCorrelationId})` : ''}
          </span>
        </div>
      )}

      {/* 1. Email and Password fields at the top */}
      <form noValidate onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="login-input-group">
          <label htmlFor="admin-email" className="login-input-label">
            Admin Email Address <RequiredIndicator />
          </label>
          <div
            className={`login-input-wrapper ${errors.email ? 'has-error' : ''} ${isSubmitting ? 'is-disabled' : ''}`}
          >
            <div className="login-input-icon">
              <Mail size={16} />
            </div>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              {...register('email', {
                onChange: () => {
                  setAuthError(null);
                  setAuthCorrelationId(null);
                  setSelectedRoleId(null);
                },
              })}
              disabled={isSubmitting}
              placeholder="name@sevanest.internal"
              className="login-input-field"
            />
          </div>
          {errors.email && (
            <span role="alert" aria-live="polite" className="login-input-error">
              {errors.email.message}
            </span>
          )}
        </div>

        <div className="login-input-group">
          <label htmlFor="admin-password" className="login-input-label">
            Password <RequiredIndicator />
          </label>
          <div
            className={`login-input-wrapper ${errors.password ? 'has-error' : ''} ${isSubmitting ? 'is-disabled' : ''}`}
          >
            <div className="login-input-icon">
              <Lock size={16} />
            </div>
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password', {
                onChange: () => {
                  setAuthError(null);
                  setAuthCorrelationId(null);
                  setSelectedRoleId(null);
                },
              })}
              disabled={isSubmitting}
              placeholder="Enter password"
              className="login-input-field"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              disabled={isSubmitting}
              className="login-password-toggle"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <span role="alert" aria-live="polite" className="login-input-error">
              {errors.password.message}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          aria-label="Sign In to Operations Console"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            backgroundColor: isSubmitting ? 'var(--color-bg-disabled)' : 'var(--color-primary)',
            color: isSubmitting ? 'var(--color-text-disabled)' : '#ffffff',
            padding: '0 12px',
            height: '44px',
            minHeight: '44px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 600,
            marginTop: '2px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            transition: 'background-color var(--transition-fast)',
            border: 'none',
          }}
        >
          <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Operations Console'}</span>
          <ArrowRight size={16} />
        </button>
      </form>

      {/* 2. Quick Login Section below the Sign In form */}
      {showQuickLogin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: '4px 0' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }} />
          <span
            style={{
              fontSize: '11px',
              color: 'var(--color-text-muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            or quick login
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }} />
        </div>
      )}

      {showQuickLogin && (
        <QuickLoginSection
          selectedRoleId={selectedRoleId}
          onSelectRole={handleSelectRole}
          disabled={isSubmitting}
        />
      )}
    </div>
  );
};