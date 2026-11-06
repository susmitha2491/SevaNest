export type BookingStatus =
  | 'REQUESTED'
  | 'NEW_REQUEST'
  | 'MATCHED'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEW_TRIAL_SCHEDULED'
  | 'INTERVIEW_TRIAL_COMPLETED'
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'SERVICE_ACTIVE'
  | 'ACTIVE'
  | 'REPLACEMENT_REQUESTED'
  | 'REPLACED'
  | 'COMPLETED'
  | 'CANCELLED';

export type EngagementType =
  | 'FULL_TIME_LIVE_IN'
  | 'FULL_TIME_LIVE_OUT'
  | 'PART_TIME'
  | 'ONE_TIME';

export interface CandidateMatch {
  workerId: string;
  workerName: string;
  category: string;
  experienceYears: number;
  ratingAverage: number;
  totalReviews: number;
  locality: string;
  isFullyVerified: boolean;
  languages: string[];
  matchScore: number;
  dailyRateEstimate?: number;
}

export interface TrialSchedule {
  scheduledDate: string;
  timeSlot: string;
  durationHours: number;
  customerAddress: string;
  contactPerson: string;
  contactPhone: string;
  trialFeeAmount: number;
  notes?: string;
}

export interface TrialOutcome {
  outcome: 'SUCCEEDED' | 'REJECTED' | 'NO_SHOW';
  feedbackRemarks: string;
  customerConfirmed: boolean;
}

export interface ReplacementDetail {
  id?: string;
  bookingId?: string;
  requestedAt: string;
  reasonCategory: string;
  customerExplanation: string;
  eligibleUnderPolicy: boolean;
  coveragePlanName: string;
  priorWorkerId: string;
  priorWorkerName: string;
  replacementWorkerId?: string;
  replacementWorkerName?: string;
  status:
    | 'REQUESTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'COMPLETED'
    | 'PENDING_REMATCH'
    | 'TRIAL_SCHEDULED'
    | 'FULFILLED';
  operationalRemarks?: string;
  decisionRemarks?: string;
  decisionMessage?: string;
  decidedAt?: string;
}

export interface BookingDetail {
  id: string;
  customerId: string;
  customerName: string;
  customerPhoneMasked: string;
  customerLocality: string;
  serviceCategory: string;
  engagementType: EngagementType;
  timingShift: string;
  salaryBudgetMax: number;
  specialRequirements?: string;
  assignedWorkerId?: string;
  assignedWorkerName?: string;
  assignedWorkerPhoneMasked?: string;
  status: BookingStatus;
  createdAt: string;
  trial?: TrialSchedule;
  trialOutcome?: TrialOutcome;
  replacement?: ReplacementDetail;
  serviceStartDate?: string;
  contractPeriod?: string;
  platformFeePaid: boolean;
  platformFeeAmount: number;
  internalNotes: string[];

  // Extended fields from AdminBookingView
  customerUserId?: string;
  customerPhone?: string;
  customerEmail?: string;
  assignedWorkerPhone?: string;
  budgetMinMinor?: number;
  budgetMaxMinor?: number;
  budgetPeriod?: string;
  requirementNote?: string;
  requestedStartDate?: string;
  addressId?: string;
  workerRespondedAt?: string;
  respondBy?: string;
  proposedSlotAt?: string;
  proposedSlotNote?: string;
  replacesBookingId?: string;
  cancelReason?: string;
  cancelledByUserId?: string;
  updatedAt?: string;
  timeline?: Array<{
    from: string | null;
    to: string;
    by: string;
    note: string | null;
    at: string;
    actorUserId: string | null;
  }>;
}

