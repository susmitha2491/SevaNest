import {
  IPaymentRepository,
  PaginatedPayments,
  PaymentFilterCriteria,
  PaymentTransaction,
  RefundReasonCategory,
  FinancialOverviewMetrics,
} from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import {
  getCustomerPhone,
  setCustomerPhone,
  setCustomerEmail,
  formatPhoneNumber,
} from '../../../core/utils/phoneDirectory';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';
import {
  generatePaymentsCsvString,
  generatePaymentsExcelBlob,
} from '../utils/paymentExportGenerator';

export interface CachedCustomer {
  id: string;
  userId?: string;
  name: string;
  mobile?: string;
  email?: string;
}

export interface CachedBooking {
  id: string;
  categoryName?: string;
  customerUserId?: string;
  status?: string;
}

export const isInvalidCustomerName = (str: string): boolean => {
  if (!str) return true;
  const s = str.trim().toLowerCase();
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ||
    /^[0-9a-f]{20,}$/i.test(s) ||
    /^c-\d+$/i.test(s) ||
    /^cust[-_]\d*$/i.test(s) ||
    s.startsWith('customer (') ||
    s === 'customer' ||
    s === 'customer user' ||
    s === 'unknown' ||
    s === 'unknown customer' ||
    s === 'not provided' ||
    s === 'customer details unavailable' ||
    s === 'pawguard' ||
    s.includes('pawguard') ||
    s === 'sevanest' ||
    s === 'merchant' ||
    s === 'platform' ||
    s === 'verified test customer' ||
    s === 'customer two' ||
    s === 'test customer'
  );
};

