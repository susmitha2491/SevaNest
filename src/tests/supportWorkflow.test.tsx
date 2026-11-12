import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SupportTicketsPage } from '../features/support/presentation/SupportTicketsPage';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderWithProviders(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Support Grievance & SLA Workflows', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'STAFF-SUPP-01',
        name: 'Support Officer',
        email: 'support@sevanest.local',
        role: 'SUPPORT_EXECUTIVE',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.SUPPORT_VIEW,
          PERMISSIONS.SUPPORT_MANAGE,
          PERMISSIONS.CUSTOMERS_VIEW,
          PERMISSIONS.WORKERS_VIEW,
        ],
      },
      isAuthenticated: true,
    });
  });

  it('renders support grievance queue with SLA metrics and ticket directory table', async () => {
    renderWithProviders(<SupportTicketsPage />);

    expect(
      await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/SLA Impending Breach/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Open Inquiries/i).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText(/Search by complainant, worker, ticket ID/i)).toBeInTheDocument();

    // Verify ticket records
    expect(await screen.findByText('TKT-4921')).toBeInTheDocument();
    expect(screen.getByText('Anand Sharma')).toBeInTheDocument();
  });

  it('opens ticket chat workspace showing conversation timeline and allows replying to customer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SupportTicketsPage />);

    const viewButtons = await screen.findAllByRole('button', { name: /View Chat/i });
    expect(viewButtons.length).toBeGreaterThan(0);
    await user.click(viewButtons[0]);

    // Check modal contents
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Anand Sharma').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/#TKT-4921/i)).toBeInTheDocument();

    // Type and send a reply to customer
    const noteInput = screen.getByRole('textbox', { name: /Support reply text/i });
    await user.type(noteInput, 'Contacted customer family: Confirmed arrangement for next day shift.');

    const sendBtn = screen.getByRole('button', { name: /Send/i });
    expect(sendBtn).toBeEnabled();
    await user.click(sendBtn);
  });

  it('opens ticket resolution dialog with mandatory remarks', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SupportTicketsPage />);

    const resolveButtons = await screen.findAllByRole('button', { name: /^Resolve$/i });
    expect(resolveButtons.length).toBeGreaterThan(0);
    await user.click(resolveButtons[0]);

    expect(await screen.findByRole('heading', { name: /Resolve Grievance/i })).toBeInTheDocument();
    expect(
      screen.getByText('Describe how the complaint was addressed and what resolution was communicated to the customer or worker.')
    ).toBeInTheDocument();
    expect(screen.getByText('Resolution Summary')).toBeInTheDocument();
    expect(screen.getByTestId('required-indicator')).toHaveTextContent('*');
    expect(screen.queryByText(/\(Mandatory\)/i)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter resolution summary notes/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Close Ticket/i });
    expect(confirmBtn).toBeDisabled();

    const remarksInput = screen.getByPlaceholderText(/Enter resolution summary notes/i);
    // Whitespace only must not enable submission
    await user.type(remarksInput, '    ');
    expect(confirmBtn).toBeDisabled();

    await user.type(remarksInput, 'Mediation successful: Worker confirmed morning attendance.');
    expect(confirmBtn).toBeEnabled();
  });

  it('opens operations escalation dialog with mandatory rationale', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SupportTicketsPage />);

    const escalateButtons = await screen.findAllByRole('button', { name: /^Escalate$/i });
    expect(escalateButtons.length).toBeGreaterThan(0);
    await user.click(escalateButtons[0]);

    expect(await screen.findByRole('heading', { name: /Escalate Ticket TKT-4921 to Operations/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter mandatory escalation rationale/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Escalate to Operations/i });
    expect(confirmBtn).toBeDisabled();

    const rationaleInput = screen.getByPlaceholderText(/Enter mandatory escalation rationale/i);
    await user.type(rationaleInput, 'Repeated unannounced absences; disciplinary review required.');

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(confirmBtn).toBeEnabled();
  });

  it('displays NoAccessView when user lacks support.view permission', async () => {
    useAuthStore.setState({
      user: {
        id: 'STAFF-VE-01',
        name: 'Verification Officer',
        email: 've@sevanest.local',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.VERIFICATION_REVIEW],
      },
      isAuthenticated: true,
    });

    renderWithProviders(<SupportTicketsPage />);

    expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/support\.view/i)).toBeInTheDocument();
  });
});
