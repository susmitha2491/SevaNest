import {
  PaymentTransaction,
  PaymentFilterCriteria,
  PaginatedPayments,
  IPaymentRepository,
  RefundReasonCategory,
} from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';

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
    remarks: string
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
        mockIdempotencyKey: `mock_idem_key_${Date.now()}`,
      };
    }
  }
}

function mapBackendPaymentToDomain(raw: Record<string, unknown>): PaymentTransaction {
  const customer = raw.customer as Record<string, unknown> | undefined;
  const breakdown = raw.breakdown as Record<string, unknown> | undefined;
  const refund = raw.refund as Record<string, unknown> | undefined;

  const amount = Number(raw.amount || raw.amountINR || 0);
  const baseAmount = Number(breakdown?.baseAmount ?? (amount / 1.18).toFixed(2));
  const gstAmount = Number(breakdown?.gstAmount ?? (amount - baseAmount).toFixed(2));

  return {
    id: String(raw.id || raw.paymentId || ''),
    customerId: String(raw.customerId || customer?.id || raw.customerUserId || ''),
    customerName: String(raw.customerName || customer?.fullName || 'Customer'),
    customerPhoneMasked: String(raw.customerPhoneMasked || customer?.phoneMasked || '+91 *****'),
    bookingRef: String(raw.bookingId || raw.bookingRef || 'B-NA'),
    serviceCategory: String(raw.serviceCategory || raw.category || 'General'),
    feeType: (raw.feeType as PaymentTransaction['feeType']) || 'BOOKING_FEE',
    feeDescription: String(raw.feeDescription || raw.description || 'Service Placement Fee'),
    amountINR: amount,
    paymentMethod: String(raw.paymentMethod || raw.method || 'Online / UPI'),
    gatewayRef: String(raw.gatewayRef || raw.razorpayPaymentId || raw.id),
    status: (raw.status as PaymentTransaction['status']) || 'PAID',
    timestamp: String(raw.createdAt || raw.timestamp || 'Recent'),
    breakdown: {
      baseAmount,
      gstAmount,
      platformCommission: Number(breakdown?.platformCommission ?? baseAmount),
    },
    refund: refund
      ? {
          refundId: String(refund.id || refund.refundId),
          refundAmountINR: Number(refund.amount || refund.refundAmountINR || amount),
          reasonCategory: (refund.reasonCategory as RefundReasonCategory) || 'OTHER',
          remarks: String(refund.remarks || refund.reason || ''),
          processedAt: String(refund.processedAt || 'Recent'),
          processedBy: String(refund.processedBy || 'Admin'),
          mockIdempotencyKey: String(refund.mockIdempotencyKey || refund.idempotencyKey || ''),
        }
      : undefined,
  };
}

export class RealPaymentRepository implements IPaymentRepository {
  async getTransactions(filter?: PaymentFilterCriteria): Promise<PaginatedPayments> {
    try {
      const params: Record<string, unknown> = {
        page: filter?.page || 1,
        limit: filter?.pageSize || 10,
      };
      if (filter?.status && filter.status !== 'ALL') {
        params.status = filter.status;
      }
      if (filter?.searchTerm) {
        params.search = filter.searchTerm;
      }

      const res = await httpClient.get<{
        success: boolean;
        data: Record<string, unknown>[];
        meta?: { totalItems?: number; currentPage?: number; itemsPerPage?: number; totalPages?: number };
      }>('/admin/payments', { params });

      const payload = res.data;
      const items = Array.isArray(payload.data) ? payload.data : [];
      const mapped = items.map(mapBackendPaymentToDomain);

      const totalGross = mapped
        .filter((t) => t.status === 'PAID')
        .reduce((sum, t) => sum + t.amountINR, 0);

      const pendingRefunds = mapped.filter((t) => t.status === 'REFUND_PENDING').length;

      return {
        items: mapped,
        totalCount: payload.meta?.totalItems ?? items.length,
        page: payload.meta?.currentPage ?? filter?.page ?? 1,
        pageSize: payload.meta?.itemsPerPage ?? filter?.pageSize ?? 10,
        totalPages: payload.meta?.totalPages ?? (Math.ceil((payload.meta?.totalItems || items.length) / (filter?.pageSize || 10)) || 1),
        totalGrossCollectionsINR: totalGross,
        pendingRefundsCount: pendingRefunds,
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getTransactionById(id: string): Promise<PaymentTransaction | null> {
    try {
      const res = await httpClient.get<{ success: boolean; data: Record<string, unknown> }>(`/admin/payments/${id}`);
      const raw = res.data.data;
      return raw ? mapBackendPaymentToDomain(raw) : null;
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async processRefund(
    transactionId: string,
    _amount: number,
    reasonCategory: RefundReasonCategory,
    remarks: string
  ): Promise<void> {
    try {
      await httpClient.post(`/admin/payments/${transactionId}/refund`, {
        reason: `${reasonCategory}: ${remarks}`,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
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
