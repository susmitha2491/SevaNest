import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { PaymentsListPage } from '../features/payments/presentation/PaymentsListPage';
import { TransactionDetailModal } from '../features/payments/presentation/TransactionDetailModal';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { paymentRepository, RealPaymentRepository } from '../features/payments/data/paymentRepository';
import { httpClient } from '../core/api/httpClient';
import { PaymentTransaction } from '../features/payments/domain/types';

const MOCK_PAID_TRANSACTION: PaymentTransaction = {
  id: 'TXN-PAID-001',
  bookingId: 'B-001',
  bookingRef: 'BK-2026-001',
  customerId: 'CUST-001',
  customerName: 'Aarav Patel',
  customerPhone: '+91 98765 43210',
  customerPhoneMasked: '+91 98*** 43210',
  serviceCategory: 'House Maid',
  feeDescription: 'Initial Matching & Candidate Shortlist Fee',
  feeType: 'BOOKING_FEE',
  amountINR: 500,
  status: 'PAID',
  paymentMethod: 'UPI',
  gatewayRef: 'pay_gateway_12345',
  timestamp: '2026-11-15T10:00:00.000Z',
  createdAt: '2026-11-15T10:00:00.000Z',
  breakdown: {
    baseAmount: 423.73,
    gstAmount: 76.27,
    platformCommission: 500,
  },
};

const MOCK_PENDING_TRANSACTION: PaymentTransaction = {
  ...MOCK_PAID_TRANSACTION,
  id: 'TXN-PENDING-002',
  status: 'PENDING',
};

const MOCK_FAILED_TRANSACTION: PaymentTransaction = {
  ...MOCK_PAID_TRANSACTION,
  id: 'TXN-FAILED-003',
  status: 'FAILED',
};

const MOCK_REFUNDED_TRANSACTION: PaymentTransaction = {
  ...MOCK_PAID_TRANSACTION,
  id: 'TXN-REFUNDED-004',
  status: 'REFUNDED',
  refundStatus: 'REFUNDED',
  refundedAt: '2026-11-16T12:00:00.000Z',
  refund: {
    refundStatus: 'REFUNDED',
    refundAmountINR: 500,
    refundedAt: '2026-11-16T12:00:00.000Z',
    refundReason: 'Customer requested cancellation before trial',
    refundedByUserId: 'super-admin-01',
  },
};

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

