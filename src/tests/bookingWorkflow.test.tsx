import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { BookingsListPage } from '../features/bookings/presentation/BookingsListPage';
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

describe('Booking & Service Management Workflows', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'STAFF-OPS-01',
        name: 'Operations Officer',
        email: 'ops@sevanest.local',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.BOOKINGS_VIEW,
          PERMISSIONS.BOOKINGS_MANAGE,
          PERMISSIONS.CUSTOMERS_VIEW,
          PERMISSIONS.WORKERS_VIEW,
        ],
      },
      isAuthenticated: true,
    });
  });

  it('renders the booking directory table with canonical status badges and quick-filter tabs', async () => {
    renderWithProviders(<BookingsListPage />);

    expect(
      await screen.findByRole('heading', { name: /Booking & Service Management/i })
    ).toBeInTheDocument();

    expect(screen.getByPlaceholderText(/Search by customer, worker, booking ID/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All Bookings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Requests/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trials Scheduled/i })).toBeInTheDocument();

    // Verify bookings rows
    expect(await screen.findByText('Anand Sharma')).toBeInTheDocument();
    expect(screen.getByText('B-84920')).toBeInTheDocument();
    expect(screen.getByText('Priya Reddy')).toBeInTheDocument();
  });

  it('opens booking detail modal when View button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BookingsListPage />);

    const viewButtons = await screen.findAllByRole('button', { name: /View/i });
    expect(viewButtons.length).toBeGreaterThan(0);
    await user.click(viewButtons[0]);

    // Check modal contents
    expect(await screen.findByRole('heading', { name: /Booking Details: B-84920/i })).toBeInTheDocument();
    expect(screen.getByText(/Customer Profile/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Kondapur/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Deep kitchen cleaning/i)).toBeInTheDocument();
  });

  it('opens candidate matching wizard and displays only verified worker matches', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BookingsListPage />);

    const matchButtons = await screen.findAllByRole('button', { name: /Match Workers/i });
    expect(matchButtons.length).toBeGreaterThan(0);
    await user.click(matchButtons[0]);

    // Check wizard header and verified guarantee
    expect(await screen.findByRole('heading', { name: /Candidate Worker Matching Wizard/i })).toBeInTheDocument();
    expect(screen.getByText(/Verified Workforce Guarantee/i)).toBeInTheDocument();

    // Check candidate cards
    expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
    expect(screen.getByText(/96% Match/i)).toBeInTheDocument();

    // Select candidate and verify trial schedule form unfolds
    const candidateCard = screen.getByText('Sunita Devi');
    await user.click(candidateCard);

    expect(await screen.findByText(/Coordinate Interview \/ Trial with Sunita Devi/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm Trial Schedule/i })).toBeEnabled();
  });

  it('opens trial outcome modal for scheduled trials', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BookingsListPage />);

    const outcomeButtons = await screen.findAllByRole('button', { name: /Record Outcome/i });
    expect(outcomeButtons.length).toBeGreaterThan(0);
    await user.click(outcomeButtons[0]);

    expect(await screen.findByRole('heading', { name: /Record Trial Outcome/i })).toBeInTheDocument();
    expect(screen.getByText(/Trial Succeeded \(Candidate Confirmed\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Trial Rejected \(Candidate Unsuitable\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Trial Outcome/i })).toBeInTheDocument();
  });

  it('opens replacement workstation modal for replacement requested bookings', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BookingsListPage />);

    const replacementButtons = await screen.findAllByRole('button', { name: /Process Replacement/i });
    expect(replacementButtons.length).toBeGreaterThan(0);
    await user.click(replacementButtons[0]);

    expect(await screen.findByRole('heading', { name: /Replacement Request Workstation/i })).toBeInTheDocument();
    expect(screen.getByText(/Replacement Dispute & Coverage Breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/30-Day Free Replacement Guarantee/i)).toBeInTheDocument();
  });

  it('opens cancellation dialog with reason category and mandatory remarks', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BookingsListPage />);

    const cancelButtons = await screen.findAllByRole('button', { name: /Cancel Booking/i });
    expect(cancelButtons.length).toBeGreaterThan(0);
    await user.click(cancelButtons[0]);

    expect(await screen.findByText(/Cancel Booking B-84920/i)).toBeInTheDocument();
    expect(screen.getByText(/Cancellation Reason Category:/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter mandatory operational remarks for cancellation/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /^Confirm$/i });
    expect(confirmBtn).toBeDisabled();

    const remarksInput = screen.getByPlaceholderText(/Enter mandatory operational remarks for cancellation/i);
    await user.type(remarksInput, 'Customer decided to postpone requirement.');

    // Confirm checkbox for destructive action
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(confirmBtn).toBeEnabled();
  });

  it('renders NoAccessView when user lacks bookings.view permission', async () => {
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

    renderWithProviders(<BookingsListPage />);

    expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/bookings\.view/i)).toBeInTheDocument();
  });
});
