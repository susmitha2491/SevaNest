import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderApp(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  const memoryRouter = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
  });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={memoryRouter} />
      </QueryClientProvider>
    ),
    router: memoryRouter,
  };
}

describe('Worker Directory — Consistent Worker Profile Navigation & Interaction', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    // Default session: Operations Admin with view workers permission
    useAuthStore.getState().setSession(
      {
        id: 'ops-01',
        name: 'Operations Admin',
        email: 'ops@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.WORKERS_VIEW,
          PERMISSIONS.WORKERS_MANAGE,
          PERMISSIONS.WORKERS_MANAGE_STATUS,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
        ],
      },
      'ops-token'
    );
  });

  it('renders worker rows with accessible role, tabIndex, aria-label, and hover class for profile inspection', async () => {
    renderApp('/workers');

    expect(await screen.findByText('Domestic Worker Roster & Profiles')).toBeInTheDocument();
    const rows = await screen.findAllByRole('button', { name: /View profile for .+ \(W-\d+\)/i });
    expect(rows.length).toBeGreaterThan(0);

    const firstRow = rows[0];
    expect(firstRow.tagName).toBe('TR');
    expect(firstRow).toHaveAttribute('tabindex', '0');
    expect(firstRow.className).toContain('worker-directory-row');
    expect(firstRow).toHaveAttribute('aria-label', expect.stringMatching(/View profile for .+ \(W-\d+\)/));
  });

  it('clicking a worker row opens the worker profile view (WorkerDetailModal)', async () => {
    renderApp('/workers');

    expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
    const sunitaRow = screen.getByRole('button', { name: /View profile for Sunita Devi \(W-10482\)/i });

    // Click anywhere on the table row
    fireEvent.click(sunitaRow);

    // Profile modal opens with worker profile details
    expect(await screen.findByRole('heading', { level: 2, name: 'Sunita Devi' })).toBeInTheDocument();
    expect(screen.getByText('ID: W-10482')).toBeInTheDocument();
    expect(screen.getByText(/• House Maid •/i)).toBeInTheDocument();
  });

  it('clicking View Profile button opens the exact same profile view as clicking the row', async () => {
    renderApp('/workers');

    expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
    const viewButton = screen.getByRole('button', { name: 'View profile for Sunita Devi' });
    expect(viewButton.tagName).toBe('BUTTON');

    fireEvent.click(viewButton);

    // Identical WorkerDetailModal opens with identical elements
    expect(await screen.findByRole('heading', { level: 2, name: 'Sunita Devi' })).toBeInTheDocument();
    expect(screen.getAllByText(/Kondapur/i).length).toBeGreaterThan(0);
  });

  it('both navigation paths preserve the selected worker ID and do not mix up worker data', async () => {
    renderApp('/workers');

    // 1. Click row for Ramesh Yadav (W-10483)
    expect(await screen.findByText('Ramesh Yadav')).toBeInTheDocument();
    const rameshRow = screen.getByRole('button', { name: /View profile for Ramesh Yadav \(W-10483\)/i });
    fireEvent.click(rameshRow);

    expect(await screen.findByRole('heading', { level: 2, name: 'Ramesh Yadav' })).toBeInTheDocument();
    expect(screen.getByText('ID: W-10483')).toBeInTheDocument();
    expect(screen.getByText(/• Driver •/i)).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: 'Close dossier' });
    fireEvent.click(closeBtn);

    // 2. Click View Profile button for Sunita Devi (W-10482)
    const sunitaViewBtn = screen.getByRole('button', { name: 'View profile for Sunita Devi' });
    fireEvent.click(sunitaViewBtn);

    expect(await screen.findByRole('heading', { level: 2, name: 'Sunita Devi' })).toBeInTheDocument();
    expect(screen.getByText('ID: W-10482')).toBeInTheDocument();
    expect(screen.getByText(/• House Maid •/i)).toBeInTheDocument();
  });

  it('clicking Review KYC button opens the verification queue without opening the worker profile modal', async () => {
    const { router } = renderApp('/workers');

    expect(await screen.findByText('Ramesh Yadav')).toBeInTheDocument();
    const reviewKycBtn = screen.getByRole('button', { name: 'Review KYC for Ramesh Yadav' });
    expect(reviewKycBtn.tagName).toBe('BUTTON');

    fireEvent.click(reviewKycBtn);

    // Navigates to /verification with appropriate workerId query param
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/verification');
    });
    expect(router.state.location.search).toContain('workerId=W-10483');

    // Worker profile modal was NOT triggered
    expect(screen.queryByRole('heading', { level: 2, name: 'Ramesh Yadav' })).not.toBeInTheDocument();
  });

  it('clicking action buttons inside a row does not accidentally trigger row click', async () => {
    renderApp('/workers');

    expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
    const viewProfileBtn = screen.getByRole('button', { name: 'View profile for Sunita Devi' });

    // Click the button inside the row
    fireEvent.click(viewProfileBtn);

    // Exactly one profile modal opens
    expect(await screen.findByRole('heading', { level: 2, name: 'Sunita Devi' })).toBeInTheDocument();
    expect(screen.getAllByText('ID: W-10482').length).toBeGreaterThan(0);
  });

  it('supports keyboard navigation (Enter key on row opens profile)', async () => {
    renderApp('/workers');

    expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
    const sunitaRow = screen.getByRole('button', { name: /View profile for Sunita Devi \(W-10482\)/i });

    // Press Enter on the table row
    fireEvent.keyDown(sunitaRow, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Sunita Devi' })).toBeInTheDocument();
    expect(screen.getByText('ID: W-10482')).toBeInTheDocument();
  });

  it('supports keyboard navigation (Space key on row opens profile)', async () => {
    renderApp('/workers');

    expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
    const sunitaRow = screen.getByRole('button', { name: /View profile for Sunita Devi \(W-10482\)/i });

    // Press Space on the table row
    fireEvent.keyDown(sunitaRow, { key: ' ', code: 'Space' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Sunita Devi' })).toBeInTheDocument();
    expect(screen.getByText('ID: W-10482')).toBeInTheDocument();
  });

  it('preserves URL search params when workerId query parameter is present', async () => {
    const { router } = renderApp('/workers?workerId=W-10482');

    // Modal opens automatically from URL state
    expect(await screen.findByRole('heading', { level: 2, name: 'Sunita Devi' })).toBeInTheDocument();
    expect(screen.getByText('ID: W-10482')).toBeInTheDocument();

    // Closing modal removes workerId param cleanly
    const closeBtn = screen.getByRole('button', { name: 'Close dossier' });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(router.state.location.search).not.toContain('workerId=W-10482');
    });
  });

  it('maps legacy applicationId query parameter to worker profile modal seamlessly', async () => {
    renderApp('/workers?applicationId=W-10483');

    // Opens profile for W-10483
    expect(await screen.findByRole('heading', { level: 2, name: 'Ramesh Yadav' })).toBeInTheDocument();
    expect(screen.getByText('ID: W-10483')).toBeInTheDocument();
  });
});