describe('Payment Transaction Details Modal — Action Buttons Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      user: {
        id: 'super-admin-01',
        name: 'Super Admin',
        email: 'sevanest@admin.in',
        role: 'SUPER_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.PAYMENTS_VIEW,
          PERMISSIONS.PAYMENT_MANAGE,
          PERMISSIONS.REFUNDS_MANAGE,
          PERMISSIONS.BOOKINGS_VIEW,
        ],
      },
      isAuthenticated: true,
    });
  });

  describe('1. Action Button Naming & UI Renaming', () => {
    it('renders "Verify Payment Status" and "Process Refund" with updated names and test IDs', () => {
      renderWithProviders(
        <TransactionDetailModal
          transaction={MOCK_PAID_TRANSACTION}
          isOpen={true}
          onClose={() => {}}
          onVerifyPaymentStatus={vi.fn()}
          onProcessRefund={vi.fn()}
        />
      );

      // Verify Payment Status button
      const verifyBtn = screen.getByRole('button', { name: /Verify Payment Status/i });
      expect(verifyBtn).toBeInTheDocument();
      expect(screen.getByTestId('verify-payment-status-button')).toBe(verifyBtn);

      // Process Refund button
      const refundBtn = screen.getByRole('button', { name: /Process Refund/i });
      expect(refundBtn).toBeInTheDocument();
      expect(screen.getByTestId('process-refund-button')).toBe(refundBtn);

      // Old button labels must not exist
      expect(screen.queryByRole('button', { name: /Reconcile with Gateway/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Initiate Audited Refund/i })).not.toBeInTheDocument();
    });
  });

  describe('2. "Verify Payment Status" Action & Permissions', () => {
    it('hides "Verify Payment Status" button when user lacks payment.manage permission', () => {
      useAuthStore.setState({
        user: {
          id: 'ops-admin-01',
          name: 'Operations Manager',
          email: 'ops@sevanest.local',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.PAYMENTS_VIEW,
            // Lacks PAYMENT_MANAGE and REFUNDS_MANAGE
          ],
        },
        isAuthenticated: true,
      });

      renderWithProviders(
        <TransactionDetailModal
          transaction={MOCK_PAID_TRANSACTION}
          isOpen={true}
          onClose={() => {}}
          onVerifyPaymentStatus={vi.fn()}
          onProcessRefund={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /Verify Payment Status/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId('verify-payment-status-button')).not.toBeInTheDocument();
    });

    it('hides "Verify Payment Status" when transaction status is REFUNDED', () => {
      renderWithProviders(
        <TransactionDetailModal
          transaction={MOCK_REFUNDED_TRANSACTION}
          isOpen={true}
          onClose={() => {}}
          onVerifyPaymentStatus={vi.fn()}
          onProcessRefund={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /Verify Payment Status/i })).not.toBeInTheDocument();
    });

    it('displays "Verifying..." and disables button while verification is in progress (prevents duplicate submission)', () => {
      renderWithProviders(
        <TransactionDetailModal
          transaction={MOCK_PENDING_TRANSACTION}
          isOpen={true}
          onClose={() => {}}
          onVerifyPaymentStatus={vi.fn()}
          isVerifying={true}
        />
      );

      const verifyBtn = screen.getByRole('button', { name: /Verifying\.\.\./i });
      expect(verifyBtn).toBeInTheDocument();
      expect(verifyBtn).toBeDisabled();
    });

    it('executes verification workflow, compares status with gateway, and shows feedback banner', async () => {
      const user = userEvent.setup();
      const mockReconcile = vi.spyOn(paymentRepository, 'reconcilePayment').mockResolvedValueOnce({
        ...MOCK_PENDING_TRANSACTION,
        status: 'PAID',
      });

      renderWithProviders(<PaymentsListPage />);

      // Open a transaction
      const viewButtons = await screen.findAllByRole('button', { name: /View/i });
      await user.click(viewButtons[0]);

      // Click Verify Payment Status
      const verifyBtn = await screen.findByRole('button', { name: /Verify Payment Status/i });
      await user.click(verifyBtn);

      expect(mockReconcile).toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByTestId('modal-feedback-banner')).toBeInTheDocument();
      });
    });

    it('displays error feedback when verification API fails', async () => {
      const user = userEvent.setup();
      vi.spyOn(paymentRepository, 'reconcilePayment').mockRejectedValueOnce(
        new Error('Gateway timeout: unable to reach payment provider.')
      );

      renderWithProviders(<PaymentsListPage />);

      const viewButtons = await screen.findAllByRole('button', { name: /View/i });
      await user.click(viewButtons[0]);

      const verifyBtn = await screen.findByRole('button', { name: /Verify Payment Status/i });
      await user.click(verifyBtn);

      await waitFor(() => {
        expect(screen.getByTestId('modal-feedback-banner')).toHaveTextContent(/Failed to verify payment status: Gateway timeout/i);
      });
    });
  });

  describe('3. "Process Refund" Action & Permissions', () => {
    it('hides "Process Refund" button when user lacks refunds.manage permission', () => {
      useAuthStore.setState({
        user: {
          id: 'ops-admin-01',
          name: 'Operations Manager',
          email: 'ops@sevanest.local',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.PAYMENTS_VIEW,
            PERMISSIONS.PAYMENT_MANAGE,
            // Lacks REFUNDS_MANAGE
          ],
        },
        isAuthenticated: true,
      });

      renderWithProviders(
        <TransactionDetailModal
          transaction={MOCK_PAID_TRANSACTION}
          isOpen={true}
          onClose={() => {}}
          onProcessRefund={vi.fn()}
        />
      );

      expect(screen.queryByRole('button', { name: /Process Refund/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId('process-refund-button')).not.toBeInTheDocument();
    });

    it('hides "Process Refund" for non-paid statuses (FAILED, PENDING, REFUNDED)', () => {
      const { rerender } = renderWithProviders(
        <TransactionDetailModal
          transaction={MOCK_FAILED_TRANSACTION}
          isOpen={true}
          onClose={() => {}}
          onProcessRefund={vi.fn()}
        />
      );
      expect(screen.queryByRole('button', { name: /Process Refund/i })).not.toBeInTheDocument();

      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <TransactionDetailModal
              transaction={MOCK_PENDING_TRANSACTION}
              isOpen={true}
              onClose={() => {}}
              onProcessRefund={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );
      expect(screen.queryByRole('button', { name: /Process Refund/i })).not.toBeInTheDocument();

      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <TransactionDetailModal
              transaction={MOCK_REFUNDED_TRANSACTION}
              isOpen={true}
              onClose={() => {}}
              onProcessRefund={vi.fn()}
            />
          </MemoryRouter>
        </QueryClientProvider>
      );
      expect(screen.queryByRole('button', { name: /Process Refund/i })).not.toBeInTheDocument();
    });

    it('opens refund confirmation modal from Transaction Details, requires reason & approval checkbox, and submits', async () => {
      const user = userEvent.setup();
      const refundSpy = vi.spyOn(paymentRepository, 'processRefund').mockResolvedValueOnce({
        ...MOCK_PAID_TRANSACTION,
        status: 'REFUNDED',
        refundStatus: 'REFUNDED',
      });

      renderWithProviders(<PaymentsListPage />);

      // Open Paid transaction
      const viewButtons = await screen.findAllByRole('button', { name: /View/i });
      await user.click(viewButtons[0]);

      // Click Process Refund in detail modal
      const processRefundBtn = await screen.findByRole('button', { name: /Process Refund/i });
      await user.click(processRefundBtn);

      // Refund confirmation modal opens
      expect(await screen.findByRole('heading', { name: /Approve & Initiate Full Refund/i })).toBeInTheDocument();

      // Submit should initially be disabled
      const submitBtn = screen.getByRole('button', { name: /Confirm & Authorize Refund/i });
      expect(submitBtn).toBeDisabled();

      // Fill in operational reason
      const reasonInput = screen.getByLabelText(/Operational Justification Reason/i);
      await user.type(reasonInput, 'Candidate failed onboarding background check.');

      // Check approval checkbox
      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(submitBtn).toBeEnabled();
      await user.click(submitBtn);

      await waitFor(() => {
        expect(refundSpy).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            approval: 'APPROVE',
            reason: 'Candidate failed onboarding background check.',
          })
        );
      });
    });

    it('shows pending message when backend returns REFUND_PENDING', async () => {
      const user = userEvent.setup();
      vi.spyOn(paymentRepository, 'processRefund').mockResolvedValueOnce({
        ...MOCK_PAID_TRANSACTION,
        status: 'REFUND_PENDING',
        refundStatus: 'REFUND_PENDING',
      });

      renderWithProviders(<PaymentsListPage />);

      const viewButtons = await screen.findAllByRole('button', { name: /View/i });
      await user.click(viewButtons[0]);

      const processRefundBtn = await screen.findByRole('button', { name: /Process Refund/i });
      await user.click(processRefundBtn);

      const reasonInput = await screen.findByLabelText(/Operational Justification Reason/i);
      await user.type(reasonInput, 'Customer requested service cancellation.');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /Confirm & Authorize Refund/i }));

      await waitFor(() => {
        expect(screen.getByTestId('action-feedback-banner')).toHaveTextContent(/pending gateway settlement/i);
      });
    });

    it('shows error banner when backend returns REFUND_FAILED', async () => {
      const user = userEvent.setup();
      vi.spyOn(paymentRepository, 'processRefund').mockResolvedValueOnce({
        ...MOCK_PAID_TRANSACTION,
        status: 'REFUND_FAILED',
        refundStatus: 'REFUND_FAILED',
      });

      renderWithProviders(<PaymentsListPage />);

      const viewButtons = await screen.findAllByRole('button', { name: /View/i });
      await user.click(viewButtons[0]);

      const processRefundBtn = await screen.findByRole('button', { name: /Process Refund/i });
      await user.click(processRefundBtn);

      const reasonInput = await screen.findByLabelText(/Operational Justification Reason/i);
      await user.type(reasonInput, 'Customer requested service cancellation.');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /Confirm & Authorize Refund/i }));

      await waitFor(() => {
        expect(screen.getByTestId('action-feedback-banner')).toHaveTextContent(/failed at payment gateway/i);
      });
    });
  });

  describe('4. Real Backend HTTP Contract Verification', () => {
    it('calls POST /admin/payments/:id/reconcile and maps backend AdminPaymentView to domain', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValue({ data: [] } as never);
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          id: 'test-reconcile-uuid',
          bookingId: 'booking-uuid-1',
          status: 'SUCCEEDED',
          amountMinor: 50000,
          currency: 'INR',
          receiptNumber: 'REC-12345',
          paidAt: '2026-11-15T10:00:00Z',
          refundStatus: null,
          refundedAt: null,
          createdAt: '2026-11-15T09:00:00Z',
          paymentMethod: 'upi',
          paymentMethodDetail: 'user@okaxis',
          gatewayReference: 'pay_live_gateway_ref_999',
          failureCode: null,
          failureReason: null,
          customerUserId: 'cust-uuid-1',
          feeCode: 'BOOKING_FEE',
          providerOrderId: 'order_123',
          providerPaymentId: 'pay_live_gateway_ref_999',
          refundReason: null,
          refundedByUserId: null,
        },
      } as never);

      const repo = new RealPaymentRepository();
      const result = await repo.reconcilePayment('test-reconcile-uuid');

      expect(postSpy).toHaveBeenCalledWith('/admin/payments/test-reconcile-uuid/reconcile');
      expect(result.id).toBe('test-reconcile-uuid');
      expect(result.status).toBe('PAID'); // mapped from SUCCEEDED
      expect(result.gatewayRef).toBe('pay_live_gateway_ref_999');
      expect(result.amountINR).toBe(500);
    });

    it('calls POST /admin/payments/:id/refund with { approval: "APPROVE", reason }', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValue({ data: [] } as never);
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          id: 'test-refund-uuid',
          bookingId: 'booking-uuid-2',
          status: 'REFUNDED',
          amountMinor: 50000,
          currency: 'INR',
          receiptNumber: 'REC-12345',
          paidAt: '2026-11-15T10:00:00Z',
          refundStatus: 'REFUNDED',
          refundedAt: '2026-11-16T12:00:00Z',
          createdAt: '2026-11-15T09:00:00Z',
          paymentMethod: 'upi',
          paymentMethodDetail: 'user@okaxis',
          gatewayReference: 'pay_live_gateway_ref_999',
          failureCode: null,
          failureReason: null,
          customerUserId: 'cust-uuid-2',
          feeCode: 'BOOKING_FEE',
          providerOrderId: 'order_123',
          providerPaymentId: 'pay_live_gateway_ref_999',
          refundReason: 'Customer refund approved',
          refundedByUserId: 'super-admin-01',
        },
      } as never);

      const repo = new RealPaymentRepository();
      const result = await repo.processRefund('test-refund-uuid', {
        approval: 'APPROVE',
        reason: 'Customer refund approved',
      });

      expect(postSpy).toHaveBeenCalledWith('/admin/payments/test-refund-uuid/refund', {
        approval: 'APPROVE',
        reason: 'Customer refund approved',
      });
      expect(result.status).toBe('REFUNDED');
      expect(result.refundStatus).toBe('REFUNDED');
    });
  });
});

