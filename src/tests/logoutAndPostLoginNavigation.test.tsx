import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

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

describe('Logout & Post-Login Navigation Behavior Across All Roles', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Role Cycle: Login -> Navigate -> Logout -> Re-login lands on default module', () => {
    it('SUPER_ADMIN: logs in to /dashboard, navigates to /workers, logs out, logs in again to /dashboard', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      // 1. Log in as Super Admin
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'sevanest@admin.in');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Sevanest@2026');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      // Verify default module opens: /dashboard
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Super Admin Executive Console/i }, { timeout: 4000 })).toBeInTheDocument();

      // 2. Navigate to another module: /workers
      await act(async () => {
        await router.navigate('/workers');
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/workers');
      });
      expect(await screen.findByRole('heading', { name: /Domestic Worker Roster & Profiles/i }, { timeout: 4000 })).toBeInTheDocument();

      // 3. Log out via sidebar Sign Out button
      const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
      await user.click(signOutBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);

      // 4. Log in again as Super Admin
      const emailInput2 = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput2, 'sevanest@admin.in');
      const passwordInput2 = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput2, 'Sevanest@2026');
      const submitBtn2 = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn2);

      // 5. Verify default module opens (/dashboard) instead of previously visited /workers
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Super Admin Executive Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('VERIFICATION_EXECUTIVE: logs in to /verification, navigates to /verification/rechecks, logs out, logs in again to /verification', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      // 1. Log in as Verification Executive
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'verification.executive@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Sn-mvKYhFKPJE7#7q');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      // Verify default module opens: /verification
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });
      expect(await screen.findByText('Worker Verification & Trust Operations', {}, { timeout: 4000 })).toBeInTheDocument();

      // 2. Navigate to another module: /verification/rechecks
      await act(async () => {
        await router.navigate('/verification/rechecks');
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification/rechecks');
      });

      // 3. Log out via sidebar Sign Out button
      const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
      await user.click(signOutBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);

      // 4. Log in again as Verification Executive
      const emailInput2 = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput2, 'verification.executive@sevanest.example.com');
      const passwordInput2 = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput2, 'Sn-mvKYhFKPJE7#7q');
      const submitBtn2 = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn2);

      // 5. Verify default module opens (/verification) instead of previously visited /verification/rechecks
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });
      expect(await screen.findByText('Worker Verification & Trust Operations', {}, { timeout: 4000 })).toBeInTheDocument();
    });

    it('OPERATIONS_ADMIN: logs in to /dashboard, navigates to /bookings, logs out, logs in again to /dashboard', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      // 1. Log in as Operations Admin
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'operations.manager@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'SnFFtzKHJQu3wm#7q');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      // Verify default module opens: /dashboard (Operations Command Console)
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Operations Command Console/i }, { timeout: 4000 })).toBeInTheDocument();

      // 2. Navigate to another module: /bookings
      await act(async () => {
        await router.navigate('/bookings');
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/bookings');
      });
      expect(await screen.findByRole('heading', { name: /Booking & Service Management/i }, { timeout: 4000 })).toBeInTheDocument();

      // 3. Log out via sidebar Sign Out button
      const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
      await user.click(signOutBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);

      // 4. Log in again as Operations Admin
      const emailInput2 = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput2, 'operations.manager@sevanest.example.com');
      const passwordInput2 = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput2, 'SnFFtzKHJQu3wm#7q');
      const submitBtn2 = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn2);

      // 5. Verify default module opens (/dashboard) instead of previously visited /bookings
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Operations Command Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('SUPPORT_EXECUTIVE: logs in to /dashboard, navigates to /support, logs out, logs in again to /dashboard', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      // 1. Log in as Support Executive
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'support.executive@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'SnGprIJDAxciUB#7q');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      // Verify default module opens: /dashboard (Support Operations Console)
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Support Operations Console/i }, { timeout: 4000 })).toBeInTheDocument();

      // 2. Navigate to another module: /support
      await act(async () => {
        await router.navigate('/support');
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/support');
      });
      expect(await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i }, { timeout: 4000 })).toBeInTheDocument();

      // 3. Log out via sidebar Sign Out button
      const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
      await user.click(signOutBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);

      // 4. Log in again as Support Executive
      const emailInput2 = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput2, 'support.executive@sevanest.example.com');
      const passwordInput2 = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput2, 'SnGprIJDAxciUB#7q');
      const submitBtn2 = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn2);

      // 5. Verify default module opens (/dashboard) instead of previously visited /support
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Support Operations Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });
  });

  describe('2. Direct Login Without Previous Session', () => {
    it('direct login for Verification Executive opens /verification immediately without prior session', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'verification.exec@sevanest.internal');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'password123');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });
      expect(await screen.findByText('Worker Verification & Trust Operations', {}, { timeout: 4000 })).toBeInTheDocument();
    });

    it('direct login for Operations Admin opens /dashboard immediately without prior session', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'ops.admin@sevanest.internal');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'password123');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Operations Command Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });
  });

  describe('3. Browser Refresh While Authenticated', () => {
    it('browser refresh preserves deep route for an already authenticated user without redirecting to default module', async () => {
      // Simulate stored refresh token in localStorage for session restoration
      window.localStorage.setItem('sevanest_refresh_token', 'refresh-oper-1720000000');
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
      // Preserved active deep link
      expect(router.state.location.pathname).toBe('/workers');
      expect(await screen.findByRole('heading', { name: /Domestic Worker Roster & Profiles/i }, { timeout: 4000 })).toBeInTheDocument();
    });
  });

  describe('4. Expired Session Handling', () => {
    it('expired session cleans storage, navigates to login, and subsequent navigation to / stays on login', async () => {
      window.localStorage.setItem('sevanest_refresh_token', 'expired-token-xyz');
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
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();

      // Subsequent navigation to / must remain on /auth/login without redirect loop
      await act(async () => {
        await router.navigate('/');
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();
    });
  });

  describe('5. Unauthorized Route Access', () => {
    it('unauthorized route renders Access Restricted view with link back to role landing route', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'verif-001',
          name: 'Verification Executive',
          email: 'verification.exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.CUSTOMER_VIEW,
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
          ],
        },
        'verif-token'
      );

      // Access unauthorized configuration page
      renderApp('/configuration');

      expect(await screen.findByRole('heading', { name: /Access Restricted/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/Required permission: configuration\.manage/i)).toBeInTheDocument();

      const returnLink = screen.getByRole('link', { name: /Return to Primary Workstation/i });
      expect(returnLink).toBeInTheDocument();
      expect(returnLink).toHaveAttribute('href', '/verification');
    });
  });

  describe('6. Role Switching Across Logout', () => {
    it('User A (Operations Admin) on /workers logs out; User B (Verification Executive) logs in and lands on /verification', async () => {
      const user = userEvent.setup();

      // User A (Operations Admin) active on /workers
      useAuthStore.getState().setSession(
        {
          id: 'ops-01',
          name: 'Operations Admin',
          email: 'operations.manager@sevanest.example.com',
          role: 'OPERATIONS_ADMIN',
          permissions: ['*'],
        },
        'token-ops-01'
      );

      const { router } = renderApp('/workers');
      expect(await screen.findByRole('heading', { name: /Domestic Worker Roster & Profiles/i }, { timeout: 4000 })).toBeInTheDocument();

      // Sign out
      const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
      await user.click(signOutBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });

      // User B (Verification Executive) signs in
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'verification.executive@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Sn-mvKYhFKPJE7#7q');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      // User B must land on /verification, NOT retain User A's /workers
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });
      expect(await screen.findByText('Worker Verification & Trust Operations', {}, { timeout: 4000 })).toBeInTheDocument();
    });
  });
});
