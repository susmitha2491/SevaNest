import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { authRepository } from '../data/authRepository';
import { useAuthStore } from '../../../core/auth/authStore';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const showQuickLogin = isQuickLoginEnabled();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();

  // Redirect to role-authorized landing dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const userLanding = getDefaultLandingRoute(user);
      navigate(userLanding, { replace: true, state: null });
    }
  }, [isAuthenticated, user, navigate]);

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
    setSelectedRoleId(role.id);
  };

  const onSubmit = async (values: SignInFormValues) => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      setAuthError(null);
      const { user: loggedInUser, accessToken, refreshToken } = await authRepository.login(values);
      setSession(loggedInUser, accessToken, refreshToken);
      const userLanding = getDefaultLandingRoute(loggedInUser);
      // Fresh sign-in must always navigate directly to the authenticated user's designated role dashboard,
      // clearing any stale 'from' or 'returnTo' navigation state from earlier sessions.
      navigate(userLanding, { replace: true, state: null });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.';
      setAuthError(errorMessage);
      // Security: Clear password input on failed login attempt while preserving entered email
      setValue('password', '');
      setSelectedRoleId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div>
        <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
          Staff Sign In
        </h2>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
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
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-xs)',
          }}
          role="alert"
        >
          <AlertCircle size={16} />
          <span>{authError}</span>
        </div>
      )}

      {/* 1. Email and Password fields at the top */}
      <form noValidate onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label htmlFor="admin-email" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            Admin Email Address
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              backgroundColor: 'var(--color-bg-app)',
              border: `1px solid ${errors.email ? 'var(--color-error)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '0 var(--space-3)',
              height: '42px',
            }}
          >
            <Mail size={16} style={{ color: 'var(--color-text-muted)' }} />
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              {...register('email', {
                onChange: () => {
                  setAuthError(null);
                  setSelectedRoleId(null);
                },
              })}
              disabled={isSubmitting}
              placeholder="name@sevanest.internal"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                width: '100%',
              }}
            />
          </div>
          {errors.email && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-status-danger-text)' }}>
              {errors.email.message}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label htmlFor="admin-password" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            Password
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              backgroundColor: 'var(--color-bg-app)',
              border: `1px solid ${errors.password ? 'var(--color-error)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '0 var(--space-3)',
              height: '42px',
            }}
          >
            <Lock size={16} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              {...register('password', {
                onChange: () => {
                  setAuthError(null);
                  setSelectedRoleId(null);
                },
              })}
              disabled={isSubmitting}
              placeholder="Enter password"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                width: '100%',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              disabled={isSubmitting}
              style={{
                background: 'none',
                border: 'none',
                padding: 'var(--space-1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                color: 'var(--color-text-muted)',
                borderRadius: 'var(--radius-sm)',
                flexShrink: 0,
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-status-danger-text)' }}>
              {errors.password.message}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-1)',
            backgroundColor: isSubmitting ? 'var(--color-bg-disabled)' : 'var(--color-primary)',
            color: isSubmitting ? 'var(--color-text-disabled)' : '#ffffff',
            padding: '11px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 600,
            marginTop: 0,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            transition: 'background-color var(--transition-fast)',
          }}
        >
          <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Operations Console'}</span>
          <ArrowRight size={16} />
        </button>
      </form>

      {/* 2. Quick Login Section below the Sign In form */}
      {showQuickLogin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 'var(--space-1) 0' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border)' }} />
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
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