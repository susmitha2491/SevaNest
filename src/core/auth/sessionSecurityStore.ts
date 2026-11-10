import { create } from 'zustand';

export interface SessionSecurityPolicy {
  autoLogoutEnabled: boolean;
  timeoutMinutes: 10 | 15;
  warningDurationSeconds: number; // 60s
  lastActivityTime: number;
  setPolicy: (policy: Partial<Omit<SessionSecurityPolicy, 'lastActivityTime' | 'setPolicy' | 'recordActivity'>>) => void;
  recordActivity: () => void;
  resetPolicy: () => void;
}

const DEFAULT_TIMEOUT_MINUTES: 10 | 15 = 15;
const DEFAULT_WARNING_SECONDS = 60;
export const LAST_ACTIVITY_KEY = 'sevanest_last_activity';

const getInitialActivityTime = (): number => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = window.sessionStorage.getItem(LAST_ACTIVITY_KEY);
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
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
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

export const useSessionSecurityStore = create<SessionSecurityPolicy>((set) => ({
  autoLogoutEnabled: true,
  timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
  warningDurationSeconds: DEFAULT_WARNING_SECONDS,
  lastActivityTime: getInitialActivityTime(),

  setPolicy: (updates) => {
    set((state) => ({ ...state, ...updates }));
  },

  recordActivity: () => {
    const now = Date.now();
    persistActivityTime(now);
    set({ lastActivityTime: now });
  },

  resetPolicy: () => {
    const now = Date.now();
    persistActivityTime(now);
    set({
      autoLogoutEnabled: true,
      timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
      warningDurationSeconds: DEFAULT_WARNING_SECONDS,
      lastActivityTime: now,
    });
  },
}));