export const isIdLike = (str: string): boolean => {
  return isInvalidCustomerName(str);
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formatBookingReference(id?: string): string {
  if (!id) return 'BK-NA';
  const clean = id.trim();
  if (UUID_REGEX.test(clean)) {
    return `BK-${clean.slice(-8).toUpperCase()}`;
  }
  if (clean.toUpperCase().startsWith('BK-')) {
    return clean.toUpperCase();
  }
  return `BK-${clean.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}`;
}

let customerRegistryCache: Map<string, CachedCustomer> | null = null;
let lastCustomerFetch = 0;

let bookingRegistryCache: Map<string, CachedBooking> | null = null;
let lastBookingFetch = 0;

export function clearCustomerRegistryCache(): void {
  customerRegistryCache = null;
  lastCustomerFetch = 0;
}

export function clearBookingRegistryCache(): void {
  bookingRegistryCache = null;
  lastBookingFetch = 0;
}

export async function getCustomerRegistry(): Promise<Map<string, CachedCustomer>> {
  const now = Date.now();
  if (customerRegistryCache && now - lastCustomerFetch < 60000) {
    return customerRegistryCache;
  }
  try {
    const map = new Map<string, CachedCustomer>();
    let page = 1;
    const limit = 100;

    // Paginate through all customers
    while (page <= 25) {
      const res = await httpClient.get<{
        data?: Array<Record<string, unknown>>;
        items?: Array<Record<string, unknown>>;
        meta?: { total?: number; page?: number; limit?: number; totalPages?: number };
      }>('/admin/customers', {
        params: { page, limit },
      });
      const raw = res.data;
      const list: Array<Record<string, unknown>> = Array.isArray(raw)
        ? (raw as Array<Record<string, unknown>>)
        : Array.isArray(raw?.data)
        ? (raw.data as Array<Record<string, unknown>>)
        : Array.isArray(raw?.items)
        ? (raw.items as Array<Record<string, unknown>>)
        : [];

      for (const c of list) {
        const id = String(c.id || c.customerId || '');
        const userId = c.userId ? String(c.userId) : undefined;
        const rawName = String(c.name || c.fullName || c.customerName || '').trim();
        const name = isInvalidCustomerName(rawName) ? '' : rawName;
        const mobile = c.phone || c.mobile ? String(c.phone || c.mobile) : undefined;
        const email = c.email ? String(c.email) : undefined;

        if (name) {
          const entry: CachedCustomer = { id, userId, name, mobile, email };
          if (id) map.set(id, entry);
          if (userId) map.set(userId, entry);
          if (mobile) {
            setCustomerPhone(id, mobile);
            if (userId) setCustomerPhone(userId, mobile);
          }
          if (email) {
            setCustomerEmail(id, email);
            if (userId) setCustomerEmail(userId, email);
          }
        }
      }

      const total = typeof raw?.meta?.total === 'number' ? raw.meta.total : list.length;
      const resLimit = typeof raw?.meta?.limit === 'number' && raw.meta.limit > 0 ? raw.meta.limit : limit;
      const totalPages = typeof raw?.meta?.totalPages === 'number' ? raw.meta.totalPages : Math.ceil(total / resLimit);
      if (!list.length || page >= totalPages) {
        break;
      }
      page++;
    }

    customerRegistryCache = map;
    lastCustomerFetch = now;
    return map;
  } catch (err) {
    console.warn('Failed to load customer registry for payments:', err);
    return customerRegistryCache || new Map<string, CachedCustomer>();
  }
}

export async function getBookingRegistry(): Promise<Map<string, CachedBooking>> {
  const now = Date.now();
  if (bookingRegistryCache && now - lastBookingFetch < 60000) {
    return bookingRegistryCache;
  }
  try {
    const map = new Map<string, CachedBooking>();
    let page = 1;
    const limit = 100;
    while (page <= 25) {
      const res = await httpClient.get<{
        data?: Array<Record<string, unknown>>;
        meta?: { total?: number; page?: number; limit?: number; totalPages?: number };
      }>('/admin/bookings', { params: { page, limit } });
      const raw = res.data;
      const list: Array<Record<string, unknown>> = Array.isArray(raw?.data)
        ? (raw.data as Array<Record<string, unknown>>)
        : Array.isArray(raw)
        ? (raw as Array<Record<string, unknown>>)
        : [];
      for (const b of list) {
        const id = String(b.id || '');
        if (!id) continue;
        const cat = b.category as Record<string, unknown> | undefined;
        const categoryName = typeof cat === 'object' && cat ? String(cat.name || cat.code || '') : undefined;
        const customerUserId = b.customerUserId ? String(b.customerUserId) : undefined;
        const status = b.status ? String(b.status) : undefined;
        map.set(id, { id, categoryName, customerUserId, status });
      }
      const total = typeof raw?.meta?.total === 'number' ? raw.meta.total : list.length;
      const resLimit = typeof raw?.meta?.limit === 'number' && raw.meta.limit > 0 ? raw.meta.limit : limit;
      const totalPages = typeof raw?.meta?.totalPages === 'number' ? raw.meta.totalPages : Math.ceil(total / resLimit);
      if (list.length === 0 || page >= totalPages) break;
      page++;
    }
    bookingRegistryCache = map;
    lastBookingFetch = now;
    return map;
  } catch {
    return bookingRegistryCache || new Map<string, CachedBooking>();
  }
}

export class MockPaymentRepository implements IPaymentRepository {
  private transactions: PaymentTransaction[] = [
    {
      id: 'TXN-892104',
      customerId: 'C-1092',
      customerName: 'Anand Sharma',
      customerPhoneMasked: '+91 98765 *****',
      bookingRef: 'B-84920',
      serviceCategory: 'House Maid',
      feeType: 'BOOKING_FEE',
      feeDescription: 'Initial Matching & Candidate Shortlist Fee',
      amountINR: 1500,
      paymentMethod: 'UPI (Google Pay)',
      gatewayRef: 'pay_29QQoUBi66xm2f',
      status: 'PAID',
      timestamp: '2026-11-12 14:32:10',
      breakdown: {
        baseAmount: 1271.19,
        gstAmount: 228.81,
        platformCommission: 1271.19,
      },
    },
    {
      id: 'TXN-892050',
      customerId: 'C-3081',
      customerName: 'Rajesh Kumar',
      customerPhoneMasked: '+91 99881 *****',
      bookingRef: 'B-84890',
      serviceCategory: 'Driver',
      feeType: 'BOOKING_FEE',
      feeDescription: 'Interview & Trial Coordination Fee',
      amountINR: 499,
      paymentMethod: 'Credit Card (ICICI Visa)',
      gatewayRef: 'pay_P0912481m',
      status: 'REFUND_PENDING',
      timestamp: '2026-11-12 10:15:00',
      breakdown: {
        baseAmount: 422.88,
        gstAmount: 76.12,
        platformCommission: 422.88,
      },
    },
    {
      id: 'TXN-892105',
      customerId: 'C-1093',
      customerName: 'Meera Patel',
      customerPhoneMasked: '+91 94451 *****',
      bookingRef: 'B-84921',
      serviceCategory: 'Cook',
      feeType: 'PLACEMENT_FEE',
      feeDescription: 'Full-time Placement Commission (Quarterly Plan)',
      amountINR: 4500,
      paymentMethod: 'Credit Card (HDFC)',
      gatewayRef: 'pay_29QR87Lk11no9z',
      status: 'REFUND_PENDING',
      timestamp: '2026-11-12 11:20:45',
      breakdown: {
        baseAmount: 3813.56,
        gstAmount: 686.44,
        platformCommission: 3813.56,
      },
    },
    {
      id: 'TXN-892106',
      customerId: 'C-1094',
      customerName: 'Kavita Reddy',
      customerPhoneMasked: '+91 97890 *****',
      bookingRef: 'B-84922',
      serviceCategory: 'Driver',
      feeType: 'REPLACEMENT_PLAN',
      feeDescription: '6-Month Comprehensive Replacement Guarantee',
      amountINR: 2000,
      paymentMethod: 'Net Banking (ICICI)',
      gatewayRef: 'pay_29QS44Aa00pp5x',
      status: 'REFUNDED',
      timestamp: '2026-11-11 16:45:00',
      breakdown: {
        baseAmount: 1694.92,
        gstAmount: 305.08,
        platformCommission: 1694.92,
      },
      refund: {
        refundId: 'REF-00192',
        refundAmountINR: 2000,
        reasonCategory: 'UNSATISFACTORY_TRIAL',
        remarks: 'Candidate failed trial period. Customer requested full refund within 24 hours.',
        processedAt: '2026-11-11 18:00:00',
        processedBy: 'Operations Admin (Auto-audit)',
      },
    },
    {
      id: 'TXN-892107',
      customerId: 'C-1095',
      customerName: 'Rajesh Varma',
      customerPhoneMasked: '+91 91234 *****',
      bookingRef: 'B-84923',
      serviceCategory: 'Babysitter',
      feeType: 'BOOKING_FEE',
      feeDescription: 'Trial Session Platform Fee',
      amountINR: 500,
      paymentMethod: 'UPI (PhonePe)',
      gatewayRef: 'pay_29QT12Bb33qq1m',
      status: 'PAYMENT_FAILED',
      timestamp: '2026-11-11 09:12:33',
      breakdown: {
        baseAmount: 423.73,
        gstAmount: 76.27,
        platformCommission: 423.73,
      },
    },
  ];

  async getTransactions(filter?: PaymentFilterCriteria): Promise<PaginatedPayments> {
    const filtered = await this.getAllFilteredTransactions(filter);

    const pageSize = filter?.pageSize || 10;
    const page = filter?.page || 1;
    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    const items = filtered.slice((page - 1) * pageSize, page * pageSize);

    const totalGross = this.transactions
      .filter((t) => t.status === 'PAID')
      .reduce((sum, t) => sum + t.amountINR, 0);

    const pendingRefunds = this.transactions.filter((t) => t.status === 'REFUND_PENDING').length;

    return {
      items,
      totalCount: filtered.length,
      page,
      pageSize,
      totalPages,
      totalGrossCollectionsINR: totalGross,
      pendingRefundsCount: pendingRefunds,
    };
  }

  async getTransactionById(id: string): Promise<PaymentTransaction | null> {
    const txn = this.transactions.find((t) => t.id === id);
    return txn || null;
  }

  async processRefund(
    transactionId: string,
    amount: number,
    reasonCategory: RefundReasonCategory,
    remarks: string,
    idempotencyKey?: string
  ): Promise<void> {
    const txn = this.transactions.find((t) => t.id === transactionId);
    if (!txn) throw new Error('Transaction not found in ledger.');

    txn.status = 'REFUNDED';
    txn.refund = {
      refundId: `REF-${Math.floor(10000 + Math.random() * 90000)}`,
      refundAmountINR: amount,
      reasonCategory,
      remarks,
      processedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      processedBy: 'Operations Admin (Demo Session)',
      idempotencyKey,
      mockIdempotencyKey: idempotencyKey,
    };
  }

  async reconcilePayment(paymentId: string): Promise<void> {
    const txn = this.transactions.find((t) => t.id === paymentId);
    if (txn && txn.status === 'PAYMENT_FAILED') {
      txn.status = 'PAID';
    }
  }

  async getFinancialOverview(): Promise<FinancialOverviewMetrics> {
    const grossSettledCollectionsINR = this.transactions
      .filter((t) => t.status === 'PAID')
      .reduce((sum, t) => sum + t.amountINR, 0);
    const pendingRefundsCount = this.transactions.filter((t) => t.status === 'REFUND_PENDING').length;
    const totalLedgerRecords = this.transactions.length;
    return {
      grossSettledCollectionsINR,
      pendingRefundsCount,
      totalLedgerRecords,
    };
  }

  async exportPaymentsCsv(_from?: string, _to?: string, filter?: PaymentFilterCriteria): Promise<string> {
    const transactions = await this.getAllFilteredTransactions(filter);
    return generatePaymentsCsvString(transactions);
  }

  async exportPaymentsExcel(filter?: PaymentFilterCriteria): Promise<Blob> {
    const transactions = await this.getAllFilteredTransactions(filter);
    return generatePaymentsExcelBlob(transactions, {
      search: filter?.searchTerm,
      status: filter?.status,
      feeType: filter?.feeType,
      filterDescription: filter?.status && filter.status !== 'ALL' ? `Status: ${filter.status}` : 'All Statuses',
      exportedBy: 'Operations Admin',
    });
  }

  async getAllFilteredTransactions(filter?: PaymentFilterCriteria): Promise<PaymentTransaction[]> {
    let result = [...this.transactions];
    if (filter?.status && filter.status !== 'ALL') {
      result = result.filter((t) => t.status === filter.status);
    }
    if (filter?.feeType && filter.feeType !== 'ALL') {
      result = result.filter((t) => t.feeType === filter.feeType);
    }
    if (filter?.searchTerm) {
      const q = filter.searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          t.bookingRef.toLowerCase().includes(q) ||
          t.gatewayRef.toLowerCase().includes(q)
      );
    }
    return result;
  }
}

