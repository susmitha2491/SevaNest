import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TicketDetailModal } from '../features/support/presentation/TicketDetailModal';
import { SupportTicketDetail } from '../features/support/domain/types';
import { supportRepository } from '../features/support/data/supportRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { formatDateTimeIST } from '../shared/formatters/dateTime';

describe('Support Ticket Details Modal UI & Timezone (Asia/Kolkata IST) Audit', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    cleanup();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession(false);

    // Standard authoritative Support Executive session with manage permissions
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

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession(false);
  });

  const baseMockTicket: SupportTicketDetail = {
    id: 'TKT-9842',
    etag: '"v1-etag"',
    complainantId: 'CUST-8831',
    complainantName: 'Vikramaditya Singhania',
    complainantType: 'CUSTOMER',
    complainantPhoneMasked: '+91 98765 43210',
    subjectWorkerId: 'WRK-2201',
    subjectWorkerName: 'Sunita Devi',
    serviceCategory: 'House Maid',
    disputeCategory: 'ATTENDANCE_BREACH',
    description: 'Worker failed to report for scheduled shift on three consecutive days without prior notification.',
    bookingRef: 'BK-55209',
    priority: 'HIGH',
    slaStatus: 'BREACHED',
    slaRemainingText: 'Breached by 2h 15m',
    assignedToStaffId: 'adm-004',
    assignedToStaffName: 'Pooja Sharma',
    status: 'IN_PROGRESS',
    createdAt: '2026-11-06T11:42:17.207Z',
    caseNotes: [
      {
        id: 'NOTE-1',
        authorName: 'Pooja Sharma',
        authorRole: 'Support Executive',
        noteType: 'TELEPHONIC_LOG',
        noteText: 'Called customer to obtain confirmation regarding absence logs.',
        timestamp: '2026-11-06T11:45:00.000Z',
      },
      {
        id: 'NOTE-2',
        authorName: 'Pooja Sharma',
        authorRole: 'Support Executive',
        noteType: 'INTERNAL_NOTE',
        noteText: 'Worker phone was unreachable. Escalation to Operations recommended if no reply by evening.',
        timestamp: '2026-11-06T12:00:00.000Z',
      },
      {
        id: 'NOTE-3',
        authorName: 'Operations Lead',
        authorRole: 'Operations Admin',
        noteType: 'ESCALATION_SUMMARY',
        noteText: 'Assigned to field verification team for worker welfare check.',
        timestamp: '2026-11-06T14:30:00.000Z',
      },
    ],
  };

  /* =========================================================================
     1. Timezone Correction: Asia/Kolkata (IST, UTC+05:30)
     ========================================================================= */
  describe('1. Mandatory Timezone Formatting (Asia/Kolkata IST)', () => {
    it('converts UTC ISO timestamp 2026-11-06T11:42:17.207Z precisely to "06 Nov 2026, 05:12 PM IST"', () => {
      const formatted = formatDateTimeIST('2026-11-06T11:42:17.207Z');
      expect(formatted).toBe('06 Nov 2026, 05:12 PM IST');
    });

    it('renders Intake timestamp formatted in IST in Section 1 (SLA Information)', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      // Raw value is 2026-11-06T11:42:17.207Z
      // Expected display: 06 Nov 2026, 05:12 PM IST
      expect(screen.getByText(/Intake:/i)).toBeInTheDocument();
      expect(screen.getByText('06 Nov 2026, 05:12 PM IST')).toBeInTheDocument();
      expect(screen.queryByText('2026-11-06T11:42:17.207Z')).not.toBeInTheDocument();
    });

    it('renders all case activity and communication history timestamps in IST', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      // NOTE-1: 2026-11-06T11:45:00.000Z -> 06 Nov 2026, 05:15 PM IST
      expect(screen.getByText('06 Nov 2026, 05:15 PM IST')).toBeInTheDocument();

      // NOTE-2: 2026-11-06T12:00:00.000Z -> 06 Nov 2026, 05:30 PM IST
      expect(screen.getByText('06 Nov 2026, 05:30 PM IST')).toBeInTheDocument();

      // NOTE-3: 2026-11-06T14:30:00.000Z -> 06 Nov 2026, 08:00 PM IST
      expect(screen.getByText('06 Nov 2026, 08:00 PM IST')).toBeInTheDocument();

      // Ensure no raw UTC Z strings are rendered in the DOM
      expect(screen.queryByText(/2026-11-06T/)).not.toBeInTheDocument();
    });

    it('handles missing or non-parseable timestamps gracefully without crashing', () => {
      expect(formatDateTimeIST(null)).toBe('—');
      expect(formatDateTimeIST(undefined)).toBe('—');
      expect(formatDateTimeIST('')).toBe('—');
      expect(formatDateTimeIST('Recent Event')).toBe('—');
    });
  });

  /* =========================================================================
     2. Redesigned Modal Sections & Layout
     ========================================================================= */
  describe('2. Modal Layout & Section Structure', () => {
    it('renders compact header with Case ID, status, priority, and close button', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      // Header title
      expect(screen.getByRole('heading', { name: /Grievance Case: TKT-9842/i })).toBeInTheDocument();

      // Priority selector
      const prioritySelect = screen.getByLabelText(/Priority:/i);
      expect(prioritySelect).toBeInTheDocument();
      expect(prioritySelect).toHaveValue('HIGH');

      // Top close button
      expect(screen.getByTestId('close-ticket-modal-button')).toBeInTheDocument();
    });

    it('renders Section 1 (SLA Information) with distinct visual styling for BREACHED state', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      expect(screen.getByText(/SLA Status:/i)).toBeInTheDocument();
      expect(screen.getByText('BREACHED')).toBeInTheDocument();
      expect(screen.getByText(/Breached by 2h 15m/i)).toBeInTheDocument();
    });

    it('renders Section 1 (SLA Information) with distinct styling for AT_RISK and NORMAL states', () => {
      const atRiskTicket: SupportTicketDetail = {
        ...baseMockTicket,
        slaStatus: 'AT_RISK',
        slaRemainingText: '1h 10m remaining',
      };

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={atRiskTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      expect(screen.getByText('AT_RISK')).toBeInTheDocument();
      expect(screen.getByText(/1h 10m remaining/i)).toBeInTheDocument();

      // Re-render with NORMAL healthy state
      const normalTicket: SupportTicketDetail = {
        ...baseMockTicket,
        slaStatus: 'NORMAL',
        slaRemainingText: 'Healthy SLA (18h left)',
      };

      rerender(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={normalTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      expect(screen.getByText('NORMAL')).toBeInTheDocument();
      expect(screen.getByText(/Healthy SLA \(18h left\)/i)).toBeInTheDocument();
    });

    it('renders Section 2 (Customer & Booking Information) in a structured two-column layout', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      // Column 1: Customer Profile
      expect(screen.getByText('Vikramaditya Singhania')).toBeInTheDocument();
      expect(screen.getByText(/CUST-8831/i)).toBeInTheDocument();
      expect(screen.getByText(/\+91 98765 43210/i)).toBeInTheDocument();
      expect(screen.getByText('CUSTOMER')).toBeInTheDocument();
      expect(screen.getByText(/Sunita Devi/i)).toBeInTheDocument();
      expect(screen.getByText(/\(WRK-2201\)/i)).toBeInTheDocument();

      // Column 2: Booking Reference & Dispute
      expect(screen.getByText('BK-55209')).toBeInTheDocument();
      expect(screen.getByText(/ATTENDANCE BREACH/i)).toBeInTheDocument();
      expect(screen.getAllByText(/House Maid/i).length).toBeGreaterThanOrEqual(1);
    });

    it('renders Section 3 (Customer Complaint) in a dedicated card', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      expect(screen.getByText(/Complainant Grievance Statement:/i)).toBeInTheDocument();
      expect(
        screen.getByText('Worker failed to report for scheduled shift on three consecutive days without prior notification.')
      ).toBeInTheDocument();
    });

    it('renders Section 4 (Case Activity) with empty state when no case notes exist', () => {
      const ticketWithoutNotes: SupportTicketDetail = {
        ...baseMockTicket,
        caseNotes: [],
      };

      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={ticketWithoutNotes} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      expect(screen.getByText(/No case activity or telephonic logs recorded yet/i)).toBeInTheDocument();
    });

    it('distinguishes telephonic logs, internal notes, and escalation summaries visually', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      expect(screen.getAllByText('Telephonic Call Log').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Internal Staff Note').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Escalation Handoff')).toBeInTheDocument();
    });
  });

  /* =========================================================================
     3. Case Note Logging & Action Handlers
     ========================================================================= */
  describe('3. Case Actions & Note Logging Interactions', () => {
    it('submits a new case note via addCaseNote mutation when clicking "Save Case Note"', async () => {
      const user = userEvent.setup();
      const addNoteSpy = vi.spyOn(supportRepository, 'addCaseNote').mockResolvedValueOnce();

      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      const textarea = screen.getByPlaceholderText(/Enter details of conversation with customer/i);
      await user.type(textarea, 'Spoke with customer over phone. Customer agreed to await replacement candidate.');

      const saveBtn = screen.getByRole('button', { name: /Save Case Note/i });
      expect(saveBtn).not.toBeDisabled();
      await user.click(saveBtn);

      await waitFor(() => {
        expect(addNoteSpy).toHaveBeenCalledWith(
          'TKT-9842',
          'Spoke with customer over phone. Customer agreed to await replacement candidate.',
          'TELEPHONIC_LOG',
          'Support Executive'
        );
      });
    });

    it('triggers priority change mutation when selecting a new priority', async () => {
      const user = userEvent.setup();
      const prioritySpy = vi.spyOn(supportRepository, 'setPriority').mockResolvedValueOnce();

      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      const prioritySelect = screen.getByLabelText(/Priority:/i);
      await user.selectOptions(prioritySelect, 'LOW');

      await waitFor(() => {
        expect(prioritySpy).toHaveBeenCalledWith('TKT-9842', 'LOW', '"v1-etag"');
      });
    });

    it('renders Claim Ticket when ticket is unassigned or created', async () => {
      const user = userEvent.setup();
      const claimSpy = vi.spyOn(supportRepository, 'claimTicket').mockResolvedValueOnce();

      const unassignedTicket: SupportTicketDetail = {
        ...baseMockTicket,
        assignedToStaffId: undefined,
        assignedToStaffName: undefined,
        status: 'CREATED',
      };

      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={unassignedTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      const claimBtn = screen.getByRole('button', { name: /Claim Ticket/i });
      expect(claimBtn).toBeInTheDocument();
      await user.click(claimBtn);

      await waitFor(() => {
        expect(claimSpy).toHaveBeenCalledWith('TKT-9842', 'Support Executive', '"v1-etag"');
      });
    });

    it('triggers callbacks for Mark Resolved, Request Replacement, and Escalate Ops', async () => {
      const user = userEvent.setup();
      const resolveFn = vi.fn();
      const escalateFn = vi.fn();
      const replacementFn = vi.fn();

      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal
            ticket={baseMockTicket}
            isOpen={true}
            onClose={vi.fn()}
            onOpenResolve={resolveFn}
            onOpenEscalate={escalateFn}
            onOpenReplacement={replacementFn}
          />
        </QueryClientProvider>
      );

      // 1. Mark Resolved
      const resolveBtn = screen.getByRole('button', { name: /Mark Resolved/i });
      await user.click(resolveBtn);
      expect(resolveFn).toHaveBeenCalledWith(baseMockTicket);

      // 2. Request Replacement
      const replacementBtn = screen.getByRole('button', { name: /Request Replacement/i });
      await user.click(replacementBtn);
      expect(replacementFn).toHaveBeenCalledWith(baseMockTicket);

      // 3. Escalate Ops
      const escalateBtn = screen.getByRole('button', { name: /Escalate Ops/i });
      await user.click(escalateBtn);
      expect(escalateFn).toHaveBeenCalledWith(baseMockTicket);
    });
  });
});
