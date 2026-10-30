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

export interface BookingFunnelSeriesItem {
  period: string;
  requests: number;
  confirmed: number;
  confirmationRate: number;
}

export interface BookingFunnelData {
  interval: string;
  requests: number;
  confirmed: number;
  confirmationRate: number;
  series: BookingFunnelSeriesItem[];
}

export interface CategoryDemandItem {
  categoryId: string;
  code: string;
  name: string;
  requests: number;
}

export interface CategoryDemandData {
  total: number;
  categories: CategoryDemandItem[];
}

export interface AreaDemandItem {
  areaId: string;
  name: string;
  city: string;
  requests: number;
}

export interface WorkerRegistrationsSeriesItem {
  period: string;
  registered: number;
  verified: number;
  verificationConversion: number;
}

export interface WorkerRegistrationsData {
  interval: string;
  registered: number;
  verified: number;
  verificationConversion: number;
  series: WorkerRegistrationsSeriesItem[];
}

export interface WorkerUtilizationData {
  verifiedWorkers: number;
  workersWithActiveBooking: number;
  utilization: number;
}

export interface InterviewConversionData {
  interviewsHeld: number;
  confirmed: number;
  conversion: number;
}

export interface CancellationRateData {
  totalBookings: number;
  cancelled: number;
  cancellationRate: number;
}

export interface ReplacementRateData {
  activeBookings: number;
  replacementRequests: number;
  replacementRate: number;
}

export interface FeeTypeTotalItem {
  feeCode: string;
  currency: string;
  payments: number;
  grossMinor: number;
  refundedMinor: number;
}

export interface PaymentCollectionSeriesItem {
  period: string;
  feeCode: string;
  currency: string;
  payments: number;
  grossMinor: number;
  refundedMinor: number;
}

export interface PaymentCollectionsData {
  interval: string;
  totalsByFeeType: FeeTypeTotalItem[];
  series: PaymentCollectionSeriesItem[];
}

export interface SupportStatusCount {
  status: string;
  count: number;
}

export interface SupportSeriesItem {
  period: string;
  count: number;
}

export interface SupportTicketsAnalyticsData {
  interval: string;
  created: number;
  closed: number;
  averageResolutionSeconds: number | null;
  byStatus: SupportStatusCount[];
  series: SupportSeriesItem[];
}

export interface TopRatedWorkerItem {
  workerId: string;
  name: string;
  ratingCount: number;
  averageRating: number;
}

export interface RepeatCustomerItem {
  customerUserId: string;
  name: string;
  bookings: number;
}

export interface SuperAdminAnalyticsData {
  bookingFunnel: BookingFunnelData | null;
  categoryDemand: CategoryDemandData | null;
  areaDemand: AreaDemandItem[] | null;
  workerRegistrations: WorkerRegistrationsData | null;
  workerUtilization: WorkerUtilizationData | null;
  interviewConversion: InterviewConversionData | null;
  cancellationRate: CancellationRateData | null;
  replacementRate: ReplacementRateData | null;
  paymentCollections: PaymentCollectionsData | null;
  supportTickets: SupportTicketsAnalyticsData | null;
  topRatedWorkers: TopRatedWorkerItem[] | null;
  repeatCustomers: RepeatCustomerItem[] | null;
}

export interface IDashboardRepository {
  getSuperAdminDashboard(): Promise<SuperAdminDashboardData>;
  getSuperAdminAnalytics(from?: string, to?: string): Promise<SuperAdminAnalyticsData>;
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
