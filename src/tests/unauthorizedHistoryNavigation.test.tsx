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
        expect(router.state.location.pathname).toBe('/verification');
      });

      // Browser popstate back into /payments
      triggerPopStateForTesting();
      window.dispatchEvent(new window.PopStateEvent('popstate'));

      await act(async () => {
        await router.navigate('/payments');
      });

      // Redirects to /verification
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
      expect(await screen.findByText('Worker Verification & Trust Operations', {}, { timeout: 4000 })).toBeInTheDocument();
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

      expect(await screen.findByRole('heading', { name: /Financial Transactions & Refunds/i }, { timeout: 10000 })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
    });
  });
});
