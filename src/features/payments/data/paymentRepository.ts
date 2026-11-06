import {
  PaymentTransaction,
  PaymentFilterCriteria,
  PaginatedPayments,
  FinancialOverviewMetrics,
  IPaymentRepository,
  RefundReasonCategory,
} from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import {
  getCustomerPhone,
  preloadCustomerPhones,
  formatPhoneNumber,
  setCustomerPhone,
  setCustomerEmail,
} from '../../../core/utils/phoneDirectory';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';

export interface CachedCustomer {
  id: string;
  userId?: string;
  name: string;
  mobile?: string;
  email?: string;
}

export const isIdLike = (str: string): boolean => {
  if (!str) return false;
  const s = str.trim().toLowerCase();
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ||
    /^[0-9a-f]{20,}$/i.test(s) ||
    s.startsWith('customer (') ||
    s === 'customer' ||
    s === 'unknown'
  );
};

let customerRegistryCache: Map<string, CachedCustomer> | null = null;
let lastCustomerFetch = 0;

export function clearCustomerRegistryCache(): void {
  customerRegistryCache = null;
  lastCustomerFetch = 0;
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
    while (true) {
      const res = await httpClient.get<{
        data?: Array<Record<string, unknown>>;
        items?: Array<Record<string, unknown>>;
        meta?: { total?: number; page?: number; limit?: number };
      }>('/admin/customers', {
        params: { page, limit },
      });
      const raw = res.data;
      const list = Array.isArray(raw)
        ? (raw as Record<string, unknown>[])
        : Array.isArray(raw?.data)
        ? (raw.data as Record<string, unknown>[])
        : Array.isArray(raw?.items)
        ? (raw.items as Record<string, unknown>[])
        : [];

      for (const c of list) {
        const id = String(c.id || c.customerId || '');
        const userId = c.userId ? String(c.userId) : undefined;
        const name = String(c.name || c.fullName || c.customerName || '').trim();
        const mobile = c.phone || c.mobile ? String(c.phone || c.mobile) : undefined;
        const email = c.email ? String(c.email) : undefined;

        if (name && !isIdLike(name)) {
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

      const total = raw?.meta?.total ?? list.length;
      const responseLimit = raw?.meta?.limit ?? limit;
      if (!list.length || list.length < responseLimit || page * responseLimit >= total) {
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
      amountINR: 499,
      paymentMethod: 'UPI (GPay)',
      gatewayRef: 'pay_H93b1948x',
      status: 'PAID',
      timestamp: 'Recent Transaction',
      breakdown: {
        baseAmount: 422.88,
        gstAmount: 76.12,
        platformCommission: 422.88,
      },
    },
    {
      id: 'TXN-892099',
      customerId: 'C-2091',
      customerName: 'Priya Reddy',
      customerPhoneMasked: '+91 94401 *****',
      bookingRef: 'B-84912',
      serviceCategory: 'Cook',
      feeType: 'PLACEMENT_FEE',
      feeDescription: 'Full-Time Verified Cook Placement & Service Contract Fee',
      amountINR: 1999,
      paymentMethod: 'Net Banking (HDFC)',
      gatewayRef: 'pay_K2848102z',
      status: 'PAID',
      timestamp: 'Recent Transaction',
      breakdown: {
        baseAmount: 1694.07,
        gstAmount: 304.93,
        platformCommission: 1694.07,
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
      timestamp: 'Awaiting Settlement',
      breakdown: {
        baseAmount: 422.88,
        gstAmount: 76.12,
        platformCommission: 422.88,
      },
    },
    {
      id: 'TXN-891902',
      customerId: 'C-4019',
      customerName: 'Sneha Patel',
      customerPhoneMasked: '+91 97001 *****',
      bookingRef: 'B-84870',
      serviceCategory: 'Babysitter',
      feeType: 'REPLACEMENT_PLAN',
      feeDescription: '30-Day Extended Workforce Replacement Guarantee Protection Plan',
      amountINR: 799,
      paymentMethod: 'UPI (PhonePe)',
      gatewayRef: 'pay_L0192834c',
      status: 'PAID',
      timestamp: 'Active Plan',
      breakdown: {
        baseAmount: 677.12,
        gstAmount: 121.88,
        platformCommission: 677.12,
      },
    },
    {
      id: 'TXN-891820',
      customerId: 'C-5120',
      customerName: 'Deepak Rao',
      customerPhoneMasked: '+91 98499 *****',
      bookingRef: 'B-84850',
      serviceCategory: 'Elderly Care Helper',
      feeType: 'PLACEMENT_FEE',
      feeDescription: 'Elderly Care Assisted Household Staff Placement Fee',
      amountINR: 1999,
      paymentMethod: 'UPI (Paytm)',
      gatewayRef: 'pay_R8812039p',
      status: 'REFUNDED',
      timestamp: 'Refund Completed',
      breakdown: {
        baseAmount: 1694.07,
        gstAmount: 304.93,
        platformCommission: 1694.07,
      },
      refund: {
        refundId: 'REF-00912',
        refundAmountINR: 1999,
        reasonCategory: 'UNSATISFACTORY_TRIAL',
        remarks: 'Customer cancelled prior to joining; full reimbursement authorized by Operations.',
        processedAt: 'Recent Settlement',
        processedBy: 'Operations Admin',
        mockIdempotencyKey: 'sim_idem_90192834_settled',
      },
    },
    {
      id: 'TXN-891701',
      customerId: 'C-6002',
      customerName: 'Kavita Menon',
      customerPhoneMasked: '+91 91100 *****',
      bookingRef: 'B-84810',
      serviceCategory: 'House Maid',
      feeType: 'BOOKING_FEE',
      feeDescription: 'Booking Fee (Failed Bank Gateway Auth)',
      amountINR: 499,
      paymentMethod: 'Debit Card (SBI)',
      gatewayRef: 'pay_fail_77192',
      status: 'PAYMENT_FAILED',
      timestamp: 'Gateway Decline',
      breakdown: {
        baseAmount: 422.88,
        gstAmount: 76.12,
        platformCommission: 422.88,
      },
    },
  ];

  async getTransactions(filter?: PaymentFilterCriteria): Promise<PaginatedPayments> {
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
          t.gatewayRef.toLowerCase().includes(q) ||
          t.serviceCategory.toLowerCase().includes(q)
      );
    }

    const page = filter?.page || 1;
    const pageSize = filter?.pageSize || 10;
    const totalCount = result.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const paginated = result.slice((page - 1) * pageSize, page * pageSize);

    const totalGrossCollectionsINR = this.transactions
      .filter((t) => t.status === 'PAID')
      .reduce((sum, t) => sum + t.amountINR, 0);

    const pendingRefundsCount = this.transactions.filter((t) => t.status === 'REFUND_PENDING').length;

    return {
      items: paginated,
      totalCount,
      page,
      pageSize,
      totalPages,
      totalGrossCollectionsINR,
      pendingRefundsCount,
    };
  }

  async getTransactionById(id: string): Promise<PaymentTransaction | null> {
    const item = this.transactions.find((t) => t.id === id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async processRefund(
    transactionId: string,
    amount: number,
    reasonCategory: RefundReasonCategory,
    remarks: string,
    idempotencyKey?: string
  ): Promise<void> {
    const item = this.transactions.find((t) => t.id === transactionId);
    if (item) {
      item.status = 'REFUNDED';
      item.refund = {
        refundId: `REF-${Math.floor(10000 + Math.random() * 90000)}`,
        refundAmountINR: amount,
        reasonCategory,
        remarks,
        processedAt: 'Recent Settlement',
        processedBy: 'Operations Admin',
        idempotencyKey: idempotencyKey || `idem_key_${Date.now()}`,
        mockIdempotencyKey: idempotencyKey || `mock_idem_key_${Date.now()}`,
      };
    }
  }

  async reconcilePayment(paymentId: string): Promise<void> {
    const item = this.transactions.find((t) => t.id === paymentId);
    if (item && item.status !== 'REFUNDED') {
      item.status = 'PAID';
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

  async exportPaymentsCsv(_from: string, _to: string): Promise<string> {
    const headers = 'Payment ID,Booking ID,Customer,Amount (INR),Status,Timestamp';
    const rows = this.transactions.map((t) => `"${t.id}","${t.bookingRef}","${t.customerName}",${t.amountINR},"${t.status}","${t.timestamp}"`);
    return [headers, ...rows].join('\n');
  }
}

function mapBackendPaymentToDomain(
  raw: Record<string, unknown>,
  customerMap?: Map<string, CachedCustomer>
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
  }

  const rawFeeType = String(raw.feeType || raw.feeCode || 'BOOKING_FEE');
  const feeType = (
    rawFeeType === 'PLACEMENT_FEE' || rawFeeType === 'REPLACEMENT_PLAN' || rawFeeType === 'SUBSCRIPTION'
      ? rawFeeType
      : 'BOOKING_FEE'
  ) as PaymentTransaction['feeType'];

  const feeDescription = String(
    raw.feeDescription ||
      raw.description ||
      (feeType === 'BOOKING_FEE' ? 'Initial Matching & Candidate Shortlist Fee' : 'Service Placement Fee')
  );

  const rawCustUserId = raw.customerUserId ? String(raw.customerUserId) : undefined;
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

  if (!customerName || isIdLike(customerName)) {
    if (custObj?.name && !isIdLike(custObj.name)) {
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
    (cachedCustPhone && !cachedCustPhone.includes('*') ? cachedCustPhone : undefined) ||
    (custObj?.mobile && !custObj.mobile.includes('*') ? formatPhoneNumber(custObj.mobile) : undefined) ||
    (rawCustPhone ? formatPhoneNumber(String(rawCustPhone)) : undefined);

  const fallbackMasked =
    (custObj?.mobile && custObj.mobile.includes('*') ? custObj.mobile : undefined) ||
    (cachedCustPhone && cachedCustPhone.includes('*') ? cachedCustPhone : undefined) ||
    raw.customerPhoneMasked ||
    customer?.phoneMasked ||
    '+91 98*** *****';

  const bookingIdStr = raw.bookingId ? String(raw.bookingId) : undefined;
  const bookingRef = String(
    raw.bookingRef ||
      (bookingIdStr ? `B-${bookingIdStr.slice(0, 8)}` : 'B-NA')
  );

  const refundData =
    refund ||
    (raw.refundStatus || raw.refundReason || raw.refundedAt
      ? {
          refundId: String(raw.refundId || `REF-${String(raw.id || '').slice(0, 8)}`),
          refundAmountINR: Number(raw.refundAmountINR || amount),
          reasonCategory: (raw.refundReasonCategory as RefundReasonCategory) || 'OTHER',
          remarks: String(raw.refundReason || raw.refundRemarks || 'Refund processed under platform policy'),
          processedAt: String(raw.refundedAt || 'Recorded'),
          processedBy: String(raw.refundedByUserId || 'Operations Admin'),
        }
      : undefined);

  return {
    id: String(raw.id || raw.paymentId || ''),
    customerId: custObj?.id || rawCustId || rawCustUserId || custKey || 'C-NA',
    customerName,
    customerPhoneMasked: String(unmaskedCustPhone || fallbackMasked),
    customerPhone: unmaskedCustPhone,
    bookingRef,
    bookingId: bookingIdStr,
    serviceCategory: String(
      raw.serviceCategory ||
        (typeof raw.category === 'object' && raw.category !== null ? (raw.category as Record<string, unknown>).name : raw.category) ||
        'General Household'
    ),
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
        raw.razorpayPaymentId ||
        raw.id ||
        'N/A'
    ),
    status,
    rawStatus,
    timestamp: String(raw.paidAt || raw.createdAt || raw.timestamp || 'Recent'),
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
      platformCommission: Number(breakdown?.platformCommission ?? baseAmount),
    },
    refund: refundData
      ? {
          refundId: String(refundData.refundId || refundData.id || ''),
          refundAmountINR: Number(refundData.refundAmountINR || refundData.amount || amount),
          reasonCategory: (refundData.reasonCategory as RefundReasonCategory) || 'OTHER',
          remarks: String(refundData.remarks || refundData.reason || ''),
          processedAt: String(refundData.processedAt || 'Recent Settlement'),
          processedBy: String(refundData.processedBy || 'Operations Admin'),
          idempotencyKey: String(refundData.idempotencyKey || refundData.mockIdempotencyKey || ''),
          mockIdempotencyKey: String(refundData.mockIdempotencyKey || refundData.idempotencyKey || ''),
        }
      : undefined,
  };
}

export class RealPaymentRepository implements IPaymentRepository {
  async getTransactions(filter?: PaymentFilterCriteria): Promise<PaginatedPayments> {
    try {
      const [customerMap] = await Promise.all([
        getCustomerRegistry(),
        preloadCustomerPhones().catch(() => {}),
      ]);

      const params: Record<string, unknown> = {};

      if (filter?.status && filter.status !== 'ALL') {
        if (filter.status === 'PAID') {
          params.status = 'SUCCEEDED';
        } else if (filter.status === 'PAYMENT_FAILED') {
          params.status = 'FAILED';
        } else {
          params.status = filter.status;
        }
      }

      const hasSearch = Boolean(filter?.searchTerm?.trim());
      const hasFeeFilter = Boolean(filter?.feeType && filter.feeType !== 'ALL');

      if (!hasSearch && !hasFeeFilter) {
        params.page = filter?.page || 1;
        params.limit = filter?.pageSize || 10;
      } else {
        params.page = 1;
        params.limit = 100;
      }

      const res = await httpClient.get<{
        success: boolean;
        data: Record<string, unknown>[];
        meta?: { totalItems?: number; total?: number; currentPage?: number; page?: number; itemsPerPage?: number; limit?: number; totalPages?: number };
      }>('/admin/payments', { params });

      const payload = res.data;
      const rawItems = Array.isArray(payload.data) ? payload.data : [];

      // Pre-resolve authoritative complete unmasked phone numbers for customers in these transactions
      const customerIdsToResolve = Array.from(
        new Set(
          rawItems
            .map((item) => {
              const uId = String(item.customerUserId || item.customerId || '');
              const cust = uId ? customerMap.get(uId) : undefined;
              return cust?.id || (item.customerId ? String(item.customerId) : undefined);
            })
            .filter((id): id is string => Boolean(id))
        )
      );

      if (customerIdsToResolve.length > 0) {
        await Promise.all(
          customerIdsToResolve.map(async (cid) => {
            const cached = getCustomerPhone(cid);
            if (cached && !cached.includes('*')) return;
            try {
              const detailRes = await httpClient.get<Record<string, unknown>>(`/admin/customers/${cid}`);
              const detail = (detailRes.data?.data || detailRes.data) as Record<string, unknown>;
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

      let mapped = rawItems.map((item) => mapBackendPaymentToDomain(item, customerMap));

      if (hasSearch && filter?.searchTerm) {
        const q = filter.searchTerm.toLowerCase().trim();
        mapped = mapped.filter(
          (t) =>
            t.id.toLowerCase().includes(q) ||
            t.customerName.toLowerCase().includes(q) ||
            t.bookingRef.toLowerCase().includes(q) ||
            t.gatewayRef.toLowerCase().includes(q) ||
            t.serviceCategory.toLowerCase().includes(q) ||
            t.paymentMethod.toLowerCase().includes(q)
        );
      }

      if (hasFeeFilter && filter?.feeType && filter.feeType !== 'ALL') {
        mapped = mapped.filter((t) => t.feeType === filter.feeType);
      }

      let paginatedItems: PaymentTransaction[];
      let totalItems: number;
      let pageSize: number;
      let currentPage: number;
      let totalPages: number;

      if (hasSearch || hasFeeFilter) {
        totalItems = mapped.length;
        pageSize = filter?.pageSize || 10;
        currentPage = filter?.page || 1;
        totalPages = Math.ceil(totalItems / pageSize) || 1;
        paginatedItems = mapped.slice((currentPage - 1) * pageSize, currentPage * pageSize);
      } else {
        paginatedItems = mapped;
        totalItems = payload.meta?.totalItems ?? payload.meta?.total ?? mapped.length;
        pageSize = payload.meta?.itemsPerPage ?? payload.meta?.limit ?? filter?.pageSize ?? 10;
        currentPage = payload.meta?.currentPage ?? payload.meta?.page ?? filter?.page ?? 1;
        totalPages = payload.meta?.totalPages ?? (Math.ceil(totalItems / pageSize) || 1);
      }

      const totalGross = mapped
        .filter((t) => t.status === 'PAID')
        .reduce((sum, t) => sum + t.amountINR, 0);

      const pendingRefunds = mapped.filter((t) => t.status === 'REFUND_PENDING').length;

      return {
        items: paginatedItems,
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
      const [res, customerMap] = await Promise.all([
        httpClient.get<{ success: boolean; data: Record<string, unknown> }>(`/admin/payments/${id}`),
        getCustomerRegistry(),
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

      return mapBackendPaymentToDomain(raw, customerMap);
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
        const repData = (repRes.data?.data || repRes.data) as Record<string, unknown>;
        const totals = Array.isArray(repData?.totalsByFeeType)
          ? (repData.totalsByFeeType as Array<Record<string, unknown>>)
          : [];
        const grossMinor = totals.reduce((sum, item) => sum + Number(item.grossMinor || 0), 0);
        grossSettledCollectionsINR = Math.round(grossMinor / 100);
      } catch {
        // Fallback: Query SUCCEEDED payments from ledger
        try {
          const succRes = await httpClient.get<{
            data?: Array<Record<string, unknown>>;
          }>('/admin/payments', {
            params: { status: 'SUCCEEDED', limit: 100 },
          });
          const succItems = succRes.data?.data || [];
          const sumMinor = succItems.reduce((acc, p) => acc + Number(p.amountMinor || 0), 0);
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
      const key = idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idem_ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
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

  async exportPaymentsCsv(from: string, to: string): Promise<string> {
    try {
      const res = await httpClient.get<string>(`/admin/payments-export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
        responseType: 'text',
      });
      return typeof res.data === 'string' ? res.data : String(res.data);
    } catch (err) {
      try {
        const transactions = await this.getTransactions({ pageSize: 100 });
        const headers = 'Payment ID,Booking ID,Customer,Amount (INR),Status,Timestamp';
        const rows = transactions.items.map((t) => `"${t.id}","${t.bookingRef}","${t.customerName}",${t.amountINR},"${t.status}","${t.timestamp}"`);
        return [headers, ...rows].join('\n');
      } catch {
        throw mapHttpErrorToDomainError(err);
      }
    }
  }
}

export { RealPaymentRepository as PaymentRepositoryImpl };

export const createPaymentRepository = (
  useMock: boolean = env.VITE_USE_MOCK_AUTH
): IPaymentRepository => {
  return useMock ? new MockPaymentRepository() : new RealPaymentRepository();
};

export const paymentRepository = createPaymentRepository();
