import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { useSessionSecurityStore } from '../core/auth/sessionSecurityStore';
import { PERMISSIONS, getDefaultLandingRoute } from '../core/rbac/permissions';
import { SessionInactivityGuard } from '../core/auth/SessionInactivityGuard';
import * as tokenRefreshCoordinator from '../core/auth/tokenRefreshCoordinator';

function renderApp(initialEntry = '/auth/login', state?: unknown) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const memoryRouter = createMemoryRouter(routes, {
    initialEntries: [{ pathname: initialEntry, state }],
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

describe('SevaNest Authentication, Landing Navigation, Logout & Session Inactivity Audit', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    useSessionSecurityStore.getState().resetPolicy();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  /* =========================================================================
     1. Default Landing Route for Each Role
     ========================================================================= */
  describe('1. Default Landing Route Evaluation for All Roles', () => {
    it('evaluates Super Admin default landing route as /dashboard', () => {
      const superAdmin = {
        id: 'adm-001',
        role: 'SUPER_ADMIN',
        permissions: ['*'],
      };
      expect(getDefaultLandingRoute(superAdmin)).toBe('/dashboard');
    });

    it('evaluates Operations Admin default landing route as /dashboard', () => {
      const opsAdmin = {
        id: 'adm-002',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.CUSTOMER_VIEW,
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.BOOKINGS_VIEW,
          PERMISSIONS.PAYMENTS_VIEW,
        ],
      };
      expect(getDefaultLandingRoute(opsAdmin)).toBe('/dashboard');
    });

    it('evaluates Verification Executive default landing route as /verification', () => {
      const verifExec = {
        id: 'adm-003',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.AUDIT_VIEW,
        ],
      };
      expect(getDefaultLandingRoute(verifExec)).toBe('/verification');
    });

    it('evaluates Support Executive default landing route as /dashboard (Support Operations Console)', () => {
      const supportExec = {
        id: 'adm-004',
        role: 'SUPPORT_EXECUTIVE',
        permissions: [
          PERMISSIONS.SUPPORT_VIEW,
          PERMISSIONS.SUPPORT_MANAGE,
          PERMISSIONS.CUSTOMER_VIEW,
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.AUDIT_VIEW,
        ],
      };
      expect(getDefaultLandingRoute(supportExec)).toBe('/dashboard');
    });

    it('evaluates unauthenticated or null user to /auth/login', () => {
      expect(getDefaultLandingRoute(null)).toBe('/auth/login');
      expect(getDefaultLandingRoute(undefined)).toBe('/auth/login');
      expect(getDefaultLandingRoute({ role: 'UNKNOWN', permissions: [] })).toBe('/account');
    });
  });

  /* =========================================================================
     2. Fresh Login Flow and Landing Render Across All Roles
     ========================================================================= */
  describe('2. Fresh Sign-In Landing Verification Across All 4 Roles', () => {
    it('Super Admin logs in and mounts SuperAdminDashboard at /dashboard', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'sevanest@admin.in');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Sevanest@2026');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Super Admin Executive Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('Operations Admin logs in and mounts OperationsAdminDashboard at /dashboard', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'operations.manager@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Operations@2026');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Operations Command Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('Verification Executive logs in and mounts VerificationQueuePage at /verification', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'verification.executive@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Verification@2026');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });
      expect(await screen.findByText('Worker Verification & Trust Operations', {}, { timeout: 4000 })).toBeInTheDocument();
    });

    it('Support Executive logs in and mounts SupportExecutiveDashboard at /dashboard', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'support.executive@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Support@2026');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /^Dashboard$/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/Support operations overview and ticket monitoring\./i)).toBeInTheDocument();
    });
  });

  /* =========================================================================
     3. Stale Route / State Immunity on Fresh Login
     ========================================================================= */
  describe('3. Immunity from Stale Navigation State and Visited Routes on Fresh Login', () => {
    it('ignores stale location.state.from (/workers) and lands strictly on default dashboard', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login', { from: { pathname: '/workers', search: '' } });

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'operations.manager@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Operations@2026');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Operations Command Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('ignores stale query param returnTo (/configuration) and lands strictly on default dashboard', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login?returnTo=/configuration', { from: { pathname: '/configuration' } });

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'support.executive@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Support@2026');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /^Dashboard$/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/Support operations overview and ticket monitoring\./i)).toBeInTheDocument();
    });

    it('clears stale storage keys (last_visited_route, selected_module) during clearSession', () => {
      window.localStorage.setItem('last_visited_route', '/payments');
      window.sessionStorage.setItem('selected_module', 'payments');
      window.localStorage.setItem('returnTo', '/audit');

      useAuthStore.getState().clearSession();

      expect(window.localStorage.getItem('last_visited_route')).toBeNull();
      expect(window.sessionStorage.getItem('selected_module')).toBeNull();
      expect(window.localStorage.getItem('returnTo')).toBeNull();
    });
  });

  /* =========================================================================
     4. Role Transition & Session Isolation Across Logout & Re-login
     ========================================================================= */
  describe('4. Clean Role Transition Across Logout and Re-Login', () => {
    it('Super Admin on /configuration logs out; Verification Executive logs in and lands on /verification', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      // 1. Super Admin logs in
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'sevanest@admin.in');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Sevanest@2026');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      // 2. Navigate to /configuration
      await act(async () => {
        await router.navigate('/configuration');
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/configuration');
      });

      // 3. Logout
      const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
      await user.click(signOutBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);

      // 4. Verification Executive logs in
      const emailInput2 = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput2, 'verification.executive@sevanest.example.com');
      const passwordInput2 = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput2, 'Verification@2026');
      const submitBtn2 = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn2);

      // Must land on /verification, NOT on /configuration
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });
      expect(await screen.findByText('Worker Verification & Trust Operations', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
    });

    it('Verification Executive on /workers logs out; Support Executive logs in and lands on /dashboard', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      // 1. Verification Executive logs in
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'verification.executive@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Verification@2026');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });

      // 2. Navigate to /workers
      await act(async () => {
        await router.navigate('/workers');
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/workers');
      });

      // 3. Logout
      const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
      await user.click(signOutBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });

      // 4. Support Executive logs in
      const emailInput2 = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput2, 'support.executive@sevanest.example.com');
      const passwordInput2 = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput2, 'Support@2026');
      const submitBtn2 = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn2);

      // Must land on /dashboard (Support Operations Console), NOT on /workers
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /^Dashboard$/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/Support operations overview and ticket monitoring\./i)).toBeInTheDocument();
    });
  });

  /* =========================================================================
     5. Session Restoration on Refresh & Route Preservation
     ========================================================================= */
  describe('5. Session Restoration and Route Preservation on Refresh', () => {
    it('restores authenticated session and preserves active route (/bookings) on refresh', async () => {
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
      });

      expect(useAuthStore.getState().user?.role).toBe('OPERATIONS_ADMIN');
      expect(router.state.location.pathname).toBe('/bookings');
      expect(await screen.findByRole('heading', { name: /Booking & Service Management/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('clears stored session and redirects to /auth/login when refresh token is expired or rejected', async () => {
      window.sessionStorage.setItem('sevanest_refresh_token', 'expired-token-xyz');
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: false,
        isAuthenticated: false,
        user: null,
        accessToken: null,
      });

      const { router } = renderApp('/bookings');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(window.sessionStorage.getItem('sevanest_refresh_token')).toBeNull();
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();
    });
  });

  /* =========================================================================
     6. Post-Logout History Guard & Browser Back Immunity
     ========================================================================= */
  describe('6. Post-Logout Protection Against Browser Back Traversal', () => {
    it('blocks unauthenticated access when navigating back to protected routes after logout', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      // 1. Log in as Operations Admin
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'operations.manager@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Operations@2026');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      // 2. Log out
      const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
      await user.click(signOutBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });

      // 3. Simulate browser Back traversal to /dashboard
      await act(async () => {
        await router.navigate('/dashboard');
      });

      // ProtectedRoute must fail closed and redirect to /auth/login
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(screen.queryByRole('heading', { name: /Operations Command Console/i })).not.toBeInTheDocument();
    });
  });

  /* =========================================================================
     7. Session Inactivity Guard: Timeout, Warning Modal & Stay Logged In
     ========================================================================= */
  describe('7. Session Inactivity Guard: 15-Minute Timeout, 60s Warning & Stay Logged In', () => {
    function renderGuard() {
      const queryClient = new QueryClient();
      const memoryRouter = createMemoryRouter([
        {
          path: '/',
          element: (
            <div>
              <SessionInactivityGuard />
              <div data-testid="protected-content">Protected Dashboard Content</div>
            </div>
          ),
        },
        {
          path: '/auth/login',
          element: <div data-testid="login-page">Sign In Page</div>,
        },
      ]);

      return {
        ...render(
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={memoryRouter} />
          </QueryClientProvider>
        ),
        router: memoryRouter,
      };
    }

    it('displays warning modal when 60 seconds remain before timeout', async () => {
      // Set lastActivityTime to 14 minutes and 10 seconds ago (50s remaining)
      const fiftySecondsRemaining = Date.now() - (15 * 60 - 50) * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 15,
        warningDurationSeconds: 60,
        lastActivityTime: fiftySecondsRemaining,
      });

      useAuthStore.setState({
        isAuthenticated: true,
        user: {
          id: 'adm-002',
          name: 'Operations Admin',
          email: 'operations.manager@sevanest.example.com',
          role: 'OPERATIONS_ADMIN',
          permissions: [PERMISSIONS.DASHBOARD_VIEW],
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      renderGuard();

      // Warning modal must be visible
      await waitFor(() => {
        expect(screen.getByTestId('session-inactivity-warning-modal')).toBeInTheDocument();
      });
      expect(screen.getByText(/Session Inactivity Warning/i)).toBeInTheDocument();
      expect(screen.getByTestId('stay-logged-in-button')).toBeInTheDocument();
      expect(screen.getByTestId('logout-now-button')).toBeInTheDocument();
    });

    it('clicking "Stay Logged In" resets timer, dismisses modal, and requests silent token refresh', async () => {
      const user = userEvent.setup();
      const refreshSpy = vi.spyOn(tokenRefreshCoordinator, 'requestTokenRefresh').mockResolvedValue({ accessToken: 'new-token' });

      const fortySecondsRemaining = Date.now() - (15 * 60 - 40) * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 15,
        warningDurationSeconds: 60,
        lastActivityTime: fortySecondsRemaining,
      });

      useAuthStore.setState({
        isAuthenticated: true,
        user: {
          id: 'adm-002',
          name: 'Operations Admin',
          email: 'operations.manager@sevanest.example.com',
          role: 'OPERATIONS_ADMIN',
          permissions: [PERMISSIONS.DASHBOARD_VIEW],
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      renderGuard();

      const modal = await screen.findByTestId('session-inactivity-warning-modal');
      expect(modal).toBeInTheDocument();

      const stayBtn = screen.getByTestId('stay-logged-in-button');
      await user.click(stayBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('session-inactivity-warning-modal')).not.toBeInTheDocument();
      });

      expect(refreshSpy).toHaveBeenCalled();
      const lastActive = useSessionSecurityStore.getState().lastActivityTime;
      expect(Date.now() - lastActive).toBeLessThan(1000);
    });

    it('auto-terminates session and redirects to /auth/login when inactivity timeout elapses', async () => {
      // Simulate expired time (15 minutes + 5 seconds ago)
      const expiredTime = Date.now() - (15 * 60 + 5) * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 15,
        warningDurationSeconds: 60,
        lastActivityTime: expiredTime,
      });

      useAuthStore.setState({
        isAuthenticated: true,
        user: {
          id: 'adm-002',
          name: 'Operations Admin',
          email: 'operations.manager@sevanest.example.com',
          role: 'OPERATIONS_ADMIN',
          permissions: [PERMISSIONS.DASHBOARD_VIEW],
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const { router } = renderGuard();

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  /* =========================================================================
     8. Multi-Tab Synchronization & Unauthorized Route Guard
     ========================================================================= */
  describe('8. Multi-Tab Sync & Unauthorized Route Guard', () => {
    it('broadcasts logout across tabs via tokenRefreshCoordinator', () => {
      const broadcastSpy = vi.spyOn(tokenRefreshCoordinator, 'broadcastLogout');

      useAuthStore.getState().clearSession(true);

      expect(broadcastSpy).toHaveBeenCalled();
    });

    it('blocks unauthorized route access with NoAccessView when permissions are missing', async () => {
      // Operations Admin attempting to access /verification (unauthorized)
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        isRestoring: false,
        user: {
          id: 'adm-002',
          name: 'Operations Admin',
          email: 'operations.manager@sevanest.example.com',
          role: 'OPERATIONS_ADMIN',
          permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.BOOKINGS_VIEW],
        },
        accessToken: 'valid-token',
        refreshToken: 'valid-refresh',
      });

      const { router } = renderApp('/verification');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });

      expect(await screen.findByRole('heading', { name: /Access Restricted/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/You do not have the required server-issued permissions to view this module/i)).toBeInTheDocument();
    });
  });
});
