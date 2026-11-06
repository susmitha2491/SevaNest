/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RealPaymentRepository,
  isIdLike,
  clearCustomerRegistryCache,
} from '../features/payments/data/paymentRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { httpClient } from '../core/api/httpClient';

describe('Payment Management Module — Enterprise Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearCustomerRegistryCache();
    useAuthStore.setState({
      user: {
        id: 'STAFF-OPS-01',
        name: 'Operations Admin',
        email: 'ops@sevanest.in',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.PAYMENTS_VIEW,
          PERMISSIONS.REFUNDS_MANAGE,
        ],
      },
      isAuthenticated: true,
    });
  });

  describe('Customer Name Resolution & Anti-UUID Enforcement', () => {
    it('isIdLike correctly flags UUIDs and generic placeholders', () => {
      expect(isIdLike('01a17bcf-d1a5-714e-bf97-7a9a6cefe4a0')).toBe(true);
      expect(isIdLike('Customer (01a17bcf)')).toBe(true);
      expect(isIdLike('Customer')).toBe(true);
      expect(isIdLike('unknown')).toBe(true);
      expect(isIdLike('01a17bcfd1a5714ebf977a9a6cefe4a0')).toBe(true);

      // Authentic names should NOT be id-like
      expect(isIdLike('Polo')).toBe(false);
      expect(isIdLike('Meera Subramanian')).toBe(false);
      expect(isIdLike('Ajay Nagirikanti')).toBe(false);
    });

    it('resolves authentic customer names from backend customer registry across pages', async () => {
      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: any) => {
        if (url === '/admin/customers') {
          const page = config?.params?.page || 1;
          if (page === 1) {
            return {
              data: {
                success: true,
                data: [
                  {
                    id: 'cust-id-1',
                    userId: 'usr-uuid-1',
                    name: 'Meera Subramanian',
                    phone: '+91 98765 02030',
                  },
                ],
                meta: { total: 2, page: 1, limit: 1 },
              },
            } as any;
          } else {
            return {
              data: {
                success: true,
                data: [
                  {
                    id: 'cust-id-2',
                    userId: 'usr-uuid-2',
                    name: 'Polo',
                    phone: '+91 98765 01032',
                  },
                ],
                meta: { total: 2, page: 2, limit: 1 },
              },
            } as any;
          }
        }
        if (url === '/admin/payments') {
          return {
            data: {
              success: true,
              data: [
                {
                  id: '01a11ef9-test-payment-id',
                  bookingId: '01a17c40-97f6-72ef-bb5c-4046eeef51cb',
                  status: 'SUCCEEDED',
                  amountMinor: 50000,
                  currency: 'INR',
                  customerUserId: 'usr-uuid-1',
                  feeCode: 'BOOKING_FEE',
                },
                {
                  id: '01a17d02-failed-payment-id',
                  bookingId: '01a17c40-97f6-72ef-bb5c-4046eeef51cc',
                  status: 'FAILED',
                  amountMinor: 50000,
                  currency: 'INR',
                  customerUserId: 'usr-uuid-2',
                  feeCode: 'BOOKING_FEE',
                  failureReason: 'BOOKING_CANCELLED',
                },
                {
                  id: '01a17d03-unmatched-payment-id',
                  bookingId: '01a17c40-97f6-72ef-bb5c-4046eeef51cd',
                  status: 'SUCCEEDED',
                  amountMinor: 50000,
                  currency: 'INR',
                  customerUserId: 'usr-uuid-999-missing',
                  feeCode: 'BOOKING_FEE',
                },
              ],
              meta: { total: 3, page: 1, limit: 10 },
            },
          } as any;
        }
        return { data: { success: true, data: [] } } as any;
      });

      const repo = new RealPaymentRepository();
      const result = await repo.getTransactions();

      expect(result.items.length).toBe(3);

      // Item 1: Resolved to Meera Subramanian
      expect(result.items[0].customerName).toBe('Meera Subramanian');
      expect(result.items[0].customerName).not.toContain('Customer (');

      // Item 2: Resolved to Polo
      expect(result.items[1].customerName).toBe('Polo');
      expect(result.items[1].customerName).not.toContain('Customer (');
      expect(result.items[1].failureReason).toBe('BOOKING_CANCELLED');

      // Item 3: Missing customer handled honestly without UUID
      expect(result.items[2].customerName).toBe('Customer Details Unavailable');
      expect(result.items[2].customerName).not.toContain('usr-uuid-999');
    });

    it('resolves and formats complete unmasked customer mobile number from backend customer profile', async () => {
      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/customers') {
          return {
            data: {
              success: true,
              data: [
                {
                  id: '01a11ef5-e72f-7029-a22a-cfd1c86da283',
                  userId: '01a11ef5-e4d9-72a5-a78c-9dded10997f1',
                  name: 'Meera Subramanian',
                  mobile: '+91******0203',
                },
              ],
              meta: { total: 1, page: 1, limit: 100 },
            },
          } as any;
        }
        if (url === '/admin/customers/01a11ef5-e72f-7029-a22a-cfd1c86da283') {
          return {
            data: {
              id: '01a11ef5-e72f-7029-a22a-cfd1c86da283',
              name: 'Meera Subramanian',
              mobile: '+919000000203',
            },
          } as any;
        }
        if (url === '/admin/payments') {
          return {
            data: {
              success: true,
              data: [
                {
                  id: '01a11ef9-320a-71a1-83f5-f422e3786b72',
                  bookingId: '01a11ef9-booking',
                  status: 'SUCCEEDED',
                  amountMinor: 50000,
                  currency: 'INR',
                  customerUserId: '01a11ef5-e4d9-72a5-a78c-9dded10997f1',
                  feeCode: 'BOOKING_FEE',
                },
              ],
              meta: { total: 1, page: 1, limit: 10 },
            },
          } as any;
        }
        return { data: {} } as any;
      });

      const repo = new RealPaymentRepository();
      const res = await repo.getTransactions();

      expect(res.items.length).toBe(1);
      const txn = res.items[0];
      expect(txn.customerName).toBe('Meera Subramanian');
      expect(txn.customerPhoneMasked).toBe('+91 90000 00203');
      expect(txn.customerPhone).toBe('+91 90000 00203');
      expect(txn.customerPhoneMasked).not.toContain('*');
    });
  });

  describe('Financial Overview Summary Metrics from Backend APIs', () => {
    it('queries authoritative reports and ledger count for gross collections, pending refunds, and total records', async () => {
      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, config?: any) => {
        if (url === '/admin/reports/payment-collections') {
          return {
            data: {
              data: {
                totalsByFeeType: [
                  { feeCode: 'BOOKING_FEE', payments: 7, grossMinor: 350000, refundedMinor: 0 },
                ],
              },
            },
          } as any;
        }
        if (url === '/admin/payments') {
          if (config?.params?.status === 'REFUND_PENDING') {
            return {
              data: {
                meta: { total: 0 },
                data: [],
              },
            } as any;
          }
          if (config?.params?.limit === 1) {
            return {
              data: {
                meta: { total: 9 },
                data: [],
              },
            } as any;
          }
        }
        return { data: { success: true } } as any;
      });

      const repo = new RealPaymentRepository();
      const overview = await repo.getFinancialOverview();

      expect(overview.grossSettledCollectionsINR).toBe(3500);
      expect(overview.pendingRefundsCount).toBe(0);
      expect(overview.totalLedgerRecords).toBe(9);
    });
  });

  describe('Status Tabs & Filter Mapping', () => {
    it('maps UI tabs to correct backend status queries', async () => {
      const getSpy = vi.spyOn(httpClient, 'get').mockImplementation(async (url: string, _config?: any) => {
        if (url === '/admin/customers') {
          return { data: { success: true, data: [] } } as any;
        }
        if (url === '/admin/payments') {
          return {
            data: {
              success: true,
              data: [],
              meta: { total: 0, page: 1, limit: 10 },
            },
          } as any;
        }
        return { data: {} } as any;
      });

      const repo = new RealPaymentRepository();

      // ALL: no status param
      await repo.getTransactions({ status: 'ALL' });
      expect(getSpy).toHaveBeenLastCalledWith(
        '/admin/payments',
        expect.objectContaining({ params: expect.not.objectContaining({ status: expect.anything() }) })
      );

      // PAID: status=SUCCEEDED
      await repo.getTransactions({ status: 'PAID' });
      expect(getSpy).toHaveBeenLastCalledWith(
        '/admin/payments',
        expect.objectContaining({ params: expect.objectContaining({ status: 'SUCCEEDED' }) })
      );

      // PAYMENT_FAILED: status=FAILED
      await repo.getTransactions({ status: 'PAYMENT_FAILED' });
      expect(getSpy).toHaveBeenLastCalledWith(
        '/admin/payments',
        expect.objectContaining({ params: expect.objectContaining({ status: 'FAILED' }) })
      );

      // REFUND_PENDING: status=REFUND_PENDING
      await repo.getTransactions({ status: 'REFUND_PENDING' });
      expect(getSpy).toHaveBeenLastCalledWith(
        '/admin/payments',
        expect.objectContaining({ params: expect.objectContaining({ status: 'REFUND_PENDING' }) })
      );

      // REFUNDED: status=REFUNDED
      await repo.getTransactions({ status: 'REFUNDED' });
      expect(getSpy).toHaveBeenLastCalledWith(
        '/admin/payments',
        expect.objectContaining({ params: expect.objectContaining({ status: 'REFUNDED' }) })
      );
    });
  });

  describe('Refund Authorization Workflow', () => {
    it('executes full refund via POST /admin/payments/{id}/refund with reason and Idempotency-Key header', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValue({
        data: { success: true },
      } as any);

      const repo = new RealPaymentRepository();
      await repo.processRefund(
        'pay-test-123',
        500,
        'UNSATISFACTORY_TRIAL',
        'Customer requested replacement before trial completion',
        'idem_key_manual_999'
      );

      expect(postSpy).toHaveBeenCalledWith(
        '/admin/payments/pay-test-123/refund',
        {
          reason: 'UNSATISFACTORY_TRIAL: Customer requested replacement before trial completion',
        },
        expect.objectContaining({
          headers: expect.objectContaining({ 'Idempotency-Key': 'idem_key_manual_999' }),
        })
      );
    });
  });
});
