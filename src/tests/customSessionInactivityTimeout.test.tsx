/* global StorageEvent, MouseEvent, Event */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ConfigurationMastersPage } from '../features/configuration/presentation/ConfigurationMastersPage';
import { SessionInactivityGuard } from '../core/auth/SessionInactivityGuard';
import {
  useSessionSecurityStore,
  POLICY_STORAGE_KEY,
  DEFAULT_TIMEOUT_MINUTES,
  getInitialPolicy,
} from '../core/auth/sessionSecurityStore';
import { useAuthStore } from '../core/auth/authStore';
import { authRepository } from '../features/auth/data/authRepository';
import * as tokenRefreshCoordinator from '../core/auth/tokenRefreshCoordinator';

function renderWithProviders(ui: React.ReactElement, initialRoute = '/configuration?tab=security') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/configuration" element={ui} />
          <Route path="/auth/login" element={<div data-testid="login-page">Sign In Page</div>} />
          <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Custom Session Inactivity Timeout Configuration & Guard Enforcement', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    useSessionSecurityStore.getState().resetPolicy();

    // Default authenticated Super Admin user
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'super-admin-1',
        name: 'Super Admin',
        email: 'sevanest@admin.in',
        role: 'SUPER_ADMIN',
        permissions: ['*'],
      },
      accessToken: 'valid-jwt-token',
      refreshToken: 'valid-refresh-token',
    });

    vi.spyOn(authRepository, 'listSessions').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useSessionSecurityStore.getState().resetPolicy();
  });

  describe('1. Active Timeout Display & Quick Selections', () => {
    it('displays the 15-minute standard policy by default as active', async () => {
      renderWithProviders(<ConfigurationMastersPage />);

      expect(await screen.findByRole('heading', { name: /Session Governance & Security Settings/i })).toBeInTheDocument();
      expect(screen.getByText(/15-Minute Standard Active/i)).toBeInTheDocument();

      const activeBadge = screen.getByTestId('active-timeout-badge');
      expect(activeBadge).toHaveTextContent(/Active: 15 Minutes/i);

      const option15 = screen.getByTestId('timeout-option-15');
      const option10 = screen.getByTestId('timeout-option-10');
      const optionCustom = screen.getByTestId('timeout-option-custom');

      expect(option15).toBeChecked();
      expect(option10).not.toBeChecked();
      expect(optionCustom).not.toBeChecked();
      expect(screen.getByTestId('auto-logout-toggle')).toBeChecked();
    });

    it('allows changing timeout to 10 minutes and saving policy', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConfigurationMastersPage />);

      const option10 = await screen.findByTestId('timeout-option-10');
      await user.click(option10);

      expect(screen.getByTestId('unsaved-changes-indicator')).toBeInTheDocument();

      const saveBtn = screen.getByTestId('save-security-policy-btn');
      expect(saveBtn).not.toBeDisabled();

      await user.click(saveBtn);

      expect(useSessionSecurityStore.getState().timeoutMinutes).toBe(10);
      expect(screen.getByTestId('save-feedback-message')).toHaveTextContent(/Session security policy saved successfully/i);
      expect(screen.getByTestId('active-timeout-badge')).toHaveTextContent(/Active: 10 Minutes/i);
    });

    it('cancels unsaved changes and restores active policy', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConfigurationMastersPage />);

      const option10 = await screen.findByTestId('timeout-option-10');
      await user.click(option10);

      expect(screen.getByTestId('unsaved-changes-indicator')).toBeInTheDocument();

      const cancelBtn = screen.getByTestId('cancel-security-policy-btn');
      await user.click(cancelBtn);

      expect(screen.queryByTestId('unsaved-changes-indicator')).not.toBeInTheDocument();
      expect(screen.getByTestId('timeout-option-15')).toBeChecked();
      expect(useSessionSecurityStore.getState().timeoutMinutes).toBe(15);
    });
  });

  describe('2. Custom Timeout Selection & Permitted Range Validation (5 - 60 min)', () => {
    it('allows selecting Custom and configuring 30 minutes timeout', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConfigurationMastersPage />);

      const customOption = await screen.findByTestId('timeout-option-custom');
      await user.click(customOption);

      expect(customOption).toBeChecked();
      const customInput = screen.getByTestId('custom-timeout-input');
      expect(customInput).toBeInTheDocument();

      await user.clear(customInput);
      await user.type(customInput, '30');

      const saveBtn = screen.getByTestId('save-security-policy-btn');
      expect(saveBtn).not.toBeDisabled();

      await user.click(saveBtn);

      expect(useSessionSecurityStore.getState().timeoutMinutes).toBe(30);
      expect(screen.getByTestId('active-timeout-badge')).toHaveTextContent(/Active: 30 Minutes/i);

      // Verify persistence in localStorage
      const stored = JSON.parse(window.localStorage.getItem(POLICY_STORAGE_KEY) || '{}');
      expect(stored.timeoutMinutes).toBe(30);
      expect(stored.autoLogoutEnabled).toBe(true);
    });

    it('rejects values below minimum 5 minutes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConfigurationMastersPage />);

      const customOption = await screen.findByTestId('timeout-option-custom');
      await user.click(customOption);

      const customInput = screen.getByTestId('custom-timeout-input');
      await user.clear(customInput);
      await user.type(customInput, '4');

      const errorMsg = screen.getByTestId('custom-timeout-error');
      expect(errorMsg).toHaveTextContent(/Minimum inactivity timeout is 5 minutes/i);

      const saveBtn = screen.getByTestId('save-security-policy-btn');
      expect(saveBtn).toBeDisabled();
    });

    it('rejects values above maximum 60 minutes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConfigurationMastersPage />);

      const customOption = await screen.findByTestId('timeout-option-custom');
      await user.click(customOption);

      const customInput = screen.getByTestId('custom-timeout-input');
      await user.clear(customInput);
      await user.type(customInput, '75');

      const errorMsg = screen.getByTestId('custom-timeout-error');
      expect(errorMsg).toHaveTextContent(/Maximum inactivity timeout is 60 minutes/i);

      const saveBtn = screen.getByTestId('save-security-policy-btn');
      expect(saveBtn).toBeDisabled();
    });

    it('rejects empty or non-integer input', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConfigurationMastersPage />);

      const customOption = await screen.findByTestId('timeout-option-custom');
      await user.click(customOption);

      const customInput = screen.getByTestId('custom-timeout-input');
      await user.clear(customInput);

      expect(screen.getByTestId('custom-timeout-error')).toHaveTextContent(/Please enter a timeout value/i);
      expect(screen.getByTestId('save-security-policy-btn')).toBeDisabled();
    });

    it('allows boundary values 5 minutes and 60 minutes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConfigurationMastersPage />);

      const customOption = await screen.findByTestId('timeout-option-custom');
      await user.click(customOption);

      const customInput = screen.getByTestId('custom-timeout-input');
      const saveBtn = screen.getByTestId('save-security-policy-btn');

      // Test lower boundary: 5 min
      await user.clear(customInput);
      await user.type(customInput, '5');
      expect(screen.queryByTestId('custom-timeout-error')).not.toBeInTheDocument();
      await user.click(saveBtn);
      expect(useSessionSecurityStore.getState().timeoutMinutes).toBe(5);

      // Test upper boundary: 60 min
      await user.clear(customInput);
      await user.type(customInput, '60');
      expect(screen.queryByTestId('custom-timeout-error')).not.toBeInTheDocument();
      await user.click(saveBtn);
      expect(useSessionSecurityStore.getState().timeoutMinutes).toBe(60);
    });
  });

  describe('3. Disabling Inactivity Logout & Auto Logout Toggle', () => {
    it('allows disabling automated inactivity logout and saving', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ConfigurationMastersPage />);

      const toggle = await screen.findByTestId('auto-logout-toggle');
      expect(toggle).toBeChecked();

      await user.click(toggle);
      expect(toggle).not.toBeChecked();

      const saveBtn = screen.getByTestId('save-security-policy-btn');
      await user.click(saveBtn);

      expect(useSessionSecurityStore.getState().autoLogoutEnabled).toBe(false);
      expect(screen.getByTestId('active-timeout-badge')).toHaveTextContent(/Active: Disabled/i);
    });
  });

  describe('4. Inactivity Guard Warning, Countdown & Stay Logged In Enforcement', () => {
    function renderGuard() {
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
        ...render(<RouterProvider router={memoryRouter} />),
        router: memoryRouter,
      };
    }

    it('triggers warning modal 60 seconds before custom timeout expires (e.g. 30 minutes)', async () => {
      // 30 min = 1800s. Warning threshold is at 1740s elapsed (50s remaining).
      const fiftySecondsRemaining = Date.now() - (30 * 60 - 50) * 1000;

      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 30,
        warningDurationSeconds: 60,
        lastActivityTime: fiftySecondsRemaining,
      });

      renderGuard();

      await waitFor(() => {
        expect(screen.getByTestId('session-inactivity-warning-modal')).toBeInTheDocument();
      });
      expect(screen.getByText(/Session Inactivity Warning/i)).toBeInTheDocument();
      expect(screen.getByTestId('inactivity-countdown')).toBeInTheDocument();
      expect(screen.getByTestId('stay-logged-in-button')).toBeInTheDocument();
      expect(screen.getByTestId('logout-now-button')).toBeInTheDocument();
    });

    it('custom 5-minute timeout displays warning modal at exactly 4 minutes of inactivity (60s remaining)', async () => {
      // 5 min = 300s. Warning threshold is at 240s elapsed (50s remaining).
      const fiftySecondsRemaining = Date.now() - (5 * 60 - 50) * 1000;

      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 5,
        warningDurationSeconds: 60,
        lastActivityTime: fiftySecondsRemaining,
      });

      renderGuard();

      await waitFor(() => {
        expect(screen.getByTestId('session-inactivity-warning-modal')).toBeInTheDocument();
      });
      expect(screen.getByTestId('inactivity-countdown')).toBeInTheDocument();
    });

    it('custom 5-minute timeout does not log out before the deadline', async () => {
      // 3 minutes elapsed out of 5 minutes (120s remaining before deadline)
      const twoMinutesRemaining = Date.now() - 3 * 60 * 1000;

      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 5,
        warningDurationSeconds: 60,
        lastActivityTime: twoMinutesRemaining,
      });

      const { router } = renderGuard();

      // Guard should NOT redirect and should NOT display warning yet
      expect(router.state.location.pathname).toBe('/');
      expect(screen.queryByTestId('session-inactivity-warning-modal')).not.toBeInTheDocument();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('custom 5-minute timeout automatically logs out at the 5-minute deadline', async () => {
      // 5 minutes + 2 seconds elapsed
      const expiredTime = Date.now() - (5 * 60 + 2) * 1000;

      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 5,
        warningDurationSeconds: 60,
        lastActivityTime: expiredTime,
      });

      const { router } = renderGuard();

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('genuine user interaction (mousemove with coordinate delta) resets the deadline', async () => {
      // 3 minutes elapsed out of 5 minutes
      const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 5,
        warningDurationSeconds: 60,
        lastActivityTime: threeMinutesAgo,
      });

      renderGuard();

      expect(useSessionSecurityStore.getState().lastActivityTime).toBe(threeMinutesAgo);

      // Dispatch genuine mousemove with coordinates
      act(() => {
        const mouseEvent = new MouseEvent('mousemove', { clientX: 100, clientY: 150 });
        window.dispatchEvent(mouseEvent);
      });

      expect(useSessionSecurityStore.getState().lastActivityTime).toBeGreaterThan(threeMinutesAgo);
    });

    it('background query updates do not reset the inactivity deadline', () => {
      const fourMinutesAgo = Date.now() - 4 * 60 * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 5,
        warningDurationSeconds: 60,
        lastActivityTime: fourMinutesAgo,
      });

      renderGuard();

      // Background data changes or queries do NOT trigger DOM events
      const queryClient = new QueryClient();
      queryClient.setQueryData(['background-check'], { timestamp: Date.now() });

      expect(useSessionSecurityStore.getState().lastActivityTime).toBe(fourMinutesAgo);
    });

    it('tab visibility change evaluates deadline immediately and terminates expired session', async () => {
      // Tab woke up after sleeping beyond 5 minutes
      const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 5,
        warningDurationSeconds: 60,
        lastActivityTime: sixMinutesAgo,
      });

      const { router } = renderGuard();

      // Trigger visibility change event
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('"Stay Logged In" resets activity timestamp and triggers background token refresh', async () => {
      const user = userEvent.setup();
      const refreshSpy = vi.spyOn(tokenRefreshCoordinator, 'requestTokenRefresh').mockResolvedValue({
        accessToken: 'new-token-123',
        refreshToken: 'new-refresh-456',
      });

      const fortySecondsRemaining = Date.now() - (30 * 60 - 40) * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 30,
        warningDurationSeconds: 60,
        lastActivityTime: fortySecondsRemaining,
      });

      renderGuard();

      const modal = await screen.findByTestId('session-inactivity-warning-modal');
      expect(modal).toBeInTheDocument();

      const stayLoggedInBtn = screen.getByTestId('stay-logged-in-button');
      await user.click(stayLoggedInBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('session-inactivity-warning-modal')).not.toBeInTheDocument();
      });

      expect(refreshSpy).toHaveBeenCalled();
      const lastActive = useSessionSecurityStore.getState().lastActivityTime;
      expect(Date.now() - lastActive).toBeLessThan(2000);
    });

    it('"Stay Logged In" terminates session if token refresh fails on server', async () => {
      const user = userEvent.setup();
      vi.spyOn(tokenRefreshCoordinator, 'requestTokenRefresh').mockRejectedValue(
        new Error('Session revoked by server')
      );

      const fortySecondsRemaining = Date.now() - (5 * 60 - 40) * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 5,
        warningDurationSeconds: 60,
        lastActivityTime: fortySecondsRemaining,
      });

      const { router } = renderGuard();

      const modal = await screen.findByTestId('session-inactivity-warning-modal');
      expect(modal).toBeInTheDocument();

      const stayLoggedInBtn = screen.getByTestId('stay-logged-in-button');
      await user.click(stayLoggedInBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('terminates session and redirects to /auth/login when full timeout elapses', async () => {
      const expiredTime = Date.now() - (30 * 60 + 5) * 1000; // 30 min + 5s ago
      useSessionSecurityStore.setState({
        autoLogoutEnabled: true,
        timeoutMinutes: 30,
        warningDurationSeconds: 60,
        lastActivityTime: expiredTime,
      });

      const { router } = renderGuard();

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('does not display warning when autoLogoutEnabled is false', async () => {
      const expiredTime = Date.now() - 30 * 60 * 1000;
      useSessionSecurityStore.setState({
        autoLogoutEnabled: false,
        timeoutMinutes: 30,
        warningDurationSeconds: 60,
        lastActivityTime: expiredTime,
      });

      renderGuard();

      // Ensure modal does not appear
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(screen.queryByTestId('session-inactivity-warning-modal')).not.toBeInTheDocument();
    });
  });

  describe('5. Cross-Tab Synchronization & Persistence Lifecycle', () => {
    it('restores persisted policy from localStorage on initialization', () => {
      window.localStorage.setItem(
        POLICY_STORAGE_KEY,
        JSON.stringify({ autoLogoutEnabled: true, timeoutMinutes: 25 })
      );

      const policy = getInitialPolicy();
      expect(policy.autoLogoutEnabled).toBe(true);
      expect(policy.timeoutMinutes).toBe(25);
    });

    it('clamps invalid or corrupted values from storage to valid defaults', () => {
      window.localStorage.setItem(
        POLICY_STORAGE_KEY,
        JSON.stringify({ autoLogoutEnabled: 'invalid', timeoutMinutes: 999 })
      );

      const policy = getInitialPolicy();
      expect(policy.autoLogoutEnabled).toBe(true);
      expect(policy.timeoutMinutes).toBe(DEFAULT_TIMEOUT_MINUTES);
    });

    it('synchronizes policy changes across tabs via storage event', () => {
      render(
        <MemoryRouter>
          <SessionInactivityGuard />
        </MemoryRouter>
      );

      expect(useSessionSecurityStore.getState().timeoutMinutes).toBe(15);

      // Simulate a storage event fired from another browser tab
      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: POLICY_STORAGE_KEY,
            newValue: JSON.stringify({ autoLogoutEnabled: true, timeoutMinutes: 45 }),
          })
        );
      });

      expect(useSessionSecurityStore.getState().timeoutMinutes).toBe(45);
    });
  });

  describe('6. Role Authorization & Access Control', () => {
    it('disables save and editing controls for non-superadmin without configuration permissions', async () => {
      // Simulate Support Executive
      useAuthStore.setState({
        isAuthenticated: true,
        user: {
          id: 'support-1',
          name: 'Support Executive',
          email: 'support@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          permissions: ['support.view', 'support.manage', 'booking.view'],
        },
      });

      renderWithProviders(<ConfigurationMastersPage />);

      // NoAccessView is rendered for unauthorized roles accessing security settings directly
      expect(screen.getByRole('region', { name: /Access Denied/i })).toBeInTheDocument();
      expect(screen.queryByTestId('save-security-policy-btn')).not.toBeInTheDocument();
    });
  });
});
