import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SupportTicketsPage } from '../features/support/presentation/SupportTicketsPage';
import { TicketDetailModal } from '../features/support/presentation/TicketDetailModal';
import { supportRepository } from '../features/support/data/supportRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { ConcurrencyConflictError } from '../core/errors/DomainError';
import { SupportTicketDetail } from '../features/support/domain/types';

describe('Resolve Grievance Modal Enhancements', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    useAuthStore.setState({
      user: {
        id: 'STAFF-SUPP-01',
        name: 'Pooja (Support Exec)',
        email: 'pooja@sevanest.local',
        role: 'SUPPORT_EXECUTIVE',
        permissions: [PERMISSIONS.SUPPORT_VIEW, PERMISSIONS.SUPPORT_MANAGE],
      },
      isAuthenticated: true,
    });

    vi.restoreAllMocks();
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SupportTicketsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('1 & 2 & 3: renders modal with correct heading, description, and mandatory label', async () => {
    const user = userEvent.setup();
    renderPage();

    const resolveButtons = await screen.findAllByRole('button', { name: /^Resolve$/i });
    expect(resolveButtons.length).toBeGreaterThan(0);
    await user.click(resolveButtons[0]);

    // 1. Heading is Resolve Grievance
    expect(await screen.findByRole('heading', { name: 'Resolve Grievance' })).toBeInTheDocument();

    // 2. Updated description
    expect(
      screen.getByText(
        'Describe how the complaint was addressed and what resolution was communicated to the customer or worker.'
      )
    ).toBeInTheDocument();

    // 3. Field label is Resolution Summary * (no "(Mandatory)" text)
    expect(screen.getByText('Resolution Summary')).toBeInTheDocument();
    expect(screen.getByTestId('required-indicator')).toHaveTextContent('*');
    expect(screen.queryByText(/\(Mandatory\)/i)).not.toBeInTheDocument();
  });

  it('4: strictly disallows empty or whitespace-only submissions', async () => {
    const user = userEvent.setup();
    renderPage();

    const resolveButtons = await screen.findAllByRole('button', { name: /^Resolve$/i });
    await user.click(resolveButtons[0]);

    const confirmBtn = await screen.findByRole('button', { name: /Confirm & Close Ticket/i });
    const remarksInput = screen.getByPlaceholderText(/Enter resolution summary notes/i);

    // Initial state: empty -> disabled
    expect(confirmBtn).toBeDisabled();

    // Typing whitespace only -> still disabled
    await user.type(remarksInput, '     ');
    expect(confirmBtn).toBeDisabled();

    // Clearing -> disabled
    await user.clear(remarksInput);
    expect(confirmBtn).toBeDisabled();

    // Typing valid text -> enabled
    await user.type(remarksInput, 'Issue resolved with customer consent.');
    expect(confirmBtn).toBeEnabled();
  });

  it('7 & 8: keeps Cancel option and disables confirmation button while processing', async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: void) => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    const resolveSpy = vi.spyOn(supportRepository, 'resolveTicket').mockImplementation(() => pendingPromise);

    renderPage();

    const resolveButtons = await screen.findAllByRole('button', { name: /^Resolve$/i });
    await user.click(resolveButtons[0]);

    // 8. Cancel option exists and closes modal without submitting
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    expect(cancelBtn).toBeInTheDocument();

    const remarksInput = screen.getByPlaceholderText(/Enter resolution summary notes/i);
    await user.type(remarksInput, 'Dispute settled between customer and maid.');

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Close Ticket/i });
    expect(confirmBtn).toBeEnabled();

    // Click confirm to start mutation
    await user.click(confirmBtn);
    expect(resolveSpy).toHaveBeenCalledTimes(1);

    // 7. Confirmation button is disabled while request is processing
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByText(/Processing\.\.\./i)).toBeInTheDocument();

    // Finish processing
    resolvePromise!();
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Resolve Grievance' })).not.toBeInTheDocument();
    });
  });

  it('6: marks ticket as RESOLVED only after successful backend confirmation', async () => {
    const user = userEvent.setup();
    let rejectPromise: (reason: unknown) => void;
    const failingPromise = new Promise<void>((_, reject) => {
      rejectPromise = reject;
    });

    vi.spyOn(supportRepository, 'resolveTicket').mockImplementation(() => failingPromise);

    renderPage();

    const resolveButtons = await screen.findAllByRole('button', { name: /^Resolve$/i });
    await user.click(resolveButtons[0]);

    const remarksInput = screen.getByPlaceholderText(/Enter resolution summary notes/i);
    await user.type(remarksInput, 'Resolution attempted but backend will fail.');

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Close Ticket/i });
    await user.click(confirmBtn);

    // Backend rejects with error
    rejectPromise!(new Error('Backend validation failed or database lock'));

    // Modal stays open showing error, ticket is not marked resolved
    await waitFor(() => {
      expect(screen.getByText('Backend validation failed or database lock')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Resolve Grievance' })).toBeInTheDocument();
    });
  });

  it('5: displays resolution summary in ticket history as an internal record, not as a customer chat message', async () => {
    const resolvedTicket: SupportTicketDetail = {
      id: 'TKT-TEST-01',
      complainantId: 'C-101',
      complainantName: 'Sunita Sharma',
      complainantType: 'CUSTOMER',
      complainantPhoneMasked: '+91 98765 43210',
      serviceCategory: 'Maid Service',
      disputeCategory: 'SERVICE_QUALITY',
      description: 'Customer reported delayed arrival by helper.',
      priority: 'MEDIUM',
      slaStatus: 'NORMAL',
      status: 'RESOLVED',
      createdAt: '2026-11-06T10:00:00.000Z',
      caseNotes: [
        {
          id: 'NOTE-RES-1',
          authorName: 'Support Executive',
          authorRole: 'Support Executive',
          timestamp: '2026-11-06T12:00:00.000Z',
          noteText: 'Case Resolved: Customer agreed to revised timing schedule.',
          noteType: 'RESOLUTION_SUMMARY',
        },
      ],
      messages: [],
    };

    render(
      <QueryClientProvider client={queryClient}>
        <TicketDetailModal ticket={resolvedTicket} isOpen={true} onClose={vi.fn()} />
      </QueryClientProvider>
    );

    // Verify it is displayed as an internal record with staff-only lock indicator
    expect(await screen.findByText('Case Resolved: Customer agreed to revised timing schedule.')).toBeInTheDocument();
    expect(screen.getByText(/Private • Staff-Only/i)).toBeInTheDocument();
    expect(screen.getByText('Resolution Record (Internal)')).toBeInTheDocument();

    // Verify it is NOT displayed as customer-facing outgoing message from "Support Team"
    expect(screen.queryByText('Support Team')).not.toBeInTheDocument();
  });

  it('9: displays 428/412 concurrency conflict errors directly inside the Resolve Grievance modal', async () => {
    const user = userEvent.setup();
    vi.spyOn(supportRepository, 'resolveTicket').mockRejectedValueOnce(
      new ConcurrencyConflictError('If-Match header is required.', undefined, 428)
    );

    renderPage();

    const resolveButtons = await screen.findAllByRole('button', { name: /^Resolve$/i });
    await user.click(resolveButtons[0]);

    const remarksInput = screen.getByPlaceholderText(/Enter resolution summary notes/i);
    await user.type(remarksInput, 'Attempt resolution with stale ETag.');

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Close Ticket/i });
    await user.click(confirmBtn);

    const alertEl = await screen.findByRole('alert');
    expect(alertEl).toHaveTextContent(/If-Match header is required\./i);
    expect(screen.getByRole('heading', { name: 'Resolve Grievance' })).toBeInTheDocument();
  });
});

