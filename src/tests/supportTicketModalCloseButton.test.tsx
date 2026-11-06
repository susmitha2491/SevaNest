import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { supportRepository } from '../features/support/data/supportRepository';

function renderApp(initialPath: string = '/support/tickets') {
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

describe('Support Ticket Detail Modal Close Functionality', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession();

    // Standard authoritative Support Executive session
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
  });

  it('closes ticket detail modal when clicking the top-right "x" button even when opened with ticketId URL param', async () => {
    const user = userEvent.setup();
    const ticketsRes = await supportRepository.getTickets();
    const targetTicket = ticketsRes.items[0];
    expect(targetTicket).toBeDefined();

    const initialUrl = `/support/tickets?search=${encodeURIComponent(targetTicket.id)}&ticketId=${encodeURIComponent(targetTicket.id)}`;
    const { router } = renderApp(initialUrl);

    // 1. Verify modal is automatically opened for the specified ticketId
    expect(
      await screen.findByRole('dialog', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Grievance Case: ${targetTicket.id}`, 'i'))).toBeInTheDocument();

    // 2. Find and click the top-right "x" close button
    const closeXButton = screen.getByRole('button', { name: /Close ticket modal/i });
    expect(closeXButton).toBeInTheDocument();
    await user.click(closeXButton);

    // 3. Verify modal closes and does not re-open
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // 4. Verify ticketId is removed from search params while preserving search filter
    expect(router.state.location.search).not.toContain('ticketId=');

    // Wait a brief tick to ensure useEffect does not falsely re-open it
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes ticket detail modal when pressing Escape key', async () => {
    const user = userEvent.setup();
    const ticketsRes = await supportRepository.getTickets();
    const targetTicket = ticketsRes.items[0];

    const initialUrl = `/support/tickets?search=${encodeURIComponent(targetTicket.id)}&ticketId=${encodeURIComponent(targetTicket.id)}`;
    renderApp(initialUrl);

    expect(await screen.findByRole('dialog', {}, { timeout: 4000 })).toBeInTheDocument();

    // Press Escape key
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('closes ticket detail modal when clicking the bottom Close button', async () => {
    const user = userEvent.setup();
    const ticketsRes = await supportRepository.getTickets();
    const targetTicket = ticketsRes.items[0];

    const initialUrl = `/support/tickets?search=${encodeURIComponent(targetTicket.id)}&ticketId=${encodeURIComponent(targetTicket.id)}`;
    renderApp(initialUrl);

    expect(await screen.findByRole('dialog', {}, { timeout: 4000 })).toBeInTheDocument();

    const bottomCloseButton = screen.getByTestId('bottom-close-ticket-modal-button');
    expect(bottomCloseButton).toBeInTheDocument();
    await user.click(bottomCloseButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

