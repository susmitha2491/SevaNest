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

export type ReplacementReasonCode =
  | 'WORK_QUALITY'
  | 'BEHAVIOUR'
  | 'ATTENDANCE'
  | 'MISMATCH'
  | 'WORKER_UNAVAILABLE'
  | 'OTHER';

export const REPLACEMENT_REASONS: Record<ReplacementReasonCode, string> = {
  WORK_QUALITY: 'Quality of work',
  BEHAVIOUR: 'Worker behaviour or conduct',
  ATTENDANCE: 'Punctuality and attendance',
  MISMATCH: 'Skill or expectation mismatch',
  WORKER_UNAVAILABLE: 'Worker unavailable',
  OTHER: 'Other reason',
};

export type ReplacementStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED';

export interface CandidateMatch {
  workerId: string;
  workerName: string;
  category: string;
  experienceYears: number;
  experienceMonths?: number | null;
  ratingAverage?: number;
  totalReviews?: number;
  locality: string;
  isFullyVerified: boolean;
  languages: string[];
  matchScore?: number;
  dailyRateEstimate?: number;
  serviceAreas?: Array<{ id?: string; code?: string; name?: string; city?: string }>;
  categories?: Array<{ id?: string; code?: string; name?: string }>;
  engagementPreference?: string | null;
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
  id: string;
  bookingId: string;
  status: ReplacementStatus;
  reasonCode?: ReplacementReasonCode;
  reason?: string;
  notes?: string | null;
  neededFrom?: string | null;
  decisionMessage?: string | null;
  decisionRemarks?: string | null;
  replacementBookingId?: string | null;
  currentWorkerId?: string | null;
  requestedByUserId?: string;
  decidedByUserId?: string | null;
  createdAt?: string;
  decidedAt?: string | null;
  completedAt?: string | null;

  // Preserved for backwards compatibility / UI convenience:
  requestedAt?: string;
  reasonCategory?: string;
  customerExplanation?: string;
  priorWorkerId?: string;
  priorWorkerName?: string;
  replacementWorkerId?: string;
  replacementWorkerName?: string;
  coveragePlanName?: string;
  eligibleUnderPolicy?: boolean;
  operationalRemarks?: string;
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
  communications?: BookingCommunicationEvent[];

  // Extended fields from AdminBookingView
  customerUserId?: string;
  customerPhone?: string;
  customerEmail?: string;
  assignedWorkerPhone?: string;
  categoryCode?: string;
  areaId?: string;
  availableFrom?: string;
  availableTo?: string;
  engagement?: string;
  allowedActions?: string[];
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
    replacesBookingId?: string | null;
    workerId?: string;
    workerName?: string;
    startDate?: string;
    createdAt?: string;
    current: boolean;
  }>;
  payments?: BookingPaymentEntry[];
  auditLogs?: BookingAuditEntry[];
  communications?: BookingCommunicationEvent[];
  rawBookingDetail?: Record<string, unknown>;
}

export type BackendAttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCEPTION' | 'LATE' | 'LEAVE';

export interface BookingAttendanceHistoryItem {
  id: string;
  previousStatus?: string | null;
  newStatus: string;
  note?: string | null;
  reason?: string | null;
  changedByUserId?: string | null;
  actorKind?: string | null;
  changedAt: string;
}

export interface BookingAttendanceEntry {
  id: string;
  bookingId: string;
  workerId: string;
  date: string;
  status: BackendAttendanceStatus | string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  note?: string | null;
  markedByRole?: string;
  recordedByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  etag?: string;
  history?: BookingAttendanceHistoryItem[];
}

export interface BookingAttendancePage {
  items: BookingAttendanceEntry[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GlobalAttendanceOverview {
  entries: BookingAttendanceEntry[];
  bookings: BookingDetail[];
  isComplete: boolean;
  incompleteReason?: string;
  failedBookingsCount: number;
}

export interface BookingAttendanceSummary {
  bookingId: string;
  month: string;
  from?: string;
  to?: string;
  daysInMonth?: number;
  recorded?: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  exceptionDays: number;
  leaveDays: number;
  scheduledWindow?: { from?: string; to?: string } | null;
}

export interface RecordAttendanceInput {
  date: string;
  status: BackendAttendanceStatus;
  note?: string;
  idempotencyKey?: string;
}

export interface CorrectAttendanceInput {
  status: BackendAttendanceStatus;
  note?: string;
  reason: string;
  etag?: string;
}

export interface InterviewActionPayload {
  scheduledAt?: string;
  outcomeNote?: string;
  reason?: string;
  note?: string;
  meetingLink?: string;
  location?: string;
}

export interface IBookingRepository {
  getBookings(filter?: BookingFilterCriteria): Promise<PaginatedBookings>;
  getBookingById(id: string): Promise<BookingDetail | null>;
  getCandidateSuggestions(bookingId: string): Promise<CandidateMatch[]>;
  matchCandidates?(requirement: MatchRequirement): Promise<CandidateMatch[]>;
  assignMatchedWorker?(bookingId: string, workerId: string, reason?: string): Promise<void>;
  reopenMatching?(bookingId: string, reason: string): Promise<void>;
  scheduleTrial(bookingId: string, candidateWorkerId: string, trial: TrialSchedule & { scheduleType?: 'TRIAL' | 'INTERVIEW' }): Promise<void>;
  recordTrialOutcome(bookingId: string, outcome: TrialOutcome): Promise<void>;
  confirmBooking(bookingId: string, startDate?: string): Promise<void>;
  startService?(bookingId: string, note?: string): Promise<void>;
  completeBooking?(bookingId: string, note?: string): Promise<void>;
  respondSlotProposal?(bookingId: string, answer: 'accept' | 'reject', note?: string): Promise<void>;
  performInterviewAction?(interviewId: string, action: 'confirm' | 'reschedule' | 'complete' | 'cancel', payload?: InterviewActionPayload): Promise<void>;
  getBookingAttendance?(bookingId: string, params?: { from?: string; to?: string; page?: number; limit?: number }): Promise<BookingAttendanceEntry[]>;
  getBookingAttendancePage?(bookingId: string, params?: { from?: string; to?: string; page?: number; limit?: number }): Promise<BookingAttendancePage>;
  getAllAttendanceOverview?(params?: { from?: string; to?: string }): Promise<GlobalAttendanceOverview>;
  getBookingAttendanceSummary?(bookingId: string, month: string): Promise<BookingAttendanceSummary | null>;
  recordBookingAttendance?(bookingId: string, payload: RecordAttendanceInput): Promise<void>;
  correctBookingAttendance?(attendanceId: string, payload: CorrectAttendanceInput): Promise<void>;
  processReplacement(bookingId: string, replacementWorkerId: string, remarks: string): Promise<void>;
  cancelBooking(bookingId: string, remarks: string, reasonCategory: string): Promise<void>;
  approveReplacement(requestId: string, remarks?: string, message?: string): Promise<void>;
  rejectReplacement(requestId: string, remarks: string, message?: string): Promise<void>;
  getReplacementCandidates(requestId: string): Promise<CandidateMatch[]>;
  selectReplacementWorker(requestId: string, workerId: string): Promise<void>;
  getBookingHistory(bookingId: string): Promise<BookingHistoryData>;
}
