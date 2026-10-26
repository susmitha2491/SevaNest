export interface SuperAdminKPIs {
  grossBookings: number | null;
  activeWorkforce: number | null;
  verificationQueue: number | null;
  activeGrievances: number | null;
  replacementVolume: number | null;
  platformRevenueINR: number | null;
  scheduledTrials: number | null;
  policeVerifDue: number | null;
}

export interface OperationsAdminKPIs {
  totalCustomers: number;
  totalWorkers: number;
  newBookingRequests: number;
  bookingsAwaitingMatching: number;
  scheduledTrialsToday: number;
  bookingsAwaitingConfirmation: number;
  activeLiveEngagements: number;
  replacementRequests: number;
  pendingVerificationCases: number;
  openDisputes: number;
  pendingRefunds: number;
  expiringVerifications: number;
}

export type OperationsQueueTab =
  | 'NEW_REQUESTS'
  | 'MATCHING'
  | 'TRIALS'
  | 'CONFIRMATIONS'
  | 'ACTIVE_SERVICES'
  | 'REPLACEMENTS'
  | 'REFUNDS'
  | 'FOLLOW_UPS'
  | 'SUPPORT_HANDOFFS';

export interface VerificationExecutiveKPIs {
  pendingReview: number;
  inProgressReview: number;
  reCheckDue: number;
  decisionsToday: number;
  completedReviews?: number;
  correctionsRequired?: number;
  overdueReviews?: number | null;
  avgProcessingTimeMinutes?: number | null;
}

export interface SupportExecutiveKPIs {
  openUnassignedGrievances: number | null;
  myActiveCases: number | null;
  slaAtRiskCount: number | null;
  slaBreachedCount: number | null;
  resolvedTodayCount: number | null;
}

export interface SuperAdminQueueItem {
  id: string;
  type: 'VERIFICATION' | 'GRIEVANCE' | 'REPLACEMENT' | 'CONFIG';
  title: string;
  source: string;
  timing: string;
  status: string;
  targetRoute: string;
  actionLabel: string;
}

export interface OperationsQueueItem {
  id: string;
  customerName: string;
  category: string;
  locality: string;
  status: string;
  submissionTime: string;
  dominantAction: string;
  targetRoute: string;
}

export interface VerificationDashboardQueueItem {
  id: string;
  workerId: string;
  workerName: string;
  category: string;
  submissionTime: string;
  pendingCheckTypes: string[];
  status: string;
  actionLabel: string;
}

export interface SupportDashboardQueueItem {
  id: string;
  ticketId: string;
  complainantName: string;
  roleType: 'CUSTOMER' | 'WORKER';
  category: string;
  disputeCategory: string;
  slaIndicator: 'BREACHED' | 'AT_RISK' | 'NORMAL';
  status: string;
  actionLabel: string;
}

export interface BookingStatusCount {
  status: string;
  count: number;
}

export interface WorkerSectionBreakdown {
  registered: number;
  verifiedAndActive: number;
}

export interface PendingKycSectionBreakdown {
  submitted: number;
  inReview: number;
}

export interface ComplaintsSectionBreakdown {
  open: number;
  inProgress: number;
  escalated: number;
  unassigned: number;
}

export interface ReplacementsSectionBreakdown {
  requested: number;
  approved: number;
}

export interface AlertsSectionBreakdown {
  open: number;
  critical: number;
  warning: number;
}

export interface CollectionMetricItem {
  currency: string;
  todayMinor: number;
  monthToDateMinor: number;
  todayINR: number;
  monthToDateINR: number;
  todayFormatted: string;
  monthToDateFormatted: string;
}

export interface SuperAdminDashboardSections {
  bookings?: {
    byStatus: BookingStatusCount[];
    grossBookings?: number | null;
  };
  workers?: WorkerSectionBreakdown;
  pendingKyc?: PendingKycSectionBreakdown;
  complaints?: ComplaintsSectionBreakdown;
  replacements?: ReplacementsSectionBreakdown;
  alerts?: AlertsSectionBreakdown;
  collections?: CollectionMetricItem[];
}

export interface SuperAdminDashboardData {
  generatedAt?: string;
  kpis: SuperAdminKPIs;
  queues: SuperAdminQueueItem[];
  sections?: SuperAdminDashboardSections;
}

export interface IDashboardRepository {
  getSuperAdminDashboard(): Promise<SuperAdminDashboardData>;
  getOperationsAdminDashboard(): Promise<{
    kpis: OperationsAdminKPIs;
    queues: Record<OperationsQueueTab, OperationsQueueItem[]>;
  }>;
  getVerificationExecutiveDashboard(): Promise<{
    kpis: VerificationExecutiveKPIs;
    queues: Record<'PENDING_REVIEW' | 'IN_REVIEW' | 'RECHECK_DUE' | 'REJECTED', VerificationDashboardQueueItem[]>;
  }>;
  getSupportExecutiveDashboard(): Promise<{
    kpis: SupportExecutiveKPIs;
    queues: Record<'AT_RISK' | 'UNASSIGNED' | 'MY_CASES' | 'ESCALATED', SupportDashboardQueueItem[]>;
  }>;
}
