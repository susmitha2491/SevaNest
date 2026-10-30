import {
  IDashboardRepository,
  SuperAdminQueueItem,
  SuperAdminDashboardData,
  SuperAdminDashboardSections,
  OperationsAdminKPIs,
  OperationsQueueItem,
  OperationsQueueTab,
  VerificationExecutiveKPIs,
  VerificationDashboardQueueItem,
  SupportExecutiveKPIs,
  SupportDashboardQueueItem,
  SuperAdminAnalyticsData,
  BookingFunnelData,
  CategoryDemandData,
  AreaDemandItem,
  WorkerRegistrationsData,
  WorkerUtilizationData,
  InterviewConversionData,
  CancellationRateData,
  ReplacementRateData,
  PaymentCollectionsData,
  SupportTicketsAnalyticsData,
  TopRatedWorkerItem,
  RepeatCustomerItem,
} from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';
import { ServerFailureError } from '../../../core/errors/DomainError';
import { formatCurrencyINR } from '../../../shared/formatters/currency';

export class MockDashboardRepository implements IDashboardRepository {
  async getSuperAdminDashboard(): Promise<SuperAdminDashboardData> {
    return {
      generatedAt: '2026-10-15T06:31:28.064Z',
      kpis: {
        grossBookings: 1420,
        activeWorkforce: 385,
        verificationQueue: 42,
        activeGrievances: 7,
        replacementVolume: 14,
        platformRevenueINR: 485200,
        scheduledTrials: 18,
        policeVerifDue: 9,
      },
      queues: [
        {
          id: 'VQ-1048',
          type: 'VERIFICATION',
          title: 'Worker Verification Backlog (42 pending)',
          source: 'Trust & Safety Queue',
          timing: 'Recent Backlog',
          status: 'PENDING_REVIEW',
          targetRoute: '/verification',
          actionLabel: 'Review Workstation',
        },
        {
          id: 'TKT-4921',
          type: 'GRIEVANCE',
          title: 'High-Priority Grievance Escalation: Breach Risk',
          source: 'Customer Support Escalation',
          timing: 'Recent Escalation',
          status: 'ESCALATED',
          targetRoute: '/support',
          actionLabel: 'Inspect Dispute',
        },
        {
          id: 'REP-84912',
          type: 'REPLACEMENT',
          title: 'Marketplace Rematch Handoff (Cook - Gachibowli)',
          source: 'Operations Fulfillment',
          timing: 'Recent Handoff',
          status: 'REPLACEMENT_REQUESTED',
          targetRoute: '/bookings',
          actionLabel: 'Rematch Pool',
        },
        {
          id: 'AUD-902',
          type: 'CONFIG',
          title: 'Recent Pricing & Fee Structure Update Published',
          source: 'Platform Governance',
          timing: 'Recent Change',
          status: 'ACTIVE',
          targetRoute: '/audit',
          actionLabel: 'Audit Delta',
        },
      ],
      sections: {
        bookings: {
          byStatus: [
            { status: 'ACTIVE', count: 2 },
            { status: 'CANCELLED', count: 1 },
            { status: 'COMPLETED', count: 3 },
            { status: 'CONFIRMED', count: 1 },
            { status: 'INTERVIEW_TRIAL_COMPLETED', count: 1 },
            { status: 'INTERVIEW_TRIAL_SCHEDULED', count: 1 },
            { status: 'MATCHED', count: 2 },
            { status: 'PENDING_PAYMENT', count: 2 },
            { status: 'REPLACEMENT_REQUESTED', count: 1 },
          ],
          grossBookings: 1420,
        },
        workers: {
          registered: 13,
          verifiedAndActive: 9,
        },
        pendingKyc: {
          submitted: 1,
          inReview: 1,
        },
        complaints: {
          open: 1,
          inProgress: 1,
          escalated: 0,
          unassigned: 1,
        },
        replacements: {
          requested: 0,
          approved: 1,
        },
        alerts: {
          open: 0,
          critical: 0,
          warning: 0,
        },
        collections: [
          {
            currency: 'INR',
            todayMinor: 0,
            monthToDateMinor: 48520000,
            todayINR: 0,
            monthToDateINR: 485200,
            todayFormatted: '₹0.00',
            monthToDateFormatted: '₹4,85,200.00',
          },
        ],
      },
    };
  }

  async getSuperAdminAnalytics(): Promise<SuperAdminAnalyticsData> {
    return {
      bookingFunnel: {
        interval: 'month',
        requests: 1420,
        confirmed: 890,
        confirmationRate: 0.6268,
        series: [
          { period: '2026-05', requests: 220, confirmed: 135, confirmationRate: 0.6136 },
          { period: '2026-06', requests: 280, confirmed: 172, confirmationRate: 0.6143 },
          { period: '2026-07', requests: 310, confirmed: 195, confirmationRate: 0.6290 },
          { period: '2026-08', requests: 340, confirmed: 215, confirmationRate: 0.6324 },
          { period: '2026-09', requests: 270, confirmed: 173, confirmationRate: 0.6407 },
        ],
      },
      categoryDemand: {
        total: 1420,
        categories: [
          { categoryId: 'cat-maid', code: 'HOUSE_MAID', name: 'House Maid', requests: 520 },
          { categoryId: 'cat-cook', code: 'COOK', name: 'Cook', requests: 340 },
          { categoryId: 'cat-babysitter', code: 'BABYSITTER', name: 'Babysitter / Nanny', requests: 210 },
          { categoryId: 'cat-elderly', code: 'ELDERLY_CARE', name: 'Elderly Care', requests: 160 },
          { categoryId: 'cat-driver', code: 'DRIVER', name: 'Driver', requests: 130 },
          { categoryId: 'cat-allrounder', code: 'ALL_ROUNDER', name: 'All-Rounder', requests: 60 },
        ],
      },
      areaDemand: [
        { areaId: 'area-gachibowli', name: 'Gachibowli', city: 'Hyderabad', requests: 380 },
        { areaId: 'area-hiteccity', name: 'HITEC City', city: 'Hyderabad', requests: 340 },
        { areaId: 'area-madhapur', name: 'Madhapur', city: 'Hyderabad', requests: 290 },
        { areaId: 'area-kondapur', name: 'Kondapur', city: 'Hyderabad', requests: 240 },
        { areaId: 'area-jubileehills', name: 'Jubilee Hills', city: 'Hyderabad', requests: 170 },
      ],
      workerRegistrations: {
        interval: 'month',
        registered: 385,
        verified: 320,
        verificationConversion: 0.8312,
        series: [
          { period: '2026-05', registered: 60, verified: 48, verificationConversion: 0.8 },
          { period: '2026-06', registered: 75, verified: 62, verificationConversion: 0.8267 },
          { period: '2026-07', registered: 85, verified: 71, verificationConversion: 0.8353 },
          { period: '2026-08', registered: 90, verified: 76, verificationConversion: 0.8444 },
          { period: '2026-09', registered: 75, verified: 63, verificationConversion: 0.84 },
        ],
      },
      workerUtilization: {
        verifiedWorkers: 320,
        workersWithActiveBooking: 245,
        utilization: 0.7656,
      },
      interviewConversion: {
        interviewsHeld: 410,
        confirmed: 295,
        conversion: 0.7195,
      },
      cancellationRate: {
        totalBookings: 1420,
        cancelled: 85,
        cancellationRate: 0.0599,
      },
      replacementRate: {
        activeBookings: 348,
        replacementRequests: 14,
        replacementRate: 0.0402,
      },
      paymentCollections: {
        interval: 'month',
        totalsByFeeType: [
          { feeCode: 'PLATFORM_FEE', currency: 'INR', payments: 890, grossMinor: 38500000, refundedMinor: 0 },
          { feeCode: 'REGISTRATION_FEE', currency: 'INR', payments: 385, grossMinor: 19250000, refundedMinor: 0 },
        ],
        series: [
          { period: '2026-05', feeCode: 'PLATFORM_FEE', currency: 'INR', payments: 135, grossMinor: 7425000, refundedMinor: 0 },
          { period: '2026-06', feeCode: 'PLATFORM_FEE', currency: 'INR', payments: 172, grossMinor: 9460000, refundedMinor: 0 },
          { period: '2026-07', feeCode: 'PLATFORM_FEE', currency: 'INR', payments: 195, grossMinor: 10725000, refundedMinor: 0 },
          { period: '2026-08', feeCode: 'PLATFORM_FEE', currency: 'INR', payments: 215, grossMinor: 11825000, refundedMinor: 0 },
          { period: '2026-09', feeCode: 'PLATFORM_FEE', currency: 'INR', payments: 173, grossMinor: 9515000, refundedMinor: 0 },
        ],
      },
      supportTickets: {
        interval: 'month',
        created: 148,
        closed: 135,
        averageResolutionSeconds: 7200,
        byStatus: [
          { status: 'OPEN', count: 7 },
          { status: 'IN_PROGRESS', count: 4 },
          { status: 'RESOLVED', count: 120 },
          { status: 'CLOSED', count: 15 },
          { status: 'ESCALATED', count: 3 },
        ],
        series: [
          { period: '2026-05', count: 24 },
          { period: '2026-06', count: 32 },
          { period: '2026-07', count: 38 },
          { period: '2026-08', count: 30 },
          { period: '2026-09', count: 24 },
        ],
      },
      topRatedWorkers: [
        { workerId: 'W-10482', name: 'Sunita Devi', ratingCount: 48, averageRating: 4.9 },
        { workerId: 'W-10484', name: 'Meena Bai', ratingCount: 39, averageRating: 4.85 },
        { workerId: 'W-10483', name: 'Ramesh Yadav', ratingCount: 42, averageRating: 4.8 },
        { workerId: 'W-10488', name: 'Anil Rao', ratingCount: 31, averageRating: 4.75 },
        { workerId: 'W-10490', name: 'Lakshmi K', ratingCount: 27, averageRating: 4.7 },
      ],
      repeatCustomers: [
        { customerUserId: 'C-901', name: 'Anand Sharma', bookings: 6 },
        { customerUserId: 'C-902', name: 'Priya Reddy', bookings: 5 },
        { customerUserId: 'C-903', name: 'Rajesh Kumar', bookings: 4 },
        { customerUserId: 'C-904', name: 'Sneha Patel', bookings: 4 },
        { customerUserId: 'C-905', name: 'Vikram Verma', bookings: 3 },
      ],
    };
  }

