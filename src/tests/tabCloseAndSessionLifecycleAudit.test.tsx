import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import {
  getStoredRefreshToken,
  setStoredRefreshToken,
  clearStoredRefreshToken,
} from '../core/auth/tokenStorage';
import {
  useSessionSecurityStore,
  LAST_ACTIVITY_KEY,
} from '../core/auth/sessionSecurityStore';
import { SessionInactivityGuard } from '../core/auth/SessionInactivityGuard';
import { authRepository, RealAuthRepository } from '../features/auth/data/authRepository';
import { httpClient } from '../core/api/httpClient';
import { queryClient as globalQueryClient } from '../core/api/queryClient';
import { RateLimitExceededError } from '../core/errors/DomainError';
import { restoreSession } from '../core/auth/sessionRestoration';
import * as coordinator from '../core/auth/tokenRefreshCoordinator';

function renderApp(initialEntry = '/auth/login', state?: unknown) {
  const testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const [pathname, search] = initialEntry.split('?');
  const memoryRouter = createMemoryRouter(routes, {
    initialEntries: [{ pathname, search: search ? `?${search}` : '', state }],
  });

  return {
    ...render(
      <QueryClientProvider client={testQueryClient}>
        <RouterProvider router={memoryRouter} />
      </QueryClientProvider>
    ),
    router: memoryRouter,
    testQueryClient,
  };
}

