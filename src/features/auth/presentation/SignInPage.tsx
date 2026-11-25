import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, ArrowRight, Eye, EyeOff, Loader2, RotateCw } from 'lucide-react';
import { RequiredIndicator } from '../../../components/common/RequiredIndicator';
import { authRepository, invalidateSessionOnServer } from '../data/authRepository';
import { useAuthStore } from '../../../core/auth/authStore';
import { queryClient } from '../../../core/api/queryClient';
import { getStoredRefreshToken } from '../../../core/auth/tokenStorage';
import { DomainError, UnauthorizedError, RateLimitExceededError, OfflineError } from '../../../core/errors/DomainError';
import { getDefaultLandingRoute } from '../../../core/rbac/permissions';
import { isQuickLoginEnabled, env } from '../../../core/config/env';
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
  const [wakeUpStatus, setWakeUpStatus] = useState<{ attempt: number; maxRetries: number } | null>(null);
  const [isRetryableError, setIsRetryableError] = useState(false);
  const [retryCooldown, setRetryCooldown] = useState(0);
  const showQuickLogin = isQuickLoginEnabled();
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();

  // Cooldown countdown timer for rate-limit / Cloudflare security challenges
  useEffect(() => {
    if (retryCooldown <= 0) return;
    const timer = setInterval(() => {
      setRetryCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [retryCooldown]);

  // Pre-warm the backend on Render when user visits the sign-in page (online only)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    const controller = typeof window !== 'undefined' && window.AbortController
      ? new window.AbortController()
      : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 15000) : null;
    const probeUrl = `${(env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')}/app-config`;
    fetch(probeUrl, { method: 'GET', cache: 'no-store', signal: controller?.signal }).catch(() => {});
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (controller) controller.abort();
    };
  }, []);

  // Listen for browser online / offline connectivity changes
  useEffect(() => {
    const handleOffline = () => {
      setWakeUpStatus(null);
      setIsSubmitting(false);
      setAuthError('No internet connection. Please check your network and try again.');
      setIsRetryableError(true);
    };

    const handleOnline = () => {
      setAuthError((prev) => {
        if (prev && prev.includes('No internet connection')) {
          return null;
        }
        return prev;
      });
      setIsRetryableError(false);
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      handleOffline();
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Listen for backend waking-up progress and wake-up stopped events
  useEffect(() => {
    const handleWakingUp: Parameters<typeof window.addEventListener>[1] = (e) => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setWakeUpStatus(null);
        return;
      }
      const detail = (e as { detail?: { attempt: number; maxRetries: number } })?.detail;
      if (detail) {
        setWakeUpStatus(detail);
      }
    };
    const handleWakingUpStopped = () => {
      setWakeUpStatus(null);
    };
    window.addEventListener('backend-waking-up', handleWakingUp);
    window.addEventListener('backend-waking-up-stopped', handleWakingUpStopped);
    return () => {
      window.removeEventListener('backend-waking-up', handleWakingUp);
      window.removeEventListener('backend-waking-up-stopped', handleWakingUpStopped);
    };
  }, []);

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
      setIsRetryableError(false);
      setRetryCooldown(0);
      setSelectedRoleId(role.id);
    };

  const onSubmit = async (values: SignInFormValues) => {
    if (isSubmitting || retryCooldown > 0) return;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setWakeUpStatus(null);
      setAuthError('No internet connection. Please check your network and try again.');
      setIsRetryableError(true);
      setIsSubmitting(false);
      return;
    }

    try {
      setIsSubmitting(true);
      setWakeUpStatus(null);
      setAuthError(null);
      setAuthCorrelationId(null);
      setIsRetryableError(false);
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

      const isOfflineError =
        err instanceof OfflineError ||
        (err instanceof DomainError && err.code === 'OFFLINE_ERROR') ||
        (typeof navigator !== 'undefined' && navigator.onLine === false) ||
        errorMessage.toLowerCase().includes('no internet connection');

      if (isOfflineError) {
        setWakeUpStatus(null);
        setIsRetryableError(true);
        setRetryCooldown(0);
        return;
      }

      const isRateLimitOrChallenge =
        err instanceof RateLimitExceededError ||
        (err instanceof DomainError && err.code === 'RATE_LIMIT_EXCEEDED') ||
        errorMessage.toLowerCase().includes('cloudflare') ||
        errorMessage.toLowerCase().includes('challenge') ||
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.toLowerCase().includes('too many requests');

      if (isRateLimitOrChallenge) {
        setWakeUpStatus(null);
        setIsRetryableError(true);
        setRetryCooldown(10);
        return;
      }

      // Security: Clear password input ONLY on invalid credentials, NOT on server/network/waking errors
      const isCredentialError =
        err instanceof UnauthorizedError ||
        (err instanceof DomainError && (err.code === 'UNAUTHORIZED' || ('errorCode' in err && (err as { errorCode?: string }).errorCode === 'INVALID_CREDENTIALS')));
      if (isCredentialError) {
        setValue('password', '');
        setSelectedRoleId(null);
        setIsRetryableError(false);
        setRetryCooldown(0);
      } else {
        setIsRetryableError(true);
        setRetryCooldown(0);
      }
    } finally {
      setIsSubmitting(false);
      setWakeUpStatus(null);
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

      {wakeUpStatus && !authError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#92400e',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-xs)',
          }}
          role="status"
          aria-live="polite"
        >
          <Loader2
            size={16}
            style={{
              flexShrink: 0,
              animation: 'spin 1s linear infinite',
            }}
          />
          <span>
            Backend server is waking up on Render (attempt {wakeUpStatus.attempt}/{wakeUpStatus.maxRetries}). Please hold on, connecting automatically...
          </span>
        </div>
      )}

      {authError && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            backgroundColor: 'var(--color-status-danger-bg)',
            border: '1px solid var(--color-status-danger-border)',
            color: 'var(--color-status-danger-text)',
            padding: '8px 10px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-xs)',
          }}
          role="alert"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>
              {authError}
              {authCorrelationId ? ` (Ref: ${authCorrelationId})` : ''}
            </span>
          </div>
          {(isRetryableError || authError.includes('No internet connection') || authError.includes('waking up on Render') || authError.includes('temporarily unavailable') || authError.toLowerCase().includes('cloudflare') || authError.toLowerCase().includes('challenge') || authError.toLowerCase().includes('rate limit')) && (
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting || retryCooldown > 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                alignSelf: 'flex-start',
                marginTop: '2px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: isSubmitting || retryCooldown > 0 ? 'var(--color-bg-disabled, #94a3b8)' : 'var(--color-primary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: isSubmitting || retryCooldown > 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <RotateCw size={12} style={isSubmitting ? { animation: 'spin 1s linear infinite' } : undefined} />
              <span>{retryCooldown > 0 ? `Retry available in ${retryCooldown}s` : 'Retry Sign In Now'}</span>
            </button>
          )}
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
                  setIsRetryableError(false);
                  setRetryCooldown(0);
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
                  setIsRetryableError(false);
                  setRetryCooldown(0);
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
          disabled={isSubmitting || retryCooldown > 0}
          aria-label="Sign In to Operations Console"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            backgroundColor: isSubmitting || retryCooldown > 0 ? 'var(--color-bg-disabled)' : 'var(--color-primary)',
            color: isSubmitting || retryCooldown > 0 ? 'var(--color-text-disabled)' : '#ffffff',
            padding: '0 12px',
            height: '44px',
            minHeight: '44px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 600,
            marginTop: '2px',
            cursor: isSubmitting || retryCooldown > 0 ? 'not-allowed' : 'pointer',
            transition: 'background-color var(--transition-fast)',
            border: 'none',
          }}
        >
          {wakeUpStatus ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Waking Server ({wakeUpStatus.attempt}/{wakeUpStatus.maxRetries})...</span>
            </>
          ) : isSubmitting ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Authenticating...</span>
            </>
          ) : retryCooldown > 0 ? (
            <span>Wait {retryCooldown}s to Sign In</span>
          ) : (
            <>
              <span>Sign In to Operations Console</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

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