  async getOperationsAdminDashboard(): Promise<{
    kpis: OperationsAdminKPIs;
    queues: Record<OperationsQueueTab, OperationsQueueItem[]>;
  }> {
    return {
      kpis: {
        totalCustomers: 128,
        totalWorkers: 164,
        newBookingRequests: 28,
        bookingsAwaitingMatching: 19,
        scheduledTrialsToday: 12,
        bookingsAwaitingConfirmation: 6,
        activeLiveEngagements: 348,
        replacementRequests: 14,
        pendingVerificationCases: 18,
        openDisputes: 5,
        pendingRefunds: 3,
        expiringVerifications: 8,
      },
      queues: {
        NEW_REQUESTS: [
          { id: 'B-84920', customerName: 'Anand Sharma', category: 'House Maid', locality: 'Kondapur', status: 'REQUESTED', submissionTime: 'Recent Request', dominantAction: 'Match Workers', targetRoute: '/bookings' },
          { id: 'B-84922', customerName: 'Venkatesh Iyer', category: 'Driver', locality: 'Hitec City', status: 'REQUESTED', submissionTime: 'Recent Request', dominantAction: 'Match Workers', targetRoute: '/bookings' },
          { id: 'B-84925', customerName: 'Neha Gupta', category: 'Babysitter', locality: 'Gachibowli', status: 'REQUESTED', submissionTime: 'Recent Request', dominantAction: 'Match Workers', targetRoute: '/bookings' },
        ],
        MATCHING: [
          { id: 'B-84920', customerName: 'Anand Sharma', category: 'House Maid', locality: 'Kondapur', status: 'MATCHING_IN_PROGRESS', submissionTime: 'Candidate Shortlist Active', dominantAction: 'Launch Match Wizard', targetRoute: '/bookings' },
          { id: 'B-84922', customerName: 'Venkatesh Iyer', category: 'Driver', locality: 'Hitec City', status: 'MATCHING_IN_PROGRESS', submissionTime: 'Shortlisting', dominantAction: 'Launch Match Wizard', targetRoute: '/bookings' },
        ],
        TRIALS: [
          { id: 'B-84890', customerName: 'Rajesh Kumar', category: 'Driver', locality: 'Madhapur', status: 'INTERVIEW_SCHEDULED', submissionTime: 'Today, 10:00 AM', dominantAction: 'Record Outcome', targetRoute: '/bookings' },
          { id: 'B-84895', customerName: 'Sanjay Verma', category: 'Cook', locality: 'Kondapur', status: 'INTERVIEW_SCHEDULED', submissionTime: 'Today, 04:00 PM', dominantAction: 'Record Outcome', targetRoute: '/bookings' },
        ],
        CONFIRMATIONS: [
          { id: 'B-84880', customerName: 'Ananya Sen', category: 'Elderly Care', locality: 'Banjara Hills', status: 'CONFIRMED', submissionTime: 'Trial Passed', dominantAction: 'Activate Service', targetRoute: '/bookings' },
          { id: 'B-84882', customerName: 'Karthik Raja', category: 'Driver', locality: 'Jubilee Hills', status: 'CONFIRMED', submissionTime: 'Trial Passed', dominantAction: 'Activate Service', targetRoute: '/bookings' },
        ],
        ACTIVE_SERVICES: [
          { id: 'B-84870', customerName: 'Sneha Patel', category: 'Babysitter', locality: 'Hitec City', status: 'SERVICE_ACTIVE', submissionTime: 'Month 3 of 12', dominantAction: 'View Engagement', targetRoute: '/bookings' },
          { id: 'B-84850', customerName: 'Deepak Rao', category: 'House Maid', locality: 'Gachibowli', status: 'SERVICE_ACTIVE', submissionTime: 'Month 1 of 12', dominantAction: 'View Engagement', targetRoute: '/bookings' },
        ],
        REPLACEMENTS: [
          { id: 'B-84912', customerName: 'Priya Reddy', category: 'Cook', locality: 'Gachibowli', status: 'REPLACEMENT_REQUESTED', submissionTime: 'Urgent Rematch', dominantAction: 'Process Rematch', targetRoute: '/bookings' },
          { id: 'B-84888', customerName: 'Sneha Patel', category: 'House Maid', locality: 'Madhapur', status: 'REPLACEMENT_REQUESTED', submissionTime: 'Urgent Rematch', dominantAction: 'Process Rematch', targetRoute: '/bookings' },
        ],
        REFUNDS: [
          { id: 'TXN-892050', customerName: 'Rajesh Kumar', category: 'Booking Fee (₹499)', locality: 'Madhapur', status: 'REFUND_PENDING', submissionTime: 'Awaiting Authorization', dominantAction: 'Authorize Refund', targetRoute: '/payments' },
          { id: 'TXN-892011', customerName: 'Deepak Rao', category: 'Placement Fee (₹1,999)', locality: 'Jubilee Hills', status: 'REFUND_PENDING', submissionTime: 'Awaiting Authorization', dominantAction: 'Authorize Refund', targetRoute: '/payments' },
        ],
        FOLLOW_UPS: [
          { id: 'W-10482', customerName: 'Sunita Devi (Worker)', category: 'House Maid', locality: 'Kondapur', status: 'ACTIVE', submissionTime: 'Post-Placement Check', dominantAction: 'Inspect Worker', targetRoute: '/workers' },
          { id: 'C-1092', customerName: 'Anand Sharma (Customer)', category: 'House Maid', locality: 'Kondapur', status: 'ACTIVE', submissionTime: '7-Day Quality Follow-up', dominantAction: 'Inspect Customer', targetRoute: '/customers' },
        ],
        SUPPORT_HANDOFFS: [
          { id: 'TKT-8901', customerName: 'Priya Reddy (Dispute)', category: 'Cook Replacement Escalation', locality: 'Gachibowli', status: 'ESCALATED', submissionTime: 'Handoff from Support', dominantAction: 'Inspect Ticket', targetRoute: '/support' },
        ],
      },
    };
  }

  async getVerificationExecutiveDashboard(): Promise<{
    kpis: VerificationExecutiveKPIs;
    queues: Record<'PENDING_REVIEW' | 'IN_REVIEW' | 'RECHECK_DUE' | 'REJECTED', VerificationDashboardQueueItem[]>;
  }> {
    return {
      kpis: {
        pendingReview: 24,
        inProgressReview: 6,
        reCheckDue: 12,
        decisionsToday: 18,
        completedReviews: 42,
        correctionsRequired: 5,
        overdueReviews: null,
        avgProcessingTimeMinutes: null,
      },
      queues: {
        PENDING_REVIEW: [
          { id: 'VQ-101', workerId: 'W-10482', workerName: 'Sunita Devi', category: 'House Maid', submissionTime: 'Recent Onboarding', pendingCheckTypes: ['Identity Proof (Aadhaar)', 'Address Proof', 'Criminal Self-Decl'], status: 'PENDING_REVIEW', actionLabel: 'Review KYC' },
          { id: 'VQ-103', workerId: 'W-10484', workerName: 'Meena Bai', category: 'Cook', submissionTime: 'Recent Onboarding', pendingCheckTypes: ['Identity Proof (Aadhaar)', 'Reference Check'], status: 'PENDING_REVIEW', actionLabel: 'Review KYC' },
          { id: 'VQ-105', workerId: 'W-10488', workerName: 'Anil Rao', category: 'Elderly Care', submissionTime: 'Recent Onboarding', pendingCheckTypes: ['Address Proof', 'Prior Employer Reference'], status: 'PENDING_REVIEW', actionLabel: 'Review KYC' },
        ],
        IN_REVIEW: [
          { id: 'VQ-102', workerId: 'W-10483', workerName: 'Ramesh Yadav', category: 'Driver', submissionTime: 'Under Review', pendingCheckTypes: ['Driving License', 'Reference Call'], status: 'IN_REVIEW', actionLabel: 'Resume Review' },
        ],
        RECHECK_DUE: [
          { id: 'VQ-098', workerId: 'W-10120', workerName: 'Devendra Singh', category: 'Driver', submissionTime: 'Annual Expiry', pendingCheckTypes: ['Police Clearance Renewal', 'License Revalidation'], status: 'RECHECK_DUE', actionLabel: 'Inspect Expiry' },
        ],
        REJECTED: [
          { id: 'VQ-105', workerId: 'W-10486', workerName: 'Anil Rao', category: 'Elderly Care Helper', submissionTime: 'Recent Onboarding', pendingCheckTypes: ['Identity Proof (Aadhaar)'], status: 'REJECTED', actionLabel: 'Inspect Dossier' },
        ],
      },
    };
  }

