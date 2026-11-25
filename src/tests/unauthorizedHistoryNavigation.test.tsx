/* global Event, PageTransitionEvent */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { triggerPopStateForTesting } from '../app/router/popstateTracker';

function renderApp(initialEntries: string[], initialIndex = 0) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });

  const memoryRouter = createMemoryRouter(routes, {
    initialEntries,
    initialIndex,
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

describe('Unauthorized History Navigation & Route Guard Security', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Support Executive Role Landing and Navigation', () => {
    it('Support Executive logs in and lands directly on /dashboard', async () => {
      const user = userEvent.setup();
      const { router } = renderApp(['/auth/login']);

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
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
    });

    it('Support Executive can navigate between authorized pages (/dashboard, /support/tickets, /support/my-tickets)', async () => {
      const user = userEvent.setup();
      const { router } = renderApp(['/auth/login']);

      // 1. Log in
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'support.executive@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Support@2026');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      // 2. Navigate to Support Tickets (/support/tickets)
      await act(async () => {
        await router.navigate('/support/tickets');
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/support/tickets');
      });
      expect(await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i }, { timeout: 4000 })).toBeInTheDocument();

      // 3. Navigate to My Assigned Tickets (/support/my-tickets)
      await act(async () => {
        await router.navigate('/support/my-tickets');
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/support/my-tickets');
      });
      expect(await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i }, { timeout: 4000 })).toBeInTheDocument();

      // Legitimate back navigation works between authorized pages
      await act(async () => {
        await router.navigate(-1);
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/support/tickets');
      });
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
    });
  });

  describe('2. Browser History Traversal into Unauthorized Routes (Popstate Protection)', () => {
    it('Redirects Support Executive to /dashboard and prevents Access Restricted when history traversal hits /payments', async () => {
      // Simulate history where /payments was in the stack before Support Executive logged in
      const user = userEvent.setup();
      const { router } = renderApp(['/payments', '/auth/login'], 1);

      // Log in as Support Executive
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'support.executive@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Support@2026');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      // User navigates to /support
      await act(async () => {
        await router.navigate('/support');
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/support');
      });

      // Now user traverses back past /dashboard into /payments (which requires payments.view)
      // When browser Back button is clicked in a browser, window popstate event fires
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));

      await act(async () => {
        await router.navigate('/payments');
      });

      // Must immediately redirect to /dashboard landing route
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      // Must NEVER display "Access Restricted"
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: /^Dashboard$/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/Support operations overview and ticket monitoring\./i)).toBeInTheDocument();
    });

    it('Redirects Verification Executive to /verification when history traversal hits unauthorized /payments', async () => {
      const user = userEvent.setup();
      const { router } = renderApp(['/payments', '/auth/login'], 1);

      // Log in as Verification Executive
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'verification.executive@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Verification@2026');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      // Browser popstate back into /payments
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));

      await act(async () => {
        await router.navigate('/payments');
      });

      // Redirects to /dashboard
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: /Trust & Verification Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('Redirects Operations Manager to /dashboard when history traversal hits unauthorized /configuration', async () => {
      const user = userEvent.setup();
      const { router } = renderApp(['/configuration', '/auth/login'], 1);

      // Log in as Operations Manager
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'operations.manager@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Operations@2026');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      // Browser popstate back into /configuration
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));

      await act(async () => {
        await router.navigate('/configuration');
      });

      // Redirects to /dashboard
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: /Operations Command Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('Administrator has full access to /payments and all workstations without redirection', async () => {
      const user = userEvent.setup();
      const { router } = renderApp(['/auth/login']);

      // Log in as Administrator
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'sevanest@admin.in');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Sevanest@2026');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      // Navigate to /payments
      await act(async () => {
        await router.navigate('/payments');
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/payments');
      });

      expect(await screen.findByRole('heading', { name: /Financial Transactions/i }, { timeout: 10000 })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
    });
  });

  describe('3. Browser History Traversal (Back & Forward) Post-Logout Across All 4 Roles', () => {
    it('SUPER_ADMIN: Back and Forward work while authenticated; after logout, Back/Forward redirect to /auth/login and never render protected modules', async () => {
      const user = userEvent.setup();
      const { router, queryClient } = renderApp(['/auth/login']);

      // 1. Sign in as Super Admin
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

      // 2. Navigate to another module: /workers
      await act(async () => {
        await router.navigate('/workers');
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/workers');
      });
      expect(await screen.findByRole('heading', { name: /Domestic Worker Roster & Profiles/i }, { timeout: 4000 })).toBeInTheDocument();

      // 3. Authenticated Back navigation works: returns to /dashboard
      await act(async () => {
        await router.navigate(-1);
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Super Admin Executive Console/i }, { timeout: 4000 })).toBeInTheDocument();

      // 4. Authenticated Forward navigation works: returns to /workers
      await act(async () => {
        await router.navigate(1);
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/workers');
      });
      expect(await screen.findByRole('heading', { name: /Domestic Worker Roster & Profiles/i }, { timeout: 4000 })).toBeInTheDocument();

      // 5. Sign Out
      const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
      await user.click(signOutBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);

      // 6. Press browser Back button after logout:
      // Must NOT display /workers or /dashboard; must stay/redirect to /auth/login
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));

      await act(async () => {
        await router.navigate(-1);
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(screen.queryByRole('heading', { name: /Super Admin Executive Console/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Domestic Worker Roster & Profiles/i })).not.toBeInTheDocument();
      expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();

      // 7. Press browser Forward button after logout:
      // Must NOT open dashboard or any module without requiring sign-in
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));

      await act(async () => {
        await router.navigate(1);
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(screen.queryByRole('heading', { name: /Super Admin Executive Console/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Domestic Worker Roster & Profiles/i })).not.toBeInTheDocument();
      expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();
    });

    it('OPERATIONS_ADMIN: Back and Forward work while authenticated; after logout, Back/Forward redirect to /auth/login', async () => {
      const user = userEvent.setup();
      const { router, queryClient } = renderApp(['/auth/login']);

      // 1. Sign in as Operations Admin
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

      // 2. Navigate to /bookings
      await act(async () => {
        await router.navigate('/bookings');
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/bookings');
      });
      expect(await screen.findByRole('heading', { name: /Booking & Service Management/i }, { timeout: 4000 })).toBeInTheDocument();

      // 3. Authenticated Back navigation works
      await act(async () => {
        await router.navigate(-1);
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Operations Command Console/i }, { timeout: 4000 })).toBeInTheDocument();

      // 4. Authenticated Forward navigation works
      await act(async () => {
        await router.navigate(1);
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/bookings');
      });
      expect(await screen.findByRole('heading', { name: /Booking & Service Management/i }, { timeout: 4000 })).toBeInTheDocument();

      // 5. Sign Out
      const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
      await user.click(signOutBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);

      // 6. Press Back after logout: stays on /auth/login
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      await act(async () => {
        await router.navigate(-1);
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(screen.queryByRole('heading', { name: /Booking & Service Management/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Operations Command Console/i })).not.toBeInTheDocument();
      expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();

      // 7. Press Forward after logout: stays on /auth/login
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      await act(async () => {
        await router.navigate(1);
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(screen.queryByRole('heading', { name: /Booking & Service Management/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Operations Command Console/i })).not.toBeInTheDocument();
    });

    it('VERIFICATION_EXECUTIVE: Back and Forward work while authenticated; after logout, Back/Forward redirect to /auth/login', async () => {
      const user = userEvent.setup();
      const { router, queryClient } = renderApp(['/auth/login']);

      // 1. Sign in as Verification Executive
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'verification.executive@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Verification@2026');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Trust & Verification Console/i }, { timeout: 4000 })).toBeInTheDocument();

      // 2. Navigate to /verification
      await act(async () => {
        await router.navigate('/verification');
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });

      // 3. Authenticated Back navigation works
      await act(async () => {
        await router.navigate(-1);
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Trust & Verification Console/i }, { timeout: 4000 })).toBeInTheDocument();

      // 4. Authenticated Forward navigation works
      await act(async () => {
        await router.navigate(1);
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });

      // 5. Sign Out
      const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
      await user.click(signOutBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);

      // 6. Press Back after logout: stays on /auth/login
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      await act(async () => {
        await router.navigate(-1);
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(screen.queryByText('Worker Verification & Trust Operations')).not.toBeInTheDocument();
      expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();

      // 7. Press Forward after logout: stays on /auth/login
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      await act(async () => {
        await router.navigate(1);
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(screen.queryByText('Worker Verification & Trust Operations')).not.toBeInTheDocument();
    });

    it('SUPPORT_EXECUTIVE: Back and Forward work while authenticated; after logout, Back/Forward redirect to /auth/login', async () => {
      const user = userEvent.setup();
      const { router, queryClient } = renderApp(['/auth/login']);

      // 1. Sign in as Support Executive
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

      // 2. Navigate to /support/tickets
      await act(async () => {
        await router.navigate('/support/tickets');
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/support/tickets');
      });
      expect(await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i }, { timeout: 4000 })).toBeInTheDocument();

      // 3. Authenticated Back navigation works
      await act(async () => {
        await router.navigate(-1);
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /^Dashboard$/i }, { timeout: 4000 })).toBeInTheDocument();

      // 4. Authenticated Forward navigation works
      await act(async () => {
        await router.navigate(1);
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/support/tickets');
      });
      expect(await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i }, { timeout: 4000 })).toBeInTheDocument();

      // 5. Sign Out
      const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
      await user.click(signOutBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);

      // 6. Press Back after logout: stays on /auth/login
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      await act(async () => {
        await router.navigate(-1);
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(screen.queryByRole('heading', { name: /Support Grievance & SLA Queue/i })).not.toBeInTheDocument();
      expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();

      // 7. Press Forward after logout: stays on /auth/login
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      await act(async () => {
        await router.navigate(1);
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(screen.queryByRole('heading', { name: /Support Grievance & SLA Queue/i })).not.toBeInTheDocument();
    });

    it('Back-Forward Cache (bfcache pageshow event) purges queries and replaces to /auth/login when unauthenticated', async () => {
      const { router, queryClient } = renderApp(['/auth/login']);

      // Prepopulate cache with simulated sensitive query
      queryClient.setQueryData(['sensitive_workers'], [{ id: 'w1', name: 'Confidential Worker' }]);
      expect(queryClient.getQueryData(['sensitive_workers'])).toBeDefined();

      // Ensure no active token in storage
      window.sessionStorage.clear();
      useAuthStore.getState().clearSession(false);

      // Dispatch pageshow event simulating browser bfcache resurrection
      const pageShowEvent = new Event('pageshow') as PageTransitionEvent;
      Object.defineProperty(pageShowEvent, 'persisted', { value: true, writable: false });
      window.dispatchEvent(pageShowEvent);

      await waitFor(() => {
        expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(router.state.location.pathname).toBe('/auth/login');
    });
  });

  describe('4. Direct Browser Back from Dashboard: Sign In -> Dashboard -> Back -> Invalidate Session -> Sign In Page -> Sign In Again', () => {
    it('SUPER_ADMIN: Sign In -> /dashboard -> Browser Back -> Invalidate -> /auth/login -> Sign In Again -> /dashboard', async () => {
      const user = userEvent.setup();
      const { router, queryClient } = renderApp(['/auth/login']);

      // 1. Initial Sign In as Super Admin
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'sevanest@admin.in');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Sevanest@2026');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      // Verify dashboard opened
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Super Admin Executive Console/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // 2. User presses browser Back button from dashboard
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      await act(async () => {
        await router.navigate(-1);
      });

      // 3. Application returns to /auth/login and securely invalidates session
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
      expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();

      // 4. Pressing browser Forward must NOT restore dashboard
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      await act(async () => {
        await router.navigate(1);
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(screen.queryByRole('heading', { name: /Super Admin Executive Console/i })).not.toBeInTheDocument();

      // 5. User signs in again with credentials
      const emailInput2 = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput2, 'sevanest@admin.in');
      const passwordInput2 = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput2, 'Sevanest@2026');
      const submitBtn2 = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn2);

      // 6. User re-authenticated and lands on dashboard
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Super Admin Executive Console/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('OPERATIONS_ADMIN: Sign In -> /dashboard -> Browser Back -> Invalidate -> /auth/login -> Sign In Again -> /dashboard', async () => {
      const user = userEvent.setup();
      const { router, queryClient } = renderApp(['/auth/login']);

      // 1. Sign In as Operations Admin
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
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // 2. Press browser Back button from dashboard
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      await act(async () => {
        await router.navigate(-1);
      });

      // 3. Returns to /auth/login, invalidating session
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
      expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();

      // 4. Press Forward -> remains on /auth/login
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      await act(async () => {
        await router.navigate(1);
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(screen.queryByRole('heading', { name: /Operations Command Console/i })).not.toBeInTheDocument();

      // 5. Sign In Again
      const emailInput2 = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput2, 'operations.manager@sevanest.example.com');
      const passwordInput2 = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput2, 'Operations@2026');
      const submitBtn2 = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn2);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Operations Command Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('VERIFICATION_EXECUTIVE: Sign In -> /verification -> Browser Back -> Invalidate -> /auth/login -> Sign In Again -> /verification', async () => {
      const user = userEvent.setup();
      const { router, queryClient } = renderApp(['/auth/login']);

      // 1. Sign In as Verification Executive
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'verification.executive@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Verification@2026');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Trust & Verification Console/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // 2. Press browser Back button from /dashboard
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      await act(async () => {
        await router.navigate(-1);
      });

      // 3. Returns to /auth/login, invalidating session
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
      expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();

      // 4. Press Forward -> remains on /auth/login
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      await act(async () => {
        await router.navigate(1);
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(screen.queryByRole('heading', { name: /Trust & Verification Console/i })).not.toBeInTheDocument();

      // 5. Sign In Again
      const emailInput2 = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput2, 'verification.executive@sevanest.example.com');
      const passwordInput2 = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput2, 'Verification@2026');
      const submitBtn2 = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn2);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Trust & Verification Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('SUPPORT_EXECUTIVE: Sign In -> /dashboard -> Browser Back -> Invalidate -> /auth/login -> Sign In Again -> /dashboard', async () => {
      const user = userEvent.setup();
      const { router, queryClient } = renderApp(['/auth/login']);

      // 1. Sign In as Support Executive
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
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // 2. Press browser Back button from dashboard
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      await act(async () => {
        await router.navigate(-1);
      });

      // 3. Returns to /auth/login, invalidating session
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
      expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();

      // 4. Press Forward -> remains on /auth/login
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));
      await act(async () => {
        await router.navigate(1);
      });
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(screen.queryByRole('heading', { name: /^Dashboard$/i })).not.toBeInTheDocument();

      // 5. Sign In Again
      const emailInput2 = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput2, 'support.executive@sevanest.example.com');
      const passwordInput2 = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput2, 'Support@2026');
      const submitBtn2 = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn2);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /^Dashboard$/i }, { timeout: 4000 })).toBeInTheDocument();
    });
  });
});
