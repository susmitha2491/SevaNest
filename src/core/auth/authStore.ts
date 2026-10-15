import { create } from 'zustand';
import { AdminUser, AuthSession } from './authTypes';
import { getStoredRefreshToken, setStoredRefreshToken, clearStoredRefreshToken } from './tokenStorage';

export interface AuthState extends AuthSession {
  isInitialized: boolean;
  isRestoring: boolean;
  setSession: (user: AdminUser, accessToken: string, refreshToken?: string | null) => void;
  setAccessToken: (accessToken: string) => void;
  setTokens: (accessToken: string, refreshToken?: string | null) => void;
  clearSession: () => void;
  setLoading: (isLoading: boolean) => void;
  setInitialized: (isInitialized: boolean) => void;
  setRestoring: (isRestoring: boolean) => void;
}

/**
 * Zustand Store for SevaNest Admin Authentication.
 * - Access tokens and user profiles are stored in-memory.
 * - Refresh tokens are securely coordinated via tokenStorage to support session restoration across page refreshes.
 * - Password credentials are NEVER stored.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: getStoredRefreshToken() || null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  isRestoring: !!getStoredRefreshToken(),

  setSession: (user: AdminUser, accessToken: string, refreshToken?: string | null) => {
    if (refreshToken !== undefined) {
      setStoredRefreshToken(refreshToken);
    }
    set({
      user,
      accessToken,
      refreshToken: refreshToken ?? null,
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
      isRestoring: false,
    });
  },

  setAccessToken: (accessToken: string) => {
    set({ accessToken });
  },

  setTokens: (accessToken: string, refreshToken?: string | null) => {
    if (refreshToken) {
      setStoredRefreshToken(refreshToken);
    }
    set((state) => ({
      accessToken,
      refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
    }));
  },

  clearSession: () => {
    clearStoredRefreshToken();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: true,
      isRestoring: false,
    });
  },

  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },

  setInitialized: (isInitialized: boolean) => {
    set({ isInitialized });
  },

  setRestoring: (isRestoring: boolean) => {
    set({ isRestoring });
  },
}));

