import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

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

describe('Support Executive Dashboard KPI Card Interactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession();

    // Authoritative Support Executive session
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

    // Mock window.scrollTo
    window.scrollTo = vi.fn();
  });

  it('keeps user on /dashboard when clicking KPI cards and updates tab filters and card highlights', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/dashboard');

    expect(
      await screen.findByRole('heading', { name: /Support Operations Console/i }, { timeout: 4000 })
    ).toBeInTheDocument();

    expect(router.state.location.pathname).toBe('/dashboard');

    const getWorkstation = () => document.getElementById('support-workstation-queues')!;

    // 1. Total Tickets -> All Tickets
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