export function mapBackendPaymentToDomain(
  raw: Record<string, unknown>,
  customerMap?: Map<string, CachedCustomer>,
  bookingMap?: Map<string, CachedBooking>
): PaymentTransaction {
  const customer = raw.customer as Record<string, unknown> | undefined;
  const breakdown = raw.breakdown as Record<string, unknown> | undefined;
  const refund = raw.refund as Record<string, unknown> | undefined;

  const rawAmount = raw.amount ?? raw.amountINR;
  const amount =
    rawAmount !== undefined && rawAmount !== null
      ? Number(rawAmount)
      : raw.amountMinor !== undefined && raw.amountMinor !== null
      ? Number(raw.amountMinor) / 100
      : 0;

  const baseAmount = Number(breakdown?.baseAmount ?? (amount / 1.18).toFixed(2));
  const gstAmount = Number(breakdown?.gstAmount ?? (amount - baseAmount).toFixed(2));

  let status: PaymentTransaction['status'] = 'PAID';
  const rawStatus = String(raw.status || '').toUpperCase();
  if (rawStatus === 'SUCCEEDED' || rawStatus === 'PAID') {
    status = 'PAID';
  } else if (rawStatus === 'FAILED' || rawStatus === 'PAYMENT_FAILED') {
    status = 'PAYMENT_FAILED';
  } else if (rawStatus === 'REFUND_PENDING' || raw.refundStatus === 'REFUND_PENDING') {
    status = 'REFUND_PENDING';
  } else if (rawStatus === 'REFUNDED' || raw.refundStatus === 'REFUNDED') {
    status = 'REFUNDED';
  } else if (rawStatus === 'PARTIALLY_REFUNDED' || raw.refundStatus === 'PARTIALLY_REFUNDED') {
    status = 'PARTIALLY_REFUNDED';
  } else if (rawStatus === 'REFUND_FAILED' || raw.refundStatus === 'REFUND_FAILED') {
    status = 'REFUND_FAILED';
  } else if (rawStatus === 'PENDING') {
    status = 'PENDING';
  } else if (rawStatus === 'CREATED') {
    status = 'CREATED';
  }

  const rawFeeType = String(raw.feeType || raw.feeCode || '');
  const feeType = (
    rawFeeType === 'BOOKING_FEE' ||
    rawFeeType === 'PLACEMENT_FEE' ||
    rawFeeType === 'REPLACEMENT_PLAN' ||
    rawFeeType === 'SUBSCRIPTION'
      ? rawFeeType
      : 'BOOKING_FEE'
  ) as PaymentTransaction['feeType'];

  const feeDescription = String(
    raw.feeDescription ||
      raw.description ||
      (feeType === 'BOOKING_FEE' ? 'Initial Matching & Candidate Shortlist Fee' : 'Service Placement Fee')
  );

  const bookingIdStr = raw.bookingId ? String(raw.bookingId) : undefined;
  const linkedBooking = bookingIdStr ? bookingMap?.get(bookingIdStr) : undefined;
  const bookingRef = raw.bookingRef
    ? String(raw.bookingRef)
    : bookingIdStr
    ? formatBookingReference(bookingIdStr)
    : 'BK-NA';

  const rawCustUserId = raw.customerUserId
    ? String(raw.customerUserId)
    : linkedBooking?.customerUserId
    ? String(linkedBooking.customerUserId)
    : undefined;
  const rawCustId = raw.customerId || customer?.id ? String(raw.customerId || customer?.id) : undefined;
  const custKey = rawCustUserId || rawCustId || '';

  const custObj =
    (rawCustUserId ? customerMap?.get(rawCustUserId) : undefined) ||
    (rawCustId ? customerMap?.get(rawCustId) : undefined) ||
    (custKey ? customerMap?.get(custKey) : undefined);

  let customerName = String(
    custObj?.name ||
      raw.customerName ||
      customer?.fullName ||
      customer?.name ||
      ''
  ).trim();

  if (!customerName || isInvalidCustomerName(customerName)) {
    if (custObj?.name && !isInvalidCustomerName(custObj.name)) {
      customerName = custObj.name;
    } else {
      customerName = 'Customer Details Unavailable';
    }
  }

  const cachedCustPhone =
    (custObj?.id ? getCustomerPhone(custObj.id) : undefined) ||
    (rawCustUserId ? getCustomerPhone(rawCustUserId) : undefined) ||
    (custKey ? getCustomerPhone(custKey) : undefined);
  const rawCustPhone =
    (custObj?.mobile && !custObj.mobile.includes('*') ? custObj.mobile : undefined) ||
    (cachedCustPhone && !cachedCustPhone.includes('*') ? cachedCustPhone : undefined) ||
    (raw.customerPhone && !String(raw.customerPhone).includes('*') ? String(raw.customerPhone) : undefined) ||
    (raw.phone && !String(raw.phone).includes('*') ? String(raw.phone) : undefined);
  const unmaskedCustPhone =
    customerName !== 'Customer Details Unavailable'
      ? (cachedCustPhone && !cachedCustPhone.includes('*') ? cachedCustPhone : undefined) ||
        (custObj?.mobile && !custObj.mobile.includes('*') ? formatPhoneNumber(custObj.mobile) : undefined) ||
        (rawCustPhone ? formatPhoneNumber(String(rawCustPhone)) : undefined)
      : undefined;

  const fallbackMasked =
    customerName !== 'Customer Details Unavailable'
      ? (custObj?.mobile && custObj.mobile.includes('*') ? custObj.mobile : undefined) ||
        (cachedCustPhone && cachedCustPhone.includes('*') ? cachedCustPhone : undefined) ||
        raw.customerPhoneMasked ||
        customer?.phoneMasked ||
        '+91 98*** *****'
      : '';

  const refundRecord =
    refund
      ? {
          refundId: String(refund.refundId || `REF-${String(raw.id || '').slice(0, 8)}`),
          refundAmountINR: Number(refund.refundAmountINR || amount),
          reasonCategory: (refund.reasonCategory as RefundReasonCategory) || 'OTHER',
          remarks: String(refund.remarks || refund.reason || raw.refundReason || 'Refund processed under platform policy'),
          processedAt: String(refund.processedAt || raw.refundedAt || 'Recorded'),
          processedBy: String(refund.processedBy || raw.refundedByUserId || 'Operations Admin'),
        }
      : status === 'REFUNDED' || status === 'REFUND_PENDING' || raw.refundedAt || raw.refundReason
      ? {
          refundId: String(raw.refundId || `REF-${String(raw.id || '').slice(0, 8)}`),
          refundAmountINR: Number(raw.refundAmountINR || amount),
          reasonCategory: (raw.refundReasonCategory as RefundReasonCategory) || 'OTHER',
          remarks: String(raw.refundReason || raw.refundRemarks || 'Refund processed under platform policy'),
          processedAt: String(raw.refundedAt || 'Recorded'),
          processedBy: String(raw.refundedByUserId || 'Operations Admin'),
        }
      : undefined;

  const serviceCategory = String(
    linkedBooking?.categoryName ||
      raw.serviceCategory ||
      (typeof raw.category === 'object' && raw.category !== null ? (raw.category as Record<string, unknown>).name : raw.category) ||
      'Household Services'
  );

  return {
    id: String(raw.id || raw.paymentId || ''),
    customerId: custObj?.id || rawCustId || rawCustUserId || custKey || 'C-NA',
    customerName,
    customerPhoneMasked: String(unmaskedCustPhone || fallbackMasked),
    customerPhone: unmaskedCustPhone,
    bookingRef,
    bookingId: bookingIdStr,
    serviceCategory,
    feeType,
    feeDescription,
    amountINR: amount,
    paymentMethod: String(
      raw.paymentMethod ||
        raw.paymentMethodDetail ||
        raw.method ||
        (rawStatus === 'SUCCEEDED' ? 'Online / UPI' : 'Pending Gateway')
    ),
    gatewayRef: String(
      raw.gatewayRef ||
        raw.providerPaymentId ||
        raw.providerOrderId ||
        raw.gatewayReference ||
        'N/A'
    ),
    status,
    rawStatus: String(raw.status || ''),
    timestamp: String(raw.paidAt || raw.createdAt || raw.timestamp || new Date().toISOString()),
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    paidAt: raw.paidAt ? String(raw.paidAt) : undefined,
    refundedAt: raw.refundedAt ? String(raw.refundedAt) : undefined,
    providerOrderId: raw.providerOrderId ? String(raw.providerOrderId) : undefined,
    providerPaymentId: raw.providerPaymentId ? String(raw.providerPaymentId) : undefined,
    receiptNumber: raw.receiptNumber ? String(raw.receiptNumber) : undefined,
    failureReason: raw.failureReason ? String(raw.failureReason) : undefined,
    failureCode: raw.failureCode ? String(raw.failureCode) : undefined,
    breakdown: {
      baseAmount,
      gstAmount,
      platformCommission: baseAmount,
    },
    refund: refundRecord,
  };
}