export interface BookingPaymentEntry {
  id: string;
  bookingId: string;
  status: string;
  amountMinor: number;
  amountINR: number;
  currency: string;
  receiptNumber?: string | null;
  paidAt?: string | null;
  refundStatus?: string | null;
  refundedAt?: string | null;
  refundReason?: string | null;
  refundedByUserId?: string | null;
  paymentMethod?: string | null;
  paymentMethodDetail?: string | null;
  gatewayReference?: string | null;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  failureCode?: string | null;
  failureReason?: string | null;
  feeCode?: string;
  createdAt: string;
}

export interface BookingAuditEntry {
  id: string;
  actorStaffId: string;
  actorName: string;
  actorRole: string;
  actionType: string;
  targetRecordId: string;
  targetEntityType: string;
  summary: string;
  timestamp: string;
  operationalRemarks?: string;
}

export interface BookingCommunicationEvent {
  id: string;
  timestamp: string;
  channel: string;
  senderRole: 'CUSTOMER' | 'WORKER' | 'ADMIN' | 'SYSTEM';
  senderName?: string;
  title: string;
  outcome?: string;
  remarks: string;
}

export interface BookingFilterCriteria {
  searchTerm?: string;
  status?: string;
  category?: string;
  locality?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'customerName' | 'category' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedBookings {
  items: BookingDetail[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface MatchRequirement {
  category: string;
  areaId: string;
  engagement: 'FULL_TIME' | 'PART_TIME' | 'LIVE_IN' | 'DAILY' | 'HOURLY' | 'SHIFT' | 'ONE_TIME';
  availableFrom: string;
  availableTo: string;
  startDate?: string;
  language?: string;
  minExperienceMonths?: number;
  page?: number;
  limit?: number;
}

export interface BookingHistoryData {
  timeline: Array<{
    from: string | null;
    to: string;
    by: string;
    note: string | null;
    at: string;
    actorUserId: string | null;
  }>;
  interviews?: Array<{
    id: string;
    type: string;
    status: string;
    statusLabel?: string;
    requestedBy?: string;
    preferredAt?: string;
    scheduledAt?: string;
    proposedAt?: string;
    proposedBy?: string;
    note?: string;
    declineReason?: string;
    cancelReason?: string;
    outcome?: string;
    outcomeNote?: string;
    meetingLink?: string;
    location?: string;
    scheduleType?: string;
    completedAt?: string;
    cancelledAt?: string;
    createdAt?: string;
    updatedAt?: string;
    timeline?: Array<{ title: string; state: string; at: string }>;
  }>;
  replacementChain?: Array<{
    id?: string;
    bookingId: string;
    position: number;
    status: string;
    workerId: string;
    startDate?: string;
    createdAt: string;
    current: boolean;
  }>;
  payments?: BookingPaymentEntry[];
  auditLogs?: BookingAuditEntry[];
  communications?: BookingCommunicationEvent[];
  rawBookingDetail?: Record<string, unknown>;
}

export interface IBookingRepository {
  getBookings(filter?: BookingFilterCriteria): Promise<PaginatedBookings>;
  getBookingById(id: string): Promise<BookingDetail | null>;
  getCandidateSuggestions(bookingId: string): Promise<CandidateMatch[]>;
  matchCandidates?(requirement: MatchRequirement): Promise<CandidateMatch[]>;
  scheduleTrial(bookingId: string, candidateWorkerId: string, trial: TrialSchedule): Promise<void>;
  recordTrialOutcome(bookingId: string, outcome: TrialOutcome): Promise<void>;
  confirmBooking(bookingId: string): Promise<void>;
  processReplacement(bookingId: string, replacementWorkerId: string, remarks: string): Promise<void>;
  cancelBooking(bookingId: string, remarks: string, reasonCategory: string): Promise<void>;
  approveReplacement?(requestId: string, remarks?: string): Promise<void>;
  rejectReplacement?(requestId: string, remarks: string): Promise<void>;
  getReplacementCandidates?(requestId: string): Promise<CandidateMatch[]>;
  selectReplacementWorker?(requestId: string, workerId: string): Promise<void>;
  getBookingHistory?(bookingId: string): Promise<BookingHistoryData>;
}
