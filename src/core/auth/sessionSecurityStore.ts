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

export const useSessionSecurityStore = create<SessionSecurityPolicy>((set) => ({
  autoLogoutEnabled: true,
  timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
  warningDurationSeconds: DEFAULT_WARNING_SECONDS,
  lastActivityTime: Date.now(),

  setPolicy: (updates) => {
    set((state) => ({ ...state, ...updates }));
  },

  recordActivity: () => {
    set({ lastActivityTime: Date.now() });
  },

  resetPolicy: () => {
    set({
      autoLogoutEnabled: true,
      timeoutMinutes: DEFAULT_TIMEOUT_MINUTES,
      warningDurationSeconds: DEFAULT_WARNING_SECONDS,
      lastActivityTime: Date.now(),
    });
  },
}));

