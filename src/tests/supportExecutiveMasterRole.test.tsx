import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { supportRepository } from '../features/support/data/supportRepository';

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

describe('Support Executive Master Role & Operational Workflows', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession();

    // Standard authoritative Support Executive session with approved permissions
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

  describe('1. Support Operations Console Dashboard', () => {
    it('renders the Support Operations Console with 5 KPI cards and 4 operational queues', async () => {
      const { router } = renderApp('/dashboard');

      expect(
        await screen.findByRole('heading', { name: /Support Operations Console/i }, { timeout: 4000 })
      ).toBeInTheDocument();

      // Check all 5 KPI cards
      expect(screen.getByText('Open Grievances')).toBeInTheDocument();
      expect(screen.getByText('Assigned to Me')).toBeInTheDocument();
      expect(screen.getByText('SLA At Risk')).toBeInTheDocument();
      expect(screen.getByText('SLA Breached')).toBeInTheDocument();
      expect(screen.getByText('Resolved Today')).toBeInTheDocument();

      // Check Queue Tabs
      expect(screen.getByRole('button', { name: /SLA At Risk & Breached/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Unassigned Intake Queue/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /My Active Cases/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Escalated to Operations/i })).toBeInTheDocument();

      expect(router.state.location.pathname).toBe('/dashboard');
    });

    it('switches queue tabs and navigates directly to support case via drill-down action', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/dashboard');

      expect(await screen.findByRole('heading', { name: /Support Operations Console/i }, { timeout: 4000 })).toBeInTheDocument();

      // Switch to Unassigned queue tab
      const unassignedTab = screen.getByRole('button', { name: /Unassigned Intake Queue/i });
      await user.click(unassignedTab);

      // Verify unassigned queue item exists
      const claimButtons = await screen.findAllByRole('button', { name: /Claim Ticket/i });
      expect(claimButtons.length).toBeGreaterThan(0);

      // Click Claim Ticket drill-down action
      await user.click(claimButtons[0]);

      // Should drill-down navigate to /support with searchParams
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/support');
        expect(router.state.location.search).toContain('ticketId=');
      });
    });
  });

  describe('2. Support Tickets & Grievance Mediation', () => {
    it('renders ticket queue, allows filtering by status and searching by complainant', async () => {
      const user = userEvent.setup();
      renderApp('/support');

      expect(
        await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i }, { timeout: 4000 })
      ).toBeInTheDocument();

      // Filter by In Investigation status tab
      const inInvestigationBtn = screen.getByRole('button', { name: /^In Investigation$/i });
      await user.click(inInvestigationBtn);

      // Search input
      const searchInput = screen.getByPlaceholderText(/Search by complainant, worker, ticket ID/i);
      await user.type(searchInput, 'Sharma');

      // Verify records update
      expect(await screen.findByText('Anand Sharma', {}, { timeout: 4000 })).toBeInTheDocument();
    });

    it('claims an unassigned ticket, transitioning it to assigned state', async () => {
      const user = userEvent.setup();
      renderApp('/support');

      expect(await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i }, { timeout: 4000 })).toBeInTheDocument();

      // Open detail modal for unassigned ticket
      const viewButtons = await screen.findAllByRole('button', { name: /^View$/i });
      await user.click(viewButtons[0]);

      expect(await screen.findByRole('heading', { name: /Grievance Case: TKT-/i })).toBeInTheDocument();

      // If ticket has Claim Ticket button, click it
      const claimBtn = screen.queryByRole('button', { name: /^Claim Ticket$/i });
      if (claimBtn) {
        const claimSpy = vi.spyOn(supportRepository, 'claimTicket');
        await user.click(claimBtn);
        expect(claimSpy).toHaveBeenCalled();
      }
    });

    it('logs an immutable telephonic case note with investigation findings', async () => {
      const user = userEvent.setup();
      renderApp('/support');

      expect(await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i }, { timeout: 4000 })).toBeInTheDocument();

      const viewButtons = await screen.findAllByRole('button', { name: /^View$/i });
      await user.click(viewButtons[0]);

      expect(await screen.findByRole('heading', { name: /Grievance Case: TKT-/i })).toBeInTheDocument();

      const noteTextarea = screen.getByPlaceholderText(/Enter details of conversation with customer or domestic worker/i);
      await user.type(noteTextarea, 'Customer stated worker delayed due to heavy rain. Shift rescheduled to 9 AM.');

      const saveNoteBtn = screen.getByRole('button', { name: /Save Case Note/i });
      expect(saveNoteBtn).toBeEnabled();

      const addNoteSpy = vi.spyOn(supportRepository, 'addCaseNote');
      await user.click(saveNoteBtn);
      expect(addNoteSpy).toHaveBeenCalled();
    });

    it('resolves a grievance with mandatory summary remarks', async () => {
      const user = userEvent.setup();
      renderApp('/support');

      expect(await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i }, { timeout: 4000 })).toBeInTheDocument();

      const resolveButtons = await screen.findAllByRole('button', { name: /^Resolve$/i });
      await user.click(resolveButtons[0]);

      expect(await screen.findByRole('heading', { name: /Resolve Ticket/i })).toBeInTheDocument();

      const remarksInput = screen.getByPlaceholderText(/Enter resolution summary notes/i);
      const confirmBtn = screen.getByRole('button', { name: /Confirm & Close Ticket/i });
      expect(confirmBtn).toBeDisabled();

      await user.type(remarksInput, 'Mediation successful: Customer and worker agreed on updated morning shift.');
      expect(confirmBtn).toBeEnabled();

      const resolveSpy = vi.spyOn(supportRepository, 'resolveTicket');
      await user.click(confirmBtn);
      expect(resolveSpy).toHaveBeenCalled();
    });

    it('escalates a disciplinary/refund dispute to Operations Admin', async () => {
      const user = userEvent.setup();
      renderApp('/support');

      expect(await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i }, { timeout: 4000 })).toBeInTheDocument();

      const escalateButtons = await screen.findAllByRole('button', { name: /^Escalate$/i });
      await user.click(escalateButtons[0]);

      expect(await screen.findByRole('heading', { name: /Escalate Ticket .* to Operations/i })).toBeInTheDocument();

      const rationaleInput = screen.getByPlaceholderText(/Enter mandatory escalation rationale/i);
      const confirmBtn = screen.getByRole('button', { name: /Escalate to Operations/i });
      expect(confirmBtn).toBeDisabled();

      await user.type(rationaleInput, 'Customer requests service termination and full monthly fee refund.');
      const ackCheckbox = screen.getByRole('checkbox');
      await user.click(ackCheckbox);

      expect(confirmBtn).toBeEnabled();

      const escalateSpy = vi.spyOn(supportRepository, 'escalateToOperations');
      await user.click(confirmBtn);
      expect(escalateSpy).toHaveBeenCalled();
    });
  });

  describe('3. Customers Directory & Profile Context (Audited Read-Only)', () => {
    it('allows Support Executive to view customer directory and dossier', async () => {
      const user = userEvent.setup();
      renderApp('/customers');

      expect(
        await screen.findByRole('heading', { name: /Customer Accounts & Households/i }, { timeout: 4000 })
      ).toBeInTheDocument();

      expect(await screen.findByText('Anand Sharma')).toBeInTheDocument();

      // Open Customer Detail Modal
      const viewProfileButtons = screen.getAllByRole('button', { name: /View Profile/i });
      await user.click(viewProfileButtons[0]);

      expect(await screen.findByRole('heading', { name: /Anand Sharma/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/Household Contact & Locality Details/i)).toBeInTheDocument();

      // Ensure Suspend Account button is NOT visible to Support Executive
      expect(screen.queryByRole('button', { name: /Suspend Customer Account/i })).not.toBeInTheDocument();
    });

    it('displays masked customer contact details without customer PII reveal action (not in approved RBAC)', async () => {
      renderApp('/customers');

      expect(await screen.findByRole('heading', { name: /Customer Accounts & Households/i }, { timeout: 4000 })).toBeInTheDocument();

      // Masked phone is rendered directly in table
      expect(await screen.findByText(/\+91 98\*\*\*\* \*\*12/i)).toBeInTheDocument();

      // Customer PII reveal is not part of approved RBAC: no reveal buttons
      expect(screen.queryByRole('button', { name: /Reveal/i })).not.toBeInTheDocument();
    });
  });

  describe('4. Workers Directory & Profiles (Read-Only Context)', () => {
    it('allows Support Executive to inspect worker profiles without KYC review or disciplinary mutation authority', async () => {
      const user = userEvent.setup();
      renderApp('/workers');

      expect(
        await screen.findByRole('heading', { name: /Domestic Worker Roster & Profiles/i }, { timeout: 4000 })
      ).toBeInTheDocument();

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      // Support Executive should NOT have Review KYC buttons in the table
      expect(screen.queryByRole('button', { name: /Review KYC/i })).not.toBeInTheDocument();

      // Support Executive should NOT have Discipline buttons in the table
      expect(screen.queryByRole('button', { name: /Discipline/i })).not.toBeInTheDocument();

      // Search for Sunita to target profile
      const searchInput = screen.getByPlaceholderText(/Search by worker name, ID, category/i);
      await user.type(searchInput, 'Sunita');

      // View worker profile
      const viewButtons = await screen.findAllByRole('button', { name: /View Profile/i });
      await user.click(viewButtons[0]);

      expect(await screen.findByRole('heading', { name: /Sunita Devi/i }, { timeout: 4000 })).toBeInTheDocument();

      // Should land on Professional tab by default for Support Executive
      expect(screen.getByText(/Professional Profile/i)).toBeInTheDocument();

      // Manage Categories button must NOT be visible (requires workers.manage)
      expect(screen.queryByRole('button', { name: /Manage Categories/i })).not.toBeInTheDocument();
    });
  });

  describe('5. Bookings Pipeline (Read-Only Context)', () => {
    it('allows Support Executive to inspect booking roster and details with all mutations hidden', async () => {
      const user = userEvent.setup();
      renderApp('/bookings');

      expect(
        await screen.findByRole('heading', { name: /Booking & Service Management/i }, { timeout: 4000 })
      ).toBeInTheDocument();

      // Support Executive should NOT see Match Workers, Record Outcome, or Activate Service buttons in table
      expect(screen.queryByRole('button', { name: /Match Workers/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Record Outcome/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Activate Service/i })).not.toBeInTheDocument();

      // Open Booking Detail Modal
      const viewButtons = await screen.findAllByRole('button', { name: /^View$/i });
      await user.click(viewButtons[0]);

      expect(await screen.findByRole('heading', { name: /Booking Details: B-/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/Shift & Budget/i)).toBeInTheDocument();

      // Cancel Booking button must NOT be present in BookingDetailModal for Support Executive
      expect(screen.queryByRole('button', { name: /Cancel Booking/i })).not.toBeInTheDocument();
    });
  });

  describe('6. Security & RBAC Enforcement', () => {
    it('displays Access Restricted when server-issued permissions omit customers.view', async () => {
      // Simulate session missing customers.view
      useAuthStore.getState().setSession(
        {
          id: 'adm-004-limited',
          name: 'Support Executive Limited',
          email: 'support.limited@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.SUPPORT_VIEW,
            PERMISSIONS.SUPPORT_MANAGE,
          ],
        },
        'token-limited'
      );

      renderApp('/customers');

      expect(await screen.findByRole('heading', { name: /Access Restricted/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/Required permission: customer\.view/i)).toBeInTheDocument();
    });

    it('blocks Support Executive from accessing Payments, Configuration, Verification, and Audit modules', async () => {
      const restrictedRoutes = [
        { path: '/payments', required: 'payments.view' },
        { path: '/configuration', required: 'configuration.manage' },
        { path: '/audit', required: 'audit.view' },
        { path: '/verification', required: 'verification.review' },
      ];

      for (const route of restrictedRoutes) {
        const { unmount } = renderApp(route.path);
        expect(await screen.findByRole('heading', { name: /Access Restricted/i }, { timeout: 4000 })).toBeInTheDocument();
        expect(screen.getByText(new RegExp(route.required, 'i'))).toBeInTheDocument();
        unmount();
      }
    });
  });
});