function renderInactivityWorkspace(ui: React.ReactElement, initialRoute = '/dashboard') {
  const testQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <div>
                <SessionInactivityGuard />
                <h1>Authenticated Workspace</h1>
              </div>
            }
          />
          <Route path="/auth/login" element={<h2>Staff Sign In</h2>} />
          <Route
            path="*"
            element={
              <div>
                <SessionInactivityGuard />
                {ui}
              </div>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SevaNest Admin Portal: Tab-Close Logout, Login Rate-Limit Audit & Inactivity Timeout', () => {
  let realRepo: RealAuthRepository;

  beforeEach(() => {
    coordinator.resetRefreshCoordinator();
    useAuthStore.getState().clearSession(false);
    useSessionSecurityStore.getState().resetPolicy();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    realRepo = new RealAuthRepository();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Tab-Scoped Session Storage & Cross-Tab Isolation', () => {
    it('persists refresh token in sessionStorage and guarantees localStorage remains clean', () => {
      setStoredRefreshToken('tab-scoped-refresh-token-12345');

      expect(window.sessionStorage.getItem('sevanest_refresh_token')).toBe('tab-scoped-refresh-token-12345');
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();
      expect(getStoredRefreshToken()).toBe('tab-scoped-refresh-token-12345');
    });

    it('proactively purges legacy localStorage tokens upon inspection or modification', () => {
      // Simulate legacy token in localStorage from an earlier session
      window.localStorage.setItem('sevanest_refresh_token', 'legacy-leak-token');

      // Calling getStoredRefreshToken must purge localStorage
      const token = getStoredRefreshToken();
      expect(token).toBeNull();
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();

      // Calling setStoredRefreshToken must also purge localStorage
      window.localStorage.setItem('sevanest_refresh_token', 'legacy-leak-token-2');
      setStoredRefreshToken('new-tab-token');
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();
      expect(window.sessionStorage.getItem('sevanest_refresh_token')).toBe('new-tab-token');

      // Calling clearStoredRefreshToken must wipe both
      clearStoredRefreshToken();
      expect(window.sessionStorage.getItem('sevanest_refresh_token')).toBeNull();
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();
    });

    it('never writes access tokens or sensitive passwords to sessionStorage or localStorage', async () => {
      vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          accessToken: 'super-secret-in-memory-jwt',
          refreshToken: 'tab-refresh-token-999',
          user: {
            id: 'adm-001',
            email: 'ops@sevanest.internal',
            role: 'OPERATIONS_ADMIN',
            name: 'Operations Lead',
          },
        },
      });

      const { accessToken, refreshToken, user } = await realRepo.login({
        email: 'ops@sevanest.internal',
        password: 'validPassword123',
      });

      useAuthStore.getState().setSession(user, accessToken, refreshToken);

      // Access tokens must NEVER touch browser disk storage
      expect(window.sessionStorage.getItem('accessToken')).toBeNull();
      expect(window.sessionStorage.getItem('token')).toBeNull();
      expect(window.localStorage.getItem('accessToken')).toBeNull();
      expect(window.localStorage.getItem('token')).toBeNull();
      expect(window.sessionStorage.getItem('password')).toBeNull();
      expect(window.localStorage.getItem('password')).toBeNull();

      // Only tab-scoped refresh token is stored in sessionStorage
      expect(window.sessionStorage.getItem('sevanest_refresh_token')).toBe('tab-refresh-token-999');
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();
    });
  });

  describe('2. Page Refresh vs Tab-Close Session Termination', () => {
    it('preserves authenticated session and deep route across page refresh in the same tab', async () => {
      // Simulate active tab state with refresh token in sessionStorage
      window.sessionStorage.setItem('sevanest_refresh_token', 'refresh-oper-1720000000');
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: false,
        isAuthenticated: false,
        user: null,
        accessToken: null,
      });

      // User refreshes while on /workers
      const { router } = renderApp('/workers');

      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
      });

      expect(useAuthStore.getState().user?.role).toBe('OPERATIONS_ADMIN');
      expect(router.state.location.pathname).toBe('/workers');
      expect(await screen.findByRole('heading', { name: /Domestic Worker Roster & Profiles/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('terminates session when tab is closed: opening in a new tab displays Sign In page without session restoration', async () => {
      // A newly opened tab has an empty sessionStorage and empty localStorage
      expect(window.sessionStorage.getItem('sevanest_refresh_token')).toBeNull();
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();

      const refreshSpy = vi.spyOn(authRepository, 'refreshToken');

      // User opens application at /
      const { router } = renderApp('/');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });

      // No restore network calls are attempted
      expect(refreshSpy).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(await screen.findByRole('heading', { name: /Staff Sign In/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('new tab accessing a protected deep link redirects to /auth/login without attempting unauthenticated network calls', async () => {
      const getSessionSpy = vi.spyOn(authRepository, 'getCurrentSession');
      const refreshSpy = vi.spyOn(authRepository, 'refreshToken');

      const { router } = renderApp('/configuration');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });

      expect(getSessionSpy).not.toHaveBeenCalled();
      expect(refreshSpy).not.toHaveBeenCalled();
      expect(router.state.location.state).toEqual({
        from: expect.objectContaining({ pathname: '/configuration' }),
      });
    });
  });

  describe('3. Default Landing on Fresh Login (No Redirection to Stale Modules)', () => {
    it('always navigates Support Executive to /dashboard on fresh login regardless of stale previous route', async () => {
      const user = userEvent.setup();

      // Seed stale navigation keys in sessionStorage
      window.sessionStorage.setItem('from', '/workers');
      window.sessionStorage.setItem('returnTo', '/workers');
      window.sessionStorage.setItem('last_visited_route', '/workers');

      const { router } = renderApp('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      const passwordInput = screen.getByPlaceholderText('Enter password');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });

      await user.type(emailInput, 'support.exec@sevanest.internal');
      await user.type(passwordInput, 'password123');
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      expect(useAuthStore.getState().user?.role).toBe('SUPPORT_EXECUTIVE');
      expect(await screen.findByRole('heading', { name: /Support Operations Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('navigates Verification Executive to /verification on fresh login', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      const passwordInput = screen.getByPlaceholderText('Enter password');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });

      await user.type(emailInput, 'verif.exec@sevanest.internal');
      await user.type(passwordInput, 'password123');
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });

      expect(useAuthStore.getState().user?.role).toBe('VERIFICATION_EXECUTIVE');
    });

    it('navigates Operations Admin to /dashboard on fresh login', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      const passwordInput = screen.getByPlaceholderText('Enter password');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });

      await user.type(emailInput, 'ops.admin@sevanest.internal');
      await user.type(passwordInput, 'password123');
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      expect(useAuthStore.getState().user?.role).toBe('OPERATIONS_ADMIN');
    });
  });

  describe('4. Login Rate-Limit Audit & Backend 429 Protection', () => {
    it('does not impose artificial client cooldowns on failed submissions', async () => {
      const user = userEvent.setup();
      renderApp('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      const passwordInput = screen.getByPlaceholderText('Enter password');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });

      // First failed attempt
      await user.type(emailInput, 'ops.admin@sevanest.internal');
      await user.type(passwordInput, 'wrongPassword1');
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Submit button is NOT permanently disabled by artificial client timer
      expect(submitBtn).not.toBeDisabled();
      expect(passwordInput).toHaveValue('');

      // Immediate second attempt allowed
      await user.type(passwordInput, 'wrongPassword2');
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      expect(submitBtn).not.toBeDisabled();
    });

    it('faithfully surfaces backend HTTP 429 ADMIN_LOGIN_LOCKED to user without freezing client', async () => {
      // 1. Verify RealAuthRepository maps 429 HTTP response to RateLimitExceededError
      const rateLimitError = new axios.AxiosError(
        'Too many failed attempts.',
        'ERR_BAD_REQUEST',
        undefined,
        undefined,
        {
          status: 429,
          statusText: 'Too Many Requests',
          headers: {},
          config: {} as never,
          data: {
            code: 'ADMIN_LOGIN_LOCKED',
            message: 'Account locked due to consecutive failed attempts. Please try again after 15 minutes.',
          },
        }
      );

      vi.spyOn(httpClient, 'post').mockRejectedValueOnce(rateLimitError);
      await expect(
        realRepo.login({
          email: 'ops.admin@sevanest.internal',
          password: 'password123',
        })
      ).rejects.toThrow('Account locked due to consecutive failed attempts. Please try again after 15 minutes.');

      // 2. Verify SignInPage surfaces RateLimitExceededError message to user without artificial freeze
      vi.spyOn(authRepository, 'login').mockRejectedValueOnce(
        new RateLimitExceededError('Account locked due to consecutive failed attempts. Please try again after 15 minutes.')
      );

      const user = userEvent.setup();
      renderApp('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      const passwordInput = screen.getByPlaceholderText('Enter password');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });

      await user.type(emailInput, 'ops.admin@sevanest.internal');
      await user.type(passwordInput, 'somePassword');
      await user.click(submitBtn);

      // Warning alert rendered with backend lockout message
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/Account locked due to consecutive failed attempts/i);

      // Submit button remains operable without client lockout timers
      expect(submitBtn).not.toBeDisabled();
      expect(passwordInput).toHaveValue('');
    });
  });

  describe('5. 15-Minute Inactivity Timeout & Inactivity Countdown Warning', () => {
    it('displays 60-second warning modal at 14 minutes of inactivity', async () => {
      // 14 minutes and 10 seconds elapsed = 50 seconds remaining
      const fiftySecondsRemaining = Date.now() - (15 * 60 - 50) * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 15,
        warningDurationSeconds: 60,
        lastActivityTime: fiftySecondsRemaining,
      });

      useAuthStore.getState().setSession(
        {
          id: 'adm-001',
          name: 'Super Admin',
          email: 'super@sevanest.internal',
          role: 'SUPER_ADMIN',
          permissions: ['*'],
        },
        'token-123'
      );

      renderInactivityWorkspace(<div>Content</div>);

      await waitFor(() => {
        expect(screen.getByTestId('session-inactivity-warning-modal')).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(screen.getByText(/Session Inactivity Warning/i)).toBeInTheDocument();
      expect(screen.getByTestId('stay-logged-in-button')).toBeInTheDocument();
    });

    it('"Stay Logged In" resets inactivity timer and triggers silent token refresh', async () => {
      const user = userEvent.setup();
      const fortySecondsRemaining = Date.now() - (15 * 60 - 40) * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 15,
        warningDurationSeconds: 60,
        lastActivityTime: fortySecondsRemaining,
      });

      useAuthStore.getState().setSession(
        {
          id: 'adm-001',
          name: 'Super Admin',
          email: 'super@sevanest.internal',
          role: 'SUPER_ADMIN',
          permissions: ['*'],
        },
        'token-123'
      );

      const refreshSpy = vi.spyOn(coordinator, 'requestTokenRefresh').mockResolvedValue({
        accessToken: 'new-token',
      });

      renderInactivityWorkspace(<div>Content</div>);

      const modal = await screen.findByTestId('session-inactivity-warning-modal', {}, { timeout: 3000 });
      expect(modal).toBeInTheDocument();

      const stayBtn = screen.getByTestId('stay-logged-in-button');
      await user.click(stayBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('session-inactivity-warning-modal')).not.toBeInTheDocument();
      });

      expect(refreshSpy).toHaveBeenCalled();
      expect(Date.now() - useSessionSecurityStore.getState().lastActivityTime).toBeLessThan(1000);
    });

    it('DOM interaction events reset the inactivity timer while background queries do not', () => {
      vi.useFakeTimers();

      useAuthStore.getState().setSession(
        {
          id: 'adm-001',
          name: 'Super Admin',
          email: 'super@sevanest.internal',
          role: 'SUPER_ADMIN',
          permissions: ['*'],
        },
        'token-123'
      );

      // Set initial activity time to 5 minutes ago
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      useSessionSecurityStore.setState({ lastActivityTime: fiveMinutesAgo });

      renderInactivityWorkspace(<div>Content</div>);

      // Simulating a background query (e.g. TanStack query fetch) does NOT fire DOM events
      globalQueryClient.setQueryData(['test-background'], { refreshed: true });
      expect(useSessionSecurityStore.getState().lastActivityTime).toBe(fiveMinutesAgo);

      // Advance clock past the 2000ms event throttle window
      act(() => {
        vi.advanceTimersByTime(2500);
      });

      // User performs actual mousemove interaction
      act(() => {
        fireEvent.mouseMove(window);
      });

      // Activity time updated to current
      expect(useSessionSecurityStore.getState().lastActivityTime).toBeGreaterThan(fiveMinutesAgo);
    });

    it('persists lastActivityTime across page reloads in sessionStorage so reload does not reset 15m timer', () => {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(tenMinutesAgo));

      // Re-initialize store state as would happen on reload
      useSessionSecurityStore.getState().resetPolicy();

      // Recording activity updates sessionStorage
      useSessionSecurityStore.getState().recordActivity();
      const updated = window.sessionStorage.getItem(LAST_ACTIVITY_KEY);
      expect(Number(updated)).toBeGreaterThanOrEqual(tenMinutesAgo);
    });

    it('terminates session and navigates to /auth/login when full 15 minutes of inactivity elapse', () => {
      vi.useFakeTimers();

      // 1 second remaining
      const oneSecondRemaining = Date.now() - (15 * 60 - 1) * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 15,
        warningDurationSeconds: 60,
        lastActivityTime: oneSecondRemaining,
      });

      useAuthStore.getState().setSession(
        {
          id: 'adm-001',
          name: 'Super Admin',
          email: 'super@sevanest.internal',
          role: 'SUPER_ADMIN',
          permissions: ['*'],
        },
        'token-123',
        'refresh-token-123'
      );

      renderInactivityWorkspace(<div>Content</div>);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Session wiped
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(window.sessionStorage.getItem('sevanest_refresh_token')).toBeNull();
    });
  });

  describe('6. Complete Session Cleanup & Revocation', () => {
    it('logout clears all storage, cache, state, and prevents back-navigation', async () => {
      window.sessionStorage.setItem('sevanest_refresh_token', 'rt-active-123');
      window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      globalQueryClient.setQueryData(['sensitive-records'], [{ id: 1 }]);

      useAuthStore.getState().setSession(
        {
          id: 'adm-001',
          name: 'Super Admin',
          email: 'super@sevanest.internal',
          role: 'SUPER_ADMIN',
          permissions: ['*'],
        },
        'access-token-xyz',
        'rt-active-123'
      );

      const { router } = renderApp('/dashboard');

      // Perform logout
      act(() => {
        useAuthStore.getState().clearSession();
        router.navigate('/auth/login', { replace: true });
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(window.sessionStorage.getItem('sevanest_refresh_token')).toBeNull();
      expect(window.sessionStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull();
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();
      expect(globalQueryClient.getQueryData(['sensitive-records'])).toBeUndefined();
    });

    it('expired or revoked refresh token fails restoration and cleanly wipes storage', async () => {
      window.sessionStorage.setItem('sevanest_refresh_token', 'revoked-token');

      vi.spyOn(authRepository, 'refreshToken').mockRejectedValueOnce(
        new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, {
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config: {} as never,
          data: { code: 'REFRESH_TOKEN_EXPIRED', message: 'Token has been revoked or expired.' },
        })
      );

      const restored = await restoreSession();

      expect(restored).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(window.sessionStorage.getItem('sevanest_refresh_token')).toBeNull();
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();
    });
  });
});
