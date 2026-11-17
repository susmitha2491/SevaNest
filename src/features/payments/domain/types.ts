export type FeeClassification =
  | 'BOOKING_FEE'
  | 'PLACEMENT_FEE'
  | 'REPLACEMENT_PLAN'
  | 'SUBSCRIPTION'
  | 'VERIFICATION_FEE'
  | 'CANCELLATION_FEE'
  | string;

export type PaymentStatus =
  | 'PAID'
  | 'SUCCEEDED'
  | 'CREATED'
  | 'PENDING'
  | 'FAILED'
  | 'PAYMENT_FAILED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'REFUND_FAILED';

export type RefundStatus = 'REFUND_PENDING' | 'REFUNDED' | 'REFUND_FAILED';

export interface RefundDto {
  approval: 'APPROVE';
  reason: string;
}

export interface RefundRecord {
  refundStatus: RefundStatus;
  refundAmountINR: number;
  refundedAt?: string;
  refundReason?: string;
  refundedByUserId?: string;
  refundId?: string;
  reasonCategory?: string;
  remarks?: string;
  processedBy?: string;
  processedAt?: string;
  idempotencyKey?: string;
  mockIdempotencyKey?: string;
}

export type FeeKind =
  | 'BOOKING'
  | 'PLACEMENT'
  | 'VERIFICATION'
  | 'REPLACEMENT_PLAN'
  | 'SUBSCRIPTION'
  | 'CANCELLATION';

export interface FeeRecord {
  code: string;
  kind: FeeKind;
  amountMinor: number;
  amountINR: number;
  currency: string;
  isActive: boolean;
  updatedAt: string;
}

export interface FeeBreakdown {
  baseAmount: number;
  gstAmount: number;
  platformCommission: number;
}

export interface PaymentTransaction {
  id: string;
  customerId: string;
  customerUserId?: string;
  customerName: string;
  customerPhoneMasked: string;
  customerPhone?: string;
  bookingRef: string;
  bookingId?: string;
  serviceCategory: string;
  feeType: FeeClassification;
  feeCode?: string;
  feeKind?: FeeKind;
  feeDescription: string;
  amountINR: number;
  amountMinor?: number;
  paymentMethod: string;
  paymentMethodDetail?: string;
  gatewayRef: string;
  status: PaymentStatus;
  rawStatus?: string;
  timestamp: string;
  createdAt?: string;
  paidAt?: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  receiptNumber?: string;
  failureReason?: string;
  failureCode?: string;
  breakdown: FeeBreakdown;
  refundStatus?: RefundStatus | null;
  refundedAt?: string | null;
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
  refunded?: boolean;
}

export interface PaginatedPayments {
  items: PaymentTransaction[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalGrossCollectionsINR: number;
}

export interface FinancialOverviewMetrics {
  grossSettledCollectionsINR: number;
  totalLedgerRecords: number;
  totalRefundedINR?: number;
}

export interface IPaymentRepository {
  getTransactions(filter?: PaymentFilterCriteria): Promise<PaginatedPayments>;
  getTransactionById(id: string): Promise<PaymentTransaction | null>;
  getFinancialOverview(from?: string, to?: string): Promise<FinancialOverviewMetrics>;
  reconcilePayment(paymentId: string): Promise<PaymentTransaction>;
  processRefund(paymentId: string, dto: RefundDto): Promise<PaymentTransaction>;
  getFeeRecords(kind?: string): Promise<FeeRecord[]>;
  exportPaymentsCsv(from?: string, to?: string, filter?: PaymentFilterCriteria): Promise<string>;
  exportPaymentsExcel(filter?: PaymentFilterCriteria): Promise<Blob>;
  getAllFilteredTransactions?(filter?: PaymentFilterCriteria): Promise<PaymentTransaction[]>;
}
