/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  RealPaymentRepository,
  isIdLike,
  isInvalidCustomerName,
  formatBookingReference,
  clearCustomerRegistryCache,
  clearBookingRegistryCache,
} from '../features/payments/data/paymentRepository';
import { STATUS_MAPPINGS } from '../shared/constants/statusLabels';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { httpClient } from '../core/api/httpClient';

describe('Payment Management Module — Enterprise Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearCustomerRegistryCache();
    clearBookingRegistryCache();
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
    });
  });

  describe('Customer Resolution & Identifier Separation', () => {
    it('flags actual invalid placeholders and UUIDs as invalid customer names while allowing real names', () => {
      expect(isInvalidCustomerName('')).toBe(true);
      expect(isInvalidCustomerName('01a192ee-1a73-7449-9822-da9ac3221ef2')).toBe(true);
      expect(isInvalidCustomerName('unknown')).toBe(true);
      expect(isInvalidCustomerName('Customer Details Unavailable')).toBe(true);
      expect(isInvalidCustomerName('Not Provided')).toBe(true);
      expect(isInvalidCustomerName('merchant')).toBe(true);
      expect(isInvalidCustomerName('platform')).toBe(true);

      // Legitimate customer names from database must NOT be rejected
      expect(isInvalidCustomerName('PawGuard')).toBe(false);
      expect(isInvalidCustomerName('Verified Test Customer')).toBe(false);
      expect(isInvalidCustomerName('Customer Two')).toBe(false);
      expect(isInvalidCustomerName('jack sparrow')).toBe(false);
      expect(isInvalidCustomerName('Ajay Nagirikanti')).toBe(false);
    });

    it('resolves genuine customer records (including PawGuard) to real customer name and separates customerId from customerUserId', async () => {
      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/customers') {
          return {
            data: {
              data: [
                {
                  id: '01a19314-4b83-76fc-ac66-cd382dae5ba6',
                  userId: '01a192ee-1a73-7449-9822-da9ac3221ef2',
                  name: 'PawGuard',
                  email: 'pawguard@gmail.com',
                  mobile: '+919988776655',
                },
              ],
              meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
            },
          } as any;
        }
        if (url === '/admin/bookings') {
          return {
            data: {
              data: [],
              meta: { total: 0, page: 1, limit: 100, totalPages: 1 },
            },
          } as any;
        }
        if (url === '/admin/payments') {
          return {
            data: {
              data: [
                {
                  id: '01a1ce2d-7c93-7042-98f1-163daa5a008c',
                  bookingId: '01a1ce2a-6160-76ad-83fa-c9c3e95a1d77',
                  status: 'FAILED',
                  amountMinor: 50000,
                  currency: 'INR',
                  customerUserId: '01a192ee-1a73-7449-9822-da9ac3221ef2',
                  feeCode: 'BOOKING_FEE',
                },
              ],
              meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
            },
          } as any;
        }
        if (url.startsWith('/admin/customers/01a19314-4b83-76fc-ac66-cd382dae5ba6')) {
          return {
            data: {
              id: '01a19314-4b83-76fc-ac66-cd382dae5ba6',
              userId: '01a192ee-1a73-7449-9822-da9ac3221ef2',
              name: 'PawGuard',
              mobile: '+919988776655',
            },
          } as any;
        }
        return { data: {} } as any;
      });

      const repo = new RealPaymentRepository();
      const res = await repo.getTransactions();

      expect(res.items.length).toBe(1);
      expect(res.items[0].customerName).toBe('PawGuard');
      expect(res.items[0].customerId).toBe('01a19314-4b83-76fc-ac66-cd382dae5ba6');
      expect(res.items[0].customerUserId).toBe('01a192ee-1a73-7449-9822-da9ac3221ef2');
      expect(res.items[0].customerPhone).toBe('+91 99887 76655');
    });

    it('resolves customer via linked booking when payment record lacks customerUserId directly', async () => {
      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/customers') {
          return {
            data: {
              data: [
                {
                  id: 'cust-divya-id',
                  userId: 'user-divya-id',
                  name: 'Divya Chowdary',
                  email: 'divya@example.com',
                  phone: '+91 98765 43210',
                },
              ],
              meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
            },
          } as any;
        }
        if (url === '/admin/bookings') {
          return {
            data: {
              data: [
                {
                  id: 'booking-divya-123',
                  category: { name: 'House Maid' },
                  customerUserId: 'user-divya-id',
                },
              ],
              meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
            },
          } as any;
        }
        if (url === '/admin/payments') {
          return {
            data: {
              data: [
                {
                  id: 'payment-divya-001',
                  bookingId: 'booking-divya-123',
                  status: 'SUCCEEDED',
                  amountMinor: 50000,
                  currency: 'INR',
                  feeCode: 'BOOKING_FEE',
                },
              ],
              meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
            },
          } as any;
        }
        return { data: {} } as any;
      });

      const repo = new RealPaymentRepository();
      const res = await repo.getTransactions();

      expect(res.items.length).toBe(1);
      expect(res.items[0].customerName).toBe('Divya Chowdary');
      expect(res.items[0].customerId).toBe('cust-divya-id');
      expect(res.items[0].customerUserId).toBe('user-divya-id');
      expect(res.items[0].serviceCategory).toBe('House Maid');
    });

    it('honestly displays "Customer Details Unavailable" and safe C-NA customerId when customer data is missing from backend', async () => {
      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/customers') {
          return {
            data: { data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 1 } },
          } as any;
        }
        if (url === '/admin/bookings') {
          return {
            data: { data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 1 } },
          } as any;
        }
        if (url === '/admin/payments') {
          return {
            data: {
              data: [
                {
                  id: 'payment-unknown-999',
                  bookingId: 'booking-unknown-999',
                  status: 'SUCCEEDED',
                  amountMinor: 50000,
                  currency: 'INR',
                  customerUserId: 'user-not-in-db-999',
                  feeCode: 'BOOKING_FEE',
                },
              ],
              meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
            },
          } as any;
        }
        return { data: {} } as any;
      });

      const repo = new RealPaymentRepository();
      const res = await repo.getTransactions();

      expect(res.items.length).toBe(1);
      expect(res.items[0].customerName).toBe('Customer Details Unavailable');
      expect(res.items[0].customerId).toBe('C-NA');
      expect(res.items[0].customerPhone).toBeUndefined();
    });
  });

  describe('Booking Reference & Service Category Resolution', () => {
    it('formats UUID booking IDs into canonical BK-XXXXXXXX references', () => {
      expect(formatBookingReference('01a17c40-97f6-72ef-bb5c-4046eeef51cb')).toBe('BK-EEEF51CB');
      expect(formatBookingReference('01a11ef8-1111-2222-3333-da9ac3221ef2')).toBe('BK-C3221EF2');
      expect(formatBookingReference(undefined)).toBe('BK-NA');
    });

    it('enriches service category from linked booking registry when raw payment lacks category', async () => {
      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/customers') {
          return {
            data: {
              data: [
                {
                  id: 'c-1',
                  userId: 'u-1',
                  name: 'Rajesh Agarwal',
                },
              ],
              meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
            },
          } as any;
        }
        if (url === '/admin/bookings') {
          return {
            data: {
              data: [
                {
                  id: '01a17c40-97f6-72ef-bb5c-4046eeef51cb',
                  category: { name: 'House Maid', code: 'HOUSE_MAID' },
                  customerUserId: 'u-1',
                },
              ],
              meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
            },
          } as any;
        }
        if (url === '/admin/payments') {
          return {
            data: {
              data: [
                {
                  id: 'p-1',
                  bookingId: '01a17c40-97f6-72ef-bb5c-4046eeef51cb',
                  status: 'SUCCEEDED',
                  amountMinor: 50000,
                  currency: 'INR',
                  feeCode: 'BOOKING_FEE',
                },
              ],
              meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
            },
          } as any;
        }
        return { data: {} } as any;
      });

      const repo = new RealPaymentRepository();
      const res = await repo.getTransactions();

      expect(res.items.length).toBe(1);
      expect(res.items[0].serviceCategory).toBe('House Maid');
      expect(res.items[0].bookingRef).toBe('BK-EEEF51CB');
      expect(res.items[0].customerName).toBe('Rajesh Agarwal');
    });
  });

  describe('Status Mappings & Export Generation', () => {
    it('verifies status labels mapping covers all backend payment statuses', () => {
      expect(STATUS_MAPPINGS['PAID']?.label).toBe('Paid');
      expect(STATUS_MAPPINGS['SUCCEEDED']?.label).toBe('Paid');
      expect(STATUS_MAPPINGS['FAILED']?.label).toBe('Payment failed');
      expect(STATUS_MAPPINGS['PAYMENT_FAILED']?.label).toBe('Payment failed');
      expect(STATUS_MAPPINGS['REFUND_PENDING']?.label).toBe('Refund pending');
      expect(STATUS_MAPPINGS['REFUNDED']?.label).toBe('Refunded');
      expect(STATUS_MAPPINGS['PARTIALLY_REFUNDED']?.label).toBe('Partially refunded');
      expect(STATUS_MAPPINGS['REFUND_FAILED']?.label).toBe('Refund failed');
    });

    it('generates clean CSV and Excel blob exports with business metadata and headers', async () => {
      vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/admin/customers') {
          return {
            data: {
              data: [
                { id: 'c-1', userId: 'u-1', name: 'Divya Chowdary', phone: '+91 98765 43210' },
              ],
              meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
            },
          } as any;
        }
        if (url === '/admin/bookings') {
          return {
            data: {
              data: [
                { id: 'b-1', category: { name: 'Cook' }, customerUserId: 'u-1' },
              ],
              meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
            },
          } as any;
        }
        if (url === '/admin/payments') {
          return {
            data: {
              data: [
                {
                  id: '01a11ef9-export-payment',
                  bookingId: 'b-1',
                  bookingRef: 'BK-01A11EF2',
                  status: 'SUCCEEDED',
                  amountMinor: 50000,
                  currency: 'INR',
                  customerUserId: 'u-1',
                  feeCode: 'BOOKING_FEE',
                  createdAt: '2026-10-15T10:30:00Z',
                },
              ],
              meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
            },
          } as any;
        }
        return { data: {} } as any;
      });

      const repo = new RealPaymentRepository();
      const csv = await repo.exportPaymentsCsv();
      expect(csv).toContain('Transaction ID');
      expect(csv).toContain('Customer Name');
      expect(csv).toContain('Booking Reference');
      expect(csv).toContain('Service Category');
      expect(csv).toContain('Divya Chowdary');
      expect(csv).toContain('BK-01A11EF2');
      expect(csv).toContain('Cook');
      expect(csv).toContain('500.00');

      const blob = await repo.exportPaymentsExcel();
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(blob.size).toBeGreaterThan(100);
    });
  });
});
