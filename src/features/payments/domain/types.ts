export type FeeClassification =
  | 'BOOKING_FEE'
  | 'PLACEMENT_FEE'
  | 'REPLACEMENT_PLAN'
  | 'SUBSCRIPTION';

export type PaymentStatus =
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type RefundReasonCategory =
  | 'WORKER_NO_SHOW'
  | 'UNSATISFACTORY_TRIAL'
  | 'CANCELLATION_POLICY'
  | 'OPERATIONAL_ERROR'
  | 'OTHER';

export const REFUND_REASONS: { key: RefundReasonCategory; label: string }[] = [
  { key: 'WORKER_NO_SHOW', label: 'Worker No-Show / Attendance Breach' },
  { key: 'UNSATISFACTORY_TRIAL', label: 'Unsatisfactory Trial / Customer Cancellation' },
  { key: 'CANCELLATION_POLICY', label: 'Customer Cancellation Under Policy' },
  { key: 'OPERATIONAL_ERROR', label: 'Operational or Billing Discrepancy' },
  { key: 'OTHER', label: 'Other Specific Operational Rationale' },
];

export interface FeeBreakdown {
  baseAmount: number;
  gstAmount: number;
  platformCommission: number;
}

export interface RefundRecord {
  refundId: string;
  refundAmountINR: number;
  reasonCategory: RefundReasonCategory;
  remarks: string;
  processedAt: string;
  processedBy: string;
  mockIdempotencyKey: string;
}

export interface PaymentTransaction {
  id: string;
  customerId: string;
  customerName: string;
  customerPhoneMasked: string;
  bookingRef: string;
  serviceCategory: string;
  feeType: FeeClassification;
  feeDescription: string;
  amountINR: number;
  paymentMethod: string;
  gatewayRef: string;
  status: PaymentStatus;
  timestamp: string;
  breakdown: FeeBreakdown;
  refund?: RefundRecord;
}

export interface PaymentFilterCriteria {
  searchTerm?: string;
  status?: string;
  feeType?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'timestamp' | 'amountINR' | 'customerName' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedPayments {
  items: PaymentTransaction[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalGrossCollectionsINR: number;
  pendingRefundsCount: number;
}

export interface IPaymentRepository {
  getTransactions(filter?: PaymentFilterCriteria): Promise<PaginatedPayments>;
  getTransactionById(id: string): Promise<PaymentTransaction | null>;
  processRefund(
    transactionId: string,
    amount: number,
    reasonCategory: RefundReasonCategory,
    remarks: string
  ): Promise<void>;
}