  async getSupportExecutiveDashboard(): Promise<{
    kpis: SupportExecutiveKPIs;
    queues: Record<'AT_RISK' | 'UNASSIGNED' | 'MY_CASES' | 'ESCALATED', SupportDashboardQueueItem[]>;
  }> {
    return {
      kpis: {
        openUnassignedGrievances: 11,
        myActiveCases: 4,
        slaAtRiskCount: null,
        slaBreachedCount: 1,
        resolvedTodayCount: 19,
      },
      queues: {
        AT_RISK: [
          { id: 'Q-01', ticketId: 'TKT-4921', complainantName: 'Anand Sharma', roleType: 'CUSTOMER', category: 'House Maid', disputeCategory: 'Unannounced Absence', slaIndicator: 'AT_RISK', status: 'INVESTIGATION_PENDING', actionLabel: 'Mediate Dispute' },
          { id: 'Q-02', ticketId: 'TKT-4902', complainantName: 'Priya Reddy', roleType: 'CUSTOMER', category: 'Cook', disputeCategory: 'Replacement Delay', slaIndicator: 'BREACHED', status: 'ESCALATED', actionLabel: 'High Priority Intake' },
        ],
        UNASSIGNED: [
          { id: 'Q-03', ticketId: 'TKT-4919', complainantName: 'Sunita Devi', roleType: 'WORKER', category: 'House Maid', disputeCategory: 'Payout Clarification', slaIndicator: 'NORMAL', status: 'OPEN', actionLabel: 'Claim Ticket' },
          { id: 'Q-04', ticketId: 'TKT-4915', complainantName: 'Kavita Kumari', roleType: 'WORKER', category: 'Babysitter', disputeCategory: 'Overtime Dispute', slaIndicator: 'NORMAL', status: 'OPEN', actionLabel: 'Claim Ticket' },
        ],
        MY_CASES: [
          { id: 'Q-05', ticketId: 'TKT-4890', complainantName: 'Rajesh Kumar', roleType: 'CUSTOMER', category: 'Driver', disputeCategory: 'Service Quality Dispute', slaIndicator: 'NORMAL', status: 'INVESTIGATION_PENDING', actionLabel: 'Open Call Logs' },
        ],
        ESCALATED: [
          { id: 'Q-06', ticketId: 'TKT-4877', complainantName: 'Manish V', roleType: 'CUSTOMER', category: 'Cook', disputeCategory: 'Contract Termination', slaIndicator: 'NORMAL', status: 'ESCALATED', actionLabel: 'View Ops Status' },
        ],
      },
    };
  }
}

function parseRequiredMetric(val: unknown, fieldName: string): number {
  if (val === undefined || val === null || val === '') {
    throw new ServerFailureError(`Dashboard contract violation: missing required metric "${fieldName}".`);
  }
  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num) || !isFinite(num) || num < 0) {
    throw new ServerFailureError(`Dashboard contract violation: invalid metric value for "${fieldName}".`);
  }
  return num;
}

function parseOptionalMetric(val: unknown, fieldName: string): number | null {
  if (val === undefined || val === null || val === '') {
    return null;
  }
  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num) || !isFinite(num) || num < 0) {
    throw new ServerFailureError(`Dashboard contract violation: invalid metric value for "${fieldName}".`);
  }
  return num;
}

function unwrapReportData<T>(rawPayload: unknown): T | null {
  if (rawPayload === undefined || rawPayload === null) {
    return null;
  }
  if (typeof rawPayload === 'object' && !Array.isArray(rawPayload) && 'data' in (rawPayload as Record<string, unknown>)) {
    return ((rawPayload as { data: T }).data ?? null) as T | null;
  }
  return rawPayload as T;
}

