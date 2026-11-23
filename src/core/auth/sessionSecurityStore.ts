/* global BroadcastChannel */
import { create } from 'zustand';

export interface SessionSecurityPolicy {
  autoLogoutEnabled: boolean;
  timeoutMinutes: number;
  warningDurationSeconds: number; // 60s
  lastActivityTime: number;
  setPolicy: (policy: Partial<Omit<SessionSecurityPolicy, 'lastActivityTime' | 'setPolicy' | 'recordActivity'>>) => void;
  recordActivity: () => void;
  resetPolicy: () => void;
}

export const MIN_TIMEOUT_MINUTES = 5;
export const MAX_TIMEOUT_MINUTES = 60;
export const DEFAULT_TIMEOUT_MINUTES = 15;
export const DEFAULT_WARNING_SECONDS = 60;
export const LAST_ACTIVITY_KEY = 'sevanest_last_activity';
export const POLICY_STORAGE_KEY = 'sevanest_session_security_policy';

export const getInitialPolicy = (): { autoLogoutEnabled: boolean; timeoutMinutes: number } => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(POLICY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const autoLogoutEnabled = typeof parsed.autoLogoutEnabled === 'boolean' ? parsed.autoLogoutEnabled : true;
        let timeoutMinutes = typeof parsed.timeoutMinutes === 'number' ? parsed.timeoutMinutes : DEFAULT_TIMEOUT_MINUTES;
        if (Number.isNaN(timeoutMinutes) || timeoutMinutes < MIN_TIMEOUT_MINUTES || timeoutMinutes > MAX_TIMEOUT_MINUTES) {
          timeoutMinutes = DEFAULT_TIMEOUT_MINUTES;
        }
        return { autoLogoutEnabled, timeoutMinutes };
      }
    }
  } catch {
    // Graceful fallback on storage access exception
  }
  return { autoLogoutEnabled: true, timeoutMinutes: DEFAULT_TIMEOUT_MINUTES };
};

export const persistPolicy = (policy: { autoLogoutEnabled: boolean; timeoutMinutes: number }): void => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(policy));
    }
    // Broadcast policy change across open browser tabs
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('sevanest_activity_sync');
        channel.postMessage({ type: 'POLICY_UPDATE', policy });
        channel.close();
      } catch {
        // Ignore BroadcastChannel errors
      }
    }
  } catch {
    // Graceful fallback on storage access exception
  }
};

const getInitialActivityTime = (): number => {
  try {
    if (typeof window !== 'undefined') {
      const stored = window.sessionStorage?.getItem(LAST_ACTIVITY_KEY) || window.localStorage?.getItem(LAST_ACTIVITY_KEY);
      if (stored) {
        const parsed = Number(stored);
        if (!Number.isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }
  } catch {
    // Graceful fallback on storage access exception
  }
  return Date.now();
};

export const persistActivityTime = (timestamp: number): void => {
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.setItem(LAST_ACTIVITY_KEY, String(timestamp));
      window.localStorage?.setItem(LAST_ACTIVITY_KEY, String(timestamp));
    }
  } catch {
    // Graceful fallback on storage access exception
  }
};

export const clearPersistedActivityTime = (): void => {
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.removeItem(LAST_ACTIVITY_KEY);
      window.localStorage?.removeItem(LAST_ACTIVITY_KEY);
    }
  } catch {
    // Graceful fallback on storage access exception
  }
};

const initialPolicy = getInitialPolicy();

export const useSessionSecurityStore = create<SessionSecurityPolicy>((set) => ({
  autoLogoutEnabled: initialPolicy.autoLogoutEnabled,
  timeoutMinutes: initialPolicy.timeoutMinutes,
  warningDurationSeconds: DEFAULT_WARNING_SECONDS,
  lastActivityTime: getInitialActivityTime(),

  setPolicy: (updates) => {
    set((state) => {
      const updated = { ...state, ...updates };
      // Enforce bounds if timeoutMinutes is provided
      if (typeof updated.timeoutMinutes === 'number') {
        if (updated.timeoutMinutes < MIN_TIMEOUT_MINUTES) {
          updated.timeoutMinutes = MIN_TIMEOUT_MINUTES;
        } else if (updated.timeoutMinutes > MAX_TIMEOUT_MINUTES) {
          updated.timeoutMinutes = MAX_TIMEOUT_MINUTES;
        }
      }
      persistPolicy({
        autoLogoutEnabled: updated.autoLogoutEnabled,
        timeoutMinutes: updated.timeoutMinutes,
      });
      return updated;
    });
  },

  recordActivity: () => {
    const now = Date.now();
    persistActivityTime(now);
    set({ lastActivityTime: now });
  },

  resetPolicy: () => {
    const now = Date.now();
    persistActivityTime(now);
    persistPolicy({
      autoLogoutEnabled: true,
      timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
    });
    set({
      autoLogoutEnabled: true,
      timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
      warningDurationSeconds: DEFAULT_WARNING_SECONDS,
      lastActivityTime: now,
    });
  },
}));
