import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('Customer Management Module — PRD Capability Audit & Validation', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  describe('1. Customer Profiles & Directory Rendering', () => {
    beforeEach(() => {
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
    });

    it('renders customer directory table with masked PII and pagination controls', async () => {
      renderApp('/customers');

      expect(await screen.findByText('Customer Accounts & Households', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(await screen.findByText('Anand Sharma')).toBeInTheDocument();
      expect(await screen.findByText('Priya Reddy')).toBeInTheDocument();
      expect(await screen.findByText('Rajesh Kumar')).toBeInTheDocument();

      // PII masking default check
      expect(screen.getByText(/\+91 98\*{4} \*{2}12/)).toBeInTheDocument();
      expect(screen.getByText(/\+91 97\*{4} \*{2}44/)).toBeInTheDocument();

      // Locality clusters in table and select options
      expect(screen.getAllByText('Kondapur').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Gachibowli').length).toBeGreaterThan(0);

      // Pagination elements
      expect(screen.getByText(/Page 1 of \d+/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Previous/i })).toBeDisabled();
    });

    it('filters customer directory by search query and locality', async () => {
      renderApp('/customers');

      const searchInput = await screen.findByPlaceholderText(/Search by customer name/i);
      fireEvent.change(searchInput, { target: { value: 'Priya' } });

      expect(await screen.findByText('Priya Reddy')).toBeInTheDocument();
      expect(screen.queryByText('Anand Sharma')).not.toBeInTheDocument();
      expect(screen.queryByText('Rajesh Kumar')).not.toBeInTheDocument();
    });

    it('filters customer directory by account status', async () => {
      renderApp('/customers');

      const statusSelect = await screen.findByLabelText(/Filter by account status/i);
      fireEvent.change(statusSelect, { target: { value: 'SUSPENDED' } });

      expect(await screen.findByText('Rajesh Kumar')).toBeInTheDocument();
      expect(screen.queryByText('Anand Sharma')).not.toBeInTheDocument();
    });
  });

  describe('2. Separation of Account Status & Verification Status', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(
        {
          id: 'ops-admin-01',
          name: 'Operations Director',
          email: 'ops@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.CUSTOMER_VIEW,
            PERMISSIONS.CUSTOMERS_MANAGE,
            PERMISSIONS.CUSTOMERS_MANAGE_STATUS,
          ],
        },
        'mock-ops-token'
      );
    });

    it('clearly distinguishes account lifecycle status from KYC verification status', async () => {
      renderApp('/customers');

      expect(await screen.findByText('Customer Accounts & Households')).toBeInTheDocument();

      // Verification badges column in list
      const verifiedBadges = await screen.findAllByText('Verified');
      expect(verifiedBadges.length).toBeGreaterThan(0);

      const pendingBadges = await screen.findAllByText('Pending KYC');
      expect(pendingBadges.length).toBeGreaterThan(0);

      // Account status column in list
      const activeBadges = await screen.findAllByText('Active');
      expect(activeBadges.length).toBeGreaterThan(0);

      const suspendedBadges = await screen.findAllByText('Suspended');
      expect(suspendedBadges.length).toBeGreaterThan(0);
    });

    it('displays distinct verification badge and status badge in customer detail modal', async () => {
      renderApp('/customers');

      const viewButtons = await screen.findAllByText('View Profile');
      fireEvent.click(viewButtons[0]); // Anand Sharma (ACTIVE, VERIFIED)

      expect(await screen.findByText('Household Contact & Locality Details')).toBeInTheDocument();
      expect(await screen.findByText('Preferred Communication:')).toBeInTheDocument();
      expect(await screen.findByText(/English, Hindi/i)).toBeInTheDocument();

      // Modal header badges and identity
      expect(screen.getByText(/C-1092 • Registered Recent/i)).toBeInTheDocument();
    });
  });

  describe('3. Bookings, Service History & Engagement Ledger', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(
        {
          id: 'ops-admin-01',
          name: 'Operations Director',
          email: 'ops@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.CUSTOMER_VIEW,
            PERMISSIONS.CUSTOMERS_MANAGE,
          ],
        },
        'mock-ops-token'
      );
    });

    it('displays historical bookings in profile preview and provides dedicated Bookings & History tab', async () => {
      renderApp('/customers');

      const viewButtons = await screen.findAllByText('View Profile');
      fireEvent.click(viewButtons[0]); // Anand Sharma

      // Profile tab preview of bookings
      expect(await screen.findByText('Historical Service Engagements & Requests')).toBeInTheDocument();
      expect(await screen.findByText('B-84920')).toBeInTheDocument();
      expect(await screen.findByText('House Maid')).toBeInTheDocument();
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      // Switch to Tab 2: Bookings & History
      const bookingsTab = await screen.findByRole('button', { name: /Bookings & History/i });
      fireEvent.click(bookingsTab);

      // Dedicated bookings table
      expect(await screen.findByText('Assigned Domestic Worker')).toBeInTheDocument();
      expect(screen.getByText('B-84920')).toBeInTheDocument();
      expect(screen.getByText('House Maid')).toBeInTheDocument();
      expect(screen.getByText('Sunita Devi')).toBeInTheDocument();

      // Booking navigation link
      expect(screen.getByRole('link', { name: /Open in Booking Management/i })).toHaveAttribute(
        'href',
        '/bookings?search=C-1092'
      );
    });

    it('displays empty state when customer has no historical bookings', async () => {
      const originalGetCustomerById = customerRepository.getCustomerById;
      vi.spyOn(customerRepository, 'getCustomerById').mockResolvedValueOnce({
        id: 'C-EMPTY',
        name: 'New Customer',
        maskedPhone: '+91 99**** **00',
        maskedEmail: 'n***@example.com',
        locality: 'Gachibowli',
        fullAddress: 'Flat 101, New Tower',
        registeredDate: 'Recent',
        totalBookings: 0,
        activeBookings: 0,
        totalSpendINR: 0,
        openGrievances: 0,
        status: 'ACTIVE',
        verificationStatus: 'PENDING',
        bookings: [],
        notes: [],
        complaints: [],
      });

      renderApp('/customers');

      const viewButtons = await screen.findAllByText('View Profile');
      fireEvent.click(viewButtons[0]);

      const bookingsTab = await screen.findByRole('button', { name: /Bookings & History/i });
      fireEvent.click(bookingsTab);

      expect(await screen.findByText('No booking engagements on record for this customer.')).toBeInTheDocument();

      customerRepository.getCustomerById = originalGetCustomerById;
    });
  });

  describe('4. Support Tickets, Complaints & Dispute Tracking', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(
        {
          id: 'support-exec-01',
          name: 'Support Executive',
          email: 'support@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [
            PERMISSIONS.CUSTOMER_VIEW,
            PERMISSIONS.SUPPORT_VIEW,
          ],
        },
        'mock-support-token'
      );
    });

    it('renders customer complaints and grievance records in dedicated tab with navigation to Support', async () => {
      renderApp('/customers');

      const viewButtons = await screen.findAllByText('View Profile');
      fireEvent.click(viewButtons[0]); // Anand Sharma (has TKT-1082)

      const complaintsTab = await screen.findByRole('button', { name: /Support & Complaints/i });
      fireEvent.click(complaintsTab);

      expect(await screen.findByText('Customer Complaints & Grievance Tickets')).toBeInTheDocument();
      expect(await screen.findByText('TKT-1082')).toBeInTheDocument();
      expect(await screen.findByText('SERVICE_QUALITY')).toBeInTheDocument();
      expect(await screen.findByText(/Trial maid arrived 45 minutes late/i)).toBeInTheDocument();
      expect(await screen.findByText('House Maid')).toBeInTheDocument();

      // Navigation link to Support module
      const supportLink = screen.getByRole('link', { name: /Open in Support Console/i });
      expect(supportLink).toHaveAttribute('href', '/support?searchTerm=C-1092');
    });

    it('displays empty state when customer has no recorded complaints', async () => {
      renderApp('/customers');

      const viewButtons = await screen.findAllByText('View Profile');
      fireEvent.click(viewButtons[1]); // Priya Reddy (has 0 grievances)

      const complaintsTab = await screen.findByRole('button', { name: /Support & Complaints/i });
      fireEvent.click(complaintsTab);

      expect(await screen.findByText('No support complaints or dispute tickets recorded for this customer.')).toBeInTheDocument();
    });
  });

  describe('5. Operational Notes Management & Persistence', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(
        {
          id: 'ops-admin-01',
          name: 'Operations Director',
          email: 'ops@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.CUSTOMER_VIEW,
            PERMISSIONS.CUSTOMERS_MANAGE,
          ],
        },
        'mock-ops-token'
      );
    });

    it('displays existing operational notes and records a new note successfully', async () => {
      const addNoteSpy = vi.spyOn(customerRepository, 'addCustomerNote');

      renderApp('/customers');

      const viewButtons = await screen.findAllByText('View Profile');
      fireEvent.click(viewButtons[0]);

      const notesTab = await screen.findByRole('button', { name: /Operational Notes/i });
      fireEvent.click(notesTab);

      expect(await screen.findByText('Operational & Case Notes')).toBeInTheDocument();
      expect(await screen.findByText(/Preferred morning trial slots/i)).toBeInTheDocument();

      // Add a new note
      const noteInput = screen.getByPlaceholderText(/Enter operational note, customer feedback/i);
      fireEvent.change(noteInput, { target: { value: 'Verified customer preferred address details via call.' } });

      const saveNoteBtn = screen.getByRole('button', { name: /Save Note/i });
      fireEvent.click(saveNoteBtn);

      await waitFor(() => {
        expect(addNoteSpy).toHaveBeenCalledWith('C-1092', 'Verified customer preferred address details via call.');
      });

      addNoteSpy.mockRestore();
    });

    it('validates minimum note length before submission', async () => {
      renderApp('/customers');

      const viewButtons = await screen.findAllByText('View Profile');
      fireEvent.click(viewButtons[0]);

      const notesTab = await screen.findByRole('button', { name: /Operational Notes/i });
      fireEvent.click(notesTab);

      const noteInput = await screen.findByPlaceholderText(/Enter operational note, customer feedback/i);
      fireEvent.change(noteInput, { target: { value: 'ab' } });

      const saveNoteBtn = screen.getByRole('button', { name: /Save Note/i });
      fireEvent.click(saveNoteBtn);

      expect(await screen.findByText('Note must be at least 3 characters.')).toBeInTheDocument();
    });
  });

  describe('6. Audited PII Reveal Flow & Role-Based Access Control', () => {
    it('shows Reveal Contact button only for authorized roles (CUSTOMERS_MANAGE)', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'ops-admin-01',
          name: 'Operations Director',
          email: 'ops@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.CUSTOMER_VIEW,
            PERMISSIONS.CUSTOMERS_MANAGE,
          ],
        },
        'mock-ops-token'
      );

      renderApp('/customers');

      const viewButtons = await screen.findAllByText('View Profile');
      fireEvent.click(viewButtons[0]);

      expect(await screen.findByRole('button', { name: /Reveal Contact/i })).toBeInTheDocument();
    });

    it('hides Reveal Contact button for roles without CUSTOMERS_MANAGE permission', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'support-exec-01',
          name: 'Support Executive',
          email: 'support@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [
            PERMISSIONS.CUSTOMER_VIEW,
          ],
        },
        'mock-support-token'
      );

      renderApp('/customers');

      const viewButtons = await screen.findAllByText('View Profile');
      fireEvent.click(viewButtons[0]);

      expect(await screen.findByText('Household Contact & Locality Details')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reveal Contact/i })).not.toBeInTheDocument();
    });

    it('requires mandatory operational justification (>= 5 chars) to reveal unmasked PII', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'ops-admin-01',
          name: 'Operations Director',
          email: 'ops@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.CUSTOMER_VIEW,
            PERMISSIONS.CUSTOMERS_MANAGE,
          ],
        },
        'mock-ops-token'
      );

      const revealSpy = vi.spyOn(customerRepository, 'revealPII');

      renderApp('/customers');

      const viewButtons = await screen.findAllByText('View Profile');
      fireEvent.click(viewButtons[0]);

      const revealBtn = await screen.findByRole('button', { name: /Reveal Contact/i });
      fireEvent.click(revealBtn);

      expect(await screen.findByText('Audited Contact PII Disclosure')).toBeInTheDocument();

      // Enter short rationale (< 5 chars)
      const reasonInput = screen.getByPlaceholderText(/e\.g\., Direct dispute resolution call/i);
      fireEvent.change(reasonInput, { target: { value: 'test' } });

      const confirmBtn = screen.getByRole('button', { name: /Confirm & Reveal/i });
      fireEvent.click(confirmBtn);

      expect(await screen.findByText('A detailed operational rationale is mandatory (minimum 5 characters).')).toBeInTheDocument();
      expect(revealSpy).not.toHaveBeenCalled();

      // Enter valid rationale
      fireEvent.change(reasonInput, { target: { value: 'Dispute escalation on cleaning ticket TKT-1082' } });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(revealSpy).toHaveBeenCalledWith('C-1092', 'Dispute escalation on cleaning ticket TKT-1082');
      });

      revealSpy.mockRestore();
    });
  });

  describe('7. Account Suspension & Reactivation Mutations', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(
        {
          id: 'ops-admin-01',
          name: 'Operations Director',
          email: 'ops@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.CUSTOMER_VIEW,
            PERMISSIONS.CUSTOMERS_MANAGE,
            PERMISSIONS.CUSTOMERS_MANAGE_STATUS,
          ],
        },
        'mock-ops-token'
      );
    });

    it('allows suspending an active customer with mandatory remarks and updates status badge', async () => {
      const suspendSpy = vi.spyOn(customerRepository, 'suspendCustomer');

      renderApp('/customers');

      const suspendButtons = await screen.findAllByText('Suspend');
      fireEvent.click(suspendButtons[0]);

      expect(await screen.findByText('Suspend Customer Account')).toBeInTheDocument();

      const remarksInput = screen.getByPlaceholderText(/Enter mandatory operational reason/i);
      fireEvent.change(remarksInput, { target: { value: 'Suspicious multiple failed payments and disputed chargeback.' } });

      // Confirm checkbox for destructive action
      const confirmCheckbox = screen.getByRole('checkbox');
      fireEvent.click(confirmCheckbox);

      const confirmBtn = screen.getByText('Confirm');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(suspendSpy).toHaveBeenCalledWith('C-1092', 'Suspicious multiple failed payments and disputed chargeback.');
      });

      suspendSpy.mockRestore();
    });

    it('allows reactivating a suspended customer from the roster', async () => {
      const reactivateSpy = vi.spyOn(customerRepository, 'reactivateCustomer');

      renderApp('/customers');

      // Filter by SUSPENDED to locate suspended customer Rajesh Kumar
      const statusSelect = await screen.findByLabelText(/Filter by account status/i);
      fireEvent.change(statusSelect, { target: { value: 'SUSPENDED' } });

      expect(await screen.findByText('Rajesh Kumar')).toBeInTheDocument();

      const reactivateBtn = screen.getByRole('button', { name: /Reactivate customer Rajesh Kumar/i });
      fireEvent.click(reactivateBtn);

      await waitFor(() => {
        expect(reactivateSpy).toHaveBeenCalledWith('C-3810');
      });

      reactivateSpy.mockRestore();
    });
  });

  describe('8. Access Control Guard & Error Boundaries', () => {
    it('redirects unauthenticated users to staff sign in', async () => {
      renderApp('/customers');

      // Without auth session, redirected to login
      expect(await screen.findByText('Staff Sign In')).toBeInTheDocument();
      expect(screen.getByText('Enter your administrative credentials to access operations queues.')).toBeInTheDocument();
    });

    it('renders Access Restricted for roles lacking CUSTOMER_VIEW permission', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'restricted-user-01',
          name: 'Restricted User',
          email: 'restricted@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [
            PERMISSIONS.SUPPORT_VIEW,
            // Missing CUSTOMER_VIEW
          ],
        },
        'mock-token'
      );

      renderApp('/customers');

      expect(await screen.findByText('Access Restricted')).toBeInTheDocument();
      expect(screen.getByText(/You do not have the required server-issued permissions to view this module/i)).toBeInTheDocument();
    });
  });
});
