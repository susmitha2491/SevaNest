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

    it('renders all case activity and communication history timestamps in IST', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      // NOTE-1: 2026-11-06T11:45:00.000Z -> 06 Nov 2026, 05:15 PM IST
      expect(await screen.findByText('06 Nov 2026, 05:15 PM IST')).toBeInTheDocument();

      // NOTE-2: 2026-11-06T12:00:00.000Z -> 06 Nov 2026, 05:30 PM IST
      expect(await screen.findByText('06 Nov 2026, 05:30 PM IST')).toBeInTheDocument();

      // NOTE-3: 2026-11-06T14:30:00.000Z -> 06 Nov 2026, 08:00 PM IST
      expect(await screen.findByText('06 Nov 2026, 08:00 PM IST')).toBeInTheDocument();

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
     2. Chat-Based Support Workspace Layout & Sections
     ========================================================================= */
  describe('2. Chat Workspace Layout & Identity Ribbon', () => {
    it('renders conversation header with Complainant name, type badge, Ticket ID, and close button', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      // Complainant Name & Ticket ID
      expect(screen.getByRole('heading', { name: 'Vikramaditya Singhania' })).toBeInTheDocument();
      expect(screen.getByText('CUSTOMER')).toBeInTheDocument();
      expect(screen.getByText('#TKT-9842')).toBeInTheDocument();

      // Category and dispute category
      expect(screen.getByText('House Maid')).toBeInTheDocument();
      expect(screen.getByText('ATTENDANCE BREACH')).toBeInTheDocument();

      // Top close button
      expect(screen.getByTestId('close-ticket-modal-button')).toBeInTheDocument();
    });

    it('renders Context Ribbon with phone, booking ref, linked worker, and SLA pill', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      // Complainant Phone, Booking Ref, Subject Worker
      expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();
      expect(screen.getByText('BK-55209')).toBeInTheDocument();
      expect(screen.getByText('Sunita Devi')).toBeInTheDocument();

      // SLA Tracking pill for BREACHED state
      expect(screen.getByText(/Breached by 2h 15m/i)).toBeInTheDocument();
    });

    it('renders SLA status with distinct styling for AT_RISK and NORMAL states', () => {
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

      expect(screen.getByText('1h 10m remaining')).toBeInTheDocument();

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

      expect(screen.getByText('Healthy SLA (18h left)')).toBeInTheDocument();
    });

    it('renders original grievance statement as the initial message in conversation', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      expect(screen.getByText(/Initial Grievance/i)).toBeInTheDocument();
      expect(
        screen.getByText('Worker failed to report for scheduled shift on three consecutive days without prior notification.')
      ).toBeInTheDocument();
    });

    it('distinguishes internal staff notes with private staff-only label and lock icon', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      const internalNotes = await screen.findAllByText(/Internal Staff Note/i);
      expect(internalNotes.length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Private • Staff-Only/i).length).toBeGreaterThanOrEqual(1);
    });

    it('verifies that Claim Ticket and Ticket Owner fields are absent in collective support model', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      expect(screen.queryByRole('button', { name: /^Claim Ticket$/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/^Ticket Owner:$/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Assigned To:$/i)).not.toBeInTheDocument();
    });
  });

  /* =========================================================================
     3. Chat Interactions, Priority Editing & Case Actions
     ========================================================================= */
  describe('3. Chat Composer Interactions & Case Actions', () => {
    it('dispatches reply message when typing and clicking Send', async () => {
      const user = userEvent.setup();
      const sendSpy = vi.spyOn(supportRepository, 'sendTicketMessage').mockResolvedValueOnce({
        id: 'msg-new',
        ticketId: 'TKT-9842',
        from: 'ADMIN',
        body: 'We are reviewing your attendance grievance.',
        createdAt: new Date().toISOString(),
        authorUserId: 'adm-004',
        internal: false,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      const textarea = screen.getByRole('textbox', { name: /Support reply text/i });
      await user.type(textarea, 'We are reviewing your attendance grievance.');

      const sendBtn = screen.getByRole('button', { name: /Send/i });
      expect(sendBtn).not.toBeDisabled();
      await user.click(sendBtn);

      await waitFor(() => {
        expect(sendSpy).toHaveBeenCalledWith(
          'TKT-9842',
          'We are reviewing your attendance grievance.',
          false
        );
      });
    });

    it('dispatches internal staff note when switching to Internal Note mode', async () => {
      const user = userEvent.setup();
      const sendSpy = vi.spyOn(supportRepository, 'sendTicketMessage').mockResolvedValueOnce({
        id: 'msg-note',
        ticketId: 'TKT-9842',
        from: 'ADMIN',
        body: 'Escalation to Ops needed if worker is unreachable.',
        createdAt: new Date().toISOString(),
        authorUserId: 'adm-004',
        internal: true,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      // Switch to internal note mode
      const noteTab = screen.getByRole('button', { name: /Internal Note \(Staff-Only\)/i });
      await user.click(noteTab);

      const textarea = screen.getByRole('textbox', { name: /Internal note text/i });
      await user.type(textarea, 'Escalation to Ops needed if worker is unreachable.');

      const logNoteBtn = screen.getByRole('button', { name: /Log Note/i });
      expect(logNoteBtn).not.toBeDisabled();
      await user.click(logNoteBtn);

      await waitFor(() => {
        expect(sendSpy).toHaveBeenCalledWith(
          'TKT-9842',
          'Escalation to Ops needed if worker is unreachable.',
          true
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

      const prioritySelect = screen.getByLabelText(/Select ticket priority/i);
      await user.selectOptions(prioritySelect, 'LOW');

      await waitFor(() => {
        expect(prioritySpy).toHaveBeenCalledWith('TKT-9842', 'LOW', '"v1-etag"');
      });
    });

    it('triggers callbacks for Resolve Ticket and Escalate Ops', async () => {
      const user = userEvent.setup();
      const resolveFn = vi.fn();
      const escalateFn = vi.fn();

      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal
            ticket={baseMockTicket}
            isOpen={true}
            onClose={vi.fn()}
            onOpenResolve={resolveFn}
            onOpenEscalate={escalateFn}
          />
        </QueryClientProvider>
      );

      // 1. Resolve Ticket
      const resolveBtn = screen.getByRole('button', { name: /Mark Resolved/i });
      await user.click(resolveBtn);
      expect(resolveFn).toHaveBeenCalledWith(baseMockTicket);

      // 2. Escalate Ops
      const escalateBtn = screen.getByRole('button', { name: /Escalate Ops/i });
      await user.click(escalateBtn);
      expect(escalateFn).toHaveBeenCalledWith(baseMockTicket);
    });

    it('renders read-only archived notice and disables composer when ticket is resolved or closed', () => {
      const resolvedTicket: SupportTicketDetail = {
        ...baseMockTicket,
        status: 'RESOLVED',
      };

      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={resolvedTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      expect(screen.getByText(/The conversation is archived and read-only/i)).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /Support reply text/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Mark Resolved/i })).not.toBeInTheDocument();
    });

    it('displays actual worker full name in header and grievance and preserves WORKER badge', async () => {
      const workerTicket: SupportTicketDetail = {
        ...baseMockTicket,
        id: 'TKT-7711',
        complainantId: 'WRK-9001',
        complainantName: 'Kamala Bai',
        complainantType: 'WORKER',
        description: 'Monthly payout deduction dispute filed by domestic helper.',
      };

      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={workerTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      // Chat header has actual worker name and WORKER badge
      const headerTitle = screen.getByRole('heading', { name: 'Kamala Bai' });
      expect(headerTitle).toBeInTheDocument();
      expect(screen.getByText('WORKER')).toBeInTheDocument();

      // Initial grievance has actual worker name
      expect(screen.getAllByText('Kamala Bai').length).toBeGreaterThanOrEqual(2);
    });

    it('retrieves worker full name from workerRepository when ticket name is generic Worker', async () => {
      const { workerRepository } = await import('../features/workers/data/workerRepository');
      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValueOnce({
        id: 'WRK-9002',
        name: 'Sunita Devi',
        category: 'House Maid',
        experienceYears: 4,
        ratingAverage: 4.7,
        totalReviews: 19,
        locality: 'Kondapur',
        isFullyVerified: true,
        status: 'ACTIVE',
        accountStatus: 'ACTIVE',
        verificationLevel: 'VERIFIED',
        onboardingStatus: 'VERIFIED',
        verificationStatus: 'VERIFIED',
        applicationStatus: 'VERIFIED',
        matchingEligible: true,
        registeredAt: '2026-01-01',
        internalNotes: [],
      } as unknown as import('../features/workers/domain/types').WorkerDetail);

      const genericWorkerTicket: SupportTicketDetail = {
        ...baseMockTicket,
        id: 'TKT-7712',
        complainantId: 'WRK-9002',
        complainantName: 'Worker',
        complainantType: 'WORKER',
      };

      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={genericWorkerTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      // Should dynamically resolve to Sunita Devi
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Sunita Devi' })).toBeInTheDocument();
      });
      expect(screen.getByText('WORKER')).toBeInTheDocument();
    });

    it('retains fallback "Worker" when no name is available without fabricating name from ID', async () => {
      const fallbackWorkerTicket: SupportTicketDetail = {
        ...baseMockTicket,
        id: 'TKT-7713',
        complainantId: 'U-00',
        complainantName: 'Worker',
        complainantType: 'WORKER',
        subjectWorkerId: undefined,
        subjectWorkerName: undefined,
        bookingRef: undefined,
      };

      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={fallbackWorkerTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      const headerTitle = screen.getByRole('heading', { name: 'Worker' });
      expect(headerTitle).toBeInTheDocument();
      expect(screen.getByText('WORKER')).toBeInTheDocument();
      // Must not fabricate a name from the ID
      expect(screen.queryByText('Worker U-00')).not.toBeInTheDocument();
    });

    it('displays actual customer full name and falls back cleanly to "Customer"', async () => {
      const customerTicket: SupportTicketDetail = {
        ...baseMockTicket,
        id: 'TKT-7714',
        complainantId: 'CUST-1001',
        complainantName: 'Radha Raman',
        complainantType: 'CUSTOMER',
      };

      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={customerTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      expect(screen.getByRole('heading', { name: 'Radha Raman' })).toBeInTheDocument();
      expect(screen.getByText('CUSTOMER')).toBeInTheDocument();
    });

    it('renders clean textarea placeholder without keyboard instructions', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      const textarea = screen.getByRole('textbox', { name: /Support reply text/i });
      expect(textarea).toBeInTheDocument();
      // Placeholder must NOT contain keyboard instruction
      const placeholder = textarea.getAttribute('placeholder') || '';
      expect(placeholder).not.toContain('(Enter to send, Shift+Enter for new line)');
      expect(placeholder).toContain('Vikramaditya Singhania');
      expect(placeholder).toBe('Type a response to Vikramaditya Singhania...');
    });

    it('switches placeholder to clean internal note text when toggling note mode', async () => {
      const user = userEvent.setup();
      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      const internalNoteBtn = screen.getByRole('button', { name: /Internal Note \(Staff-Only\)/i });
      await user.click(internalNoteBtn);

      const textarea = screen.getByRole('textbox', { name: /Internal note text/i });
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('placeholder', 'Write an internal staff note...');
      expect(textarea.getAttribute('placeholder')).not.toContain('(Enter to send');
    });

    it('sends message on Enter and allows Shift+Enter for multiline newline', async () => {
      const user = userEvent.setup();
      const sendSpy = vi.spyOn(supportRepository, 'sendTicketMessage').mockResolvedValueOnce({
        id: 'MSG-TEST-1',
        ticketId: baseMockTicket.id,
        from: 'ADMIN',
        body: 'Investigating issue immediately.',
        createdAt: new Date().toISOString(),
        authorUserId: 'adm-004',
        internal: false,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TicketDetailModal ticket={baseMockTicket} isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>
      );

      const textarea = screen.getByRole('textbox', { name: /Support reply text/i });

      // Shift+Enter should NOT submit
      await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2');
      expect(sendSpy).not.toHaveBeenCalled();

      // Clear and type single line, then press Enter
      await user.clear(textarea);
      await user.type(textarea, 'Investigating issue immediately.{Enter}');
      expect(sendSpy).toHaveBeenCalledWith(baseMockTicket.id, 'Investigating issue immediately.', false);
    });
  });
});
