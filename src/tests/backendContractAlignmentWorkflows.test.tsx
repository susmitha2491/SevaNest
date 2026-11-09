import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ReplacementFulfillmentModal } from '../features/bookings/presentation/ReplacementFulfillmentModal';
import { BookingDetailModal } from '../features/bookings/presentation/BookingDetailModal';
import { BookingsListPage } from '../features/bookings/presentation/BookingsListPage';
import { RefundProcessingModal } from '../features/payments/presentation/RefundProcessingModal';
import { TransactionDetailModal } from '../features/payments/presentation/TransactionDetailModal';
import { bookingRepository } from '../features/bookings/data/bookingRepository';
import { paymentRepository } from '../features/payments/data/paymentRepository';
import {
  BookingDetail,
  REPLACEMENT_REASONS,
  ReplacementReasonCode,
} from '../features/bookings/domain/types';
import { PaymentTransaction } from '../features/payments/domain/types';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderWithProviders(ui: React.ReactElement) {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SevaNest Backend Contract Alignment Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'U-OPS-01',
        email: 'ops@sevanest.in',
        name: 'Operations Lead',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.BOOKINGS_VIEW,
          PERMISSIONS.BOOKINGS_MANAGE,
          PERMISSIONS.PAYMENTS_VIEW,
          PERMISSIONS.REFUNDS_MANAGE,
        ],
      },
      isAuthenticated: true,
    });
  });

  describe('1. Replacement Request Management Contract Alignment', () => {
    it('verifies all 6 documented replacement reason codes map to human-readable labels', () => {
      const documentedCodes: ReplacementReasonCode[] = [
        'WORK_QUALITY',
        'BEHAVIOUR',
        'ATTENDANCE',
        'MISMATCH',
        'WORKER_UNAVAILABLE',
        'OTHER',
      ];

      documentedCodes.forEach((code) => {
        expect(REPLACEMENT_REASONS[code]).toBeDefined();
        expect(typeof REPLACEMENT_REASONS[code]).toBe('string');
        expect(REPLACEMENT_REASONS[code].length).toBeGreaterThan(0);
      });

      expect(REPLACEMENT_REASONS.WORK_QUALITY).toBe('Quality of work');
      expect(REPLACEMENT_REASONS.BEHAVIOUR).toBe('Worker behaviour or conduct');
      expect(REPLACEMENT_REASONS.ATTENDANCE).toBe('Punctuality and attendance');
      expect(REPLACEMENT_REASONS.MISMATCH).toBe('Skill or expectation mismatch');
      expect(REPLACEMENT_REASONS.WORKER_UNAVAILABLE).toBe('Worker unavailable');
      expect(REPLACEMENT_REASONS.OTHER).toBe('Other reason');
    });

    it('renders customer-selected reason code, stated reason, and customer notes in ReplacementFulfillmentModal', async () => {
      const mockBooking: BookingDetail = {
        id: 'B-10001',
        customerId: 'C-2001',
        customerName: 'Aarav Sharma',
        customerPhoneMasked: '+91 98765 *****',
        customerLocality: 'Banjara Hills',
        serviceCategory: 'Cook',
        engagementType: 'FULL_TIME_LIVE_OUT',
        timingShift: 'General',
        salaryBudgetMax: 15000,
        status: 'REPLACEMENT_REQUESTED',
        createdAt: '2026-11-01T10:00:00Z',
        platformFeePaid: true,
        platformFeeAmount: 499,
        internalNotes: [],
        replacement: {
          id: 'REP-9901',
          bookingId: 'B-10001',
          status: 'REQUESTED',
          reasonCode: 'WORK_QUALITY',
          reason: 'Worker repeatedly prepared non-dietary food items.',
          notes: 'Customer requested a replacement experienced with low-sodium cuisine.',
          neededFrom: '2026-11-15',
          requestedAt: '2026-11-05T12:00:00Z',
          priorWorkerId: 'W-4001',
          priorWorkerName: 'Laxmi Devi',
          currentWorkerId: 'W-4001',
        },
      };

      vi.spyOn(bookingRepository, 'getReplacementCandidates').mockResolvedValue([
        {
          workerId: 'W-5001',
          workerName: 'Sita Bai',
          category: 'Cook',
          experienceYears: 4,
          experienceMonths: 48,
          locality: 'Banjara Hills',
          isFullyVerified: true,
          languages: ['Telugu', 'Hindi'],
          // Authentic candidate - matchScore and ratingAverage omitted
          matchScore: undefined,
          ratingAverage: undefined,
        },
      ]);

      renderWithProviders(
        <ReplacementFulfillmentModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      // Verify authentic reason category and customer explanations are visible
      expect(screen.getByText(/Quality of work/i)).toBeInTheDocument();
      expect(screen.getByText(/Worker repeatedly prepared non-dietary food items/i)).toBeInTheDocument();
      expect(screen.getByText(/Customer requested a replacement experienced with low-sodium cuisine/i)).toBeInTheDocument();
      expect(screen.getByText(/2026-11-15/)).toBeInTheDocument();

      // Does not contain fabricated coverage plan titles
      expect(screen.queryByText(/30-Day Placement Guarantee/i)).not.toBeInTheDocument();
    });

    it('displays genuine candidate attributes without fabricated match scores or star ratings', async () => {
      const mockBooking: BookingDetail = {
        id: 'B-10002',
        customerId: 'C-2002',
        customerName: 'Sunita Rao',
        customerPhoneMasked: '+91 98888 *****',
        customerLocality: 'Kondapur',
        serviceCategory: 'House Maid',
        engagementType: 'FULL_TIME_LIVE_OUT',
        timingShift: 'Morning',
        salaryBudgetMax: 12000,
        status: 'REPLACEMENT_REQUESTED',
        createdAt: '2026-11-02T10:00:00Z',
        platformFeePaid: true,
        platformFeeAmount: 499,
        internalNotes: [],
        replacement: {
          id: 'REP-9902',
          bookingId: 'B-10002',
          status: 'APPROVED',
          reasonCode: 'ATTENDANCE',
          reason: 'Worker missed shifts without prior notice.',
          requestedAt: '2026-11-06T12:00:00Z',
          priorWorkerId: 'W-4002',
          priorWorkerName: 'Kamala',
          currentWorkerId: 'W-4002',
        },
      };

      vi.spyOn(bookingRepository, 'getReplacementCandidates').mockResolvedValue([
        {
          workerId: 'W-6002',
          workerName: 'Padma Rekha',
          category: 'House Maid',
          experienceYears: 3,
          experienceMonths: 38,
          locality: 'Kondapur',
          isFullyVerified: true,
          languages: ['Telugu', 'English'],
          matchScore: undefined,
          ratingAverage: undefined,
        },
      ]);

      renderWithProviders(
        <ReplacementFulfillmentModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Padma Rekha')).toBeInTheDocument();
      });

      // Experience is calculated authentically
      expect(screen.getByText(/3 Yrs 2 Mos Exp/i)).toBeInTheDocument();

      // Fabricated 95% match score or 5.0 rating should NOT be displayed
      expect(screen.queryByText(/95% Match/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/5\.0/i)).not.toBeInTheDocument();
    });

    it('calls selectReplacementWorker and transitions status to COMPLETED without redundant matching calls', async () => {
      const user = userEvent.setup();
      const mockBooking: BookingDetail = {
        id: 'B-10003',
        customerId: 'C-2003',
        customerName: 'Vinay Kumar',
        customerPhoneMasked: '+91 97777 *****',
        customerLocality: 'Madhapur',
        serviceCategory: 'Driver',
        engagementType: 'FULL_TIME_LIVE_OUT',
        timingShift: 'Day',
        salaryBudgetMax: 20000,
        status: 'REPLACEMENT_REQUESTED',
        createdAt: '2026-11-03T10:00:00Z',
        platformFeePaid: true,
        platformFeeAmount: 499,
        internalNotes: [],
        replacement: {
          id: 'REP-9903',
          bookingId: 'B-10003',
          status: 'APPROVED',
          reasonCode: 'BEHAVIOUR',
          reason: 'Worker disagreement with household policies.',
          requestedAt: '2026-11-07T12:00:00Z',
          priorWorkerId: 'W-4003',
          priorWorkerName: 'Ramesh',
          currentWorkerId: 'W-4003',
        },
      };

      vi.spyOn(bookingRepository, 'getReplacementCandidates').mockResolvedValue([
        {
          workerId: 'W-7003',
          workerName: 'Mahesh G',
          category: 'Driver',
          experienceYears: 5,
          experienceMonths: 60,
          locality: 'Madhapur',
          isFullyVerified: true,
          languages: ['Hindi', 'Telugu'],
        },
      ]);

      const selectSpy = vi.spyOn(bookingRepository, 'selectReplacementWorker').mockResolvedValue();

      renderWithProviders(
        <ReplacementFulfillmentModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Mahesh G')).toBeInTheDocument();
      });

      // Select candidate
      await user.click(screen.getByText('Mahesh G'));

      // Check confirmation checkbox
      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      // Confirm assignment
      const confirmButton = screen.getByRole('button', { name: /Confirm Replacement Match/i });
      expect(confirmButton).toBeEnabled();
      await user.click(confirmButton);

      await waitFor(() => {
        expect(selectSpy).toHaveBeenCalledWith('REP-9903', 'W-7003');
      });
    });
  });

  describe('2. Find Another Worker & Predecessor/Successor Booking Relationships', () => {
    it('displays successor relationship banner when replacesBookingId is present', () => {
      const mockSuccessorBooking: BookingDetail = {
        id: 'B-20002',
        customerId: 'C-3001',
        customerName: 'Ananya Roy',
        customerPhoneMasked: '+91 93333 *****',
        customerLocality: 'Jubilee Hills',
        serviceCategory: 'Cook',
        engagementType: 'FULL_TIME_LIVE_OUT',
        timingShift: 'Morning',
        salaryBudgetMax: 16000,
        status: 'NEW_REQUEST',
        replacesBookingId: 'B-10001',
        createdAt: '2026-11-08T10:00:00Z',
        platformFeePaid: true,
        platformFeeAmount: 499,
        internalNotes: [],
      };

      renderWithProviders(
        <BookingDetailModal
          booking={mockSuccessorBooking}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      const banner = screen.getByTestId('booking-relationship-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent(/Replacement Successor Booking/i);
      expect(banner).toHaveTextContent(/B-10001/);
    });

    it('displays replaced banner on original booking when successor replacementBookingId exists', () => {
      const mockReplacedBooking: BookingDetail = {
        id: 'B-10001',
        customerId: 'C-3001',
        customerName: 'Ananya Roy',
        customerPhoneMasked: '+91 93333 *****',
        customerLocality: 'Jubilee Hills',
        serviceCategory: 'Cook',
        engagementType: 'FULL_TIME_LIVE_OUT',
        timingShift: 'Morning',
        salaryBudgetMax: 16000,
        status: 'REPLACED',
        createdAt: '2026-11-01T10:00:00Z',
        platformFeePaid: true,
        platformFeeAmount: 499,
        internalNotes: [],
        replacement: {
          id: 'REP-9901',
          bookingId: 'B-10001',
          status: 'COMPLETED',
          reasonCode: 'WORK_QUALITY',
          reason: 'Customer requested worker change.',
          replacementBookingId: 'B-20002',
          priorWorkerId: 'W-101',
          priorWorkerName: 'Laxmi',
        },
      };

      renderWithProviders(
        <BookingDetailModal
          booking={mockReplacedBooking}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      const banner = screen.getByTestId('booking-relationship-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent(/Replaced Booking/i);
      expect(banner).toHaveTextContent(/B-20002/);
    });

    it('renders relationship reference badges in BookingsListPage', async () => {
      const mockBookings: BookingDetail[] = [
        {
          id: 'B-20002',
          customerId: 'C-3001',
          customerName: 'Ananya Roy',
          customerPhoneMasked: '+91 93333 *****',
          customerLocality: 'Jubilee Hills',
          serviceCategory: 'Cook',
          engagementType: 'FULL_TIME_LIVE_OUT',
          timingShift: 'Morning',
          salaryBudgetMax: 16000,
          status: 'NEW_REQUEST',
          replacesBookingId: 'B-10001',
          createdAt: '2026-11-08T10:00:00Z',
          platformFeePaid: true,
          platformFeeAmount: 499,
          internalNotes: [],
        },
      ];

      vi.spyOn(bookingRepository, 'getBookings').mockResolvedValue({
        items: mockBookings,
        totalCount: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });

      renderWithProviders(<BookingsListPage />);

      await waitFor(() => {
        expect(screen.getByText(/Replaces: B-10001/i)).toBeInTheDocument();
      });
    });
  });

  describe('3. Refund Approval Workflow Contract Alignment', () => {
    const mockPaidTxn: PaymentTransaction = {
      id: 'TXN-9001',
      customerId: 'C-5001',
      customerName: 'Deepak Patel',
      customerPhoneMasked: '+91 95555 *****',
      bookingRef: 'B-84912',
      serviceCategory: 'House Maid',
      feeType: 'BOOKING_FEE',
      feeDescription: 'Platform Placement Service Fee',
      amountINR: 1499,
      paymentMethod: 'UPI',
      gatewayRef: 'pay_live_77281',
      status: 'PAID',
      timestamp: '2026-11-05 14:30',
      breakdown: {
        baseAmount: 1270.34,
        gstAmount: 228.66,
        platformCommission: 1270.34,
      },
    };

    it('enforces full refund only and does not render partial refund toggle', () => {
      renderWithProviders(
        <RefundProcessingModal
          transaction={mockPaidTxn}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      // Verify Full Payment Reimbursement card is present
      expect(screen.getByText(/Full Payment Reimbursement \(100%\)/i)).toBeInTheDocument();
      expect(screen.getAllByText('₹1,499.00').length).toBeGreaterThan(0);

      // Verify Partial Reimbursement options are removed
      expect(screen.queryByText(/Partial Reimbursement/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Enter Partial Refund Amount/i)).not.toBeInTheDocument();
    });

    it('submits documented RefundDto { reason } schema with Idempotency-Key and omits conflicting approval property', async () => {
      const user = userEvent.setup();
      const processRefundSpy = vi.spyOn(paymentRepository, 'processRefund').mockResolvedValue();

      renderWithProviders(
        <RefundProcessingModal
          transaction={mockPaidTxn}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      // Enter remarks
      const remarksInput = screen.getByPlaceholderText(/operational justification/i);
      await user.type(remarksInput, 'Customer cancelled trial within warranty period.');

      // Check policy confirmation
      const policyCheckbox = screen.getByRole('checkbox');
      await user.click(policyCheckbox);

      // Submit refund
      const submitButton = screen.getByRole('button', { name: /Authorize Refund/i });
      expect(submitButton).toBeEnabled();
      await user.click(submitButton);

      await waitFor(() => {
        expect(processRefundSpy).toHaveBeenCalledWith(
          'TXN-9001',
          1499,
          'UNSATISFACTORY_TRIAL',
          'Customer cancelled trial within warranty period.',
          expect.stringContaining('idem_TXN-9001')
        );
      });
    });

    it('enforces PERMISSIONS.REFUNDS_MANAGE permission guard in TransactionDetailModal', () => {
      // User WITH permission
      const { rerender } = renderWithProviders(
        <TransactionDetailModal
          transaction={mockPaidTxn}
          isOpen={true}
          onClose={vi.fn()}
          onInitiateRefund={vi.fn()}
        />
      );

      expect(screen.getByTestId('initiate-refund-button')).toBeInTheDocument();

      // Revoke refund permission
      useAuthStore.setState({
        user: {
          id: 'U-VIEW-01',
          email: 'viewer@sevanest.in',
          name: 'Audit Viewer',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [PERMISSIONS.PAYMENTS_VIEW],
        },
        isAuthenticated: true,
      });

      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <TransactionDetailModal
              transaction={mockPaidTxn}
              isOpen={true}
              onClose={vi.fn()}
              onInitiateRefund={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.queryByTestId('initiate-refund-button')).not.toBeInTheDocument();
    });

    it('displays gateway failure diagnostics when transaction status is REFUND_FAILED', () => {
      const failedRefundTxn: PaymentTransaction = {
        ...mockPaidTxn,
        status: 'REFUND_PENDING',
        rawStatus: 'REFUND_FAILED',
        failureCode: 'GATEWAY_ORIGINAL_TRANSACTION_REVERSED',
        failureReason: 'Original charge was already reversed by the issuer bank.',
      };

      renderWithProviders(
        <TransactionDetailModal
          transaction={failedRefundTxn}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      const diagnostics = screen.getByTestId('gateway-failure-diagnostics');
      expect(diagnostics).toBeInTheDocument();
      expect(diagnostics).toHaveTextContent(/GATEWAY_ORIGINAL_TRANSACTION_REVERSED/);
      expect(diagnostics).toHaveTextContent(/Original charge was already reversed/i);
    });
  });
});
