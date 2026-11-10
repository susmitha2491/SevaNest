import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { authRepository, RealAuthRepository } from '../features/auth/data/authRepository';
import { httpClient } from '../core/api/httpClient';
import { restoreSession, resetSessionRestorationState } from '../core/auth/sessionRestoration';
import { resetRefreshCoordinator } from '../core/auth/tokenRefreshCoordinator';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderApp(initialEntry = '/auth/login') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const memoryRouter = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
  });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={memoryRouter} />
      </QueryClientProvider>
    ),
    router: memoryRouter,
    queryClient,
  };
}

describe('Audit & Fix: Unnecessary /api/v1/users/me 401 Request on Unauthenticated Login Page', () => {
  beforeEach(() => {
    cleanup();
    resetRefreshCoordinator();
    resetSessionRestorationState();
    useAuthStore.getState().clearSession(false);
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    resetRefreshCoordinator();
    resetSessionRestorationState();
    useAuthStore.getState().clearSession(false);
    vi.restoreAllMocks();
  });

  /* =========================================================================
     1. Unauthenticated State & Login Page: Zero /users/me Requests
     ========================================================================= */
  describe('1. Unauthenticated Visit to /auth/login', () => {
    it('does NOT call /api/v1/users/me when visiting /auth/login with no active session', async () => {
      const getSpy = vi.spyOn(httpClient, 'get');
      const postSpy = vi.spyOn(httpClient, 'post');

      renderApp('/auth/login');

      // The login page must render normally
      expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In to Operations Console/i })).toBeInTheDocument();

      // Zero calls to /users/me
      const usersMeCalls = getSpy.mock.calls.filter((call) => String(call[0]).includes('/users/me'));
      expect(usersMeCalls.length).toBe(0);

      // Zero calls to token refresh
      const refreshCalls = postSpy.mock.calls.filter((call) => String(call[0]).includes('/auth/token/refresh'));
      expect(refreshCalls.length).toBe(0);

      // No authentication errors displayed for normal unauthenticated visit
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('authRepository.getCurrentSession() immediately returns null without calling httpClient when no token exists', async () => {
      const realRepo = new RealAuthRepository();
      const getSpy = vi.spyOn(httpClient, 'get');

      useAuthStore.getState().clearSession();
      const session = await realRepo.getCurrentSession();

      expect(session).toBeNull();
      expect(getSpy).not.toHaveBeenCalled();
    });

    it('restoreSession() completes immediately and returns false without making network requests when no refresh token is stored', async () => {
      const getSpy = vi.spyOn(httpClient, 'get');
      const postSpy = vi.spyOn(httpClient, 'post');

      window.sessionStorage.removeItem('sevanest_refresh_token');
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: false,
        isAuthenticated: false,
        accessToken: null,
      });

      const restored = await restoreSession();

      expect(restored).toBe(false);
      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(useAuthStore.getState().isRestoring).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);

      // No network calls made
      expect(getSpy).not.toHaveBeenCalled();
      expect(postSpy).not.toHaveBeenCalled();
    });
  });

  /* =========================================================================
     2. Valid Session Restoration & Authenticated /users/me Usage
     ========================================================================= */
  describe('2. Valid Existing Session Restoration', () => {
    it('calls /users/me WITH Bearer token when restoring a session if user profile is needed', async () => {
      const realRepo = new RealAuthRepository();
      useAuthStore.getState().setAccessToken('valid-access-token-123');

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          id: 'adm-001',
          name: 'Super Admin User',
          email: 'admin@sevanest.internal',
          roleCode: 'SUPER_ADMIN',
          permissions: ['*'],
        },
      });

      const user = await realRepo.getCurrentSession();

      expect(user).not.toBeNull();
      expect(user?.role).toBe('SUPER_ADMIN');
      expect(getSpy).toHaveBeenCalledWith('/users/me', {
        headers: {
          Authorization: 'Bearer valid-access-token-123',
        },
      });
    });

    it('restores authenticated session from stored refresh token and continues to authorized page', async () => {
      window.sessionStorage.setItem('sevanest_refresh_token', 'refresh-oper-1720000000');
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: false,
        isAuthenticated: false,
        user: null,
        accessToken: null,
      });

      const { router } = renderApp('/bookings');

      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
      }, { timeout: 4000 });

      expect(useAuthStore.getState().user?.role).toBe('OPERATIONS_ADMIN');
      expect(router.state.location.pathname).toBe('/bookings');
    });
  });

  /* =========================================================================
     3. Expired & Invalid Token Handling: Clean Logout Without Repeated Loops
     ========================================================================= */
  describe('3. Expired and Invalid Token Handling', () => {
    it('clears stored tokens and redirects to /auth/login when refresh token is expired (401)', async () => {
      window.sessionStorage.setItem('sevanest_refresh_token', 'expired-token-xyz');
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: false,
        isAuthenticated: false,
        user: null,
        accessToken: null,
      });

      const { router } = renderApp('/dashboard');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      }, { timeout: 4000 });

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(window.sessionStorage.getItem('sevanest_refresh_token')).toBeNull();
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();
      expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();
    });

    it('does NOT trigger repeated /users/me calls or infinite refresh loops on 401', async () => {
      const getSpy = vi.spyOn(httpClient, 'get');
      window.sessionStorage.setItem('sevanest_refresh_token', 'expired-token-xyz');

      renderApp('/dashboard');

      await waitFor(() => {
        expect(useAuthStore.getState().isInitialized).toBe(true);
      }, { timeout: 4000 });

      // /users/me should NEVER be called with an expired refresh token failure
      const usersMeCalls = getSpy.mock.calls.filter((call) => String(call[0]).includes('/users/me'));
      expect(usersMeCalls.length).toBe(0);
    });
  });

  /* =========================================================================
     4. Distinguishing Server/Network Downtime from Authentication Failure
     ========================================================================= */
  describe('4. Distinguishing Server/Network Downtime from Authentication Failure', () => {
    it('preserves stored refresh token and displays recovery UI when server returns 500 error', async () => {
      window.sessionStorage.setItem('sevanest_refresh_token', 'valid-refresh-token-saved');

      // Mock server 500 failure
      vi.spyOn(authRepository, 'refreshToken').mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 500,
          data: { message: 'Internal Server Error' },
        },
      });

      useAuthStore.setState({
        isInitialized: false,
        isRestoring: false,
        isAuthenticated: false,
        user: null,
        accessToken: null,
      });

      renderApp('/workers');

      // Should display the graceful server error recovery screen
      expect(await screen.findByRole('heading', { name: /Authentication Service Unavailable/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Connection/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In with Credentials/i })).toBeInTheDocument();

      // Refresh token must NOT be wiped during server downtime!
      expect(window.sessionStorage.getItem('sevanest_refresh_token')).toBe('valid-refresh-token-saved');
    });

    it('clicking "Sign In with Credentials" clears preserved token and directs to /auth/login', async () => {
      const user = userEvent.setup();
      window.sessionStorage.setItem('sevanest_refresh_token', 'valid-refresh-token-saved');

      vi.spyOn(authRepository, 'refreshToken').mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 503,
          data: { message: 'Service Unavailable' },
        },
      });

      useAuthStore.setState({
        isInitialized: false,
        isRestoring: false,
        isAuthenticated: false,
        user: null,
        accessToken: null,
      });

      const { router } = renderApp('/workers');

      const signInBtn = await screen.findByRole('button', { name: /Sign In with Credentials/i }, { timeout: 4000 });
      await user.click(signInBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });

      // Cleaned up for new credential entry
      expect(window.sessionStorage.getItem('sevanest_refresh_token')).toBeNull();
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();
      expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();
    });
  });

  /* =========================================================================
     5. Logout followed by Clean Login Flow
     ========================================================================= */
  describe('5. Logout Followed by Clean Login', () => {
    it('logging out clears session, navigates to /auth/login, and makes zero /users/me calls on login screen', async () => {
      const user = userEvent.setup();
      const getSpy = vi.spyOn(httpClient, 'get');

      // 1. Initial authenticated state
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        user: {
          id: 'adm-002',
          name: 'Operations Manager',
          email: 'operations.manager@sevanest.example.com',
          role: 'OPERATIONS_ADMIN',
          permissions: [PERMISSIONS.DASHBOARD_VIEW],
        },
        accessToken: 'valid-token',
        refreshToken: 'valid-refresh',
      });

      const { router } = renderApp('/dashboard');

      // 2. Sign out
      const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
      await user.click(signOutBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });

      // Clear spy call history to isolate login screen behavior
      getSpy.mockClear();

      // Wait a moment on login screen
      expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();

      // Confirm ZERO calls to /users/me after logout on login page
      const usersMeCalls = getSpy.mock.calls.filter((call) => String(call[0]).includes('/users/me'));
      expect(usersMeCalls.length).toBe(0);
    });
  });
});
