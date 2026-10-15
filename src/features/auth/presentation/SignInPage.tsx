import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Mail, AlertCircle, ArrowRight, Info, Eye, EyeOff } from 'lucide-react';
import { authRepository } from '../data/authRepository';
import { useAuthStore } from '../../../core/auth/authStore';
import { env } from '../../../core/config/env';
import { getDefaultLandingRoute } from '../../../core/rbac/permissions';

const signInSchema = z.object({
  email: z.string().email('Please enter a valid administrative email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export const SignInPage: React.FC = () => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname?: string; search?: string } })?.from;

  // Redirect to role-authorized landing workstation if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const userLanding = getDefaultLandingRoute(user);
      const hasValidFrom = from?.pathname && from.pathname !== '/' && !from.pathname.startsWith('/auth');
      const finalDestination = hasValidFrom ? `${from.pathname}${from.search || ''}` : userLanding;
      navigate(finalDestination, { replace: true });
    }
  }, [isAuthenticated, user, from, navigate]);

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

  const onSubmit = async (values: SignInFormValues) => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      setAuthError(null);
      const { user: loggedInUser, accessToken, refreshToken } = await authRepository.login(values);
      setSession(loggedInUser, accessToken, refreshToken);
      const userLanding = getDefaultLandingRoute(loggedInUser);
      const hasValidFrom = from?.pathname && from.pathname !== '/' && !from.pathname.startsWith('/auth');
      const finalDestination = hasValidFrom ? `${from.pathname}${from.search || ''}` : userLanding;
      navigate(finalDestination, { replace: true });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.';
      setAuthError(errorMessage);
      // Security: Clear password input on failed login attempt while preserving entered email
      setValue('password', '');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div>
        <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
          Staff Sign In
        </h2>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
          Enter your administrative credentials to access operations queues.
        </p>
      </div>

      {/* Authentication Mode Notice */}
      <div
        style={{
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--color-status-info-bg)',
          border: '1px solid var(--color-status-info-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-status-info-text)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        <Info size={16} style={{ flexShrink: 0 }} />
        <span>
          {env.VITE_USE_MOCK_AUTH ? (
            <>
              <strong>Simulated Sandbox:</strong> In-memory mock authentication for development & testing.
            </>
          ) : (
            <>
              <strong>Backend API Gateway:</strong> Authenticating with <code>{env.VITE_API_BASE_URL}</code>.
            </>
          )}
        </span>
      </div>

      {authError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
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

      <form noValidate onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label htmlFor="admin-email" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            Admin Email Address
          </label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
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
              {...register('email', { onChange: () => setAuthError(null) })}
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
              gap: 'var(--space-2)',
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
              {...register('password', { onChange: () => setAuthError(null) })}
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
            gap: 'var(--space-2)',
            backgroundColor: isSubmitting ? 'var(--color-bg-disabled)' : 'var(--color-primary)',
            color: isSubmitting ? 'var(--color-text-disabled)' : '#ffffff',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 600,
            marginTop: 'var(--space-2)',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
          }}
        >
          <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Operations Console'}</span>
          <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
};
