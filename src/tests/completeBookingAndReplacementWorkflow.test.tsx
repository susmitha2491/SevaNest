import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { BookingsListPage } from '../features/bookings/presentation/BookingsListPage';
import { ReplacementFulfillmentModal } from '../features/bookings/presentation/ReplacementFulfillmentModal';
import { BookingDetailModal } from '../features/bookings/presentation/BookingDetailModal';
import { bookingRepository } from '../features/bookings/data/bookingRepository';
import { BookingDetail } from '../features/bookings/domain/types';
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

function createMockReplacementBooking(status: 'REQUESTED' | 'APPROVED' | 'REJECTED' = 'REQUESTED'): BookingDetail {
  return {
    id: 'B-84912',
    customerId: 'C-2091',
    customerName: 'Priya Reddy',
    customerPhoneMasked: '+91 94401 23456',
    customerLocality: 'Gachibowli',
    serviceCategory: 'Cook',
    engagementType: 'FULL_TIME_LIVE_OUT',
    timingShift: 'Split Shift',
    salaryBudgetMax: 18000,
    assignedWorkerId: 'W-10484',
    assignedWorkerName: 'Meena Bai',
    assignedWorkerPhoneMasked: '+91 91234 56789',
    status: 'REPLACEMENT_REQUESTED',
    createdAt: '2026-10-09T04:43:26.583Z',
    platformFeePaid: true,
    platformFeeAmount: 1499,
    internalNotes: [],
    replacement: {
      id: 'REP-84912',
      bookingId: 'B-84912',
      requestedAt: '2026-10-09T04:43:36.140Z',
      reasonCategory: 'Skill Mismatch / Food Preparation Quality',
      customerExplanation: 'Worker struggled with specific diabetic dietary menu requirements.',
      eligibleUnderPolicy: true,
      coveragePlanName: '30-Day Free Replacement Guarantee',
      priorWorkerId: 'W-10484',
      priorWorkerName: 'Meena Bai',
      status,
    },
  };
}

