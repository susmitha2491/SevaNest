/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { getDefaultLandingRoute, PERMISSIONS } from '../core/rbac/permissions';

function renderApp(initialEntry = '/auth/login') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const memoryRouter = createMemoryRouter(routes, {
    initialEntries: [{ pathname: initialEntry }],
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

describe('All Roles Land on Dashboard After Login Verification', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. getDefaultLandingRoute Contract Evaluation', () => {
    it('evaluates SUPER_ADMIN landing route to /dashboard', () => {
      expect(
        getDefaultLandingRoute({
          role: 'SUPER_ADMIN',
          permissions: ['*'],
        })
      ).toBe('/dashboard');
    });

    it('evaluates OPERATIONS_ADMIN landing route to /dashboard', () => {
      expect(
        getDefaultLandingRoute({
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.CUSTOMER_VIEW,
            PERMISSIONS.WORKER_VIEW,
          ],
        })
      ).toBe('/dashboard');
    });

    it('evaluates VERIFICATION_EXECUTIVE landing route to /dashboard', () => {
      expect(
        getDefaultLandingRoute({
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            'alert.view',
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DECIDE,
            PERMISSIONS.WORKER_VIEW,
          ],
        })
      ).toBe('/dashboard');
    });

    it('evaluates SUPPORT_EXECUTIVE landing route to /dashboard', () => {
      expect(
        getDefaultLandingRoute({
          role: 'SUPPORT_EXECUTIVE',
          permissions: [
            PERMISSIONS.SUPPORT_VIEW,
            PERMISSIONS.SUPPORT_MANAGE,
            PERMISSIONS.CUSTOMER_VIEW,
          ],
        })
      ).toBe('/dashboard');
    });

    it('evaluates unauthenticated users to /auth/login', () => {
      expect(getDefaultLandingRoute(null)).toBe('/auth/login');
      expect(getDefaultLandingRoute(undefined)).toBe('/auth/login');
    });
  });

  describe('2. Direct Sign-In Routing Across All 4 Roles', () => {
    it('Super Admin logs in and lands strictly on /dashboard', async () => {
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

    it('Operations Admin logs in and lands strictly on /dashboard', async () => {
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

    it('Verification Executive logs in and lands strictly on /dashboard', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

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
      // Ensure Dashboard nav is active in the sidebar
      const activeDashboardLink = screen.getByRole('link', { name: /Dashboard/i });
      expect(activeDashboardLink).toHaveClass('active');
    });

    it('Support Executive logs in and lands strictly on /dashboard', async () => {
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

  describe('3. Root Route (/) Redirects to /dashboard for All 4 Roles', () => {
    it.each([
      ['SUPER_ADMIN', 'Super Admin', ['*']],
      ['OPERATIONS_ADMIN', 'Operations Admin', [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.WORKER_VIEW]],
      ['VERIFICATION_EXECUTIVE', 'Verification Executive', ['alert.view', PERMISSIONS.VERIFICATION_REVIEW, PERMISSIONS.WORKER_VIEW]],
      ['SUPPORT_EXECUTIVE', 'Support Executive', [PERMISSIONS.SUPPORT_VIEW, PERMISSIONS.CUSTOMER_VIEW]],
    ])('redirects %s session on root (/) to /dashboard', async (role, name, permissions) => {
      useAuthStore.getState().setSession(
        {
          id: `test-${role}`,
          name,
          email: `${role.toLowerCase()}@sevanest.internal`,
          role: role as any,
          permissions,
        },
        'token-test'
      );

      const { router } = renderApp('/');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
    });
  });
});

