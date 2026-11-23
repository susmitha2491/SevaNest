/* global BroadcastChannel, MessageEvent, StorageEvent, MouseEvent, Event */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, LogOut, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuthStore } from './authStore';
import { useSessionSecurityStore, POLICY_STORAGE_KEY } from './sessionSecurityStore';
import { requestTokenRefresh } from './tokenRefreshCoordinator';
import { getStoredRefreshToken } from './tokenStorage';
import { useBodyScrollLock } from '../../shared/hooks/useBodyScrollLock';

export const SessionInactivityGuard: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const clearSession = useAuthStore((s) => s.clearSession);

  const autoLogoutEnabled = useSessionSecurityStore((s) => s.autoLogoutEnabled);
  const timeoutMinutes = useSessionSecurityStore((s) => s.timeoutMinutes);
  const warningDurationSeconds = useSessionSecurityStore((s) => s.warningDurationSeconds);
  const recordActivity = useSessionSecurityStore((s) => s.recordActivity);
  const lastActivityTime = useSessionSecurityStore((s) => s.lastActivityTime);

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(warningDurationSeconds);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useBodyScrollLock(isAuthenticated && showWarningModal);

  const showWarningModalRef = useRef<boolean>(showWarningModal);
  useEffect(() => {
    showWarningModalRef.current = showWarningModal;
  }, [showWarningModal]);

  const lastEventThrottleRef = useRef<number>(0);
  const lastCoordinatesRef = useRef<{ x: number; y: number } | null>(null);
  const isTerminatingRef = useRef<boolean>(false);
  const isRefreshingRef = useRef<boolean>(false);
  const syncChannelRef = useRef<BroadcastChannel | null>(null);

  // Session termination handler
  const handleTerminateSession = useCallback(() => {
    if (isTerminatingRef.current) return;
    isTerminatingRef.current = true;
    setShowWarningModal(false);
    showWarningModalRef.current = false;

    try {
      clearSession(true);
    } finally {
      navigate('/auth/login', { replace: true, state: null });
    }
  }, [clearSession, navigate]);

  // Broadcast Channel setup for multi-tab activity coordination
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
      return;
    }

    try {
      const channel = new BroadcastChannel('sevanest_activity_sync');
      syncChannelRef.current = channel;

      channel.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'USER_ACTIVITY' || data.type === 'STAY_LOGGED_IN') {
          // Verify tab has not already expired before accepting cross-tab activity
          const now = Date.now();
          const totalTimeoutMs = useSessionSecurityStore.getState().timeoutMinutes * 60 * 1000;
          const currentLast = useSessionSecurityStore.getState().lastActivityTime;
          if (useSessionSecurityStore.getState().autoLogoutEnabled && now >= currentLast + totalTimeoutMs) {
            handleTerminateSession();
            return;
          }
          recordActivity();
          setShowWarningModal(false);
          showWarningModalRef.current = false;
          isTerminatingRef.current = false;
        }

        if (data.type === 'POLICY_UPDATE' && data.policy && typeof data.policy === 'object') {
          const { autoLogoutEnabled: syncEnabled, timeoutMinutes: syncTimeout } = data.policy as {
            autoLogoutEnabled?: boolean;
            timeoutMinutes?: number;
          };
          useSessionSecurityStore.setState((state) => ({
            ...state,
            ...(typeof syncEnabled === 'boolean' ? { autoLogoutEnabled: syncEnabled } : {}),
            ...(typeof syncTimeout === 'number' ? { timeoutMinutes: syncTimeout } : {}),
          }));
        }
      };

      return () => {
        channel.close();
        syncChannelRef.current = null;
      };
    } catch {
      // Ignore BroadcastChannel initialization failures
    }
  }, [recordActivity, handleTerminateSession]);

  // Storage event listener for cross-tab policy updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === POLICY_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            useSessionSecurityStore.setState((state) => ({
              ...state,
              ...(typeof parsed.autoLogoutEnabled === 'boolean' ? { autoLogoutEnabled: parsed.autoLogoutEnabled } : {}),
              ...(typeof parsed.timeoutMinutes === 'number' ? { timeoutMinutes: parsed.timeoutMinutes } : {}),
            }));
          }
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // "Stay Logged In" handler - authoritatively refreshes session before resetting timer
  const handleStayLoggedIn = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);

    try {
      // 1. Authoritative backend token refresh when refresh token is available
      const storedToken = useAuthStore.getState().refreshToken || getStoredRefreshToken();
      if (storedToken) {
        await requestTokenRefresh();
      }

      // 2. ONLY after successful continuation, reset inactivity timer and dismiss warning
      const now = Date.now();
      lastEventThrottleRef.current = now;
      recordActivity();
      setShowWarningModal(false);
      showWarningModalRef.current = false;
      isTerminatingRef.current = false;

      // Broadcast to other tabs
      if (syncChannelRef.current) {
        try {
          syncChannelRef.current.postMessage({ type: 'STAY_LOGGED_IN', timestamp: now });
        } catch {
          // Broadcast ignore
        }
      }
    } catch {
      // If token refresh fails (session invalid/revoked on backend), terminate immediately
      handleTerminateSession();
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [recordActivity, handleTerminateSession]);

  // Evaluates deadline-based inactivity status (elapsed time relative to authoritative deadline)
  const evaluateDeadline = useCallback(() => {
    if (!isAuthenticated || !autoLogoutEnabled) {
      if (showWarningModalRef.current) {
        setShowWarningModal(false);
        showWarningModalRef.current = false;
      }
      return;
    }

    const now = Date.now();
    const totalTimeoutMs = timeoutMinutes * 60 * 1000;
    const deadline = lastActivityTime + totalTimeoutMs;
    const warningDurationMs = Math.min(warningDurationSeconds * 1000, totalTimeoutMs);
    const warningThreshold = deadline - warningDurationMs;

    if (now >= deadline) {
      handleTerminateSession();
      return;
    }

    if (now >= warningThreshold) {
      const remainingSeconds = Math.max(1, Math.ceil((deadline - now) / 1000));
      setShowWarningModal(true);
      showWarningModalRef.current = true;
      setSecondsRemaining(remainingSeconds);
    } else {
      if (showWarningModalRef.current) {
        setShowWarningModal(false);
        showWarningModalRef.current = false;
      }
    }
  }, [
    isAuthenticated,
    autoLogoutEnabled,
    lastActivityTime,
    timeoutMinutes,
    warningDurationSeconds,
    handleTerminateSession,
  ]);

  // Scheduled timeout deadlines & periodic fallback interval (runs every 1000ms)
  useEffect(() => {
    if (!isAuthenticated || !autoLogoutEnabled) {
      setShowWarningModal(false);
      showWarningModalRef.current = false;
      return;
    }

    // Evaluate immediately on mount or dependency change
    evaluateDeadline();

    const now = Date.now();
    const totalTimeoutMs = timeoutMinutes * 60 * 1000;
    const deadline = lastActivityTime + totalTimeoutMs;
    const warningDurationMs = Math.min(warningDurationSeconds * 1000, totalTimeoutMs);
    const warningThreshold = deadline - warningDurationMs;

    const msUntilWarning = Math.max(0, warningThreshold - now);
    const msUntilDeadline = Math.max(0, deadline - now);

    // Schedule exact timeouts for deadline and warning
    const warningTimeoutId = window.setTimeout(() => {
      evaluateDeadline();
    }, msUntilWarning);

    const deadlineTimeoutId = window.setTimeout(() => {
      evaluateDeadline();
    }, msUntilDeadline);

    // Periodic check interval (runs every 1000ms to update countdown and catch clock drift)
    const intervalId = window.setInterval(() => {
      evaluateDeadline();
    }, 1000);

    return () => {
      window.clearTimeout(warningTimeoutId);
      window.clearTimeout(deadlineTimeoutId);
      window.clearInterval(intervalId);
    };
  }, [
    isAuthenticated,
    autoLogoutEnabled,
    lastActivityTime,
    timeoutMinutes,
    warningDurationSeconds,
    evaluateDeadline,
  ]);

  // Tab visibility, focus, and pageshow listeners (immediately checks deadline when tab wakes or focuses)
  useEffect(() => {
    if (!isAuthenticated || !autoLogoutEnabled) return;

    const handleVisibilityOrFocus = () => {
      evaluateDeadline();
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('pageshow', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('pageshow', handleVisibilityOrFocus);
    };
  }, [isAuthenticated, autoLogoutEnabled, evaluateDeadline]);

  // Genuine user interaction event listener with throttling
  const handleUserActivity = useCallback(
    (event?: Event) => {
      if (!isAuthenticated || !autoLogoutEnabled) return;

      const now = Date.now();
      const totalTimeoutMs = timeoutMinutes * 60 * 1000;
      const deadline = lastActivityTime + totalTimeoutMs;

      // 1. If deadline has already passed, do NOT allow user activity to revive an expired session!
      if (now >= deadline) {
        handleTerminateSession();
        return;
      }

      // 2. If warning modal is actively displayed, do NOT let passive pointer/scroll reset the warning!
      // The user must click "Stay Logged In" to extend the session.
      if (showWarningModalRef.current) {
        return;
      }

      // 3. Coordinate check for mousemove / pointermove to ignore micro-jitter / synthetic events
      if (event && (event.type === 'mousemove' || event.type === 'pointermove')) {
        const me = event as MouseEvent;
        if (typeof me.clientX === 'number' && typeof me.clientY === 'number') {
          if (
            lastCoordinatesRef.current &&
            lastCoordinatesRef.current.x === me.clientX &&
            lastCoordinatesRef.current.y === me.clientY
          ) {
            return;
          }
          lastCoordinatesRef.current = { x: me.clientX, y: me.clientY };
        }
      }

      // 4. Throttle activity recording to at most once per 1000ms
      if (now - lastEventThrottleRef.current < 1000) {
        return;
      }
      lastEventThrottleRef.current = now;

      recordActivity();

      // Notify other tabs
      if (syncChannelRef.current) {
        try {
          syncChannelRef.current.postMessage({ type: 'USER_ACTIVITY', timestamp: now });
        } catch {
          // Broadcast ignore
        }
      }
    },
    [
      isAuthenticated,
      autoLogoutEnabled,
      lastActivityTime,
      timeoutMinutes,
      handleTerminateSession,
      recordActivity,
    ]
  );

  // Attach DOM interaction listeners to window
  useEffect(() => {
    if (!isAuthenticated) return;

    const interactionEvents = [
      'mousedown',
      'mouseup',
      'keydown',
      'keyup',
      'touchstart',
      'touchend',
      'pointerdown',
      'mousemove',
      'scroll',
    ];
    const listener = (e: Event) => handleUserActivity(e);

    interactionEvents.forEach((event) => {
      window.addEventListener(event, listener, { passive: true });
    });

    return () => {
      interactionEvents.forEach((event) => {
        window.removeEventListener(event, listener);
      });
    };
  }, [isAuthenticated, handleUserActivity]);

  if (!isAuthenticated || !showWarningModal) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-warning-title"
      data-testid="session-inactivity-warning-modal"
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: 'var(--space-4)',
        overscrollBehavior: 'contain',
      }}
    >
      <div
        className="modal-content"
        style={{
          backgroundColor: 'var(--color-surface, #ffffff)',
          borderRadius: 'var(--radius-xl, 12px)',
          maxWidth: '460px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
          border: '1px solid var(--color-border, #e2e8f0)',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        {/* Warning Banner Header */}
        <div
          style={{
            padding: 'var(--space-5) var(--space-6)',
            backgroundColor: 'var(--color-warning-bg, #fffbeb)',
            borderBottom: '1px solid var(--color-warning-border, #fef3c7)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-full, 9999px)',
              backgroundColor: 'var(--color-warning-100, #fef3c7)',
              color: 'var(--color-warning-dark, #b45309)',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3
              id="inactivity-warning-title"
              style={{
                fontSize: 'var(--font-size-md, 15px)',
                fontWeight: 700,
                color: 'var(--color-warning-dark, #92400e)',
                margin: 0,
              }}
            >
              Session Inactivity Warning
            </h3>
            <p
              style={{
                fontSize: 'var(--font-size-xs, 12px)',
                color: 'var(--color-warning-dark, #b45309)',
                margin: '2px 0 0 0',
              }}
            >
              Automatic logout due to user inactivity
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="modal-scrollable-body" style={{ padding: 'var(--space-6)', overscrollBehavior: 'contain' }}>
          <p
            style={{
              fontSize: 'var(--font-size-sm, 13px)',
              color: 'var(--color-text-secondary, #475569)',
              lineHeight: 1.5,
              margin: '0 0 var(--space-4) 0',
            }}
          >
            To protect sensitive household records, verification credentials, and financial operations,
            your administrative session will automatically terminate in:
          </p>

          {/* Countdown Clock Display */}
          <div
            data-testid="inactivity-countdown"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
              borderRadius: 'var(--radius-lg, 8px)',
              border: '1px solid var(--color-border, #e2e8f0)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <Clock size={20} color="var(--color-brand-600, #2563eb)" />
            <span
              style={{
                fontSize: 'var(--font-size-xl, 20px)',
                fontWeight: 800,
                color: secondsRemaining <= 15 ? 'var(--color-danger-dark, #dc2626)' : 'var(--color-text-primary, #0f172a)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {secondsRemaining} seconds
            </span>
          </div>

          <p
            style={{
              fontSize: 'var(--font-size-xs, 12px)',
              color: 'var(--color-text-muted, #64748b)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Click <strong>Stay Logged In</strong> below to refresh your credentials and keep your current workspace active.
          </p>
        </div>

        {/* Action Footer */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
            borderTop: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            data-testid="logout-now-button"
            onClick={handleTerminateSession}
            disabled={isRefreshing}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md, 6px)',
              border: '1px solid var(--color-border, #cbd5e1)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary, #475569)',
              fontSize: 'var(--font-size-sm, 13px)',
              fontWeight: 600,
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <LogOut size={14} />
            Log Out Now
          </button>

          <button
            type="button"
            data-testid="stay-logged-in-button"
            onClick={handleStayLoggedIn}
            disabled={isRefreshing}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-md, 6px)',
              border: 'none',
              backgroundColor: isRefreshing ? 'var(--color-brand-400, #60a5fa)' : 'var(--color-brand-600, #2563eb)',
              color: '#ffffff',
              fontSize: 'var(--font-size-sm, 13px)',
              fontWeight: 600,
              cursor: isRefreshing ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
            }}
          >
            {isRefreshing ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Refreshing Session...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                <span>Stay Logged In</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