export class RealPaymentRepository implements IPaymentRepository {
  async getTransactions(filter?: PaymentFilterCriteria): Promise<PaginatedPayments> {
    try {
      const hasSearch = Boolean(filter?.searchTerm?.trim());
      const hasFeeFilter = Boolean(filter?.feeType && filter.feeType !== 'ALL');

      // If text search or fee filter is active, fetch across all pages to ensure no truncated search
      if (hasSearch || hasFeeFilter) {
        const allTransactions = await this.getAllFilteredTransactions(filter);
        const pageSize = filter?.pageSize || 10;
        const page = filter?.page || 1;
        const totalCount = allTransactions.length;
        const totalPages = Math.ceil(totalCount / pageSize) || 1;
        const items = allTransactions.slice((page - 1) * pageSize, page * pageSize);

        const totalGross = allTransactions
          .filter((t) => t.status === 'PAID')
          .reduce((sum, t) => sum + t.amountINR, 0);
        const pendingRefunds = allTransactions.filter((t) => t.status === 'REFUND_PENDING').length;

        return {
          items,
          totalCount,
          page,
          pageSize,
          totalPages,
          totalGrossCollectionsINR: totalGross,
          pendingRefundsCount: pendingRefunds,
        };
      }

      const [customerMap, bookingMap] = await Promise.all([
        getCustomerRegistry(),
        getBookingRegistry(),
      ]);

      const params: Record<string, unknown> = {
        page: filter?.page || 1,
        limit: filter?.pageSize || 10,
      };

      if (filter?.status && filter.status !== 'ALL') {
        let backendStatus = filter.status;
        if (filter.status === 'PAID') backendStatus = 'SUCCEEDED';
        else if (filter.status === 'PAYMENT_FAILED') backendStatus = 'FAILED';
        params.status = backendStatus;
      }

      const res = await httpClient.get<{
        success?: boolean;
        data?: Array<Record<string, unknown>>;
        meta?: {
          total?: number;
          totalItems?: number;
          page?: number;
          currentPage?: number;
          limit?: number;
          itemsPerPage?: number;
          totalPages?: number;
        };
      }>('/admin/payments', { params });

      const payload = res.data;
      const rawItems: Array<Record<string, unknown>> = Array.isArray(payload.data) ? payload.data : [];

      const customerIdsToResolve = Array.from(
        new Set(
          rawItems
            .map((item: Record<string, unknown>) => {
              const uId = String(item.customerUserId || item.customerId || '');
              const cust = uId ? customerMap.get(uId) : undefined;
              return cust?.id || (item.customerId ? String(item.customerId) : undefined);
            })
            .filter((id): id is string => Boolean(id))
        )
      );

      if (customerIdsToResolve.length > 0) {
        await Promise.all(
          customerIdsToResolve.map(async (cid: string) => {
            const cached = getCustomerPhone(cid);
            if (cached && !cached.includes('*')) return;
            try {
              const detailRes = await httpClient.get<{
                data?: Record<string, unknown>;
                mobile?: string;
                phone?: string;
              }>(`/admin/customers/${cid}`);
              const detail = detailRes.data?.data || detailRes.data;
              const fullMobile = String(detail?.mobile || detail?.phone || '');
              if (fullMobile && !fullMobile.includes('*')) {
                const formatted = formatPhoneNumber(fullMobile);
                setCustomerPhone(cid, formatted);
                const cEntry = customerMap.get(cid);
                if (cEntry) {
                  cEntry.mobile = formatted;
                  if (cEntry.userId) {
                    setCustomerPhone(cEntry.userId, formatted);
                    const uEntry = customerMap.get(cEntry.userId);
                    if (uEntry) uEntry.mobile = formatted;
                  }
                }
              }
            } catch {
              // Ignore individual lookup errors
            }
          })
        );
      }

      const mapped = rawItems.map((item: Record<string, unknown>) =>
        mapBackendPaymentToDomain(item, customerMap, bookingMap)
      );
      const totalItems = payload.meta?.totalItems ?? payload.meta?.total ?? mapped.length;
      const pageSize = payload.meta?.itemsPerPage ?? payload.meta?.limit ?? filter?.pageSize ?? 10;
      const currentPage = payload.meta?.currentPage ?? payload.meta?.page ?? filter?.page ?? 1;
      const totalPages = payload.meta?.totalPages ?? (Math.ceil(totalItems / pageSize) || 1);

      const totalGross = mapped
        .filter((t: PaymentTransaction) => t.status === 'PAID')
        .reduce((sum: number, t: PaymentTransaction) => sum + t.amountINR, 0);
      const pendingRefunds = mapped.filter((t: PaymentTransaction) => t.status === 'REFUND_PENDING').length;

      return {
        items: mapped,
        totalCount: totalItems,
        page: currentPage,
        pageSize,
        totalPages,
        totalGrossCollectionsINR: totalGross,
        pendingRefundsCount: pendingRefunds,
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getTransactionById(id: string): Promise<PaymentTransaction | null> {
    try {
      const [res, customerMap, bookingMap] = await Promise.all([
        httpClient.get<{ success?: boolean; data?: Record<string, unknown> }>(`/admin/payments/${id}`),
        getCustomerRegistry(),
        getBookingRegistry(),
      ]);
      const raw = res.data?.data;
      if (!raw) return null;

      const custKey = String(raw.customerUserId || raw.customerId || '');
      const custObj = custKey ? customerMap.get(custKey) : undefined;
      const cid = custObj?.id || (raw.customerId ? String(raw.customerId) : undefined);

      if (cid) {
        const cached = getCustomerPhone(cid);
        if (!cached || cached.includes('*')) {
          try {
            const detailRes = await httpClient.get<Record<string, unknown>>(`/admin/customers/${cid}`);
            const detail = (detailRes.data?.data || detailRes.data) as Record<string, unknown>;
            const fullMobile = String(detail?.mobile || detail?.phone || '');
            if (fullMobile && !fullMobile.includes('*')) {
              const formatted = formatPhoneNumber(fullMobile);
              setCustomerPhone(cid, formatted);
              if (custObj) custObj.mobile = formatted;
              if (custObj?.userId) setCustomerPhone(custObj.userId, formatted);
            }
          } catch {
            // Ignore individual fetch failure
          }
        }
      }

      return mapBackendPaymentToDomain(raw, customerMap, bookingMap);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getFinancialOverview(): Promise<FinancialOverviewMetrics> {
    try {
      const currentYear = new Date().getFullYear();
      let grossSettledCollectionsINR = 0;

      // 1. Fetch Gross Collections from authoritative backend report
      try {
        const repRes = await httpClient.get<Record<string, unknown>>('/admin/reports/payment-collections', {
          params: { from: `${currentYear}-01-01`, to: `${currentYear}-12-31` },
        });
        const repData = (repRes.data as { data?: Record<string, unknown> })?.data || (repRes.data as Record<string, unknown>);
        const totals: Array<Record<string, unknown>> = Array.isArray(repData?.totalsByFeeType)
          ? (repData.totalsByFeeType as Array<Record<string, unknown>>)
          : [];
        const grossMinor = totals.reduce((sum: number, item: Record<string, unknown>) => sum + Number(item.grossMinor || 0), 0);
        grossSettledCollectionsINR = Math.round(grossMinor / 100);
      } catch {
        // Fallback: Query SUCCEEDED payments from ledger
        try {
          const succRes = await httpClient.get<{ data?: Array<Record<string, unknown>> }>('/admin/payments', {
            params: { status: 'SUCCEEDED', limit: 100 },
          });
          const succItems: Array<Record<string, unknown>> = Array.isArray(succRes.data?.data) ? succRes.data.data : [];
          const sumMinor = succItems.reduce((acc: number, p: Record<string, unknown>) => acc + Number(p.amountMinor || 0), 0);
          grossSettledCollectionsINR = Math.round(sumMinor / 100);
        } catch {
          grossSettledCollectionsINR = 0;
        }
      }

      // 2. Fetch Pending Refund Requests count
      let pendingRefundsCount = 0;
      try {
        const refRes = await httpClient.get<{
          meta?: { total?: number };
        }>('/admin/payments', {
          params: { status: 'REFUND_PENDING', limit: 1 },
        });
        pendingRefundsCount = refRes.data?.meta?.total ?? 0;
      } catch {
        pendingRefundsCount = 0;
      }

      // 3. Fetch Total Ledger Records count
      let totalLedgerRecords = 0;
      try {
        const totRes = await httpClient.get<{
          meta?: { total?: number };
        }>('/admin/payments', {
          params: { limit: 1 },
        });
        totalLedgerRecords = totRes.data?.meta?.total ?? 0;
      } catch {
        totalLedgerRecords = 0;
      }

      return {
        grossSettledCollectionsINR,
        pendingRefundsCount,
        totalLedgerRecords,
      };
    } catch {
      return {
        grossSettledCollectionsINR: 0,
        pendingRefundsCount: 0,
        totalLedgerRecords: 0,
      };
    }
  }

  async processRefund(
    transactionId: string,
    _amount: number,
    reasonCategory: RefundReasonCategory,
    remarks: string,
    idempotencyKey?: string
  ): Promise<void> {
    try {
      // Backend RefundDto allows only { reason: string }
      const payload = {
        reason: `${reasonCategory}: ${remarks}`,
      };
      const key =
        idempotencyKey ||
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `idem_ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
      await httpClient.post(`/admin/payments/${transactionId}/refund`, payload, {
        headers: { 'Idempotency-Key': key },
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async reconcilePayment(paymentId: string): Promise<void> {
    try {
      await httpClient.post(`/admin/payments/${encodeURIComponent(paymentId)}/reconcile`);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getAllFilteredTransactions(filter?: PaymentFilterCriteria): Promise<PaymentTransaction[]> {
    const customerMap = await getCustomerRegistry();
    const bookingMap = await getBookingRegistry();
    const allItems: PaymentTransaction[] = [];
    let page = 1;
    const limit = 100;

    while (page <= 25) {
      const params: Record<string, unknown> = { page, limit };
      if (filter?.status && filter.status !== 'ALL') {
        let backendStatus = filter.status;
        if (filter.status === 'PAID') backendStatus = 'SUCCEEDED';
        else if (filter.status === 'PAYMENT_FAILED') backendStatus = 'FAILED';
        params.status = backendStatus;
      }
      const res = await httpClient.get<{
        data?: Array<Record<string, unknown>>;
        meta?: { total?: number; page?: number; limit?: number; totalPages?: number };
      }>('/admin/payments', { params });
      const raw = res.data;
      const list: Array<Record<string, unknown>> = Array.isArray(raw?.data)
        ? (raw.data as Array<Record<string, unknown>>)
        : Array.isArray(raw)
        ? (raw as Array<Record<string, unknown>>)
        : [];
      for (const item of list) {
        allItems.push(mapBackendPaymentToDomain(item, customerMap, bookingMap));
      }
      const total = typeof raw?.meta?.total === 'number' ? raw.meta.total : list.length;
      const resLimit = typeof raw?.meta?.limit === 'number' && raw.meta.limit > 0 ? raw.meta.limit : limit;
      const totalPages = typeof raw?.meta?.totalPages === 'number' ? raw.meta.totalPages : Math.ceil(total / resLimit);
      if (list.length === 0 || page >= totalPages) break;
      page++;
    }

    let filtered = allItems;
    if (filter?.feeType && filter.feeType !== 'ALL') {
      filtered = filtered.filter((t) => t.feeType === filter.feeType);
    }
    if (filter?.searchTerm) {
      const q = filter.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          t.bookingRef.toLowerCase().includes(q) ||
          (t.gatewayRef && t.gatewayRef.toLowerCase().includes(q))
      );
    }
    return filtered;
  }

  async exportPaymentsCsv(_from?: string, _to?: string, filter?: PaymentFilterCriteria): Promise<string> {
    const transactions = await this.getAllFilteredTransactions(filter);
    return generatePaymentsCsvString(transactions);
  }

  async exportPaymentsExcel(filter?: PaymentFilterCriteria): Promise<Blob> {
    const transactions = await this.getAllFilteredTransactions(filter);
    return generatePaymentsExcelBlob(transactions, {
      search: filter?.searchTerm,
      status: filter?.status,
      feeType: filter?.feeType,
      filterDescription: filter?.status && filter.status !== 'ALL' ? `Status: ${filter.status}` : 'All Statuses',
      exportedBy: 'Operations Admin',
    });
  }
}

export { RealPaymentRepository as PaymentRepositoryImpl };

export const createPaymentRepository = (
  useMock: boolean = env.VITE_USE_MOCK_AUTH
): IPaymentRepository => {
  return useMock ? new MockPaymentRepository() : new RealPaymentRepository();
};

export const paymentRepository = createPaymentRepository();