export class RealDashboardRepository implements IDashboardRepository {
  async getSuperAdminDashboard(): Promise<SuperAdminDashboardData> {
    try {
      const res = await httpClient.get<Record<string, unknown>>('/admin/dashboard');
      const root = res.data;
      if (!root || typeof root !== 'object') {
        throw new ServerFailureError('Invalid response received from dashboard API.');
      }

      const raw = (root.data && typeof root.data === 'object' && !Array.isArray(root.data))
        ? (root.data as Record<string, unknown>)
        : root;

      // Handle the observed backend sections payload
      if (raw.sections && typeof raw.sections === 'object' && !Array.isArray(raw.sections)) {
        const sections = raw.sections as Record<string, unknown>;

        // 1. Bookings section
        const bookings = (sections.bookings && typeof sections.bookings === 'object' && !Array.isArray(sections.bookings))
          ? (sections.bookings as Record<string, unknown>)
          : undefined;

        // grossBookings: Only mapped if an explicit total/grossBookings property is provided.
        // Per contract requirements, we do NOT assume grossBookings is the sum of every booking status.
        const explicitGrossBookings = bookings?.grossBookings ?? bookings?.total ?? bookings?.totalBookings;
        const grossBookings = explicitGrossBookings !== undefined
          ? parseOptionalMetric(explicitGrossBookings, 'grossBookings')
          : null;

        // 2. Workers section: Map verifiedAndActive to activeWorkforce (per documented requirements)
        const workers = (sections.workers && typeof sections.workers === 'object' && !Array.isArray(sections.workers))
          ? (sections.workers as Record<string, unknown>)
          : undefined;
        const activeWorkforce = parseOptionalMetric(
          workers?.verifiedAndActive ?? workers?.activeWorkforce ?? workers?.activeWorkers,
          'activeWorkforce'
        );

        // 3. Pending KYC section: Map submitted + inReview to verificationQueue
        const pendingKyc = (sections.pendingKyc && typeof sections.pendingKyc === 'object' && !Array.isArray(sections.pendingKyc))
          ? (sections.pendingKyc as Record<string, unknown>)
          : undefined;
        let verificationQueue: number | null = null;
        if (pendingKyc?.total !== undefined) {
          verificationQueue = parseOptionalMetric(pendingKyc.total, 'verificationQueue');
        } else if (pendingKyc?.submitted !== undefined || pendingKyc?.inReview !== undefined) {
          const submitted = parseOptionalMetric(pendingKyc?.submitted ?? 0, 'pendingKyc.submitted') ?? 0;
          const inReview = parseOptionalMetric(pendingKyc?.inReview ?? 0, 'pendingKyc.inReview') ?? 0;
          verificationQueue = submitted + inReview;
        }

        // 4. Complaints section: Map open + inProgress + escalated to activeGrievances
        const complaints = (sections.complaints && typeof sections.complaints === 'object' && !Array.isArray(sections.complaints))
          ? (sections.complaints as Record<string, unknown>)
          : undefined;
        let activeGrievances: number | null = null;
        if (complaints?.total !== undefined) {
          activeGrievances = parseOptionalMetric(complaints.total, 'activeGrievances');
        } else if (complaints?.open !== undefined || complaints?.inProgress !== undefined || complaints?.escalated !== undefined) {
          const open = parseOptionalMetric(complaints?.open ?? 0, 'complaints.open') ?? 0;
          const inProgress = parseOptionalMetric(complaints?.inProgress ?? 0, 'complaints.inProgress') ?? 0;
          const escalated = parseOptionalMetric(complaints?.escalated ?? 0, 'complaints.escalated') ?? 0;
          activeGrievances = open + inProgress + escalated;
        }

        // 5. Replacements section: Map requested to replacementVolume
        const replacements = (sections.replacements && typeof sections.replacements === 'object' && !Array.isArray(sections.replacements))
          ? (sections.replacements as Record<string, unknown>)
          : undefined;
        let replacementVolume: number | null = null;
        if (replacements?.total !== undefined) {
          replacementVolume = parseOptionalMetric(replacements.total, 'replacementVolume');
        } else if (replacements?.requested !== undefined) {
          replacementVolume = parseOptionalMetric(replacements.requested, 'replacementVolume');
        }

        // 6. Collections section: Map INR monthToDateMinor / 100 to platformRevenueINR
        const collections = Array.isArray(sections.collections) ? sections.collections : undefined;
        let platformRevenueINR: number | null = null;
        if (collections && collections.length > 0) {
          const inrCollection = (collections.find(
            (c) => c && typeof c === 'object' && (c as Record<string, unknown>).currency === 'INR'
          ) || collections[0]) as Record<string, unknown>;

          const minorAmount = inrCollection.monthToDateMinor ?? inrCollection.todayMinor ?? inrCollection.amountMinor;
          if (minorAmount !== undefined) {
            const parsedMinor = parseOptionalMetric(minorAmount, 'collections.amountMinor');
            if (parsedMinor !== null) {
              platformRevenueINR = Math.round(parsedMinor / 100);
            }
          }
        }

        // 7. Scheduled trials from bookings.byStatus (INTERVIEW_TRIAL_SCHEDULED)
        let scheduledTrials: number | null = null;
        if (bookings && Array.isArray(bookings.byStatus)) {
          const trialItem = bookings.byStatus.find(
            (item) => item && typeof item === 'object' && (
              (item as Record<string, unknown>).status === 'INTERVIEW_TRIAL_SCHEDULED' ||
              (item as Record<string, unknown>).status === 'INTERVIEW_SCHEDULED'
            )
          ) as Record<string, unknown> | undefined;
          if (trialItem) {
            scheduledTrials = parseOptionalMetric(trialItem.count, 'scheduledTrials');
          } else {
            scheduledTrials = 0;
          }
        } else if (bookings?.scheduledTrials !== undefined) {
          scheduledTrials = parseOptionalMetric(bookings.scheduledTrials, 'scheduledTrials');
        }

        // 8. Police Verif Due: Unprovided in sections payload
        const policeVerifDue: number | null = null;

        // Queues: Handled if present, or genuine empty array when omitted in sections envelope
        let queues: SuperAdminQueueItem[] = [];
        if ('queues' in raw && Array.isArray(raw.queues)) {
          queues = raw.queues.map((item, index) => {
            if (!item || typeof item !== 'object') {
              throw new ServerFailureError(`Dashboard contract violation: malformed queue item at index ${index}.`);
            }
            const q = item as Record<string, unknown>;
            if (!q.id || !q.title || !q.targetRoute) {
              throw new ServerFailureError(`Dashboard contract violation: queue item at index ${index} missing required fields.`);
            }
            return {
              id: String(q.id),
              type: (q.type as SuperAdminQueueItem['type']) || 'VERIFICATION',
              title: String(q.title),
              source: String(q.source || 'Operational Queue'),
              timing: String(q.timing || 'Recent'),
              status: String(q.status || 'ACTIVE'),
              targetRoute: String(q.targetRoute),
              actionLabel: String(q.actionLabel || 'Inspect'),
            };
          });
        }

        const sectionBreakdowns: SuperAdminDashboardSections = {
          bookings: bookings ? {
            byStatus: Array.isArray(bookings.byStatus)
              ? bookings.byStatus.map((item) => {
                  const b = item as Record<string, unknown>;
                  return {
                    status: String(b.status || ''),
                    count: Number(b.count || 0),
                  };
                })
              : [],
            grossBookings,
          } : undefined,
          workers: workers ? {
            registered: Number(workers.registered || 0),
            verifiedAndActive: Number(workers.verifiedAndActive || 0),
          } : undefined,
          pendingKyc: pendingKyc ? {
            submitted: Number(pendingKyc.submitted || 0),
            inReview: Number(pendingKyc.inReview || 0),
          } : undefined,
          complaints: complaints ? {
            open: Number(complaints.open || 0),
            inProgress: Number(complaints.inProgress || 0),
            escalated: Number(complaints.escalated || 0),
            unassigned: Number(complaints.unassigned || 0),
          } : undefined,
          replacements: replacements ? {
            requested: Number(replacements.requested || 0),
            approved: Number(replacements.approved || 0),
          } : undefined,
          alerts: (sections.alerts && typeof sections.alerts === 'object') ? {
            open: Number((sections.alerts as Record<string, unknown>).open || 0),
            critical: Number((sections.alerts as Record<string, unknown>).critical || 0),
            warning: Number((sections.alerts as Record<string, unknown>).warning || 0),
          } : undefined,
          collections: collections ? collections.map((c) => {
            const col = c as Record<string, unknown>;
            const curr = String(col.currency || 'INR');
            const todayMinor = Number(col.todayMinor || 0);
            const monthToDateMinor = Number(col.monthToDateMinor || 0);
            return {
              currency: curr,
              todayMinor,
              monthToDateMinor,
              todayINR: todayMinor / 100,
              monthToDateINR: monthToDateMinor / 100,
              todayFormatted: curr === 'INR' ? formatCurrencyINR(todayMinor / 100) : `${curr} ${(todayMinor / 100).toFixed(2)}`,
              monthToDateFormatted: curr === 'INR' ? formatCurrencyINR(monthToDateMinor / 100) : `${curr} ${(monthToDateMinor / 100).toFixed(2)}`,
            };
          }) : undefined,
        };

        return {
          generatedAt: raw.generatedAt ? String(raw.generatedAt) : undefined,
          kpis: {
            grossBookings,
            activeWorkforce,
            verificationQueue,
            activeGrievances,
            replacementVolume,
            platformRevenueINR,
            scheduledTrials,
            policeVerifDue,
          },
          queues,
          sections: sectionBreakdowns,
        };
      }

      const kpisRecord = (raw.kpis && typeof raw.kpis === 'object' && !Array.isArray(raw.kpis))
        ? (raw.kpis as Record<string, unknown>)
        : raw;

      const grossBookings = parseRequiredMetric(
        kpisRecord.grossBookings ?? kpisRecord.totalBookings ?? raw.grossBookings ?? raw.totalBookings,
        'grossBookings'
      );
      const activeWorkforce = parseRequiredMetric(
        kpisRecord.activeWorkforce ?? kpisRecord.totalWorkers ?? kpisRecord.activeWorkers ?? raw.activeWorkforce ?? raw.totalWorkers ?? raw.activeWorkers,
        'activeWorkforce'
      );
      const verificationQueue = parseRequiredMetric(
        kpisRecord.verificationQueue ?? kpisRecord.pendingVerifications ?? kpisRecord.verificationPending ?? raw.verificationQueue ?? raw.pendingVerifications ?? raw.verificationPending,
        'verificationQueue'
      );
      const activeGrievances = parseRequiredMetric(
        kpisRecord.activeGrievances ?? kpisRecord.openTickets ?? kpisRecord.activeTickets ?? kpisRecord.openGrievances ?? raw.activeGrievances ?? raw.openTickets ?? raw.activeTickets ?? raw.openGrievances,
        'activeGrievances'
      );
      const replacementVolume = parseRequiredMetric(
        kpisRecord.replacementVolume ?? kpisRecord.replacementsPending ?? kpisRecord.replacementRequests ?? raw.replacementVolume ?? raw.replacementsPending ?? raw.replacementRequests,
        'replacementVolume'
      );
      const platformRevenueINR = parseRequiredMetric(
        kpisRecord.platformRevenueINR ?? kpisRecord.totalRevenueINR ?? kpisRecord.grossCollections ?? kpisRecord.platformRevenue ?? raw.platformRevenueINR ?? raw.totalRevenueINR ?? raw.grossCollections ?? raw.platformRevenue,
        'platformRevenueINR'
      );
      const scheduledTrials = parseRequiredMetric(
        kpisRecord.scheduledTrials ?? kpisRecord.activeTrials ?? kpisRecord.trialsCount ?? raw.scheduledTrials ?? raw.activeTrials ?? raw.trialsCount,
        'scheduledTrials'
      );
      const policeVerifDue = parseRequiredMetric(
        kpisRecord.policeVerifDue ?? kpisRecord.expiringClearances ?? kpisRecord.expiringVerifications ?? raw.policeVerifDue ?? raw.expiringClearances ?? raw.expiringVerifications,
        'policeVerifDue'
      );

      if (!('queues' in raw) || !Array.isArray(raw.queues)) {
        throw new ServerFailureError('Dashboard contract violation: missing or malformed operational queues.');
      }

      const queues: SuperAdminQueueItem[] = raw.queues.map((item, index) => {
        if (!item || typeof item !== 'object') {
          throw new ServerFailureError(`Dashboard contract violation: malformed queue item at index ${index}.`);
        }
        const q = item as Record<string, unknown>;
        if (!q.id || !q.title || !q.targetRoute) {
          throw new ServerFailureError(`Dashboard contract violation: queue item at index ${index} missing required fields.`);
        }
        return {
          id: String(q.id),
          type: (q.type as SuperAdminQueueItem['type']) || 'VERIFICATION',
          title: String(q.title),
          source: String(q.source || 'Operational Queue'),
          timing: String(q.timing || 'Recent'),
          status: String(q.status || 'ACTIVE'),
          targetRoute: String(q.targetRoute),
          actionLabel: String(q.actionLabel || 'Inspect'),
        };
      });

      return {
        kpis: {
          grossBookings,
          activeWorkforce,
          verificationQueue,
          activeGrievances,
          replacementVolume,
          platformRevenueINR,
          scheduledTrials,
          policeVerifDue,
        },
        queues,
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getSuperAdminAnalytics(from = '2026-01-01', to = '2026-12-31'): Promise<SuperAdminAnalyticsData> {
    try {
      const params = { from, to };
      const [
        bookingFunnelRes,
        categoryDemandRes,
        areaDemandRes,
        workerRegRes,
        workerUtilRes,
        interviewConvRes,
        cancellationRateRes,
        replacementRateRes,
        paymentColRes,
        supportTicketsRes,
        topWorkersRes,
        repeatCustRes,
      ] = await Promise.allSettled([
        httpClient.get<unknown>('/admin/reports/booking-funnel', { params: { ...params, interval: 'month' } }),
        httpClient.get<unknown>('/admin/reports/demand-by-category', { params }),
        httpClient.get<unknown>('/admin/reports/demand-by-area', { params }),
        httpClient.get<unknown>('/admin/reports/worker-registrations', { params: { ...params, interval: 'month' } }),
        httpClient.get<unknown>('/admin/reports/worker-utilization', { params }),
        httpClient.get<unknown>('/admin/reports/interview-conversion', { params }),
        httpClient.get<unknown>('/admin/reports/cancellation-rate', { params }),
        httpClient.get<unknown>('/admin/reports/replacement-rate', { params }),
        httpClient.get<unknown>('/admin/reports/payment-collections', { params: { ...params, interval: 'month' } }),
        httpClient.get<unknown>('/admin/reports/support-tickets', { params: { ...params, interval: 'month' } }),
        httpClient.get<unknown>('/admin/reports/top-rated-workers', { params: { limit: 10 } }),
        httpClient.get<unknown>('/admin/reports/repeat-customers', { params: { ...params, minBookings: 2 } }),
      ]);

      let bookingFunnel: BookingFunnelData | null = null;
      if (bookingFunnelRes.status === 'fulfilled') {
        const raw = unwrapReportData<Record<string, unknown>>(bookingFunnelRes.value.data);
        if (raw && typeof raw === 'object') {
          const rawSeries = Array.isArray(raw.series) ? raw.series : [];
          bookingFunnel = {
            interval: String(raw.interval || 'month'),
            requests: Number(raw.requests ?? 0),
            confirmed: Number(raw.confirmed ?? 0),
            confirmationRate: Number(raw.confirmationRate ?? 0),
            series: rawSeries.map((s: Record<string, unknown>) => ({
              period: String(s.period || ''),
              requests: Number(s.requests ?? 0),
              confirmed: Number(s.confirmed ?? 0),
              confirmationRate: Number(s.confirmationRate ?? 0),
            })),
          };
        }
      }

      let categoryDemand: CategoryDemandData | null = null;
      if (categoryDemandRes.status === 'fulfilled') {
        const raw = unwrapReportData<Record<string, unknown>>(categoryDemandRes.value.data);
        if (raw && typeof raw === 'object') {
          const rawCats = Array.isArray(raw.categories) ? raw.categories : [];
          categoryDemand = {
            total: Number(raw.total ?? 0),
            categories: rawCats.map((c: Record<string, unknown>) => ({
              categoryId: String(c.categoryId || c.code || ''),
              code: String(c.code || ''),
              name: String(c.name || c.code || ''),
              requests: Number(c.requests ?? 0),
            })),
          };
        }
      }

      let areaDemand: AreaDemandItem[] | null = null;
      if (areaDemandRes.status === 'fulfilled') {
        const raw = unwrapReportData<unknown>(areaDemandRes.value.data);
        if (Array.isArray(raw)) {
          areaDemand = raw.map((a: Record<string, unknown>) => ({
            areaId: String(a.areaId || a.id || ''),
            name: String(a.name || ''),
            city: String(a.city || ''),
            requests: Number(a.requests ?? 0),
          }));
        }
      }

      let workerRegistrations: WorkerRegistrationsData | null = null;
      if (workerRegRes.status === 'fulfilled') {
        const raw = unwrapReportData<Record<string, unknown>>(workerRegRes.value.data);
        if (raw && typeof raw === 'object') {
          const rawSeries = Array.isArray(raw.series) ? raw.series : [];
          workerRegistrations = {
            interval: String(raw.interval || 'month'),
            registered: Number(raw.registered ?? 0),
            verified: Number(raw.verified ?? 0),
            verificationConversion: Number(raw.verificationConversion ?? 0),
            series: rawSeries.map((s: Record<string, unknown>) => ({
              period: String(s.period || ''),
              registered: Number(s.registered ?? 0),
              verified: Number(s.verified ?? 0),
              verificationConversion: Number(s.verificationConversion ?? 0),
            })),
          };
        }
      }

      let workerUtilization: WorkerUtilizationData | null = null;
      if (workerUtilRes.status === 'fulfilled') {
        const raw = unwrapReportData<Record<string, unknown>>(workerUtilRes.value.data);
        if (raw && typeof raw === 'object') {
          workerUtilization = {
            verifiedWorkers: Number(raw.verifiedWorkers ?? 0),
            workersWithActiveBooking: Number(raw.workersWithActiveBooking ?? 0),
            utilization: Number(raw.utilization ?? 0),
          };
        }
      }

      let interviewConversion: InterviewConversionData | null = null;
      if (interviewConvRes.status === 'fulfilled') {
        const raw = unwrapReportData<Record<string, unknown>>(interviewConvRes.value.data);
        if (raw && typeof raw === 'object') {
          interviewConversion = {
            interviewsHeld: Number(raw.interviewsHeld ?? 0),
            confirmed: Number(raw.confirmed ?? 0),
            conversion: Number(raw.conversion ?? 0),
          };
        }
      }

      let cancellationRate: CancellationRateData | null = null;
      if (cancellationRateRes.status === 'fulfilled') {
        const raw = unwrapReportData<Record<string, unknown>>(cancellationRateRes.value.data);
        if (raw && typeof raw === 'object') {
          cancellationRate = {
            totalBookings: Number(raw.totalBookings ?? 0),
            cancelled: Number(raw.cancelled ?? 0),
            cancellationRate: Number(raw.cancellationRate ?? 0),
          };
        }
      }

      let replacementRate: ReplacementRateData | null = null;
      if (replacementRateRes.status === 'fulfilled') {
        const raw = unwrapReportData<Record<string, unknown>>(replacementRateRes.value.data);
        if (raw && typeof raw === 'object') {
          replacementRate = {
            activeBookings: Number(raw.activeBookings ?? 0),
            replacementRequests: Number(raw.replacementRequests ?? 0),
            replacementRate: Number(raw.replacementRate ?? 0),
          };
        }
      }

      let paymentCollections: PaymentCollectionsData | null = null;
      if (paymentColRes.status === 'fulfilled') {
        const raw = unwrapReportData<Record<string, unknown>>(paymentColRes.value.data);
        if (raw && typeof raw === 'object') {
          const rawTotals = Array.isArray(raw.totalsByFeeType) ? raw.totalsByFeeType : [];
          const rawSeries = Array.isArray(raw.series) ? raw.series : [];
          paymentCollections = {
            interval: String(raw.interval || 'month'),
            totalsByFeeType: rawTotals.map((t: Record<string, unknown>) => ({
              feeCode: String(t.feeCode || ''),
              currency: String(t.currency || 'INR'),
              payments: Number(t.payments ?? 0),
              grossMinor: Number(t.grossMinor ?? 0),
              refundedMinor: Number(t.refundedMinor ?? 0),
            })),
            series: rawSeries.map((s: Record<string, unknown>) => ({
              period: String(s.period || ''),
              feeCode: String(s.feeCode || ''),
              currency: String(s.currency || 'INR'),
              payments: Number(s.payments ?? 0),
              grossMinor: Number(s.grossMinor ?? 0),
              refundedMinor: Number(s.refundedMinor ?? 0),
            })),
          };
        }
      }

      let supportTickets: SupportTicketsAnalyticsData | null = null;
      if (supportTicketsRes.status === 'fulfilled') {
        const raw = unwrapReportData<Record<string, unknown>>(supportTicketsRes.value.data);
        if (raw && typeof raw === 'object') {
          const rawByStatus = Array.isArray(raw.byStatus) ? raw.byStatus : [];
          const rawSeries = Array.isArray(raw.series) ? raw.series : [];
          supportTickets = {
            interval: String(raw.interval || 'month'),
            created: Number(raw.created ?? 0),
            closed: Number(raw.closed ?? 0),
            averageResolutionSeconds: raw.averageResolutionSeconds !== null && raw.averageResolutionSeconds !== undefined
              ? Number(raw.averageResolutionSeconds)
              : null,
            byStatus: rawByStatus.map((b: Record<string, unknown>) => ({
              status: String(b.status || ''),
              count: Number(b.count ?? 0),
            })),
            series: rawSeries.map((s: Record<string, unknown>) => ({
              period: String(s.period || ''),
              count: Number(s.count ?? 0),
            })),
          };
        }
      }

      let topRatedWorkers: TopRatedWorkerItem[] | null = null;
      if (topWorkersRes.status === 'fulfilled') {
        const raw = unwrapReportData<unknown>(topWorkersRes.value.data);
        if (Array.isArray(raw)) {
          topRatedWorkers = raw.map((w: Record<string, unknown>) => ({
            workerId: String(w.workerId || ''),
            name: String(w.name || ''),
            ratingCount: Number(w.ratingCount ?? 0),
            averageRating: Number(w.averageRating ?? 0),
          }));
        }
      }

      let repeatCustomers: RepeatCustomerItem[] | null = null;
      if (repeatCustRes.status === 'fulfilled') {
        const raw = unwrapReportData<unknown>(repeatCustRes.value.data);
        if (Array.isArray(raw)) {
          repeatCustomers = raw.map((c: Record<string, unknown>) => ({
            customerUserId: String(c.customerUserId || ''),
            name: String(c.name || ''),
            bookings: Number(c.bookings ?? 0),
          }));
        }
      }

      return {
        bookingFunnel,
        categoryDemand,
        areaDemand,
        workerRegistrations,
        workerUtilization,
        interviewConversion,
        cancellationRate,
        replacementRate,
        paymentCollections,
        supportTickets,
        topRatedWorkers,
        repeatCustomers,
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getOperationsAdminDashboard(): Promise<{
    kpis: OperationsAdminKPIs;
    queues: Record<OperationsQueueTab, OperationsQueueItem[]>;
  }> {
    try {
      const res = await httpClient.get<Record<string, unknown>>('/admin/dashboard');
      const root = res.data;
      if (!root || typeof root !== 'object') {
        throw new ServerFailureError('Invalid response received from dashboard API.');
      }

      const raw = (root.data && typeof root.data === 'object' && !Array.isArray(root.data))
        ? (root.data as Record<string, unknown>)
        : root;

      // Handle the observed backend sections payload
      if (raw.sections && typeof raw.sections === 'object' && !Array.isArray(raw.sections) && !raw.kpis) {
        const sections = raw.sections as Record<string, unknown>;
        const workers = (sections.workers && typeof sections.workers === 'object' && !Array.isArray(sections.workers))
          ? (sections.workers as Record<string, unknown>)
          : undefined;
        const bookings = (sections.bookings && typeof sections.bookings === 'object' && !Array.isArray(sections.bookings))
          ? (sections.bookings as Record<string, unknown>)
          : undefined;
        const pendingKyc = (sections.pendingKyc && typeof sections.pendingKyc === 'object' && !Array.isArray(sections.pendingKyc))
          ? (sections.pendingKyc as Record<string, unknown>)
          : undefined;
        const complaints = (sections.complaints && typeof sections.complaints === 'object' && !Array.isArray(sections.complaints))
          ? (sections.complaints as Record<string, unknown>)
          : undefined;
        const replacements = (sections.replacements && typeof sections.replacements === 'object' && !Array.isArray(sections.replacements))
          ? (sections.replacements as Record<string, unknown>)
          : undefined;

        const byStatus = Array.isArray(bookings?.byStatus) ? (bookings?.byStatus as Record<string, unknown>[]) : [];
        const getStatusCount = (statusName: string) => {
          const item = byStatus.find((s) => s && s.status === statusName);
          return item ? Number(item.count || 0) : 0;
        };

        const totalCustomers = 0;
        const totalWorkers = Number(workers?.registered || workers?.verifiedAndActive || 0);
        const newBookingRequests = getStatusCount('PENDING_PAYMENT') + getStatusCount('REQUESTED') + getStatusCount('NEW_REQUEST');
        const bookingsAwaitingMatching = getStatusCount('MATCHED') + getStatusCount('MATCHING_IN_PROGRESS');
        const scheduledTrialsToday = getStatusCount('INTERVIEW_TRIAL_SCHEDULED') + getStatusCount('INTERVIEW_SCHEDULED');
        const bookingsAwaitingConfirmation = getStatusCount('INTERVIEW_TRIAL_COMPLETED') + getStatusCount('CONFIRMED');
        const activeLiveEngagements = getStatusCount('ACTIVE') + getStatusCount('SERVICE_ACTIVE');
        const replacementRequests = Number(replacements?.requested || 0);
        const pendingVerificationCases = Number(pendingKyc?.submitted || 0) + Number(pendingKyc?.inReview || 0);
        const openDisputes = Number(complaints?.open || 0) + Number(complaints?.inProgress || 0) + Number(complaints?.escalated || 0);
        const pendingRefunds = 0;
        const expiringVerifications = 0;

        const emptyQueues: Record<OperationsQueueTab, OperationsQueueItem[]> = {
          NEW_REQUESTS: [],
          MATCHING: [],
          TRIALS: [],
          CONFIRMATIONS: [],
          ACTIVE_SERVICES: [],
          REPLACEMENTS: [],
          REFUNDS: [],
          FOLLOW_UPS: [],
          SUPPORT_HANDOFFS: [],
        };

        return {
          kpis: {
            totalCustomers,
            totalWorkers,
            newBookingRequests,
            bookingsAwaitingMatching,
            scheduledTrialsToday,
            bookingsAwaitingConfirmation,
            activeLiveEngagements,
            replacementRequests,
            pendingVerificationCases,
            openDisputes,
            pendingRefunds,
            expiringVerifications,
          },
          queues: (raw.queues && typeof raw.queues === 'object') ? (raw.queues as Record<OperationsQueueTab, OperationsQueueItem[]>) : emptyQueues,
        };
      }

      const kpisRecord = (raw.kpis && typeof raw.kpis === 'object' && !Array.isArray(raw.kpis))
        ? (raw.kpis as Record<string, unknown>)
        : raw;

      const totalCustomers = parseRequiredMetric(
        kpisRecord.totalCustomers ?? kpisRecord.customersCount ?? raw.totalCustomers ?? raw.customersCount,
        'totalCustomers'
      );
      const totalWorkers = parseRequiredMetric(
        kpisRecord.totalWorkers ?? kpisRecord.workersCount ?? kpisRecord.activeWorkforce ?? raw.totalWorkers ?? raw.workersCount ?? raw.activeWorkforce,
        'totalWorkers'
      );
      const newBookingRequests = parseRequiredMetric(
        kpisRecord.newBookingRequests ?? kpisRecord.newBookings ?? raw.newBookingRequests ?? raw.newBookings,
        'newBookingRequests'
      );
      const bookingsAwaitingMatching = parseRequiredMetric(
        kpisRecord.bookingsAwaitingMatching ?? kpisRecord.matchingPending ?? raw.bookingsAwaitingMatching ?? raw.matchingPending,
        'bookingsAwaitingMatching'
      );
      const scheduledTrialsToday = parseRequiredMetric(
        kpisRecord.scheduledTrialsToday ?? kpisRecord.trialsToday ?? raw.scheduledTrialsToday ?? raw.trialsToday,
        'scheduledTrialsToday'
      );
      const bookingsAwaitingConfirmation = parseRequiredMetric(
        kpisRecord.bookingsAwaitingConfirmation ?? kpisRecord.confirmationsPending ?? raw.bookingsAwaitingConfirmation ?? raw.confirmationsPending,
        'bookingsAwaitingConfirmation'
      );
      const activeLiveEngagements = parseRequiredMetric(
        kpisRecord.activeLiveEngagements ?? kpisRecord.activeBookings ?? raw.activeLiveEngagements ?? raw.activeBookings,
        'activeLiveEngagements'
      );
      const replacementRequests = parseRequiredMetric(
        kpisRecord.replacementRequests ?? kpisRecord.replacementsPending ?? kpisRecord.replacementVolume ?? raw.replacementRequests ?? raw.replacementsPending ?? raw.replacementVolume,
        'replacementRequests'
      );
      const pendingVerificationCases = parseRequiredMetric(
        kpisRecord.pendingVerificationCases ?? kpisRecord.pendingVerifications ?? kpisRecord.verificationQueue ?? raw.pendingVerificationCases ?? raw.pendingVerifications ?? raw.verificationQueue,
        'pendingVerificationCases'
      );
      const openDisputes = parseRequiredMetric(
        kpisRecord.openDisputes ?? kpisRecord.openTickets ?? kpisRecord.activeGrievances ?? raw.openDisputes ?? raw.openTickets ?? raw.activeGrievances,
        'openDisputes'
      );
      const pendingRefunds = parseRequiredMetric(
        kpisRecord.pendingRefunds ?? kpisRecord.refundsPending ?? raw.pendingRefunds ?? raw.refundsPending,
        'pendingRefunds'
      );
      const expiringVerifications = parseRequiredMetric(
        kpisRecord.expiringVerifications ?? kpisRecord.expiringClearances ?? kpisRecord.policeVerifDue ?? raw.expiringVerifications ?? raw.expiringClearances ?? raw.policeVerifDue,
        'expiringVerifications'
      );

      if (!('queues' in raw) || !raw.queues || typeof raw.queues !== 'object') {
        throw new ServerFailureError('Dashboard contract violation: missing or malformed operational queues.');
      }

      const rawQueues = raw.queues as Record<string, unknown>;

      const parseQueueList = (list: unknown, tabName: string): OperationsQueueItem[] => {
        if (!list) return [];
        if (!Array.isArray(list)) {
          throw new ServerFailureError(`Dashboard contract violation: queue tab "${tabName}" must be an array.`);
        }
        return list.map((item, index) => {
          if (!item || typeof item !== 'object') {
            throw new ServerFailureError(`Dashboard contract violation: malformed queue item in "${tabName}" at index ${index}.`);
          }
          const q = item as Record<string, unknown>;
          if (!q.id || !q.customerName || !q.category || !q.locality || !q.status || !q.dominantAction || !q.targetRoute) {
            throw new ServerFailureError(`Dashboard contract violation: item in queue "${tabName}" at index ${index} missing required fields.`);
          }
          return {
            id: String(q.id),
            customerName: String(q.customerName),
            category: String(q.category),
            locality: String(q.locality),
            status: String(q.status),
            submissionTime: String(q.submissionTime || 'Recent'),
            dominantAction: String(q.dominantAction),
            targetRoute: String(q.targetRoute),
          };
        });
      };

      const queues: Record<OperationsQueueTab, OperationsQueueItem[]> = {
        NEW_REQUESTS: parseQueueList(rawQueues.NEW_REQUESTS, 'NEW_REQUESTS'),
        MATCHING: parseQueueList(rawQueues.MATCHING, 'MATCHING'),
        TRIALS: parseQueueList(rawQueues.TRIALS, 'TRIALS'),
        CONFIRMATIONS: parseQueueList(rawQueues.CONFIRMATIONS, 'CONFIRMATIONS'),
        ACTIVE_SERVICES: parseQueueList(rawQueues.ACTIVE_SERVICES, 'ACTIVE_SERVICES'),
        REPLACEMENTS: parseQueueList(rawQueues.REPLACEMENTS, 'REPLACEMENTS'),
        REFUNDS: parseQueueList(rawQueues.REFUNDS, 'REFUNDS'),
        FOLLOW_UPS: parseQueueList(rawQueues.FOLLOW_UPS, 'FOLLOW_UPS'),
        SUPPORT_HANDOFFS: parseQueueList(rawQueues.SUPPORT_HANDOFFS, 'SUPPORT_HANDOFFS'),
      };

      return {
        kpis: {
          totalCustomers,
          totalWorkers,
          newBookingRequests,
          bookingsAwaitingMatching,
          scheduledTrialsToday,
          bookingsAwaitingConfirmation,
          activeLiveEngagements,
          replacementRequests,
          pendingVerificationCases,
          openDisputes,
          pendingRefunds,
          expiringVerifications,
        },
        queues,
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getVerificationExecutiveDashboard(): Promise<{
    kpis: VerificationExecutiveKPIs;
    queues: Record<'PENDING_REVIEW' | 'IN_REVIEW' | 'RECHECK_DUE' | 'REJECTED', VerificationDashboardQueueItem[]>;
  }> {
    const parseVerifQueueList = (list: unknown, tabName: string): VerificationDashboardQueueItem[] => {
      if (!list) return [];
      if (!Array.isArray(list)) {
        throw new ServerFailureError(`Dashboard contract violation: verification queue "${tabName}" must be an array.`);
      }
      return list.map((item, index) => {
        if (!item || typeof item !== 'object') {
          throw new ServerFailureError(`Dashboard contract violation: malformed verification item in "${tabName}" at index ${index}.`);
        }
        const q = item as Record<string, unknown>;
        if (!q.id || !q.workerId || !q.workerName || !q.category || !q.status || !q.actionLabel) {
          throw new ServerFailureError(`Dashboard contract violation: verification item in "${tabName}" at index ${index} missing required fields.`);
        }
        return {
          id: String(q.id),
          workerId: String(q.workerId),
          workerName: String(q.workerName),
          category: String(q.category),
          submissionTime: String(q.submissionTime || 'Recent'),
          pendingCheckTypes: Array.isArray(q.pendingCheckTypes) ? q.pendingCheckTypes.map(String) : [],
          status: String(q.status) as VerificationDashboardQueueItem['status'],
          actionLabel: String(q.actionLabel),
        };
      });
    };

    try {
      // 1. Attempt dedicated /admin/dashboard endpoint if available and authorized
      try {
        const res = await httpClient.get<Record<string, unknown>>('/admin/dashboard');
        const root = res.data;
        if (root && typeof root === 'object') {
          const raw = (root.data && typeof root.data === 'object' && !Array.isArray(root.data))
            ? (root.data as Record<string, unknown>)
            : root;

          const kpisRecord = (raw.kpis && typeof raw.kpis === 'object' && !Array.isArray(raw.kpis))
            ? (raw.kpis as Record<string, unknown>)
            : undefined;

          // If payload explicitly contains verification-specific KPI structure
          if (kpisRecord || ('pendingReview' in raw) || ('pendingQueue' in raw)) {
            const metricsSource = kpisRecord || raw;
            const pendingReview = parseRequiredMetric(
              metricsSource.pendingReview ?? raw.pendingQueue ?? raw.pendingVerifications,
              'pendingReview'
            );
            const inProgressReview = parseRequiredMetric(
              metricsSource.inProgressReview ?? raw.inReview,
              'inProgressReview'
            );
            const reCheckDue = parseRequiredMetric(
              metricsSource.reCheckDue ?? raw.expiringClearances,
              'reCheckDue'
            );
            const decisionsToday = parseRequiredMetric(
              metricsSource.decisionsToday ?? raw.decisionsToday,
              'decisionsToday'
            );
            const correctionsRequired = metricsSource.correctionsRequired !== undefined
              ? parseOptionalMetric(metricsSource.correctionsRequired, 'correctionsRequired') ?? 0
              : 0;

            if (!('queues' in raw) || !raw.queues || typeof raw.queues !== 'object') {
              throw new ServerFailureError('Dashboard contract violation: missing or malformed verification queues.');
            }

            const rawQueues = raw.queues as Record<string, unknown>;

            return {
              kpis: {
                pendingReview,
                inProgressReview,
                reCheckDue,
                decisionsToday,
                correctionsRequired,
                overdueReviews: null,
                avgProcessingTimeMinutes: null,
              },
              queues: {
                PENDING_REVIEW: parseVerifQueueList(rawQueues.PENDING_REVIEW, 'PENDING_REVIEW'),
                IN_REVIEW: parseVerifQueueList(rawQueues.IN_REVIEW, 'IN_REVIEW'),
                RECHECK_DUE: parseVerifQueueList(rawQueues.RECHECK_DUE, 'RECHECK_DUE'),
                REJECTED: parseVerifQueueList(rawQueues.REJECTED, 'REJECTED'),
              },
            };
          }
        }
      } catch (err: unknown) {
        // Strict contract validation failures must propagate
        if (err instanceof ServerFailureError) {
          throw err;
        }
        // If 403 Forbidden (no dashboard.view) or 404 Not Found, fall back to authorized verification queue endpoint
      }

      // 2. Derive accurately from authorized verification queue API: GET /admin/verification/queue
      const [pendingRes, inReviewRes, recheckRes, approvedRes, rejectedRes] = await Promise.all([
        httpClient.get<{
          success?: boolean;
          data: Record<string, unknown>[];
          meta?: { totalItems?: number };
        }>('/admin/verification/queue', { params: { status: 'PENDING_REVIEW', limit: 10 } }),
        httpClient.get<{
          success?: boolean;
          data: Record<string, unknown>[];
          meta?: { totalItems?: number };
        }>('/admin/verification/queue', { params: { status: 'IN_REVIEW', limit: 10 } }),
        httpClient.get<{
          success?: boolean;
          data: Record<string, unknown>[];
          meta?: { totalItems?: number };
        }>('/admin/verification/queue', { params: { status: 'RECHECK_DUE', limit: 10 } }),
        httpClient.get<{
          success?: boolean;
          data: Record<string, unknown>[];
          meta?: { totalItems?: number };
        }>('/admin/verification/queue', { params: { status: 'APPROVED', limit: 10 } }).catch(() => null),
        httpClient.get<{
          success?: boolean;
          data: Record<string, unknown>[];
          meta?: { totalItems?: number };
        }>('/admin/verification/queue', { params: { status: 'REJECTED', limit: 10 } }).catch(() => null),
      ]);

      const parseQueueItems = (items: Record<string, unknown>[] | undefined, fallbackStatus: string, defaultAction: string): VerificationDashboardQueueItem[] => {
        if (!Array.isArray(items)) return [];
        return items.map((raw) => {
          const worker = (raw.worker && typeof raw.worker === 'object') ? (raw.worker as Record<string, unknown>) : undefined;
          let pendingCheckTypes: string[] = [];
          if (Array.isArray(raw.pendingCheckTypes)) {
            pendingCheckTypes = raw.pendingCheckTypes.map(String);
          } else if (Array.isArray(raw.checks)) {
            pendingCheckTypes = raw.checks
              .filter((c: unknown) => c && typeof c === 'object' && (c as Record<string, unknown>).status === 'PENDING')
              .map((c: unknown) => String((c as Record<string, unknown>).title || (c as Record<string, unknown>).type || 'Check'));
          } else if (raw.checks && typeof raw.checks === 'object') {
            pendingCheckTypes = Object.entries(raw.checks as Record<string, Record<string, unknown>>)
              .filter(([, v]) => v && v.status === 'PENDING')
              .map(([k, v]) => String(v.title || k));
          }

          return {
            id: String(raw.id || raw.checkId || raw.dossierId || ''),
            workerId: String(raw.workerId || worker?.id || raw.id || ''),
            workerName: String(raw.workerName || worker?.fullName || 'Worker'),
            category: String(raw.category || worker?.category || 'General Service'),
            submissionTime: String(raw.submittedAt || raw.createdAt || raw.submissionTime || 'Recent'),
            pendingCheckTypes,
            status: String(raw.status || fallbackStatus) as VerificationDashboardQueueItem['status'],
            actionLabel: String(raw.actionLabel || defaultAction),
          };
        });
      };

      const pendingItems = Array.isArray(pendingRes.data?.data) ? pendingRes.data.data : [];
      const inReviewItems = Array.isArray(inReviewRes.data?.data) ? inReviewRes.data.data : [];
      const recheckItems = Array.isArray(recheckRes.data?.data) ? recheckRes.data.data : [];
      const approvedItems = Array.isArray(approvedRes?.data?.data) ? approvedRes.data.data : [];
      const rejectedItems = Array.isArray(rejectedRes?.data?.data) ? rejectedRes.data.data : [];

      const pendingReview = pendingRes.data?.meta?.totalItems ?? pendingItems.length;
      const inProgressReview = inReviewRes.data?.meta?.totalItems ?? inReviewItems.length;
      const reCheckDue = recheckRes.data?.meta?.totalItems ?? recheckItems.length;
      const completedReviews = approvedRes?.data?.meta?.totalItems ?? approvedItems.length;
      const correctionsRequired = rejectedRes?.data?.meta?.totalItems ?? rejectedItems.length;

      return {
        kpis: {
          pendingReview,
          inProgressReview,
          reCheckDue,
          decisionsToday: 0,
          completedReviews,
          correctionsRequired,
          overdueReviews: null,
          avgProcessingTimeMinutes: null,
        },
        queues: {
          PENDING_REVIEW: parseQueueItems(pendingItems, 'PENDING_REVIEW', 'Review KYC'),
          IN_REVIEW: parseQueueItems(inReviewItems, 'IN_REVIEW', 'Resume Review'),
          RECHECK_DUE: parseQueueItems(recheckItems, 'RECHECK_DUE', 'Inspect Expiry'),
          REJECTED: parseQueueItems(rejectedItems, 'REJECTED', 'Inspect Rejection'),
        },
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getSupportExecutiveDashboard(): Promise<{
    kpis: SupportExecutiveKPIs;
    queues: Record<'AT_RISK' | 'UNASSIGNED' | 'MY_CASES' | 'ESCALATED', SupportDashboardQueueItem[]>;
  }> {
    const parseSupportQueueList = (list: unknown, tabName: string): SupportDashboardQueueItem[] => {
      if (!list) return [];
      if (!Array.isArray(list)) {
        throw new ServerFailureError(`Dashboard contract violation: support queue "${tabName}" must be an array.`);
      }
      return list.map((item, index) => {
        if (!item || typeof item !== 'object') {
          throw new ServerFailureError(`Dashboard contract violation: malformed support item in "${tabName}" at index ${index}.`);
        }
        const q = item as Record<string, unknown>;
        if (!q.id || !q.ticketId || !q.complainantName || !q.roleType || !q.category || !q.disputeCategory || !q.slaIndicator || !q.status || !q.actionLabel) {
          throw new ServerFailureError(`Dashboard contract violation: support item in "${tabName}" at index ${index} missing required fields.`);
        }
        return {
          id: String(q.id),
          ticketId: String(q.ticketId),
          complainantName: String(q.complainantName),
          roleType: (q.roleType as 'CUSTOMER' | 'WORKER') || 'CUSTOMER',
          category: String(q.category),
          disputeCategory: String(q.disputeCategory),
          slaIndicator: (q.slaIndicator as 'NORMAL' | 'AT_RISK' | 'BREACHED') || 'NORMAL',
          status: String(q.status),
          actionLabel: String(q.actionLabel),
        };
      });
    };

    const mapTicketToQueueItem = (raw: Record<string, unknown>, defaultAction: string): SupportDashboardQueueItem => {
      const creator = raw.creator as Record<string, unknown> | undefined;
      const complainantName = String(
        raw.complainantName ||
        creator?.fullName ||
        (raw.creatorKind === 'CUSTOMER' ? 'Customer' : 'Worker') ||
        'User'
      );
      const isBreached = Boolean(raw.slaBreachedAt) || raw.slaStatus === 'BREACHED';
      const isAtRisk = raw.slaStatus === 'AT_RISK';
      const slaIndicator = isBreached ? 'BREACHED' : isAtRisk ? 'AT_RISK' : 'NORMAL';

      return {
        id: String(raw.id || raw.ticketId || ''),
        ticketId: String(raw.ticketId || raw.id || ''),
        complainantName,
        roleType: (raw.creatorKind as 'CUSTOMER' | 'WORKER') || (raw.complainantType as 'CUSTOMER' | 'WORKER') || 'CUSTOMER',
        category: (raw.category && typeof raw.category === 'object')
          ? String((raw.category as Record<string, unknown>).name || (raw.category as Record<string, unknown>).code || 'Support')
          : String(raw.category || 'Support'),
        disputeCategory: String(raw.subject || raw.disputeCategory || 'Support Ticket'),
        slaIndicator,
        status: String(raw.status || 'OPEN'),
        actionLabel: defaultAction,
      };
    };

    try {
      // 1. First attempt to read from unified /admin/dashboard
      let complaintsSection: Record<string, unknown> | undefined;
      let rawQueues: Record<string, unknown> | undefined;

      try {
        const res = await httpClient.get<Record<string, unknown>>('/admin/dashboard');
        const root = res.data;
        if (root && typeof root === 'object') {
          const raw = (root.data && typeof root.data === 'object' && !Array.isArray(root.data))
            ? (root.data as Record<string, unknown>)
            : root;

          const kpisRecord = (raw.kpis && typeof raw.kpis === 'object' && !Array.isArray(raw.kpis))
            ? (raw.kpis as Record<string, unknown>)
            : undefined;

          // If payload explicitly contains dedicated support KPI structure
          if (
            kpisRecord ||
            ('openUnassignedGrievances' in raw) ||
            ('unassignedTickets' in raw) ||
            ('openTickets' in raw)
          ) {
            const metricsSource = kpisRecord || raw;
            const openUnassignedGrievances = parseRequiredMetric(
              metricsSource.openUnassignedGrievances ?? metricsSource.unassignedTickets ?? metricsSource.openTickets,
              'openUnassignedGrievances'
            );
            const myActiveCases = parseRequiredMetric(
              metricsSource.myActiveCases ?? metricsSource.assignedTickets,
              'myActiveCases'
            );
            const slaAtRiskCount = metricsSource.slaAtRiskCount !== undefined
              ? parseOptionalMetric(metricsSource.slaAtRiskCount, 'slaAtRiskCount')
              : null;
            const slaBreachedCount = parseRequiredMetric(
              metricsSource.slaBreachedCount ?? metricsSource.breachedTickets,
              'slaBreachedCount'
            );
            const resolvedTodayCount = parseRequiredMetric(
              metricsSource.resolvedTodayCount ?? metricsSource.resolvedTickets,
              'resolvedTodayCount'
            );

            if (!('queues' in raw) || !raw.queues || typeof raw.queues !== 'object') {
              throw new ServerFailureError('Dashboard contract violation: missing or malformed support queues.');
            }

            const rawQueues = raw.queues as Record<string, unknown>;

            return {
              kpis: {
                openUnassignedGrievances,
                myActiveCases,
                slaAtRiskCount,
                slaBreachedCount,
                resolvedTodayCount,
              },
              queues: {
                AT_RISK: parseSupportQueueList(rawQueues.AT_RISK, 'AT_RISK'),
                UNASSIGNED: parseSupportQueueList(rawQueues.UNASSIGNED, 'UNASSIGNED'),
                MY_CASES: parseSupportQueueList(rawQueues.MY_CASES, 'MY_CASES'),
                ESCALATED: parseSupportQueueList(rawQueues.ESCALATED, 'ESCALATED'),
              },
            };
          }

          // Check if unified dashboard has sections.complaints
          if (raw.sections && typeof raw.sections === 'object' && !Array.isArray(raw.sections)) {
            const sections = raw.sections as Record<string, unknown>;
            if (sections.complaints && typeof sections.complaints === 'object') {
              complaintsSection = sections.complaints as Record<string, unknown>;
            }
          }

          if (raw.queues && typeof raw.queues === 'object') {
            rawQueues = raw.queues as Record<string, unknown>;
          }
        }
      } catch (err: unknown) {
        if (err instanceof ServerFailureError) {
          throw err;
        }
        // Fall back gracefully to support tickets API
      }

      // If complaints section is present from /admin/dashboard
      if (complaintsSection) {
        const openUnassignedGrievances = parseOptionalMetric(
          complaintsSection.unassigned ?? complaintsSection.open,
          'complaints.open'
        );
        const myActiveCases = parseOptionalMetric(
          complaintsSection.inProgress ?? complaintsSection.investigationPending,
          'complaints.inProgress'
        );
        // SLA-at-risk threshold is not defined on backend; do not invent client-side thresholds.
        // Return null so UI shows "—" rather than fabricated 0.
        const slaAtRiskCount: number | null = null;
        const slaBreachedCount = complaintsSection.escalated !== undefined
          ? parseOptionalMetric(complaintsSection.escalated, 'complaints.escalated')
          : null;
        const resolvedTodayCount: number | null = null;

        // Populate queues
        let queues: Record<'AT_RISK' | 'UNASSIGNED' | 'MY_CASES' | 'ESCALATED', SupportDashboardQueueItem[]>;
        if (rawQueues && ('AT_RISK' in rawQueues || 'UNASSIGNED' in rawQueues)) {
          queues = {
            AT_RISK: parseSupportQueueList(rawQueues.AT_RISK, 'AT_RISK'),
            UNASSIGNED: parseSupportQueueList(rawQueues.UNASSIGNED, 'UNASSIGNED'),
            MY_CASES: parseSupportQueueList(rawQueues.MY_CASES, 'MY_CASES'),
            ESCALATED: parseSupportQueueList(rawQueues.ESCALATED, 'ESCALATED'),
          };
        } else {
          // Fetch authorized support tickets API for queue breakdown
          const ticketsRes = await httpClient.get<{
            success: boolean;
            data: Record<string, unknown>[];
          }>('/admin/support/tickets', { params: { limit: 50 } });
          const rawTickets = Array.isArray(ticketsRes.data?.data) ? ticketsRes.data.data : [];
          const atRiskTickets = rawTickets.filter(
            (t) => Boolean(t.slaBreachedAt) || t.slaStatus === 'AT_RISK' || t.slaStatus === 'BREACHED'
          );
          const unassignedTickets = rawTickets.filter(
            (t) => !t.assignedToUserId && !t.assignedToStaffId && !t.assigneeUserId && t.status !== 'CLOSED' && t.status !== 'RESOLVED'
          );
          const myCasesTickets = rawTickets.filter(
            (t) => (Boolean(t.assignedToUserId) || Boolean(t.assignedToStaffId) || Boolean(t.assigneeUserId)) && t.status !== 'CLOSED' && t.status !== 'RESOLVED'
          );
          const escalatedTickets = rawTickets.filter((t) => t.status === 'ESCALATED');

          queues = {
            AT_RISK: atRiskTickets.map((t) => mapTicketToQueueItem(t, 'Mediate Dispute')),
            UNASSIGNED: unassignedTickets.map((t) => mapTicketToQueueItem(t, 'Claim Ticket')),
            MY_CASES: myCasesTickets.map((t) => mapTicketToQueueItem(t, 'Open Call Logs')),
            ESCALATED: escalatedTickets.map((t) => mapTicketToQueueItem(t, 'View Ops Status')),
          };
        }

        return {
          kpis: {
            openUnassignedGrievances,
            myActiveCases,
            slaAtRiskCount,
            slaBreachedCount,
            resolvedTodayCount,
          },
          queues,
        };
      }

      // 2. Derive accurately from authorized support tickets API: GET /admin/support/tickets
      const ticketsRes = await httpClient.get<{
        success: boolean;
        data: Record<string, unknown>[];
        meta?: { totalItems?: number };
      }>('/admin/support/tickets', { params: { limit: 50 } });

      const rawTickets = Array.isArray(ticketsRes.data?.data) ? ticketsRes.data.data : [];

      const atRiskTickets = rawTickets.filter(
        (t) => Boolean(t.slaBreachedAt) || t.slaStatus === 'AT_RISK' || t.slaStatus === 'BREACHED'
      );
      const unassignedTickets = rawTickets.filter(
        (t) => !t.assignedToUserId && !t.assignedToStaffId && !t.assigneeUserId && t.status !== 'CLOSED' && t.status !== 'RESOLVED'
      );
      const myCasesTickets = rawTickets.filter(
        (t) => (Boolean(t.assignedToUserId) || Boolean(t.assignedToStaffId) || Boolean(t.assigneeUserId)) && t.status !== 'CLOSED' && t.status !== 'RESOLVED'
      );
      const escalatedTickets = rawTickets.filter((t) => t.status === 'ESCALATED');

      const openUnassignedGrievances = unassignedTickets.length;
      const myActiveCases = myCasesTickets.length;
      // Do not invent SLA-at-risk threshold; check if backend explicitly returns slaStatus === 'AT_RISK'
      const hasExplicitAtRisk = rawTickets.some((t) => t.slaStatus === 'AT_RISK');
      const slaAtRiskCount: number | null = hasExplicitAtRisk
        ? rawTickets.filter((t) => t.slaStatus === 'AT_RISK').length
        : null;
      const slaBreachedCount = rawTickets.filter(
        (t) => Boolean(t.slaBreachedAt) || t.slaStatus === 'BREACHED'
      ).length;

      const todayIso = new Date().toISOString().split('T')[0];
      const resolvedToday = rawTickets.filter(
        (t) => (t.status === 'CLOSED' || t.status === 'RESOLVED') && t.closedAt && String(t.closedAt).startsWith(todayIso)
      ).length;
      const hasClosedTickets = rawTickets.some((t) => t.status === 'CLOSED' || t.status === 'RESOLVED');
      const resolvedTodayCount: number | null = hasClosedTickets ? resolvedToday : null;

      return {
        kpis: {
          openUnassignedGrievances,
          myActiveCases,
          slaAtRiskCount,
          slaBreachedCount,
          resolvedTodayCount,
        },
        queues: {
          AT_RISK: atRiskTickets.map((t) => mapTicketToQueueItem(t, 'Mediate Dispute')),
          UNASSIGNED: unassignedTickets.map((t) => mapTicketToQueueItem(t, 'Claim Ticket')),
          MY_CASES: myCasesTickets.map((t) => mapTicketToQueueItem(t, 'Open Call Logs')),
          ESCALATED: escalatedTickets.map((t) => mapTicketToQueueItem(t, 'View Ops Status')),
        },
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }
}

export { RealDashboardRepository as DashboardRepositoryImpl };

export const createDashboardRepository = (
  useMock: boolean = env.VITE_USE_MOCK_AUTH
): IDashboardRepository => {
  return useMock ? new MockDashboardRepository() : new RealDashboardRepository();
};

export const dashboardRepository = createDashboardRepository();
