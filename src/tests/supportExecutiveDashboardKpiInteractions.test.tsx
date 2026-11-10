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
     1. Default Tab on Initial Login & Mount: All Tickets
     ========================================================================= */
  describe('1. Default Tab on Fresh Login', () => {
    it('defaults to "All Tickets" tab, "Total Tickets" KPI card, and full ticket roster on initial load', async () => {
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
        await screen.findByRole('heading', { name: /Support Operations Console/i }, { timeout: 4000 })
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/dashboard');

      const workstation = document.getElementById('support-workstation-queues')!;
      expect(workstation).not.toBeNull();

      // 1. Verify "All Tickets" tab is active by default with primary highlight
      const allTicketsTab = within(workstation).getByRole('button', { name: /All Tickets/i });
      expect(allTicketsTab.style.color).toBe('var(--color-primary)');
      expect(allTicketsTab.style.fontWeight).toBe('700');

      // 2. Verify other tabs are NOT active
      const atRiskTab = within(workstation).getByRole('button', { name: /SLA At Risk & Breached/i });
      expect(atRiskTab.style.color).toBe('var(--color-text-secondary)');
      expect(atRiskTab.style.fontWeight).toBe('500');

      // 3. Verify All Tickets records are present in the workstation table
      expect(within(workstation).getByText('TKT-4921')).toBeInTheDocument();
      expect(within(workstation).getByText('TKT-4902')).toBeInTheDocument();
      expect(within(workstation).getByText('TKT-4919')).toBeInTheDocument();
      expect(within(workstation).getByText('TKT-4915')).toBeInTheDocument();
      expect(within(workstation).getByText('TKT-4890')).toBeInTheDocument();
      expect(within(workstation).getByText('TKT-4877')).toBeInTheDocument();
      expect(within(workstation).getByText('TKT-4850')).toBeInTheDocument();

      // 4. Verify Total Tickets KPI card is highlighted by default
      const totalTicketsCard = screen.getByText('Total Tickets').closest('div[style*="cursor: pointer"]')!;
      expect(totalTicketsCard).not.toBeNull();
    });
  });

  /* =========================================================================
     2. Tab Switching and Logout / Re-Login Reset
     ========================================================================= */
  describe('2. Tab Switching & Re-Login Reset', () => {
    it('allows switching to other tabs, but resets strictly to "All Tickets" upon logout and fresh login', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/auth/login');

      // 1. Login as Support Executive
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'support.executive@sevanest.example.com');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'Support@2026');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Support Operations Console/i }, { timeout: 4000 })).toBeInTheDocument();

      const getWorkstation = () => document.getElementById('support-workstation-queues')!;

      // Verify initially "All Tickets" is selected
      const initialAllTab = within(getWorkstation()).getByRole('button', { name: /All Tickets/i });
      expect(initialAllTab.style.color).toBe('var(--color-primary)');

      // 2. Switch to another tab: "SLA At Risk & Breached"
      const atRiskTabBtn = within(getWorkstation()).getByRole('button', { name: /SLA At Risk & Breached/i });
      await user.click(atRiskTabBtn);

      await waitFor(() => {
        expect(atRiskTabBtn.style.color).toBe('var(--color-primary)');
      });

      // Verify table filtered to at-risk queue
      expect(within(getWorkstation()).getByText('TKT-4921')).toBeInTheDocument();
      expect(within(getWorkstation()).getByText('TKT-4902')).toBeInTheDocument();
      expect(within(getWorkstation()).queryByText('TKT-4850')).not.toBeInTheDocument();

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
      await user.type(passwordInput2, 'Support@2026');
      const submitBtn2 = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn2);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
      expect(await screen.findByRole('heading', { name: /Support Operations Console/i }, { timeout: 4000 })).toBeInTheDocument();

      // 5. Authoritatively verify that the dashboard opened to "All Tickets" and did NOT restore "SLA At Risk"
      const newAllTab = within(getWorkstation()).getByRole('button', { name: /All Tickets/i });
      expect(newAllTab.style.color).toBe('var(--color-primary)');
      expect(newAllTab.style.fontWeight).toBe('700');

      const newAtRiskTab = within(getWorkstation()).getByRole('button', { name: /SLA At Risk & Breached/i });
      expect(newAtRiskTab.style.color).toBe('var(--color-text-secondary)');
      expect(newAtRiskTab.style.fontWeight).toBe('500');

      // Full roster is back
      expect(within(getWorkstation()).getByText('TKT-4850')).toBeInTheDocument();
    });
  });

  /* =========================================================================
     3. KPI Card Clicks & Interactive Queues
     ========================================================================= */
  describe('3. KPI Card Interactions on Dashboard', () => {
    it('keeps user on /dashboard when clicking KPI cards and updates tab filters and card highlights', async () => {
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
        await screen.findByRole('heading', { name: /Support Operations Console/i }, { timeout: 4000 })
      ).toBeInTheDocument();

      expect(router.state.location.pathname).toBe('/dashboard');

      const getWorkstation = () => document.getElementById('support-workstation-queues')!;

      // 1. Total Tickets -> All Tickets (already active, click smoothly scrolls)
      const totalTicketsCard = screen.getByText('Total Tickets').closest('div[style*="cursor: pointer"]');
      expect(totalTicketsCard).not.toBeNull();
      await user.click(totalTicketsCard!);

      expect(router.state.location.pathname).toBe('/dashboard');
      expect(window.scrollTo).toHaveBeenCalled();

      // Verify "All Tickets" tab is active in workstation
      await waitFor(() => {
        const allTicketsTab = within(getWorkstation()).getByRole('button', { name: /All Tickets/i });
        expect(allTicketsTab.style.color).toBe('var(--color-primary)');
      });

      // 2. Unassigned Tickets -> Unassigned Intake Queue
      const unassignedCard = screen.getByText('Unassigned Tickets').closest('div[style*="cursor: pointer"]');
      expect(unassignedCard).not.toBeNull();
      await user.click(unassignedCard!);

      expect(router.state.location.pathname).toBe('/dashboard');
      await waitFor(() => {
        const tab = within(getWorkstation()).getByRole('button', { name: /Unassigned Intake Queue/i });
        expect(tab.style.color).toBe('var(--color-primary)');
      });

      // 3. My Assigned Tickets -> My Active Cases
      const myAssignedCards = screen.getAllByText('My Assigned Tickets');
      const myAssignedCard = myAssignedCards.find((el) => el.closest('div[style*="cursor: pointer"]'))!.closest('div[style*="cursor: pointer"]');
      await user.click(myAssignedCard!);

      expect(router.state.location.pathname).toBe('/dashboard');
      await waitFor(() => {
        const tab = within(getWorkstation()).getByRole('button', { name: /My Active Cases/i });
        expect(tab.style.color).toBe('var(--color-primary)');
      });

      // 4. In Progress -> In Investigation
      const inProgressCard = screen.getByText('In Progress').closest('div[style*="cursor: pointer"]');
      expect(inProgressCard).not.toBeNull();
      await user.click(inProgressCard!);

      expect(router.state.location.pathname).toBe('/dashboard');
      await waitFor(() => {
        const tab = within(getWorkstation()).getByRole('button', { name: /In Investigation/i });
        expect(tab.style.color).toBe('var(--color-primary)');
      });

      // 5. SLA Imminent Breach -> SLA At Risk & Breached
      const slaCard = screen.getByText('SLA Imminent Breach').closest('div[style*="cursor: pointer"]');
      expect(slaCard).not.toBeNull();
      await user.click(slaCard!);

      expect(router.state.location.pathname).toBe('/dashboard');
      await waitFor(() => {
        const tab = within(getWorkstation()).getByRole('button', { name: /SLA At Risk & Breached/i });
        expect(tab.style.color).toBe('var(--color-primary)');
      });

      // 6. Escalated Tickets -> Escalated to Operations
      const escalatedCards = screen.getAllByText('Escalated Tickets');
      const escalatedCard = escalatedCards.find((el) => el.closest('div[style*="cursor: pointer"]'))!.closest('div[style*="cursor: pointer"]');
      await user.click(escalatedCard!);

      expect(router.state.location.pathname).toBe('/dashboard');
      await waitFor(() => {
        const tab = within(getWorkstation()).getByRole('button', { name: /Escalated to Operations/i });
        expect(tab.style.color).toBe('var(--color-primary)');
      });

      // 7. Resolved Tickets -> Resolved Tickets
      const resolvedCard = screen.getByText('Resolved Tickets').closest('div[style*="cursor: pointer"]');
      expect(resolvedCard).not.toBeNull();
      await user.click(resolvedCard!);

      expect(router.state.location.pathname).toBe('/dashboard');
      await waitFor(() => {
        const tab = within(getWorkstation()).getByRole('button', { name: /Resolved Tickets/i });
        expect(tab.style.color).toBe('var(--color-primary)');
      });

      // Retaining current filter when clicking already-selected KPI card
      await user.click(resolvedCard!);
      expect(router.state.location.pathname).toBe('/dashboard');
      const tab = within(getWorkstation()).getByRole('button', { name: /Resolved Tickets/i });
      expect(tab.style.color).toBe('var(--color-primary)');
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
      expect(screen.queryByRole('heading', { name: /Support Operations Console/i })).not.toBeInTheDocument();
    });

    it('Verification Executive lands on /verification and mounts Trust Operations unaffected', async () => {
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
      expect(screen.queryByRole('heading', { name: /Support Operations Console/i })).not.toBeInTheDocument();
    });
  });
});
