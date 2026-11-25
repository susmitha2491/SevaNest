import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentsListPage } from '../features/payments/presentation/PaymentsListPage';
import { TransactionDetailModal } from '../features/payments/presentation/TransactionDetailModal';
import { RealPaymentRepository, paymentRepository } from '../features/payments/data/paymentRepository';
import { httpClient } from '../core/api/httpClient';
import { useAuthStore } from '../core/auth/authStore';
import { PaymentTransaction } from '../features/payments/domain/types';

const mockSuperAdminUser = {
  id: 'super-admin-uuid-1',
  name: 'Super Admin',
  email: 'superadmin@sevanest.in',
  role: 'SUPER_ADMIN',
  permissions: [
    'payment.view',
    'payments.view',
    'payment.manage',
    'refunds.manage',
    'audit.view',
    'bookings.view',
  ],
};

const dummyTransaction: PaymentTransaction = {
  id: '01a1ce1a-95b6-7399-bae8-a78c1c0e0517',
  customerId: 'cust-1',
  customerName: 'Anita Sharma',
  customerPhoneMasked: '+91 98765 43210',
  bookingRef: 'BK-2026-001',
  bookingId: 'booking-uuid-1',
  serviceCategory: 'Elder Care',
  feeType: 'BOOKING_FEE',
  feeCode: 'BOOKING_FEE',
  feeDescription: 'Initial Matching Fee',
  amountINR: 500,
  amountMinor: 50000,
  paymentMethod: 'UPI',
  gatewayRef: 'pay_live_gateway_123',
  status: 'PAID',
  rawStatus: 'SUCCEEDED',
  timestamp: '2026-11-20T10:00:00Z',
  paidAt: '2026-11-20T10:00:00Z',
  refundStatus: null,
  breakdown: {
    baseAmount: 423.73,
    gstAmount: 76.27,
    platformCommission: 423.73,
  },
};

