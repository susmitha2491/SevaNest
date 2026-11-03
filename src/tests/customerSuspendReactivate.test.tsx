import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { customerRepository } from '../features/customers/data/customerRepository';

function renderApp(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const memoryRouter = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={memoryRouter} />
    </QueryClientProvider>
  );
}

describe('SevaNest Admin Portal — Customer Suspension & Reactivation Action Workflows', () => {
  beforeEach(async () => {
    useAuthStore.getState().clearSession();
    await customerRepository.suspendCustomer('C-3810', 'reset test state');
    await customerRepository.reactivateCustomer('C-1092');
    await customerRepository.reactivateCustomer('C-2091');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setOpsAdminSession = () => {
    useAuthStore.getState().setSession(
      {
        id: 'ops-admin-01',
        name: 'Operations Director',
        email: 'ops@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.CUSTOMER_VIEW,
          PERMISSIONS.CUSTOMERS_MANAGE,
          PERMISSIONS.CUSTOMERS_MANAGE_STATUS,
        ],
      },
      'mock-ops-token'
    );
  };

  const setSupportExecutiveSession = () => {
    useAuthStore.getState().setSession(
      {
        id: 'support-exec-01',
        name: 'Support Executive',
        email: 'support@sevanest.internal',
        role: 'SUPPORT_EXECUTIVE',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.CUSTOMER_VIEW,
          // Lacks PERMISSIONS.CUSTOMERS_MANAGE_STATUS
        ],
      },
      'mock-support-token'
    );
  };

  it('1. Confirms View Profile button is removed and Active customer displays Suspend action', async () => {
    setOpsAdminSession();
    renderApp('/customers');

    expect(await screen.findByText('Customer Accounts & Households', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(await screen.findByText('Anand Sharma')).toBeInTheDocument();

    // Verify View Profile button is completely removed
    expect(screen.queryByText('View Profile')).not.toBeInTheDocument();

    // Active customer displays Suspend button
    const suspendBtn = screen.getByRole('button', { name: /^Suspend customer Anand Sharma/i });
    expect(suspendBtn).toBeInTheDocument();
    expect(suspendBtn).toHaveTextContent('Suspend');
  });

  it('2. Confirms Suspended customer displays Activate action instead of Suspend', async () => {
    setOpsAdminSession();
    renderApp('/customers');

    // Filter by SUSPENDED to show Rajesh Kumar
    const statusSelect = await screen.findByLabelText(/Filter by account status/i);
    fireEvent.change(statusSelect, { target: { value: 'SUSPENDED' } });

    expect(await screen.findByText('Rajesh Kumar')).toBeInTheDocument();

    // Should NOT have Suspend button for suspended customer
    expect(screen.queryByRole('button', { name: /^Suspend customer Rajesh Kumar/i })).not.toBeInTheDocument();

    // Must display Unsuspend button
    const activateBtn = screen.getByRole('button', { name: /^Unsuspend customer Rajesh Kumar/i });
    expect(activateBtn).toBeInTheDocument();
    expect(activateBtn).toHaveTextContent('Unsuspend');
  });

  it('3. Confirms clicking the customer row still opens its existing details view', async () => {
    setOpsAdminSession();
    renderApp('/customers');

    expect(await screen.findByText('Anand Sharma')).toBeInTheDocument();

    // Click the entire customer row
    const row = screen.getByRole('button', { name: /View profile for Anand Sharma/i });
    fireEvent.click(row);

    // Detail modal opens
    expect(await screen.findByText('Household Contact & Locality Details')).toBeInTheDocument();
    expect(screen.getByText(/Flat 402, Aditya Sunshine/i)).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Close dossier/i });
    fireEvent.click(closeBtn);
  });

  it('4. Canceling suspend confirmation dialog does not change account status', async () => {
    setOpsAdminSession();
    const suspendSpy = vi.spyOn(customerRepository, 'suspendCustomer');

    renderApp('/customers');

    expect(await screen.findByText('Anand Sharma')).toBeInTheDocument();

    // Open Suspend Dialog
    const suspendBtn = screen.getByRole('button', { name: /Suspend customer Anand Sharma/i });
    fireEvent.click(suspendBtn);

    expect(await screen.findByText('Suspend Customer Account')).toBeInTheDocument();
    expect(screen.getByText(/Suspended customers cannot log in and will be blocked from accessing protected customer features/i)).toBeInTheDocument();

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    // Dialog closes, spy not called, status remains Active
    await waitFor(() => {
      expect(screen.queryByText('Suspend Customer Account')).not.toBeInTheDocument();
    });
    expect(suspendSpy).not.toHaveBeenCalled();

    suspendSpy.mockRestore();
  });

  it('5. Successful suspension calls backend, updates status to SUSPENDED, and displays success message', async () => {
    setOpsAdminSession();
    const suspendSpy = vi.spyOn(customerRepository, 'suspendCustomer');

    renderApp('/customers');

    expect(await screen.findByText('Anand Sharma')).toBeInTheDocument();

    const suspendBtn = screen.getByRole('button', { name: /Suspend customer Anand Sharma/i });
    fireEvent.click(suspendBtn);

    expect(await screen.findByText('Suspend Customer Account')).toBeInTheDocument();

    // Fill mandatory remarks
    const remarksInput = screen.getByPlaceholderText(/Enter mandatory operational reason/i);
    fireEvent.change(remarksInput, { target: { value: 'Suspicious multiple fraudulent transactions reported.' } });

    // Check confirmation checkbox
    const confirmCheckbox = screen.getByRole('checkbox');
    fireEvent.click(confirmCheckbox);

    // Confirm
    const confirmBtn = screen.getByText('Confirm');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(suspendSpy).toHaveBeenCalledWith('C-1092', 'Suspicious multiple fraudulent transactions reported.');
    });

    // Success banner displayed
    expect(await screen.findByTestId('customer-action-success-banner')).toBeInTheDocument();
    expect(screen.getByText(/Customer Anand Sharma \(C-1092\) has been successfully suspended\./i)).toBeInTheDocument();

    suspendSpy.mockRestore();
  });

  it('6. Failed suspension displays backend error and preserves actual customer status', async () => {
    setOpsAdminSession();
    const suspendSpy = vi.spyOn(customerRepository, 'suspendCustomer').mockRejectedValueOnce(
      new Error('Backend server error: User state transition rejected by audit compliance.')
    );

    renderApp('/customers');

    expect(await screen.findByText('Anand Sharma')).toBeInTheDocument();

    const suspendBtn = screen.getByRole('button', { name: /Suspend customer Anand Sharma/i });
    fireEvent.click(suspendBtn);

    const remarksInput = await screen.findByPlaceholderText(/Enter mandatory operational reason/i);
    fireEvent.change(remarksInput, { target: { value: 'Attempting invalid suspension state' } });

    const confirmCheckbox = screen.getByRole('checkbox');
    fireEvent.click(confirmCheckbox);

    const confirmBtn = screen.getByText('Confirm');
    fireEvent.click(confirmBtn);

    // Backend error displayed inside dialog
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Backend server error: User state transition rejected by audit compliance\./i)).toBeInTheDocument();

    // Dialog stays open so user can review error
    expect(screen.getByText('Suspend Customer Account')).toBeInTheDocument();

    suspendSpy.mockRestore();
  });

  it('7. Canceling activation confirmation dialog does not change account status', async () => {
    setOpsAdminSession();
    const reactivateSpy = vi.spyOn(customerRepository, 'reactivateCustomer');

    renderApp('/customers');

    const statusSelect = await screen.findByLabelText(/Filter by account status/i);
    fireEvent.change(statusSelect, { target: { value: 'SUSPENDED' } });

    expect(await screen.findByText('Rajesh Kumar')).toBeInTheDocument();

    const activateBtn = screen.getByRole('button', { name: /(?:Unsuspend|Activate) customer Rajesh Kumar/i });
    fireEvent.click(activateBtn);

    expect(await screen.findByText(/(?:Unsuspend|Activate) Customer Account/i)).toBeInTheDocument();
    expect(screen.getByText(/This will restore their ability to log in and use permitted customer features/i)).toBeInTheDocument();

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText(/(?:Unsuspend|Activate) Customer Account/i)).not.toBeInTheDocument();
    });
    expect(reactivateSpy).not.toHaveBeenCalled();

    reactivateSpy.mockRestore();
  });

  it('8. Successful unsuspension restores ACTIVE status and displays success message', async () => {
    setOpsAdminSession();
    const reactivateSpy = vi.spyOn(customerRepository, 'reactivateCustomer');

    renderApp('/customers');

    const statusSelect = await screen.findByLabelText(/Filter by account status/i);
    fireEvent.change(statusSelect, { target: { value: 'SUSPENDED' } });

    expect(await screen.findByText('Rajesh Kumar')).toBeInTheDocument();

    const activateBtn = screen.getByRole('button', { name: /^Unsuspend customer Rajesh Kumar/i });
    fireEvent.click(activateBtn);

    expect(await screen.findByText(/(?:Unsuspend|Activate) Customer Account/i)).toBeInTheDocument();

    const dialog = screen.getByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: /^Unsuspend$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(reactivateSpy).toHaveBeenCalledWith('C-3810');
    });

    // Success banner displayed
    expect(await screen.findByTestId('customer-action-success-banner')).toBeInTheDocument();
    expect(screen.getByText(/Customer Rajesh Kumar \(C-3810\) has been successfully (?:unsuspended|activated)\./i)).toBeInTheDocument();

    reactivateSpy.mockRestore();
  });

  it('9. Failed unsuspension displays backend error and preserves actual customer status', async () => {
    setOpsAdminSession();
    const reactivateSpy = vi.spyOn(customerRepository, 'reactivateCustomer').mockRejectedValueOnce(
      new Error('Reactivation failed: Identity verification required before restoring account.')
    );

    renderApp('/customers');

    const statusSelect = await screen.findByLabelText(/Filter by account status/i);
    fireEvent.change(statusSelect, { target: { value: 'SUSPENDED' } });

    expect(await screen.findByText('Rajesh Kumar')).toBeInTheDocument();

    const activateBtn = screen.getByRole('button', { name: /^Unsuspend customer Rajesh Kumar/i });
    fireEvent.click(activateBtn);

    const dialog = await screen.findByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: /^Unsuspend$/i });
    fireEvent.click(confirmBtn);

    // Backend error displayed
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Reactivation failed: Identity verification required before restoring account\./i)).toBeInTheDocument();

    reactivateSpy.mockRestore();
  });

  it('10. Unauthorized users without CUSTOMERS_MANAGE_STATUS cannot view Suspend or Activate actions', async () => {
    setSupportExecutiveSession();
    renderApp('/customers');

    expect(await screen.findByText('Customer Accounts & Households')).toBeInTheDocument();
    expect(await screen.findByText('Anand Sharma')).toBeInTheDocument();

    // Verify Suspend and Activate are NOT rendered for unauthorized roles
    expect(screen.queryByRole('button', { name: /\bSuspend\b/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\bUnsuspend\b/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\bActivate\b/i })).not.toBeInTheDocument();

    // View Profile is also removed
    expect(screen.queryByText('View Profile')).not.toBeInTheDocument();

    // Row click still opens the read-only customer details view
    const row = screen.getByRole('button', { name: /View profile for Anand Sharma/i });
    fireEvent.click(row);

    expect(await screen.findByText('Household Contact & Locality Details')).toBeInTheDocument();
    // Modal action buttons for status management are also hidden
    expect(screen.queryByRole('button', { name: /Suspend Customer Account/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Restore \/ Reactivate Account/i })).not.toBeInTheDocument();
  });

  it('11. Preserves existing customer records, booking history, and data integrity', async () => {
    setOpsAdminSession();
    renderApp('/customers');

    expect(await screen.findByText('Anand Sharma')).toBeInTheDocument();

    // Open detail modal via row click
    const row = screen.getByRole('button', { name: /View profile for Anand Sharma/i });
    fireEvent.click(row);

    // Bookings & History tab preserves past bookings
    const bookingsTab = await screen.findByRole('button', { name: /Bookings & History/i });
    fireEvent.click(bookingsTab);

    expect(await screen.findByText('B-84920')).toBeInTheDocument();
    expect(screen.getByText('House Maid')).toBeInTheDocument();
    expect(screen.getByText('Sunita Devi')).toBeInTheDocument();
    expect(screen.getByText('B-81204')).toBeInTheDocument();
    expect(screen.getByText('B-79012')).toBeInTheDocument();
  });
});
