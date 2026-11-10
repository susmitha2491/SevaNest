/* global BroadcastChannel, MessageEvent */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, LogOut, ShieldCheck } from 'lucide-react';
import { useAuthStore } from './authStore';
import { useSessionSecurityStore } from './sessionSecurityStore';
import { requestTokenRefresh } from './tokenRefreshCoordinator';

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

  const lastEventThrottleRef = useRef<number>(Date.now());
  const isTerminatingRef = useRef<boolean>(false);
  const syncChannelRef = useRef<BroadcastChannel | null>(null);

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
          recordActivity();
          setShowWarningModal(false);
          isTerminatingRef.current = false;
        }
      };

      return () => {
        channel.close();
        syncChannelRef.current = null;
      };
    } catch {
      // Ignore BroadcastChannel initialization failures
    }
  }, [recordActivity]);

  // Genuine user interaction event listener with throttling (2000ms)
  const handleUserActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastEventThrottleRef.current < 2000) {
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
  }, [recordActivity]);

  // Attach DOM interaction listeners to window
  useEffect(() => {
    if (!isAuthenticated) return;

    const interactionEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const listener = () => handleUserActivity();

    interactionEvents.forEach((event) => {
      window.addEventListener(event, listener, { passive: true });
    });

    return () => {
      interactionEvents.forEach((event) => {
        window.removeEventListener(event, listener);
      });
    };
  }, [isAuthenticated, handleUserActivity]);

  // Session termination handler
  const handleTerminateSession = useCallback(() => {
    if (isTerminatingRef.current) return;
    isTerminatingRef.current = true;
    setShowWarningModal(false);

    try {
      clearSession(true);
    } finally {
      navigate('/auth/login', { replace: true, state: null });
    }
  }, [clearSession, navigate]);

  // "Stay Logged In" handler
  const handleStayLoggedIn = useCallback(async () => {
    const now = Date.now();
    lastEventThrottleRef.current = now;
    recordActivity();
    setShowWarningModal(false);
    isTerminatingRef.current = false;

    // Broadcast to other tabs
    if (syncChannelRef.current) {
      try {
        syncChannelRef.current.postMessage({ type: 'STAY_LOGGED_IN', timestamp: now });
      } catch {
        // Broadcast ignore
      }
    }

    // Refresh backend token silently in the background
    try {
      await requestTokenRefresh();
    } catch {
      // Quiet refresh error handled gracefully by coordinator
    }
  }, [recordActivity]);

  // Periodic inactivity check interval (runs every 1000ms)
  useEffect(() => {
    if (!isAuthenticated || !autoLogoutEnabled) {
      setShowWarningModal(false);
      return;
    }

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastActivityTime) / 1000);
      const totalTimeoutSeconds = timeoutMinutes * 60;
      const remaining = totalTimeoutSeconds - elapsedSeconds;

      if (remaining <= 0) {
        handleTerminateSession();
      } else if (remaining <= warningDurationSeconds) {
        setShowWarningModal(true);
        setSecondsRemaining(remaining);
      } else {
        if (showWarningModal) {
          setShowWarningModal(false);
        }
      }
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    isAuthenticated,
    autoLogoutEnabled,
    lastActivityTime,
    timeoutMinutes,
    warningDurationSeconds,
    showWarningModal,
    handleTerminateSession,
  ]);

  if (!isAuthenticated || !showWarningModal) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-warning-title"
      data-testid="session-inactivity-warning-modal"
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
      }}
    >
      <div
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
                fontSize: 'var(--font-size-md, 16px)',
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
        <div style={{ padding: 'var(--space-6)' }}>
          <p
            style={{
              fontSize: 'var(--font-size-sm, 14px)',
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
          }}
        >
          <button
            type="button"
            data-testid="logout-now-button"
            onClick={handleTerminateSession}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md, 6px)',
              border: '1px solid var(--color-border, #cbd5e1)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary, #475569)',
              fontSize: 'var(--font-size-sm, 13px)',
              fontWeight: 600,
              cursor: 'pointer',
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
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-md, 6px)',
              border: 'none',
              backgroundColor: 'var(--color-brand-600, #2563eb)',
              color: '#ffffff',
              fontSize: 'var(--font-size-sm, 13px)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
            }}
          >
            <ShieldCheck size={16} />
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
};