const renderPaymentsPage = (user = mockSuperAdminUser) => {
  useAuthStore.setState({
    user: user as never,
    isAuthenticated: true,
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PaymentsListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Super Admin Refund Handling — Backend Contract & Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. RealPaymentRepository Contract & 503 Gateway Handling', () => {
    it('sends { approval: "APPROVE", reason } in refund payload', async () => {
      const repo = new RealPaymentRepository();
      vi.spyOn(httpClient, 'get').mockResolvedValue({ data: [] } as never);
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          id: 'test-payment-id',
          status: 'REFUNDED',
          refundStatus: 'REFUNDED',
          amountMinor: 50000,
          refundReason: 'Customer requested cancellation approved',
          refundedByUserId: 'super-admin-uuid-1',
        },
      } as never);

      const result = await repo.processRefund('test-payment-id', {
        approval: 'APPROVE',
        reason: 'Customer requested cancellation approved',
      });

      expect(postSpy).toHaveBeenCalledWith('/admin/payments/test-payment-id/refund', {
        approval: 'APPROVE',
        reason: 'Customer requested cancellation approved',
      });
      expect(result.status).toBe('REFUNDED');
      expect(result.refundStatus).toBe('REFUNDED');
    });

    it('recovers authoritative REFUND_PENDING state when gateway returns 503', async () => {
      const repo = new RealPaymentRepository();

      // Gateway returns 503 Service Unavailable
      vi.spyOn(httpClient, 'post').mockRejectedValueOnce({
        response: {
          status: 503,
          data: {
            code: 'PAYMENT_PROVIDER_UNAVAILABLE',
            message: 'The payment gateway is not available right now',
          },
        },
      });

      // Subsequent query to verify database record returns REFUND_PENDING
      vi.spyOn(repo, 'getTransactionById').mockResolvedValueOnce({
        ...dummyTransaction,
        status: 'REFUND_PENDING',
        refundStatus: 'REFUND_PENDING',
        refund: {
          refundStatus: 'REFUND_PENDING',
          refundAmountINR: 500,
          refundReason: 'Approved candidate replacement cancelled',
          refundedByUserId: 'super-admin-uuid-1',
        },
      });

      const result = await repo.processRefund(dummyTransaction.id, {
        approval: 'APPROVE',
        reason: 'Approved candidate replacement cancelled',
      });

      expect(result.status).toBe('REFUND_PENDING');
      expect(result.refundStatus).toBe('REFUND_PENDING');
      expect(result.refund?.refundReason).toBe('Approved candidate replacement cancelled');
    });

    it('throws domain error when 503 occurs but payment is not in REFUND_PENDING state', async () => {
      const repo = new RealPaymentRepository();

      vi.spyOn(httpClient, 'post').mockRejectedValueOnce({
        response: {
          status: 503,
          data: {
            code: 'PAYMENT_PROVIDER_UNAVAILABLE',
            message: 'The payment gateway is not available right now',
          },
        },
      });

      // Payment in DB is still PAID (refund was not recorded or transaction was aborted)
      vi.spyOn(repo, 'getTransactionById').mockResolvedValueOnce({
        ...dummyTransaction,
        status: 'PAID',
        refundStatus: null,
      });

      await expect(
        repo.processRefund(dummyTransaction.id, {
          approval: 'APPROVE',
          reason: 'Attempted refund',
        })
      ).rejects.toThrow();
    });

    it('throws domain error on 400 validation failure', async () => {
      const repo = new RealPaymentRepository();

      vi.spyOn(httpClient, 'post').mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed',
            details: [{ field: 'approval', messages: ['approval must be one of: APPROVE'] }],
          },
        },
      });

      await expect(
        repo.processRefund(dummyTransaction.id, {
          approval: 'APPROVE',
          reason: 'Short',
        })
      ).rejects.toThrow();
    });
  });

  describe('2. UI Workflow — Super Admin Refund Initiation & Feedback', () => {
    it('initiates refund and displays pending settlement feedback when gateway is 503', async () => {
      const user = userEvent.setup();
      vi.spyOn(paymentRepository, 'getTransactions').mockResolvedValue({
        items: [dummyTransaction],
        totalCount: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
        totalGrossCollectionsINR: 500,
      });
      vi.spyOn(paymentRepository, 'getFinancialOverview').mockResolvedValue({
        grossSettledCollectionsINR: 500,
        totalLedgerRecords: 1,
        totalRefundedINR: 0,
      });

      renderPaymentsPage();

      // Find row and click Refund action button
      const initiateBtn = await screen.findByRole('button', { name: /^Refund$/i });
      await user.click(initiateBtn);

      // Verify modal is open
      expect(screen.getByRole('heading', { name: /Approve & Initiate Full Refund/i })).toBeInTheDocument();

      // Enter justification reason
      const reasonInput = screen.getByLabelText(/Operational Justification Reason/i);
      await user.type(reasonInput, 'Customer cancelled booking prior to trial; refund approved.');

      // Check the explicit approval checkbox
      const approvalCheckbox = screen.getByRole('checkbox');
      await user.click(approvalCheckbox);

      // Mock processRefund resolving to REFUND_PENDING (gateway unavailable scenario)
      vi.spyOn(paymentRepository, 'processRefund').mockResolvedValueOnce({
        ...dummyTransaction,
        status: 'REFUND_PENDING',
        refundStatus: 'REFUND_PENDING',
        refund: {
          refundStatus: 'REFUND_PENDING',
          refundAmountINR: 500,
          refundReason: 'Customer cancelled booking prior to trial; refund approved.',
          refundedByUserId: 'super-admin-uuid-1',
        },
      });

      // Submit refund
      const confirmBtn = screen.getByRole('button', { name: /Confirm & Authorize Refund/i });
      await user.click(confirmBtn);

      // Expect refund modal to close
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /Approve & Initiate Full Refund/i })).not.toBeInTheDocument();
      });

      // Expect feedback banner showing pending gateway settlement
      expect(
        await screen.findByText(/Refund initiated and currently pending gateway settlement/i)
      ).toBeInTheDocument();
    });

    it('keeps modal open and displays error when refund request is rejected by backend', async () => {
      const user = userEvent.setup();
      vi.spyOn(paymentRepository, 'getTransactions').mockResolvedValue({
        items: [dummyTransaction],
        totalCount: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
        totalGrossCollectionsINR: 500,
      });
      vi.spyOn(paymentRepository, 'getFinancialOverview').mockResolvedValue({
        grossSettledCollectionsINR: 500,
        totalLedgerRecords: 1,
        totalRefundedINR: 0,
      });

      renderPaymentsPage();

      const initiateBtn = await screen.findByRole('button', { name: /^Refund$/i });
      await user.click(initiateBtn);

      const reasonInput = screen.getByLabelText(/Operational Justification Reason/i);
      await user.type(reasonInput, 'Testing validation error handling');

      const approvalCheckbox = screen.getByRole('checkbox');
      await user.click(approvalCheckbox);

      vi.spyOn(paymentRepository, 'processRefund').mockRejectedValueOnce(
        new Error('Payment is ineligible for refund: already expired')
      );

      const confirmBtn = screen.getByRole('button', { name: /Confirm & Authorize Refund/i });
      await user.click(confirmBtn);

      // Modal must remain open
      expect(screen.getByRole('heading', { name: /Approve & Initiate Full Refund/i })).toBeInTheDocument();

      // Error message displayed
      const errorElements = await screen.findAllByText(/Payment is ineligible for refund: already expired/i);
      expect(errorElements.length).toBeGreaterThanOrEqual(1);
    });

    it('prevents duplicate refund submissions while a request is in flight', async () => {
      const user = userEvent.setup();
      vi.spyOn(paymentRepository, 'getTransactions').mockResolvedValue({
        items: [dummyTransaction],
        totalCount: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
        totalGrossCollectionsINR: 500,
      });
      vi.spyOn(paymentRepository, 'getFinancialOverview').mockResolvedValue({
        grossSettledCollectionsINR: 500,
        totalLedgerRecords: 1,
        totalRefundedINR: 0,
      });

      let resolveRefund: (val: PaymentTransaction) => void;
      const pendingPromise = new Promise<PaymentTransaction>((resolve) => {
        resolveRefund = resolve;
      });

      const refundSpy = vi.spyOn(paymentRepository, 'processRefund').mockReturnValueOnce(pendingPromise);

      renderPaymentsPage();

      const initiateBtn = await screen.findByRole('button', { name: /^Refund$/i });
      await user.click(initiateBtn);

      const reasonInput = screen.getByLabelText(/Operational Justification Reason/i);
      await user.type(reasonInput, 'Testing duplicate submission prevention guard');

      const approvalCheckbox = screen.getByRole('checkbox');
      await user.click(approvalCheckbox);

      const confirmBtn = screen.getByRole('button', { name: /Confirm & Authorize Refund/i });
      await user.click(confirmBtn);

      // While request is in-flight, button is disabled and shows processing state
      expect(confirmBtn).toBeDisabled();
      expect(screen.getByText(/Processing Refund.../i)).toBeInTheDocument();

      // Attempting to click again while in-flight does not invoke processRefund a second time
      await user.click(confirmBtn);
      expect(refundSpy).toHaveBeenCalledTimes(1);

      // Resolve the request
      resolveRefund!({
        ...dummyTransaction,
        status: 'REFUND_PENDING',
        refundStatus: 'REFUND_PENDING',
      });

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: /Approve & Initiate Full Refund/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('3. Refund Records Tab Filtering', () => {
    it('filters client-side when refunded flag is set', async () => {
      const repo = new RealPaymentRepository();

      // Mock getAllFilteredTransactions to return all 3 payments
      vi.spyOn(httpClient, 'get').mockResolvedValue({
        data: {
          data: [
            { id: 'settled-01', status: 'SUCCEEDED', amountMinor: 50000 },
            { id: 'refund-pending-01', status: 'REFUND_PENDING', refundStatus: 'REFUND_PENDING', amountMinor: 50000 },
            { id: 'refunded-01', status: 'REFUNDED', refundStatus: 'REFUNDED', amountMinor: 50000 },
          ],
          meta: { total: 3, limit: 100, totalPages: 1 },
        },
      } as never);

      const result = await repo.getTransactions({ refunded: true });

      // Only the pending and completed refunds should be present
      expect(result.items.some((t) => t.id === 'settled-01')).toBe(false);
      expect(result.items.some((t) => t.id === 'refund-pending-01')).toBe(true);
      expect(result.items.some((t) => t.id === 'refunded-01')).toBe(true);
      expect(result.totalCount).toBe(2);
    });
  });

  describe('4. TransactionDetailModal Structure & Fee Ledger', () => {
    const refundPendingTxn: PaymentTransaction = {
      ...dummyTransaction,
      id: '01a1e7ab-6e19-71ac-b565-4d320ba468f5',
      status: 'REFUND_PENDING',
      refundStatus: 'REFUND_PENDING',
      refund: {
        refundStatus: 'REFUND_PENDING',
        refundAmountINR: 500,
        refundReason: 'Customer requested cancellation for cook booking',
        refundedByUserId: '01a11eec-ff90-73c8-972a-b88e3151ada0',
        processedAt: '2026-11-23T10:48:00Z',
        idempotencyKey: 'idemp_live_ref_9876543210',
      },
      providerPaymentId: 'pay_U16TxpAreitv7V',
      providerOrderId: 'order_U16TNAgoILixfd',
    };

    it('renders all 6 required sections with complete fee and tax breakdown without clipping', () => {
      useAuthStore.setState({
        user: mockSuperAdminUser as never,
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <TransactionDetailModal
            isOpen={true}
            transaction={refundPendingTxn}
            onClose={vi.fn()}
            onProcessRefund={vi.fn()}
            onVerifyPaymentStatus={vi.fn()}
          />
        </MemoryRouter>
      );

      // Section 1: Transaction Summary
      expect(screen.getByText(/Gross Platform Collection/i)).toBeInTheDocument();
      expect(screen.getAllByText(/₹500\.00/i).length).toBeGreaterThanOrEqual(2);

      // Section 2: Customer and Booking Context
      expect(screen.getByText(/Customer & Booking Context/i)).toBeInTheDocument();
      expect(screen.getByText('Anita Sharma')).toBeInTheDocument();
      expect(screen.getAllByText('BK-2026-001').length).toBeGreaterThanOrEqual(1);

      // Section 3: Payment Gateway Details
      expect(screen.getByText(/Payment Gateway Details/i)).toBeInTheDocument();
      expect(screen.getByText('pay_live_gateway_123')).toBeInTheDocument();
      expect(screen.getByText('pay_U16TxpAreitv7V')).toBeInTheDocument();
      expect(screen.getByText('order_U16TNAgoILixfd')).toBeInTheDocument();

      // Section 4: Fee and Tax Calculation Ledger (Verifying full 3 rows are present)
      expect(screen.getByText(/Platform Fee & Tax Calculation Ledger \(INR\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Platform Base Charge/i)).toBeInTheDocument();
      expect(screen.getByText(/₹423.73/i)).toBeInTheDocument();
      expect(screen.getByText(/Applicable GST \(18% Goods & Services Tax\)/i)).toBeInTheDocument();
      expect(screen.getByText(/₹76.27/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Invoice \/ Collected Amount/i)).toBeInTheDocument();

      // Section 5: Refund Settlement Details
      expect(screen.getByText(/Refund Settlement Details: Pending Gateway Settlement/i)).toBeInTheDocument();

      // Section 6: Refund Audit History & Governance
      expect(screen.getByText(/Refund Audit History & Governance/i)).toBeInTheDocument();
      expect(screen.getByText(/Customer requested cancellation for cook booking/i)).toBeInTheDocument();
      expect(screen.getByText('01a11eec-ff90-73c8-972a-b88e3151ada0')).toBeInTheDocument();
    });

    it('renders Retry Settlement button for REFUND_PENDING and invokes callback', async () => {
      const user = userEvent.setup();
      const onProcessRefundMock = vi.fn();

      useAuthStore.setState({
        user: mockSuperAdminUser as never,
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <TransactionDetailModal
            isOpen={true}
            transaction={refundPendingTxn}
            onClose={vi.fn()}
            onProcessRefund={onProcessRefundMock}
            onVerifyPaymentStatus={vi.fn()}
          />
        </MemoryRouter>
      );

      const retryBtn = screen.getByTestId('retry-settlement-button');
      expect(retryBtn).toBeInTheDocument();
      expect(retryBtn).toHaveTextContent(/Retry Settlement/i);

      await user.click(retryBtn);
      expect(onProcessRefundMock).toHaveBeenCalledWith(refundPendingTxn);
    });

    it('renders concise dismissible inline feedback banner without oversized error layout', async () => {
      const user = userEvent.setup();

      useAuthStore.setState({
        user: mockSuperAdminUser as never,
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <TransactionDetailModal
            isOpen={true}
            transaction={refundPendingTxn}
            onClose={vi.fn()}
            feedback={{
              type: 'info',
              message: 'Payment gateway is temporarily unavailable. Authoritative backend status verified: Refund Pending.',
            }}
          />
        </MemoryRouter>
      );

      const banner = screen.getByTestId('modal-feedback-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent(/Payment gateway is temporarily unavailable/i);

      // Dismiss alert
      const dismissBtn = screen.getByRole('button', { name: /Dismiss alert/i });
      await user.click(dismissBtn);
      expect(screen.queryByTestId('modal-feedback-banner')).not.toBeInTheDocument();
    });

    it('does not display refund or retry buttons for already REFUNDED transactions', () => {
      const refundedTxn: PaymentTransaction = {
        ...dummyTransaction,
        status: 'REFUNDED',
        refundStatus: 'REFUNDED',
      };

      useAuthStore.setState({
        user: mockSuperAdminUser as never,
        isAuthenticated: true,
      });

      render(
        <MemoryRouter>
          <TransactionDetailModal
            isOpen={true}
            transaction={refundedTxn}
            onClose={vi.fn()}
            onProcessRefund={vi.fn()}
            onVerifyPaymentStatus={vi.fn()}
          />
        </MemoryRouter>
      );

      expect(screen.queryByTestId('process-refund-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('retry-settlement-button')).not.toBeInTheDocument();
    });
  });

  describe('5. Row-level Actions & Resilience on Payments Page', () => {
    it('renders Reconcile action button on table rows for REFUND_PENDING transactions', async () => {
      const refundPendingTxn: PaymentTransaction = {
        ...dummyTransaction,
        id: '01a1e7ab-6e19-71ac-b565-4d320ba468f5',
        status: 'REFUND_PENDING',
        refundStatus: 'REFUND_PENDING',
      };

      vi.spyOn(paymentRepository, 'getTransactions').mockResolvedValue({
        items: [refundPendingTxn],
        totalCount: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
        totalGrossCollectionsINR: 500,
      });
      vi.spyOn(paymentRepository, 'getFinancialOverview').mockResolvedValue({
        grossSettledCollectionsINR: 500,
        totalLedgerRecords: 1,
        totalRefundedINR: 0,
      });

      renderPaymentsPage();

      const reconcileBtn = await screen.findByTitle(/Reconcile refund status with payment gateway/i);
      expect(reconcileBtn).toBeInTheDocument();
      expect(reconcileBtn).toHaveTextContent(/Reconcile/i);
    });
  });
});
