import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { supportRepository } from '../features/support/data/supportRepository';
import { dashboardRepository } from '../features/dashboard/data/dashboardRepository';

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

  describe('1. Support Executive Analytics Dashboard', () => {
    it('renders Dashboard header, 6 KPI cards, distribution & SLA charts, and recent activity without Ticket Trends or duplicate tables', async () => {
      const { router } = renderApp('/dashboard');

      expect(
        await screen.findByRole('heading', { name: /^Dashboard$/i }, { timeout: 8000 })
      ).toBeInTheDocument();
      expect(screen.getByText(/Support operations overview and ticket monitoring\./i)).toBeInTheDocument();

      // 6 KPI Cards
      expect(screen.getAllByText('Total Tickets').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Open Tickets')).toBeInTheDocument();
      expect(screen.getAllByText('In Investigation').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Escalated Tickets')).toBeInTheDocument();
      expect(screen.getByText('Resolved Tickets')).toBeInTheDocument();
      expect(screen.getByText('SLA At Risk / Breached')).toBeInTheDocument();

      // Analytics panels
      expect(screen.getByRole('heading', { name: /Ticket Status Distribution/i })).toBeInTheDocument();
      expect(screen.getByRole('img', { name: /Ticket Status Distribution Doughnut Chart/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /SLA Monitoring/i })).toBeInTheDocument();
      expect(screen.getByRole('list', { name: /SLA Monitoring Chart/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Recent Support Activity/i })).toBeInTheDocument();

      // Ticket Trends, date-range filter, and duplicate queue tables must NOT appear
      expect(screen.queryByRole('heading', { name: /Ticket Trends/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /SLA At Risk & Breached/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Unassigned Intake Queue/i })).not.toBeInTheDocument();

      expect(router.state.location.pathname).toBe('/dashboard');
    });

    it('preserves Support Executive sidebar order and opens ticket details/chat directly from Recent Support Activity inside Dashboard', async () => {
      const user = userEvent.setup();
      const { router } = renderApp('/dashboard');

      expect(await screen.findByRole('heading', { name: /^Dashboard$/i }, { timeout: 8000 })).toBeInTheDocument();

      // Verify exact Support Executive sidebar label and order
      const navLinks = within(screen.getByRole('navigation'))
        .getAllByRole('link')
        .map((el) => el.textContent?.trim());
      expect(navLinks).toEqual([
        'Dashboard',
        'Support',
        'Directory',
        'Worker Management',
        'Customer Management',
      ]);

      // Click a recent activity item -> opens TicketDetailModal directly within Dashboard context
      const activityList = screen.getByRole('list', { name: /Recent support activity list/i });
      const activityButtons = within(activityList).getAllByRole('button');
      expect(activityButtons.length).toBeGreaterThan(0);

      await user.click(activityButtons[0]);

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/dashboard');
      expect(router.state.location.search).toBe('');

      // Verify chat functionality works directly inside Dashboard modal
      const noteTextarea = screen.getByRole('textbox', { name: /Support reply text/i });
      await user.type(noteTextarea, 'Reached out to complainant from Dashboard chat modal.');
      const sendBtn = screen.getByRole('button', { name: /Send/i });
      expect(sendBtn).toBeEnabled();
    });

    it('opens selected recent activity ticket chat modal directly within Dashboard without redirecting to /support', async () => {
      const user = userEvent.setup();
      vi.spyOn(dashboardRepository, 'getSupportExecutiveDashboard').mockResolvedValueOnce({
        kpis: {
          openUnassignedGrievances: 1,
          myActiveCases: 0,
          slaAtRiskCount: 1,
          slaBreachedCount: 0,
          resolvedTodayCount: 0,
          totalTickets: 1,
          unassignedTickets: 1,
          myAssignedTickets: 0,
          inProgressTickets: 0,
          slaImminentBreach: 1,
          escalatedTickets: 0,
          resolvedTickets: 0,
        },
        queues: {
          ALL: [
            {
              id: 'Q-VIEW-1',
              ticketId: 'TKT-4921',
              complainantName: 'Anand Sharma',
              roleType: 'CUSTOMER',
              category: 'House Maid',
              disputeCategory: 'ATTENDANCE_BREACH',
              slaIndicator: 'AT_RISK',
              status: 'INVESTIGATION_PENDING',
              actionLabel: 'View Ticket',
            },
          ],
          AT_RISK: [],
          UNASSIGNED: [],
          MY_CASES: [],
          ESCALATED: [],
        },
        analytics: {
          openTickets: 1,
          inInvestigationTickets: 0,
          escalatedTickets: 0,
          resolvedTickets: 0,
          slaAtRiskOrBreached: 1,
          statusDistribution: [
            { status: 'OPEN', label: 'Open', count: 1, color: '#3B82F6' },
            { status: 'IN_INVESTIGATION', label: 'In Investigation', count: 0, color: '#D97706' },
            { status: 'ESCALATED', label: 'Escalated', count: 0, color: '#DC2626' },
            { status: 'RESOLVED', label: 'Resolved', count: 0, color: '#16A34A' },
          ],
          slaMonitoring: { normal: 0, atRisk: 1, breached: 0 },
          recentActivity: [
            {
              id: 'ACT-1',
              ticketId: 'TKT-4921',
              activityType: 'UPDATED',
              activityLabel: 'Ticket Updated',
              timestamp: '2026-11-11T09:00:00.000Z',
              status: 'INVESTIGATION_PENDING',
              complainantName: 'Anand Sharma',
              roleType: 'CUSTOMER',
              category: 'House Maid',
              disputeCategory: 'ATTENDANCE_BREACH',
              slaIndicator: 'AT_RISK',
            },
          ],
        },
      });
      const { router } = renderApp('/dashboard');

      expect(await screen.findByRole('heading', { name: /^Dashboard$/i }, { timeout: 8000 })).toBeInTheDocument();

      const activityBtn = await screen.findByRole('button', { name: /Open ticket TKT-4921/i });
      await user.click(activityBtn);

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(within(dialog).getByText(/#TKT-4921/i)).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/dashboard');
      expect(screen.getByRole('textbox', { name: /Support reply text/i })).toBeInTheDocument();
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

    it('opens ticket chat workspace without individual claim requirement under collective model', async () => {
      const user = userEvent.setup();
      renderApp('/support');

      expect(await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i }, { timeout: 4000 })).toBeInTheDocument();

      // Open detail modal for unassigned ticket
      const viewButtons = await screen.findAllByRole('button', { name: /View Chat/i });
      await user.click(viewButtons[0]);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();

      // Verify no Claim Ticket button is displayed under collective support model
      expect(screen.queryByRole('button', { name: /^Claim Ticket$/i })).not.toBeInTheDocument();
    });

    it('sends customer reply or logs internal note in chat workspace', async () => {
      const user = userEvent.setup();
      renderApp('/support');

      expect(await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i }, { timeout: 4000 })).toBeInTheDocument();

      const viewButtons = await screen.findAllByRole('button', { name: /View Chat/i });
      await user.click(viewButtons[0]);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();

      const noteTextarea = screen.getByRole('textbox', { name: /Support reply text/i });
      await user.type(noteTextarea, 'Customer stated worker delayed due to heavy rain. Shift rescheduled to 9 AM.');

      const sendBtn = screen.getByRole('button', { name: /Send/i });
      expect(sendBtn).toBeEnabled();

      const sendSpy = vi.spyOn(supportRepository, 'sendTicketMessage');
      await user.click(sendBtn);
      expect(sendSpy).toHaveBeenCalled();
    });

    it('resolves a grievance with mandatory summary remarks', async () => {
      const user = userEvent.setup();
      renderApp('/support');

      expect(await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i }, { timeout: 4000 })).toBeInTheDocument();

      const resolveButtons = await screen.findAllByRole('button', { name: /^Resolve$/i });
      await user.click(resolveButtons[0]);

      expect(await screen.findByRole('heading', { name: /Resolve Grievance/i })).toBeInTheDocument();
      expect(
        screen.getByText('Describe how the complaint was addressed and what resolution was communicated to the customer or worker.')
      ).toBeInTheDocument();
      expect(screen.getByText('Resolution Summary')).toBeInTheDocument();
      expect(screen.queryByText(/\(Mandatory\)/i)).not.toBeInTheDocument();

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

      // Should land on Worker Information tab by default for Support Executive
      expect(screen.getByText('1. Worker Information')).toBeInTheDocument();

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
