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
    scheduledAt?: string;
    outcomeNote?: string;
    createdAt?: string;
    timeline?: Array<{ title: string; state: string; at: string }>;
  }>;
  replacementChain?: Array<{
    bookingId: string;
    position: number;
    status: string;
    workerId: string;
    startDate?: string;
    createdAt: string;
    current: boolean;
  }>;
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
