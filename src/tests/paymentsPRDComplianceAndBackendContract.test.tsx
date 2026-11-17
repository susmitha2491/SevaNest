/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { PaymentsListPage } from '../features/payments/presentation/PaymentsListPage';
import { RealPaymentRepository } from '../features/payments/data/paymentRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { httpClient } from '../core/api/httpClient';

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

describe('Payments Module — PRD Compliance & Backend Contract Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. RBAC & Personas Enforcement', () => {
    it('restricts refund initiation buttons from Operations Admin who holds only payment.view', async () => {
      useAuthStore.setState({
        user: {
          id: 'ops-user-01',
          name: 'Operations Manager',
          email: 'ops@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.PAYMENTS_VIEW,
            PERMISSIONS.BOOKINGS_VIEW,
          ],
        },
        isAuthenticated: true,
      });

      renderWithProviders(<PaymentsListPage />);

      expect(await screen.findByRole('heading', { name: /Financial Transactions/i })).toBeInTheDocument();
      // Wait for table to load
      expect(await screen.findByText('TXN-892104')).toBeInTheDocument();

      // No row refund buttons or initiate refund modal triggers should exist for Operations Admin
      expect(screen.queryByRole('button', { name: /^Refund$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Initiate Audited Refund/i })).not.toBeInTheDocument();
    });

    it('renders refund action for Super Admin holding payment.refund permission', async () => {
      useAuthStore.setState({
        user: {
          id: 'super-admin-01',
          name: 'Super Admin',
          email: 'sevanest@admin.in',
          role: 'SUPER_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.PAYMENTS_VIEW,
            PERMISSIONS.REFUNDS_MANAGE, // maps to payment.refund
            PERMISSIONS.PAYMENT_MANAGE,
            PERMISSIONS.BOOKINGS_VIEW,
          ],
        },
        isAuthenticated: true,
      });

      renderWithProviders(<PaymentsListPage />);

      expect(await screen.findByRole('heading', { name: /Financial Transactions/i })).toBeInTheDocument();
      expect(await screen.findByText('TXN-892104')).toBeInTheDocument();

      // Super Admin should see row refund button for paid transactions
      const refundButtons = await screen.findAllByRole('button', { name: /^Refund$/i });
      expect(refundButtons.length).toBeGreaterThan(0);
    });

    it('denies module access entirely when user lacks payments.view', async () => {
      useAuthStore.setState({
        user: {
          id: 've-user-01',
          name: 'Verification Officer',
          email: 've@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.VERIFICATION_REVIEW],
        },
        isAuthenticated: true,
      });

      renderWithProviders(<PaymentsListPage />);

      expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Financial Transactions/i })).not.toBeInTheDocument();
    });
  });

  describe('2. PRD Commercial Revenue Streams & Fee Records Tab', () => {
    it('switches to Fee Records tab and displays commercial fee categories', async () => {
      const user = userEvent.setup();
      useAuthStore.setState({
        user: {
          id: 'super-admin-01',
          name: 'Super Admin',
          email: 'sevanest@admin.in',
          role: 'SUPER_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.PAYMENTS_VIEW,
            PERMISSIONS.CONFIGURATION_MANAGE,
          ],
        },
        isAuthenticated: true,
      });

      renderWithProviders(<PaymentsListPage />);

      expect(await screen.findByRole('heading', { name: /Financial Transactions/i })).toBeInTheDocument();

      // Click Fee Records tab
      const feeTab = screen.getByRole('button', { name: /Fee Records & Revenue Streams/i });
      await user.click(feeTab);

      // Verify PRD revenue stream framework details
      expect(await screen.findByText(/PRD Commercial Revenue Streams & Configured Rates/i)).toBeInTheDocument();
      expect(screen.getByText(/Configure in Pricing Plans/i)).toBeInTheDocument();

      // Verify fee items
      expect(await screen.findByText('BOOKING_FEE')).toBeInTheDocument();
      expect(screen.getByText('CANCELLATION_FEE')).toBeInTheDocument();
      expect(screen.getByText('PLACEMENT_FEE')).toBeInTheDocument();
      expect(screen.getByText('VERIFICATION_FEE')).toBeInTheDocument();
      expect(screen.getByText('REPLACEMENT_PLAN_FEE')).toBeInTheDocument();
    });
  });

  describe('3. Audited Refund Processing Modal Workflow', () => {
    it('opens refund modal, validates approval checkbox and reason, and invokes processRefund', async () => {
      const user = userEvent.setup();
      useAuthStore.setState({
        user: {
          id: 'super-admin-01',
          name: 'Super Admin',
          email: 'sevanest@admin.in',
          role: 'SUPER_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.PAYMENTS_VIEW,
            PERMISSIONS.REFUNDS_MANAGE,
          ],
        },
        isAuthenticated: true,
      });

      renderWithProviders(<PaymentsListPage />);

      const refundButtons = await screen.findAllByRole('button', { name: /^Refund$/i });
      await user.click(refundButtons[0]);

      // Refund modal should open
      expect(await screen.findByRole('heading', { name: /Approve & Initiate Full Refund/i })).toBeInTheDocument();
      expect(screen.getByText(/Payment Reference:/i)).toBeInTheDocument();

      // Enter reason
      const reasonInput = screen.getByLabelText(/Operational Justification Reason/i);
      await user.type(reasonInput, 'Candidate failed initial trial period. Approved full refund per policy.');

      // Check explicit APPROVE checkbox
      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      // Submit
      const confirmBtn = screen.getByRole('button', { name: /Confirm & Authorize Refund/i });
      await user.click(confirmBtn);

      // Success feedback banner
      await waitFor(() => {
        expect(screen.getByTestId('action-feedback-banner')).toHaveTextContent(/Refund successfully processed and audited/i);
      });
    });
  });

  describe('4. Real Backend API Integration Contract', () => {
    it('calls POST /admin/payments/:id/refund with exact { approval: "APPROVE", reason } contract', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValue({ data: [] } as never);
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          id: 'test-payment-uuid',
          status: 'REFUNDED',
          refundStatus: 'REFUNDED',
        },
      } as never);

      const repo = new RealPaymentRepository();
      await repo.processRefund('test-payment-uuid', {
        approval: 'APPROVE',
        reason: 'Customer cancelled booking prior to commencement.',
      });

      expect(postSpy).toHaveBeenCalledWith('/admin/payments/test-payment-uuid/refund', {
        approval: 'APPROVE',
        reason: 'Customer cancelled booking prior to commencement.',
      });
    });

    it('calls GET /admin/fees and parses backend fee catalog correctly', async () => {
      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: [
          {
            code: 'BOOKING_FEE',
            kind: 'BOOKING',
            amountMinor: 50000,
            currency: 'INR',
            isActive: true,
            updatedAt: '2026-10-09T04:41:43.293Z',
          },
          {
            code: 'PLACEMENT_FEE',
            kind: 'PLACEMENT',
            amountMinor: 150000,
            currency: 'INR',
            isActive: false,
            updatedAt: '2026-10-15T00:00:00.000Z',
          },
        ],
      } as any);

      const repo = new RealPaymentRepository();
      const fees = await repo.getFeeRecords();

      expect(fees.length).toBe(2);
      expect(fees[0].code).toBe('BOOKING_FEE');
      expect(fees[0].amountINR).toBe(500);
      expect(fees[0].isActive).toBe(true);
      expect(fees[1].code).toBe('PLACEMENT_FEE');
      expect(fees[1].amountINR).toBe(1500);
      expect(fees[1].isActive).toBe(false);
    });

    it('calls GET /admin/payments-export with exact from and to parameters', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: 'payment_id,booking_id,status,amount_minor\n01a1,01b1,SUCCEEDED,50000',
      } as any);

      const repo = new RealPaymentRepository();
      const csv = await repo.exportPaymentsCsv('2026-10-01', '2026-10-31');

      expect(getSpy).toHaveBeenCalledWith('/admin/payments-export', {
        params: { from: '2026-10-01', to: '2026-10-31' },
        responseType: 'text',
      });
      expect(csv).toContain('payment_id,booking_id,status,amount_minor');
    });

    it('queries authoritative GET /admin/reports/payment-collections for financial metrics', async () => {
      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/reports/payment-collections') {
          return {
            data: {
              data: {
                totalsByFeeType: [
                  { feeCode: 'BOOKING_FEE', grossMinor: 700000, refundedMinor: 50000 },
                ],
              },
            },
          } as any;
        }
        if (url === '/admin/payments') {
          return {
            data: { meta: { total: 17 } },
          } as any;
        }
        return { data: {} } as any;
      });

      const repo = new RealPaymentRepository();
      const overview = await repo.getFinancialOverview('2026-10-01', '2026-11-16');

      expect(overview.grossSettledCollectionsINR).toBe(7000);
      expect(overview.totalRefundedINR).toBe(500);
      expect(overview.totalLedgerRecords).toBe(17);
    });
  });
});