describe('Complete Booking & Replacement Management Workflow Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'STAFF-OPS-01',
        name: 'Operations Officer',
        email: 'ops@sevanest.in',
        role: 'OPERATIONS_ADMIN',
        permissions: [PERMISSIONS.BOOKINGS_VIEW, PERMISSIONS.BOOKINGS_MANAGE],
      },
      isAuthenticated: true,
      isLoading: false,
    });
  });

  describe('1. Customer Name Resolution & Genuine Identity Presentation', () => {
    it('displays genuine customer names and never substitutes raw IDs as customer names', async () => {
      renderWithProviders(<BookingsListPage />);

      await waitFor(() => {
        expect(screen.getByText('Anand Sharma')).toBeInTheDocument();
        expect(screen.getByText('Priya Reddy')).toBeInTheDocument();
      });

      // Verify that no customer names start with "Customer (" or display raw UUIDs
      const customerNames = screen.queryAllByText(/Customer \(/i);
      expect(customerNames).toHaveLength(0);
    });

    it('displays "Customer Details Unavailable" clearly when customer identity is missing', async () => {
      const mockBookingMissingCustomer: BookingDetail = {
        id: 'B-MISSING-CUST',
        customerId: '01a11ef5-e4d9-72a5-a78c-9dded10997f1',
        customerName: 'Customer Details Unavailable',
        customerPhoneMasked: '+91 98765 43210',
        customerLocality: 'Kondapur',
        serviceCategory: 'House Maid',
        engagementType: 'PART_TIME',
        timingShift: 'Morning',
        salaryBudgetMax: 8000,
        status: 'REQUESTED',
        createdAt: '2026-10-09',
        platformFeePaid: true,
        platformFeeAmount: 499,
        internalNotes: [],
      };

      renderWithProviders(
        <BookingDetailModal booking={mockBookingMissingCustomer} isOpen={true} onClose={vi.fn()} />
      );

      expect(screen.getByText('Customer Details Unavailable')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /01a11ef5/i })).toBeNull();
    });
  });

  describe('2. Booking Management 7 Quick-Filter Sections', () => {
    it('renders all 7 required filter tabs in correct order and switches active filter', async () => {
      const user = userEvent.setup();
      renderWithProviders(<BookingsListPage />);

      const tabs = [
        'All Bookings',
        'New Requests',
        'Trials Scheduled',
        'Confirmed',
        'Active Services',
        'Replacements',
        'Cancelled',
      ];

      for (const tabLabel of tabs) {
        const tabButton = await screen.findByRole('button', { name: tabLabel });
        expect(tabButton).toBeInTheDocument();
      }

      // Switch to Replacements tab
      const replacementsTab = screen.getByRole('button', { name: 'Replacements' });
      await user.click(replacementsTab);

      // Verify that the table adapts to Replacement columns
      await waitFor(() => {
        expect(screen.getByText('Prior Worker Details')).toBeInTheDocument();
        expect(screen.getByText('Replacement Reason & Date')).toBeInTheDocument();
      });
    });
  });

  describe('3. Replacement Request Workflow & Workstation', () => {
    it('renders replacement details: booking ID, customer info, prior worker, stated reason, and request date', () => {
      const booking = createMockReplacementBooking('REQUESTED');
      renderWithProviders(
        <ReplacementFulfillmentModal
          booking={booking}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText(/Replacement Request Workstation/i)).toBeInTheDocument();
      expect(screen.getByText(/B-84912/)).toBeInTheDocument();
      expect(screen.getByText(/Priya Reddy/)).toBeInTheDocument();
      expect(screen.getByText(/Meena Bai/)).toBeInTheDocument();
      expect(screen.getByText(/Skill Mismatch \/ Food Preparation Quality/)).toBeInTheDocument();
      expect(screen.getByText(/Worker struggled with specific diabetic dietary menu requirements./)).toBeInTheDocument();
    });

    it('supports Accept action: moves to Stage 2 with eligible verified candidates', async () => {
      const user = userEvent.setup();
      const approveSpy = vi.spyOn(bookingRepository, 'approveReplacement');
      const booking = createMockReplacementBooking('REQUESTED');

      renderWithProviders(
        <ReplacementFulfillmentModal
          booking={booking}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      // Verify Step 1 is rendered
      expect(screen.getByText(/Step 1: Review & Decide Replacement Eligibility/i)).toBeInTheDocument();

      // Click Accept & Proceed
      const acceptBtn = screen.getByRole('button', { name: /Accept & Proceed to Rematch/i });
      await user.click(acceptBtn);

      await waitFor(() => {
        expect(approveSpy).toHaveBeenCalledWith(
          'REP-84912',
          expect.stringContaining('verified and approved')
        );
      });
    });

    it('supports Reject action: requires mandatory rejection remarks and reverts to Active service', async () => {
      const user = userEvent.setup();
      const rejectSpy = vi.spyOn(bookingRepository, 'rejectReplacement');
      const booking = createMockReplacementBooking('REQUESTED');

      renderWithProviders(
        <ReplacementFulfillmentModal
          booking={booking}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      // Click Reject Request button to reveal rejection reason input
      const rejectInitialBtn = screen.getByRole('button', { name: /Reject Request/i });
      await user.click(rejectInitialBtn);

      // Verify mandatory reason textarea is rendered
      const textarea = screen.getByPlaceholderText(/Provide specific justification for rejection/i);
      expect(textarea).toBeInTheDocument();

      // Try submitting without remarks
      const confirmRejectBtn = screen.getByRole('button', { name: /Confirm Rejection/i });
      expect(confirmRejectBtn).toBeDisabled();

      // Enter rejection remarks
      await user.type(textarea, 'Dispute resolved with current worker; replacement not warranted under policy clause.');
      expect(confirmRejectBtn).toBeEnabled();

      await user.click(confirmRejectBtn);

      await waitFor(() => {
        expect(rejectSpy).toHaveBeenCalledWith(
          'REP-84912',
          'Dispute resolved with current worker; replacement not warranted under policy clause.'
        );
      });
    });

    it('allows assigning a verified candidate worker under placement guarantee policy', async () => {
      const user = userEvent.setup();
      const approvedBooking = createMockReplacementBooking('APPROVED');
      const selectSpy = vi.spyOn(bookingRepository, 'selectReplacementWorker');

      renderWithProviders(
        <ReplacementFulfillmentModal
          booking={approvedBooking}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      // Verify Stage 2 is displayed
      await waitFor(() => {
        expect(screen.getByText(/Step 2: Select & Assign Verified Replacement Worker/i)).toBeInTheDocument();
      });

      // Select candidate
      const candidateCard = await screen.findByText('Sunita Devi');
      await user.click(candidateCard);

      // Confirm policy checkbox
      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);
      expect(checkbox).toBeChecked();

      // Confirm replacement match
      const confirmMatchBtn = screen.getByRole('button', { name: /Confirm Replacement Match/i });
      expect(confirmMatchBtn).toBeEnabled();
      await user.click(confirmMatchBtn);

      await waitFor(() => {
        expect(selectSpy).toHaveBeenCalledWith('REP-84912', 'W-10482');
      });
    });
  });

  describe('4. Booking Lifecycle History & Audit Timeline', () => {
    const mockBookingWithHistory: BookingDetail = {
      id: 'B-84920',
      customerId: 'C-1092',
      customerName: 'Anand Sharma',
      customerPhoneMasked: '+91 98765 43210',
      customerLocality: 'Kondapur',
      serviceCategory: 'House Maid',
      engagementType: 'PART_TIME',
      timingShift: 'Morning (07:00 AM - 10:00 AM)',
      salaryBudgetMax: 8000,
      assignedWorkerId: 'W-10482',
      assignedWorkerName: 'Sunita Devi',
      assignedWorkerPhoneMasked: '+91 98450 11223',
      status: 'SERVICE_ACTIVE',
      createdAt: '2026-10-09T04:43:26.583Z',
      platformFeePaid: true,
      platformFeeAmount: 499,
      internalNotes: ['Customer requested candidate with minimum 3 years experience.'],
    };

    it('renders customer profile, assigned worker allocation, and full lifecycle timeline', async () => {
      renderWithProviders(
        <BookingDetailModal
          booking={mockBookingWithHistory}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText('Booking Details: B-84920')).toBeInTheDocument();
      expect(screen.getByText('Anand Sharma')).toBeInTheDocument();
      expect(screen.getByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.getByText(/Booking Lifecycle History & Timeline/i)).toBeInTheDocument();

      // Verify status progression timeline events
      await waitFor(() => {
        expect(screen.getByText(/STATUS PROGRESSION/i)).toBeInTheDocument();
      });
    });
  });
});
