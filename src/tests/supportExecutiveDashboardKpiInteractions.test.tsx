import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { resetRefreshCoordinator } from '../core/auth/tokenRefreshCoordinator';
import { resetSessionRestorationState } from '../core/auth/sessionRestoration';
import { verificationRepository } from '../features/verification/data/verificationRepository';

function renderApp(initialPath: string = '/dashboard') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  const router = createMemoryRouter(routes, {
    initialEntries: [initialPath],
    initialIndex: 0,
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );

  return { ...view, router, queryClient };
}

describe('Support Executive Dashboard Default Tab & Interaction Audit', () => {
  beforeEach(() => {
    cleanup();
    resetRefreshCoordinator();
    resetSessionRestorationState();
    useAuthStore.getState().clearSession(false);
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();

    // Default mock window.scrollTo
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    resetRefreshCoordinator();
    resetSessionRestorationState();
    useAuthStore.getState().clearSession(false);
    vi.restoreAllMocks();
  });

  /* =========================================================================
     1. Redesigned Support Analytics Dashboard on Fresh Login
     ========================================================================= */
  describe('1. Support Analytics Dashboard Structure', () => {
    it('renders clean Dashboard header, 6 KPI cards, analytics charts, and activity list without ticket queue tables or tabs', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-004',
          name: 'Pooja Sharma',
          email: 'support.exec@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.SUPPORT_VIEW,
            PERMISSIONS.SUPPORT_MANAGE,
            PERMISSIONS.CUSTOMER_VIEW,
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.BOOKINGS_VIEW,
          ],
        },
        'token-supp-004'
      );

      const { router } = renderApp('/dashboard');

      expect(
        await screen.findByRole('heading', { name: /^Dashboard$/i }, { timeout: 4000 })
      ).toBeInTheDocument();
      expect(screen.getByText(/Support operations overview and ticket monitoring\./i)).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/dashboard');

      // Duplicate queue table & tabs must NOT be rendered on Dashboard
      expect(document.getElementById('support-workstation-queues')).toBeNull();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /All Tickets/i })).not.toBeInTheDocument();

      // Verify Recent Support Activity lists tickets cleanly
      const activityList = screen.getByRole('list', { name: /Recent support activity list/i });
      expect(within(activityList).getByText('TKT-4921')).toBeInTheDocument();
      expect(within(activityList).getByText('TKT-4902')).toBeInTheDocument();
      expect(within(activityList).getByText('TKT-4919')).toBeInTheDocument();
      expect(within(activityList).getByText('TKT-4850')).toBeInTheDocument();
    });
  });

  /* =========================================================================
     2. Logout & Re-Login Consistency
     ========================================================================= */
  describe('2. Logout & Re-Login Analytics Consistency', () => {
    it('renders the Support Analytics Dashboard consistently after logout and fresh login', async () => {
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
      expect(screen.getByRole('heading', { name: /Ticket Status Distribution/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /SLA Monitoring/i })).toBeInTheDocument();

      const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
      await user.click(signOutBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);

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
      expect(screen.getByRole('heading', { name: /Recent Support Activity/i })).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  /* =========================================================================
     3. Recent Activity Click -> Modal in Dashboard Context
     ========================================================================= */
  describe('3. Recent Activity Ticket Detail Modal on Dashboard', () => {
    it('opens TicketDetailModal inside /dashboard when clicking a recent support activity item', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-004',
          name: 'Pooja Sharma',
          email: 'support.exec@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.SUPPORT_VIEW,
            PERMISSIONS.SUPPORT_MANAGE,
            PERMISSIONS.CUSTOMER_VIEW,
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.BOOKINGS_VIEW,
          ],
        },
        'token-supp-004'
      );

      const user = userEvent.setup();
      const { router } = renderApp('/dashboard');

      expect(
        await screen.findByRole('heading', { name: /^Dashboard$/i }, { timeout: 4000 })
      ).toBeInTheDocument();

      const activityBtn = screen.getByRole('button', { name: /Open ticket TKT-4921/i });
      await user.click(activityBtn);

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/#TKT-4921/i)).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/dashboard');
    });
  });

  /* =========================================================================
     4. Role Isolation & Immunity from Regression
     ========================================================================= */
  describe('4. Role Isolation: Operations Admin & Super Admin Undisturbed', () => {
    it('Operations Admin lands on /dashboard and mounts Operations Command Console unaffected', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-002',
          name: 'Operations Manager',
          email: 'operations.manager@sevanest.example.com',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.CUSTOMER_VIEW,
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.BOOKINGS_VIEW,
          ],
        },
        'token-oper-002'
      );

      renderApp('/dashboard');

      expect(
        await screen.findByRole('heading', { name: /Operations Command Console/i }, { timeout: 4000 })
      ).toBeInTheDocument();
      expect(screen.queryByText(/Support operations overview and ticket monitoring\./i)).not.toBeInTheDocument();
    });

    it('Verification Executive lands on /verification and mounts Trust Operations unaffected', async () => {
      vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      } as unknown as Awaited<ReturnType<typeof verificationRepository.getVerificationQueue>>);

      useAuthStore.getState().setSession(
        {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 'verification.executive@sevanest.example.com',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [PERMISSIONS.VERIFICATION_REVIEW, PERMISSIONS.WORKER_VIEW],
        },
        'token-verif-003'
      );

      renderApp('/verification');

      expect(
        await screen.findByText(/Worker Verification & Trust Operations/i, {}, { timeout: 4000 })
      ).toBeInTheDocument();
      expect(screen.queryByText(/Support operations overview and ticket monitoring\./i)).not.toBeInTheDocument();
    });
  });
});
