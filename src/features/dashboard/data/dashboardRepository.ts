import {
  IDashboardRepository,
  SuperAdminQueueItem,
  SuperAdminDashboardData,
  SuperAdminDashboardSections,
  OperationsAdminDashboardData,
  OperationsQueueItem,
  OperationsQueueTab,
  VerificationDashboardQueueItem,
  VerificationExecutiveDashboardData,
  VerificationAttentionApplication,
  VerificationSLAOverview,
  VerificationStatusDistributionItem,
  SupportDashboardQueueItem,
  SupportDashboardQueues,
  SupportExecutiveDashboardData,
  SupportExecutiveAnalyticsData,
  SupportStatusDistributionItem,
  SupportRecentActivityItem,
  SupportActivityType,
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
import { getWorkerName, getCustomerName } from '../../../core/utils/phoneDirectory';
import { env } from '../../../core/config/env';
import { useAuthStore } from '../../../core/auth/authStore';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';
import { ServerFailureError } from '../../../core/errors/DomainError';
import { formatCurrencyINR } from '../../../shared/formatters/currency';

function buildSupportStatusDistribution(
  open: number,
  inInvestigation: number,
  escalated: number,
  resolved: number
): SupportStatusDistributionItem[] {
  return [
    { status: 'OPEN', label: 'Open', count: open, color: '#3B82F6' },
    { status: 'IN_INVESTIGATION', label: 'In Investigation', count: inInvestigation, color: '#D97706' },
    { status: 'ESCALATED', label: 'Escalated', count: escalated, color: '#DC2626' },
    { status: 'RESOLVED', label: 'Resolved', count: resolved, color: '#16A34A' },
  ];
}

function classifyTicketSLA(t: Record<string, unknown>, nowMs: number): 'NORMAL' | 'AT_RISK' | 'BREACHED' {
  const status = String(t.status || '').toUpperCase();
  const isClosed = status === 'CLOSED' || status === 'RESOLVED';
  if (Boolean(t.slaBreachedAt) || t.slaStatus === 'BREACHED') {
    return 'BREACHED';
  }
  if (isClosed) {
    return 'NORMAL';
  }
  if (t.slaStatus === 'AT_RISK') {
    return 'AT_RISK';
  }
  if (t.dueAt) {
    const dueMs = new Date(String(t.dueAt)).getTime();
    if (!isNaN(dueMs)) {
      if (dueMs <= nowMs) return 'BREACHED';
      if (dueMs - nowMs <= 24 * 3600 * 1000) return 'AT_RISK';
    }
  }
  return 'NORMAL';
}

function buildRecentActivityFromQueueItems(items: SupportDashboardQueueItem[]): SupportRecentActivityItem[] {
  return items.slice(0, 8).map((item) => {
    const status = item.status.toUpperCase();
    let activityType: SupportActivityType = 'UPDATED';
    let activityLabel = 'Ticket Updated';
    if (status === 'RESOLVED' || status === 'CLOSED') {
      activityType = 'RESOLVED';
      activityLabel = 'Ticket Resolved';
    } else if (status === 'ESCALATED' || status === 'REPLACEMENT_INITIATED') {
      activityType = 'ESCALATED';
      activityLabel = 'Ticket Escalated';
    } else if (status === 'OPEN' || status === 'CREATED') {
      activityType = 'CREATED';
      activityLabel = 'Ticket Created';
    }
    return {
      id: item.id,
      ticketId: item.ticketId,
      activityType,
      activityLabel,
      timestamp: '',
      status: item.status,
      complainantName: item.complainantName,
      roleType: item.roleType,
      category: item.category,
      disputeCategory: item.disputeCategory,
      slaIndicator: item.slaIndicator,
    };
  });
}

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
        registeredCustomers: 128,
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
        customers: {
          registered: 128,
          active: 112,
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

  async getOperationsAdminDashboard(): Promise<OperationsAdminDashboardData> {
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
      sections: {
        bookings: {
          grossBookings: 348,
          byStatus: [
            { status: 'REQUESTED', count: 28 },
            { status: 'MATCHING_IN_PROGRESS', count: 19 },
            { status: 'INTERVIEW_SCHEDULED', count: 12 },
            { status: 'CONFIRMED', count: 6 },
            { status: 'SERVICE_ACTIVE', count: 348 },
            { status: 'COMPLETED', count: 215 },
            { status: 'CANCELLED', count: 42 },
            { status: 'REPLACEMENT_REQUESTED', count: 14 },
          ],
        },
        workers: {
          registered: 164,
          verifiedAndActive: 142,
        },
        customers: {
          registered: 128,
          active: 96,
        },
        pendingKyc: {
          submitted: 12,
          inReview: 6,
        },
        complaints: {
          open: 2,
          inProgress: 2,
          escalated: 1,
          unassigned: 0,
        },
        replacements: {
          requested: 14,
          approved: 12,
        },
        collections: [
          {
            currency: 'INR',
            todayMinor: 1480000,
            monthToDateMinor: 48900000,
            todayINR: 14800,
            monthToDateINR: 489000,
            todayFormatted: '₹14,800',
            monthToDateFormatted: '₹4,89,000',
          },
        ],
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

  async getVerificationExecutiveDashboard(): Promise<VerificationExecutiveDashboardData> {
    return {
      overview: {
        pendingApplications: 3,
        inReview: 1,
        correctionsRequired: 1,
        recheckDue: 1,
      },
      statusDistribution: [
        { status: 'PENDING_REVIEW', label: 'Pending Review', count: 3, color: '#F59E0B' },
        { status: 'IN_REVIEW', label: 'In Review', count: 1, color: '#3B82F6' },
        { status: 'REJECTED', label: 'Corrections Required / Rejected', count: 1, color: '#EF4444' },
        { status: 'RECHECK_DUE', label: 'Re-check Due', count: 1, color: '#8B5CF6' },
        { status: 'APPROVED', label: 'Approved', count: 22, color: '#10B981' },
      ],
      recentAttentionApplications: [
        {
          id: 'VQ-101',
          workerId: 'W-10482',
          applicationId: 'APP-10482',
          applicantName: 'Sunita Devi',
          serviceCategory: 'House Maid',
          submissionDate: '2026-11-01T08:30:00.000Z',
          status: 'PENDING_REVIEW',
          isOverdue: false,
          slaFlags: [],
        },
        {
          id: 'VQ-103',
          workerId: 'W-10484',
          applicationId: 'APP-10484',
          applicantName: 'Meena Bai',
          serviceCategory: 'Cook',
          submissionDate: '2026-11-02T10:15:00.000Z',
          status: 'PENDING_REVIEW',
          isOverdue: false,
          slaFlags: [],
        },
        {
          id: 'VQ-105',
          workerId: 'W-10488',
          applicationId: 'APP-10488',
          applicantName: 'Anil Rao',
          serviceCategory: 'Elderly Care',
          submissionDate: '2026-10-20T12:00:00.000Z',
          status: 'PENDING_REVIEW',
          isOverdue: true,
          slaFlags: ['OVERDUE'],
        },
      ],
      slaOverview: {
        withinSla: 2,
        approachingSla: 0,
        slaExceeded: 1,
        notes: 'Duration telemetry pending backend contract',
      },
      kpis: {
        registeredWorkers: 29,
        verifiedAndActiveWorkers: 22,
        pendingKycSubmitted: 6,
        inReview: 1,
        openAlerts: 0,
        criticalAlerts: 0,
        warningAlerts: 0,
        pendingReview: 6,
        inProgressReview: 1,
        reCheckDue: 1,
        decisionsToday: 0,
        completedReviews: null,
        correctionsRequired: 1,
        overdueReviews: 1,
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

  async getSupportExecutiveDashboard(): Promise<SupportExecutiveDashboardData> {
    const allQueues: SupportDashboardQueueItem[] = [
      { id: 'Q-01', ticketId: 'TKT-4921', complainantName: 'Anand Sharma', roleType: 'CUSTOMER', category: 'House Maid', disputeCategory: 'Unannounced Absence', slaIndicator: 'AT_RISK', status: 'INVESTIGATION_PENDING', actionLabel: 'Mediate Dispute', ticketOwner: 'Pooja (Support Exec)' },
      { id: 'Q-02', ticketId: 'TKT-4902', complainantName: 'Priya Reddy', roleType: 'CUSTOMER', category: 'Cook', disputeCategory: 'Replacement Delay', slaIndicator: 'BREACHED', status: 'ESCALATED', actionLabel: 'High Priority Intake' },
      { id: 'Q-03', ticketId: 'TKT-4919', complainantName: 'Sunita Devi', roleType: 'WORKER', category: 'House Maid', disputeCategory: 'Payout Clarification', slaIndicator: 'NORMAL', status: 'OPEN', actionLabel: 'Mediate Dispute' },
      { id: 'Q-04', ticketId: 'TKT-4915', complainantName: 'Kavita Kumari', roleType: 'WORKER', category: 'Babysitter', disputeCategory: 'Overtime Dispute', slaIndicator: 'NORMAL', status: 'OPEN', actionLabel: 'Mediate Dispute' },
      { id: 'Q-05', ticketId: 'TKT-4890', complainantName: 'Rajesh Kumar', roleType: 'CUSTOMER', category: 'Driver', disputeCategory: 'Service Quality Dispute', slaIndicator: 'NORMAL', status: 'INVESTIGATION_PENDING', actionLabel: 'Open Call Logs', ticketOwner: 'Pooja (Support Exec)' },
      { id: 'Q-06', ticketId: 'TKT-4877', complainantName: 'Manish V', roleType: 'CUSTOMER', category: 'Cook', disputeCategory: 'Contract Termination', slaIndicator: 'NORMAL', status: 'ESCALATED', actionLabel: 'View Ops Status' },
      { id: 'Q-07', ticketId: 'TKT-4850', complainantName: 'Rohit Verma', roleType: 'CUSTOMER', category: 'Cook', disputeCategory: 'Resolution Complete', slaIndicator: 'NORMAL', status: 'RESOLVED', actionLabel: 'Inspect Record', ticketOwner: 'Pooja (Support Exec)' },
    ];

    const openCount = allQueues.filter((t) => t.status === 'OPEN' || t.status === 'CREATED').length;
    const inInvestigationCount = allQueues.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'INVESTIGATION_PENDING' || t.status === 'ASSIGNED').length;
    const escalatedCount = allQueues.filter((t) => t.status === 'ESCALATED' || t.status === 'REPLACEMENT_INITIATED').length;
    const resolvedCount = allQueues.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
    const normalSla = allQueues.filter((t) => t.slaIndicator === 'NORMAL').length;
    const atRiskSla = allQueues.filter((t) => t.slaIndicator === 'AT_RISK').length;
    const breachedSla = allQueues.filter((t) => t.slaIndicator === 'BREACHED').length;

    return {
      kpis: {
        totalTickets: allQueues.length,
        unassignedTickets: 2,
        myAssignedTickets: 1,
        inProgressTickets: inInvestigationCount,
        slaImminentBreach: atRiskSla,
        escalatedTickets: escalatedCount,
        resolvedTickets: resolvedCount,
        openUnassignedGrievances: 2,
        myActiveCases: 1,
        slaAtRiskCount: atRiskSla,
        slaBreachedCount: breachedSla,
        resolvedTodayCount: resolvedCount,
      },
      queues: {
        ALL: allQueues,
        AT_RISK: [allQueues[0], allQueues[1]],
        UNASSIGNED: [allQueues[2], allQueues[3]],
        MY_CASES: [allQueues[4]],
        IN_PROGRESS: [allQueues[0], allQueues[4]],
        ESCALATED: [allQueues[5]],
        RESOLVED: [allQueues[6]],
      },
      analytics: {
        openTickets: openCount,
        inInvestigationTickets: inInvestigationCount,
        escalatedTickets: escalatedCount,
        resolvedTickets: resolvedCount,
        slaAtRiskOrBreached: atRiskSla + breachedSla,
        statusDistribution: buildSupportStatusDistribution(openCount, inInvestigationCount, escalatedCount, resolvedCount),
        slaMonitoring: {
          normal: normalSla,
          atRisk: atRiskSla,
          breached: breachedSla,
        },
        recentActivity: buildRecentActivityFromQueueItems(allQueues),
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

        // 2b. Customers section: Map registered to registeredCustomers
        const customers = (sections.customers && typeof sections.customers === 'object' && !Array.isArray(sections.customers))
          ? (sections.customers as Record<string, unknown>)
          : undefined;
        const registeredCustomers = parseOptionalMetric(
          customers?.registered ?? customers?.total ?? customers?.totalCustomers ?? raw.registeredCustomers ?? raw.totalCustomers,
          'registeredCustomers'
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
          customers: customers ? {
            registered: Number(customers.registered ?? customers.total ?? 0),
            active: customers.active !== undefined ? Number(customers.active) : undefined,
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
            registeredCustomers,
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
      const registeredCustomers = parseOptionalMetric(
        kpisRecord.registeredCustomers ?? kpisRecord.totalCustomers ?? raw.registeredCustomers ?? raw.totalCustomers,
        'registeredCustomers'
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
          registeredCustomers,
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

  async getOperationsAdminDashboard(): Promise<OperationsAdminDashboardData> {
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
        const customers = (sections.customers && typeof sections.customers === 'object' && !Array.isArray(sections.customers))
          ? (sections.customers as Record<string, unknown>)
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
        const collections = Array.isArray(sections.collections) ? (sections.collections as Record<string, unknown>[]) : undefined;

        const byStatus = Array.isArray(bookings?.byStatus) ? (bookings?.byStatus as Record<string, unknown>[]) : [];
        const getStatusCount = (statusName: string) => {
          const item = byStatus.find((s) => s && s.status === statusName);
          return item ? Number(item.count || 0) : 0;
        };

        const totalCustomers = Number(customers?.registered ?? customers?.total ?? raw.totalCustomers ?? 0);
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

        const sectionBreakdowns: SuperAdminDashboardSections = {
          bookings: bookings ? {
            byStatus: byStatus.map((item) => {
              const b = item as Record<string, unknown>;
              return {
                status: String(b.status || ''),
                count: Number(b.count || 0),
              };
            }),
            grossBookings: bookings.grossBookings !== undefined ? Number(bookings.grossBookings) : undefined,
          } : undefined,
          workers: workers ? {
            registered: Number(workers.registered || 0),
            verifiedAndActive: Number(workers.verifiedAndActive || 0),
          } : undefined,
          customers: customers ? {
            registered: Number(customers.registered ?? customers.total ?? 0),
            active: customers.active !== undefined ? Number(customers.active) : undefined,
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
          collections: collections ? collections.map((col) => {
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
          sections: sectionBreakdowns,
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

      let sectionBreakdowns: SuperAdminDashboardSections | undefined;
      if (raw.sections && typeof raw.sections === 'object' && !Array.isArray(raw.sections)) {
        const sections = raw.sections as Record<string, unknown>;
        const workers = (sections.workers && typeof sections.workers === 'object' && !Array.isArray(sections.workers))
          ? (sections.workers as Record<string, unknown>)
          : undefined;
        const bookings = (sections.bookings && typeof sections.bookings === 'object' && !Array.isArray(sections.bookings))
          ? (sections.bookings as Record<string, unknown>)
          : undefined;
        const customers = (sections.customers && typeof sections.customers === 'object' && !Array.isArray(sections.customers))
          ? (sections.customers as Record<string, unknown>)
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
        const collections = Array.isArray(sections.collections) ? (sections.collections as Record<string, unknown>[]) : undefined;

        sectionBreakdowns = {
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
            grossBookings: bookings.grossBookings !== undefined ? Number(bookings.grossBookings) : undefined,
          } : undefined,
          workers: workers ? {
            registered: Number(workers.registered || 0),
            verifiedAndActive: Number(workers.verifiedAndActive || 0),
          } : undefined,
          customers: customers ? {
            registered: Number(customers.registered ?? customers.total ?? 0),
            active: customers.active !== undefined ? Number(customers.active) : undefined,
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
          collections: collections ? collections.map((col) => {
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
      }

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
        sections: sectionBreakdowns,
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getVerificationExecutiveDashboard(): Promise<VerificationExecutiveDashboardData> {
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
      let dashboardPendingKyc: { submitted?: number; inReview?: number } | undefined;
      let dashboardWorkers: { registered?: number; verifiedAndActive?: number } | undefined;
      let dashboardAlerts: { open?: number; critical?: number; warning?: number } | undefined;

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

          // If payload explicitly contains dedicated verification KPI structure
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
            const pendingQueueList = rawQueues.PENDING_REVIEW ? parseVerifQueueList(rawQueues.PENDING_REVIEW, 'PENDING_REVIEW') : [];
            const inReviewQueueList = rawQueues.IN_REVIEW ? parseVerifQueueList(rawQueues.IN_REVIEW, 'IN_REVIEW') : [];
            const recheckQueueList = rawQueues.RECHECK_DUE ? parseVerifQueueList(rawQueues.RECHECK_DUE, 'RECHECK_DUE') : [];
            const rejectedQueueList = rawQueues.REJECTED ? parseVerifQueueList(rawQueues.REJECTED, 'REJECTED') : [];

            return {
              overview: {
                pendingApplications: pendingReview,
                inReview: inProgressReview,
                correctionsRequired,
                recheckDue: reCheckDue,
              },
              statusDistribution: [
                { status: 'PENDING_REVIEW', label: 'Pending Review', count: pendingReview, color: '#F59E0B' },
                { status: 'IN_REVIEW', label: 'In Review', count: inProgressReview, color: '#3B82F6' },
                { status: 'REJECTED', label: 'Corrections Required / Rejected', count: correctionsRequired, color: '#EF4444' },
                { status: 'RECHECK_DUE', label: 'Re-check Due', count: reCheckDue, color: '#8B5CF6' },
                { status: 'APPROVED', label: 'Approved', count: Number(metricsSource.verifiedAndActiveWorkers ?? 0), color: '#10B981' },
              ],
              recentAttentionApplications: pendingQueueList.map((q) => ({
                id: q.id,
                workerId: q.workerId,
                applicationId: q.id,
                applicantName: q.workerName,
                serviceCategory: q.category,
                submissionDate: q.submissionTime,
                status: q.status,
              })),
              slaOverview: {
                withinSla: pendingReview,
                approachingSla: 0,
                slaExceeded: 0,
                notes: 'Authoritative SLA performance tracked from server-side check deadlines. Duration telemetry pending backend contract.',
              },
              kpis: {
                registeredWorkers: metricsSource.registeredWorkers ? Number(metricsSource.registeredWorkers) : null,
                verifiedAndActiveWorkers: metricsSource.verifiedAndActiveWorkers ? Number(metricsSource.verifiedAndActiveWorkers) : null,
                pendingKycSubmitted: pendingReview,
                inReview: inProgressReview,
                openAlerts: metricsSource.openAlerts !== undefined ? Number(metricsSource.openAlerts) : 0,
                criticalAlerts: metricsSource.criticalAlerts !== undefined ? Number(metricsSource.criticalAlerts) : 0,
                warningAlerts: metricsSource.warningAlerts !== undefined ? Number(metricsSource.warningAlerts) : 0,
                pendingReview,
                inProgressReview,
                reCheckDue,
                decisionsToday,
                correctionsRequired,
                completedReviews: null,
                overdueReviews: null,
                avgProcessingTimeMinutes: null,
              },
              queues: {
                PENDING_REVIEW: pendingQueueList,
                IN_REVIEW: inReviewQueueList,
                RECHECK_DUE: recheckQueueList,
                REJECTED: rejectedQueueList,
              },
            };
          }

          // Inspect observed backend sections payload
          if (raw.sections && typeof raw.sections === 'object' && !Array.isArray(raw.sections)) {
            const sections = raw.sections as Record<string, unknown>;
            if (sections.pendingKyc && typeof sections.pendingKyc === 'object') {
              dashboardPendingKyc = sections.pendingKyc as { submitted?: number; inReview?: number };
            }
            if (sections.workers && typeof sections.workers === 'object') {
              dashboardWorkers = sections.workers as { registered?: number; verifiedAndActive?: number };
            }
            if (sections.alerts && typeof sections.alerts === 'object') {
              dashboardAlerts = sections.alerts as { open?: number; critical?: number; warning?: number };
            }
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
      const fetchQueueSafe = async (primaryStatus: string, fallbackStatus?: string) => {
        try {
          return await httpClient.get<{
            success?: boolean;
            data: Record<string, unknown>[];
            meta?: { total?: number; totalItems?: number };
          }>('/admin/verification/queue', { params: { status: primaryStatus, limit: 50 } });
        } catch {
          if (fallbackStatus) {
            try {
              return await httpClient.get<{
                success?: boolean;
                data: Record<string, unknown>[];
                meta?: { total?: number; totalItems?: number };
              }>('/admin/verification/queue', { params: { status: fallbackStatus, limit: 50 } });
            } catch {
              return null;
            }
          }
          return null;
        }
      };

      const [pendingRes, inReviewRes, rejectedRes, approvedRes] = await Promise.all([
        fetchQueueSafe('SUBMITTED', 'PENDING_REVIEW'),
        fetchQueueSafe('IN_REVIEW'),
        fetchQueueSafe('REJECTED'),
        fetchQueueSafe('APPROVED'),
      ]);

      const parseQueueItems = (items: Record<string, unknown>[] | undefined, fallbackStatus: string, defaultAction: string): VerificationDashboardQueueItem[] => {
        if (!Array.isArray(items)) return [];
        return items.map((raw) => {
          const worker = (raw.worker && typeof raw.worker === 'object') ? (raw.worker as Record<string, unknown>) : undefined;
          let pendingCheckTypes: string[] = [];
          if (Array.isArray(raw.pendingCheckTypes)) {
            pendingCheckTypes = raw.pendingCheckTypes.map(String);
          } else if (raw.checkType) {
            pendingCheckTypes = [String(raw.checkType)];
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
            id: String(raw.checkId || raw.id || raw.dossierId || ''),
            workerId: String(raw.workerId || worker?.id || raw.id || ''),
            workerName: String(raw.workerName || worker?.fullName || 'Worker'),
            category: String(raw.category || worker?.category || raw.checkType || 'General Service'),
            submissionTime: String(raw.submittedAt || raw.applicationSubmittedAt || raw.createdAt || raw.submissionTime || 'Recent'),
            pendingCheckTypes,
            status: String(raw.status || fallbackStatus) as VerificationDashboardQueueItem['status'],
            actionLabel: String(raw.actionLabel || defaultAction),
          };
        });
      };

      const pendingItems = Array.isArray(pendingRes?.data?.data) ? pendingRes.data.data : [];
      const inReviewItems = Array.isArray(inReviewRes?.data?.data) ? inReviewRes.data.data : [];
      const rejectedItems = Array.isArray(rejectedRes?.data?.data) ? rejectedRes.data.data : [];
      const approvedItems = Array.isArray(approvedRes?.data?.data) ? approvedRes.data.data : [];

      const isRecheckItem = (i: Record<string, unknown>) => {
        const s = String(i.status || '').toUpperCase();
        if (s === 'RECHECK_DUE') return true;
        if (i.isRecheck === true) return true;
        if (String(i.checkType || '').toUpperCase().includes('RECHECK')) return true;
        if (Array.isArray(i.pendingCheckTypes) && i.pendingCheckTypes.some((t: unknown) => String(t).toLowerCase().includes('renewal') || String(t).toLowerCase().includes('recheck') || String(t).toLowerCase().includes('expiry') || String(t).toLowerCase().includes('revalidation'))) return true;
        return false;
      };

      const recheckItems = inReviewItems.filter(isRecheckItem);
      const activeInReviewItems = inReviewItems.filter((i) => !isRecheckItem(i));

      // Build unique application aggregates from queue checks to prevent double-counting
      interface WorkerAppAggregate {
        workerId: string;
        applicantName: string;
        applicationId: string;
        serviceCategory: string;
        submissionDate: string;
        isOverdue: boolean;
        slaFlags: string[];
        dueAt?: string;
        checkStatuses: string[];
        rawChecks: Record<string, unknown>[];
      }

      const workerMap = new Map<string, WorkerAppAggregate>();

      const registerCheck = (raw: Record<string, unknown>, fallbackStatus: string) => {
        const worker = (raw.worker && typeof raw.worker === 'object') ? (raw.worker as Record<string, unknown>) : undefined;
        const wId = String(raw.workerId || worker?.id || raw.id || '');
        if (!wId) return;

        const wName = String(raw.workerName || worker?.fullName || 'Worker');
        const appRef = String(raw.applicationReference || raw.id || wId);
        const category = String(raw.category || worker?.category || raw.checkType || 'General Service');
        const subDate = String(raw.applicationSubmittedAt || raw.submittedAt || raw.createdAt || raw.submissionTime || '');
        const checkStatus = String(raw.status || fallbackStatus).toUpperCase();
        const isOverdue = Boolean(raw.isOverdue || (Array.isArray(raw.slaFlags) && raw.slaFlags.includes('OVERDUE')));
        const slaFlags = Array.isArray(raw.slaFlags) ? raw.slaFlags.map(String) : [];
        const dueAt = raw.dueAt ? String(raw.dueAt) : undefined;

        let existing = workerMap.get(wId);
        if (!existing) {
          existing = {
            workerId: wId,
            applicantName: wName,
            applicationId: appRef,
            serviceCategory: category,
            submissionDate: subDate,
            isOverdue,
            slaFlags: [...slaFlags],
            dueAt,
            checkStatuses: [checkStatus],
            rawChecks: [raw],
          };
          workerMap.set(wId, existing);
        } else {
          existing.rawChecks.push(raw);
          existing.checkStatuses.push(checkStatus);
          if (!existing.submissionDate && subDate) existing.submissionDate = subDate;
          if (isOverdue) existing.isOverdue = true;
          for (const f of slaFlags) {
            if (!existing.slaFlags.includes(f)) existing.slaFlags.push(f);
          }
          if (dueAt && (!existing.dueAt || dueAt < existing.dueAt)) {
            existing.dueAt = dueAt;
          }
        }
      };

      pendingItems.forEach((c) => registerCheck(c, 'SUBMITTED'));
      activeInReviewItems.forEach((c) => registerCheck(c, 'IN_REVIEW'));
      recheckItems.forEach((c) => registerCheck(c, 'RECHECK_DUE'));
      rejectedItems.forEach((c) => registerCheck(c, 'REJECTED'));
      approvedItems.forEach((c) => registerCheck(c, 'APPROVED'));

      // Authoritative API response fields from /admin/dashboard
      const registeredWorkers = dashboardWorkers?.registered !== undefined
        ? Number(dashboardWorkers.registered)
        : null;

      const verifiedAndActiveWorkers = dashboardWorkers?.verifiedAndActive !== undefined
        ? Number(dashboardWorkers.verifiedAndActive)
        : null;

      // Resolve application-level status from check statuses
      const getAppLevelStatus = (app: WorkerAppAggregate): 'PENDING_REVIEW' | 'IN_REVIEW' | 'RECHECK_DUE' | 'REJECTED' | 'APPROVED' => {
        const statuses = app.checkStatuses;
        if (statuses.includes('REJECTED')) return 'REJECTED';
        if (statuses.includes('RECHECK_DUE') || app.rawChecks.some(isRecheckItem)) return 'RECHECK_DUE';
        if (statuses.includes('IN_REVIEW')) return 'IN_REVIEW';
        if (statuses.includes('SUBMITTED') || statuses.includes('PENDING_REVIEW') || statuses.includes('NOT_SUBMITTED')) return 'PENDING_REVIEW';
        if (statuses.length > 0 && statuses.every((s) => s === 'APPROVED')) return 'APPROVED';
        return 'PENDING_REVIEW';
      };

      let pendingAppCount = 0;
      let inReviewAppCount = 0;
      let recheckAppCount = 0;
      let rejectedAppCount = 0;
      let approvedAppCount = 0;

      for (const app of workerMap.values()) {
        const appStatus = getAppLevelStatus(app);
        if (appStatus === 'PENDING_REVIEW') pendingAppCount++;
        else if (appStatus === 'IN_REVIEW') inReviewAppCount++;
        else if (appStatus === 'RECHECK_DUE') recheckAppCount++;
        else if (appStatus === 'REJECTED') rejectedAppCount++;
        else if (appStatus === 'APPROVED') approvedAppCount++;
      }

      // If workerMap has records, use application counts; otherwise fall back to meta counts
      const pendingApplications = workerMap.size > 0
        ? pendingAppCount
        : (dashboardPendingKyc?.submitted !== undefined ? Number(dashboardPendingKyc.submitted) : (pendingRes?.data?.meta?.totalItems ?? pendingRes?.data?.meta?.total ?? pendingItems.length));

      const inReview = workerMap.size > 0
        ? inReviewAppCount
        : (dashboardPendingKyc?.inReview !== undefined ? Number(dashboardPendingKyc.inReview) : (inReviewRes?.data?.meta?.totalItems ?? inReviewRes?.data?.meta?.total ?? activeInReviewItems.length));

      const recheckDue = workerMap.size > 0 ? recheckAppCount : recheckItems.length;
      const correctionsRequired = workerMap.size > 0 ? rejectedAppCount : (rejectedRes?.data?.meta?.totalItems ?? rejectedRes?.data?.meta?.total ?? rejectedItems.length);
      const approvedTotal = workerMap.size > 0 ? approvedAppCount : (approvedRes?.data?.meta?.totalItems ?? approvedRes?.data?.meta?.total ?? approvedItems.length);

      const recentAttentionApplications: VerificationAttentionApplication[] = Array.from(workerMap.values())
        .filter((app) => getAppLevelStatus(app) !== 'APPROVED')
        .map((app) => ({
          id: app.applicationId || app.workerId,
          workerId: app.workerId,
          applicationId: app.applicationId,
          applicantName: app.applicantName,
          serviceCategory: app.serviceCategory,
          submissionDate: app.submissionDate || 'Recently Submitted',
          status: getAppLevelStatus(app),
          isOverdue: app.isOverdue,
          slaFlags: app.slaFlags,
          dueAt: app.dueAt,
        }))
        .sort((a, b) => {
          if (!a.submissionDate) return 1;
          if (!b.submissionDate) return -1;
          return new Date(a.submissionDate).getTime() - new Date(b.submissionDate).getTime();
        });

      let withinSla = 0;
      let approachingSla = 0;
      let slaExceeded = 0;

      for (const app of recentAttentionApplications) {
        if (app.isOverdue || (app.slaFlags && app.slaFlags.includes('OVERDUE'))) {
          slaExceeded++;
        } else if (app.slaFlags && app.slaFlags.includes('APPROACHING')) {
          approachingSla++;
        } else {
          withinSla++;
        }
      }

      const slaOverview: VerificationSLAOverview = {
        withinSla: recentAttentionApplications.length > 0 ? withinSla : pendingApplications,
        approachingSla,
        slaExceeded,
        notes: 'Authoritative SLA performance tracked from server-side check deadlines (dueAt, isOverdue). Duration telemetry pending backend contract.',
      };

      const statusDistribution: VerificationStatusDistributionItem[] = [
        { status: 'PENDING_REVIEW', label: 'Pending Review', count: pendingApplications, color: '#F59E0B' },
        { status: 'IN_REVIEW', label: 'In Review', count: inReview, color: '#3B82F6' },
        { status: 'REJECTED', label: 'Corrections Required / Rejected', count: correctionsRequired, color: '#EF4444' },
        { status: 'RECHECK_DUE', label: 'Re-check Due', count: recheckDue, color: '#8B5CF6' },
        { status: 'APPROVED', label: 'Approved', count: approvedTotal || (verifiedAndActiveWorkers ?? 0), color: '#10B981' },
      ];

      const openAlerts = dashboardAlerts?.open !== undefined
        ? Number(dashboardAlerts.open)
        : 0;

      const criticalAlerts = dashboardAlerts?.critical !== undefined
        ? Number(dashboardAlerts.critical)
        : 0;

      const warningAlerts = dashboardAlerts?.warning !== undefined
        ? Number(dashboardAlerts.warning)
        : 0;

      return {
        overview: {
          pendingApplications,
          inReview,
          correctionsRequired,
          recheckDue,
        },
        statusDistribution,
        recentAttentionApplications,
        slaOverview,
        kpis: {
          registeredWorkers,
          verifiedAndActiveWorkers,
          pendingKycSubmitted: pendingRes?.data?.meta?.totalItems ?? pendingRes?.data?.meta?.total ?? pendingApplications,
          inReview: inReviewRes?.data?.meta?.totalItems ?? inReviewRes?.data?.meta?.total ?? inReview,
          openAlerts,
          criticalAlerts,
          warningAlerts,
          pendingReview: pendingRes?.data?.meta?.totalItems ?? pendingRes?.data?.meta?.total ?? pendingApplications,
          inProgressReview: inReviewRes?.data?.meta?.totalItems ?? inReviewRes?.data?.meta?.total ?? inReview,
          reCheckDue: recheckDue,
          decisionsToday: 0,
          completedReviews: null,
          correctionsRequired,
          overdueReviews: slaExceeded > 0 ? slaExceeded : null,
          avgProcessingTimeMinutes: null,
        },
        queues: {
          PENDING_REVIEW: parseQueueItems(pendingItems, 'PENDING_REVIEW', 'Start Review'),
          IN_REVIEW: parseQueueItems(activeInReviewItems, 'IN_REVIEW', 'Resume Review'),
          RECHECK_DUE: parseQueueItems(recheckItems, 'RECHECK_DUE', 'Inspect Expiry'),
          REJECTED: parseQueueItems(rejectedItems, 'REJECTED', 'Inspect Rejection'),
        },
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getSupportExecutiveDashboard(): Promise<SupportExecutiveDashboardData> {
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
          ticketOwner: q.ticketOwner ? String(q.ticketOwner) : (q.assignedToStaffName ? String(q.assignedToStaffName) : undefined),
        };
      });
    };

    const mapTicketToQueueItem = (raw: Record<string, unknown>, defaultAction: string): SupportDashboardQueueItem => {
      const creator = raw.creator as Record<string, unknown> | undefined;
      const roleType = (raw.creatorKind as 'CUSTOMER' | 'WORKER') || (raw.complainantType as 'CUSTOMER' | 'WORKER') || 'CUSTOMER';
      const creatorProfile = creator?.profile as Record<string, unknown> | undefined;
      const workerObj = raw.worker as Record<string, unknown> | undefined;
      const customerObj = raw.customer as Record<string, unknown> | undefined;
      const compUserId = String(raw.creatorUserId || raw.workerId || raw.customerId || raw.complainantId || '');

      const dirName = roleType === 'WORKER'
        ? (getWorkerName(compUserId) || (raw.workerId ? getWorkerName(String(raw.workerId)) : undefined))
        : (getCustomerName(compUserId) || (raw.customerId ? getCustomerName(String(raw.customerId)) : undefined));

      const complainantName = String(
        (typeof raw.complainantName === 'string' && raw.complainantName.trim() && raw.complainantName !== 'Worker' && raw.complainantName !== 'Customer' ? raw.complainantName.trim() : undefined) ||
        (typeof raw.creatorName === 'string' && raw.creatorName.trim() ? raw.creatorName.trim() : undefined) ||
        (typeof creator?.fullName === 'string' && creator.fullName.trim() ? creator.fullName.trim() : undefined) ||
        (typeof creator?.name === 'string' && creator.name.trim() ? creator.name.trim() : undefined) ||
        (typeof creatorProfile?.fullName === 'string' ? (creatorProfile.fullName as string).trim() : undefined) ||
        (typeof creatorProfile?.name === 'string' ? (creatorProfile.name as string).trim() : undefined) ||
        (creator?.firstName ? `${creator.firstName} ${creator.lastName || ''}`.trim() : undefined) ||
        (roleType === 'WORKER' && typeof workerObj?.fullName === 'string' ? (workerObj.fullName as string).trim() : undefined) ||
        (roleType === 'WORKER' && typeof workerObj?.name === 'string' ? (workerObj.name as string).trim() : undefined) ||
        (roleType === 'WORKER' && typeof raw.workerName === 'string' && raw.workerName.trim() ? raw.workerName.trim() : undefined) ||
        (roleType === 'CUSTOMER' && typeof customerObj?.fullName === 'string' ? (customerObj.fullName as string).trim() : undefined) ||
        (roleType === 'CUSTOMER' && typeof customerObj?.name === 'string' ? (customerObj.name as string).trim() : undefined) ||
        (roleType === 'CUSTOMER' && typeof raw.customerName === 'string' && raw.customerName.trim() ? raw.customerName.trim() : undefined) ||
        (roleType === 'WORKER' && typeof raw.subjectWorkerName === 'string' && raw.subjectWorkerName.trim() ? raw.subjectWorkerName.trim() : undefined) ||
        dirName ||
        (roleType === 'CUSTOMER' ? 'Customer' : 'Worker')
      );
      const slaIndicator = classifyTicketSLA(raw, Date.now());

      const assignee = raw.assignee as Record<string, unknown> | undefined;
      const ticketOwner = String(
        raw.assignedToStaffName ||
        assignee?.name ||
        raw.assigneeName ||
        ''
      );

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
        ticketOwner: ticketOwner || undefined,
      };
    };

    const fetchAllSupportTickets = async (): Promise<{
      rawTickets: Record<string, unknown>[];
      metaTotal?: number;
    }> => {
      const firstRes = await httpClient.get<{
        success: boolean;
        data: Record<string, unknown>[];
        meta?: { total?: number; totalItems?: number };
      }>('/admin/support/tickets', { params: { limit: 100 } });

      const firstItems = Array.isArray(firstRes.data?.data) ? firstRes.data.data : [];
      const metaObj = firstRes.data?.meta;
      const metaTotal = typeof metaObj?.total === 'number'
        ? metaObj.total
        : (typeof metaObj?.totalItems === 'number' ? metaObj.totalItems : undefined);

      if (typeof metaTotal === 'number' && metaTotal > firstItems.length && firstItems.length > 0) {
        const totalPages = Math.min(Math.ceil(metaTotal / 100), 10);
        const extraResponses = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            httpClient.get<{ data?: Record<string, unknown>[] }>('/admin/support/tickets', {
              params: { page: i + 2, limit: 100 },
            })
          )
        );
        const seen = new Set(firstItems.map((t) => String(t.id || t.ticketId || '')));
        const combined = [...firstItems];
        for (const pRes of extraResponses) {
          const items = Array.isArray(pRes.data?.data) ? pRes.data.data : [];
          for (const item of items) {
            const key = String(item.id || item.ticketId || '');
            if (!key || !seen.has(key)) {
              if (key) seen.add(key);
              combined.push(item);
            }
          }
        }
        return { rawTickets: combined, metaTotal };
      }

      return { rawTickets: firstItems, metaTotal };
    };

    const deriveRecentActivity = (rawTickets: Record<string, unknown>[]): SupportRecentActivityItem[] => {
      const events = rawTickets
        .map((t) => {
          const item = mapTicketToQueueItem(t, 'View Ticket');
          if (!item.ticketId) return null;

          const status = String(t.status || 'OPEN').toUpperCase();
          const createdAt = t.createdAt ? String(t.createdAt) : '';
          const updatedAt = t.updatedAt ? String(t.updatedAt) : '';
          const assignedAt = t.assignedAt ? String(t.assignedAt) : '';
          const escalatedAt = t.escalatedAt ? String(t.escalatedAt) : '';
          const closedAt = t.closedAt ? String(t.closedAt) : '';

          let activityType: SupportActivityType = 'CREATED';
          let activityLabel = 'Ticket Created';
          let timestamp = createdAt || updatedAt;

          if (status === 'CLOSED' || status === 'RESOLVED' || Boolean(closedAt)) {
            activityType = 'RESOLVED';
            activityLabel = 'Ticket Resolved';
            timestamp = closedAt || updatedAt || createdAt;
          } else if (status === 'ESCALATED' || status === 'REPLACEMENT_INITIATED' || Boolean(escalatedAt)) {
            activityType = 'ESCALATED';
            activityLabel = 'Ticket Escalated';
            timestamp = escalatedAt || updatedAt || createdAt;
          } else {
            const createdMs = createdAt ? Date.parse(createdAt) : NaN;
            const updatedMs = updatedAt ? Date.parse(updatedAt) : NaN;
            const wasUpdatedAfterCreation =
              (!isNaN(createdMs) && !isNaN(updatedMs) && Math.abs(updatedMs - createdMs) > 1000) ||
              Boolean(assignedAt) ||
              status === 'IN_PROGRESS' ||
              status === 'INVESTIGATION_PENDING' ||
              status === 'ASSIGNED';
            if (wasUpdatedAfterCreation) {
              activityType = 'UPDATED';
              activityLabel = 'Ticket Updated';
              timestamp = updatedAt || assignedAt || createdAt;
            }
          }

          const updatedAtMs = t.updatedAt ? Date.parse(String(t.updatedAt)) : NaN;
          const etag = !isNaN(updatedAtMs) ? `"${updatedAtMs}"` : undefined;
          const sortMs = timestamp ? Date.parse(timestamp) : NaN;
          return {
            sortMs: isNaN(sortMs) ? 0 : sortMs,
            entry: {
              id: item.id,
              ticketId: item.ticketId,
              etag,
              activityType,
              activityLabel,
              timestamp,
              status: item.status,
              complainantName: item.complainantName,
              roleType: item.roleType,
              category: item.category,
              disputeCategory: item.disputeCategory,
              slaIndicator: item.slaIndicator,
            } satisfies SupportRecentActivityItem,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      events.sort((a, b) => b.sortMs - a.sortMs);
      return events.slice(0, 8).map((e) => e.entry);
    };

    const buildSupportFromTickets = (
      rawTickets: Record<string, unknown>[],
      metaTotal: number | undefined,
      complaintsSection?: Record<string, unknown>,
      rawQueues?: Record<string, unknown>
    ): SupportExecutiveDashboardData => {
      const currentUser = useAuthStore.getState().user;
      const currentUserId = currentUser?.id;
      const currentUserName = currentUser?.name;
      const now = Date.now();

      const openTicketsList = rawTickets.filter((t) => !t.status || t.status === 'OPEN' || t.status === 'CREATED');
      const unassignedTickets = rawTickets.filter(
        (t) => !t.assignedToUserId && !t.assignedToStaffId && !t.assigneeUserId && t.status !== 'CLOSED' && t.status !== 'RESOLVED'
      );
      const myCasesTickets = rawTickets.filter((t) => {
        if (t.status === 'CLOSED' || t.status === 'RESOLVED') return false;
        if (currentUserId && (t.assignedToUserId === currentUserId || t.assignedToStaffId === currentUserId || t.assigneeUserId === currentUserId)) return true;
        if (currentUserName && typeof t.assignedToStaffName === 'string' && t.assignedToStaffName.toLowerCase().includes(currentUserName.toLowerCase())) return true;
        return false;
      });
      const inProgressTickets = rawTickets.filter(
        (t) => t.status === 'IN_PROGRESS' || t.status === 'INVESTIGATION_PENDING' || t.status === 'ASSIGNED'
      );
      const escalatedTicketsList = rawTickets.filter(
        (t) =>
          t.status === 'ESCALATED' ||
          t.status === 'REPLACEMENT_INITIATED' ||
          (Boolean(t.escalatedAt) && t.status !== 'CLOSED' && t.status !== 'RESOLVED')
      );
      const resolvedTicketsList = rawTickets.filter(
        (t) => t.status === 'CLOSED' || t.status === 'RESOLVED' || Boolean(t.closedAt)
      );

      let slaNormalCount = 0;
      let slaAtRiskClassified = 0;
      let slaBreachedClassified = 0;
      for (const t of rawTickets) {
        const tier = classifyTicketSLA(t, now);
        if (tier === 'BREACHED') slaBreachedClassified++;
        else if (tier === 'AT_RISK') slaAtRiskClassified++;
        else slaNormalCount++;
      }

      const slaImminentBreach = rawTickets.filter((t) => {
        if (t.status === 'CLOSED' || t.status === 'RESOLVED') return false;
        if (Boolean(t.slaBreachedAt) || t.slaStatus === 'BREACHED') return false;
        if (t.slaStatus === 'AT_RISK') return true;
        if (t.dueAt) {
          const dueMs = new Date(String(t.dueAt)).getTime();
          return !isNaN(dueMs) && (dueMs - now <= 24 * 3600 * 1000);
        }
        return false;
      }).length;

      const atRiskQueueTickets = rawTickets.filter(
        (t) =>
          Boolean(t.slaBreachedAt) ||
          t.slaStatus === 'AT_RISK' ||
          t.slaStatus === 'BREACHED' ||
          (t.dueAt && t.status !== 'CLOSED' && t.status !== 'RESOLVED' && (new Date(String(t.dueAt)).getTime() - now <= 24 * 3600 * 1000))
      );

      const openCount = complaintsSection?.open !== undefined ? Number(complaintsSection.open) : openTicketsList.length;
      const inInvestigationCount = complaintsSection?.inProgress !== undefined ? Number(complaintsSection.inProgress) : inProgressTickets.length;
      const escalatedCount = complaintsSection?.escalated !== undefined ? Number(complaintsSection.escalated) : escalatedTicketsList.length;
      const resolvedCount = resolvedTicketsList.length;
      const totalTickets = typeof metaTotal === 'number'
        ? metaTotal
        : rawTickets.length > 0
          ? rawTickets.length
          : openCount + inInvestigationCount + escalatedCount + resolvedCount;

      const queues: SupportDashboardQueues =
        rawQueues && ('AT_RISK' in rawQueues || 'UNASSIGNED' in rawQueues)
          ? {
            ALL: 'ALL' in rawQueues ? parseSupportQueueList(rawQueues.ALL, 'ALL') : undefined,
            AT_RISK: parseSupportQueueList(rawQueues.AT_RISK, 'AT_RISK'),
            UNASSIGNED: parseSupportQueueList(rawQueues.UNASSIGNED, 'UNASSIGNED'),
            MY_CASES: parseSupportQueueList(rawQueues.MY_CASES, 'MY_CASES'),
            IN_PROGRESS: 'IN_PROGRESS' in rawQueues ? parseSupportQueueList(rawQueues.IN_PROGRESS, 'IN_PROGRESS') : undefined,
            ESCALATED: parseSupportQueueList(rawQueues.ESCALATED, 'ESCALATED'),
            RESOLVED: 'RESOLVED' in rawQueues ? parseSupportQueueList(rawQueues.RESOLVED, 'RESOLVED') : undefined,
          }
          : {
            ALL: rawTickets.map((t) => mapTicketToQueueItem(t, 'View Ticket')),
            AT_RISK: atRiskQueueTickets.map((t) => mapTicketToQueueItem(t, 'Mediate Dispute')),
            UNASSIGNED: unassignedTickets.map((t) => mapTicketToQueueItem(t, 'Claim Ticket')),
            MY_CASES: myCasesTickets.map((t) => mapTicketToQueueItem(t, 'Open Call Logs')),
            IN_PROGRESS: inProgressTickets.map((t) => mapTicketToQueueItem(t, 'Investigate')),
            ESCALATED: escalatedTicketsList.map((t) => mapTicketToQueueItem(t, 'View Ops Status')),
            RESOLVED: resolvedTicketsList.map((t) => mapTicketToQueueItem(t, 'Inspect Record')),
          };

      const analytics: SupportExecutiveAnalyticsData = {
        openTickets: openCount,
        inInvestigationTickets: inInvestigationCount,
        escalatedTickets: escalatedCount,
        resolvedTickets: resolvedCount,
        slaAtRiskOrBreached: rawTickets.length > 0 || totalTickets === 0 ? slaAtRiskClassified + slaBreachedClassified : null,
        statusDistribution: buildSupportStatusDistribution(openCount, inInvestigationCount, escalatedCount, resolvedCount),
        slaMonitoring:
          rawTickets.length > 0 || totalTickets === 0
            ? {
              normal: slaNormalCount,
              atRisk: slaAtRiskClassified,
              breached: slaBreachedClassified,
              notes: 'Classified from backend slaBreachedAt, active dueAt deadlines (<=24h at risk), and ticket status.',
            }
            : null,
        recentActivity: deriveRecentActivity(rawTickets),
      };

      if (complaintsSection) {
        const openUnassignedGrievances = parseOptionalMetric(
          complaintsSection.unassigned ?? complaintsSection.open,
          'complaints.open'
        );
        const myActiveCases = parseOptionalMetric(
          complaintsSection.inProgress ?? complaintsSection.investigationPending,
          'complaints.inProgress'
        );
        const slaAtRiskCount: number | null = null;
        const slaBreachedCount = complaintsSection.escalated !== undefined
          ? parseOptionalMetric(complaintsSection.escalated, 'complaints.escalated')
          : null;
        const resolvedTodayCount: number | null = null;

        return {
          kpis: {
            totalTickets,
            unassignedTickets: complaintsSection.unassigned !== undefined ? Number(complaintsSection.unassigned) : unassignedTickets.length,
            myAssignedTickets: myCasesTickets.length,
            inProgressTickets: inInvestigationCount,
            slaImminentBreach,
            escalatedTickets: escalatedCount,
            resolvedTickets: resolvedCount,
            openUnassignedGrievances,
            myActiveCases,
            slaAtRiskCount,
            slaBreachedCount,
            resolvedTodayCount,
          },
          queues,
          analytics,
        };
      }

      const hasExplicitAtRisk = rawTickets.some((t) => t.slaStatus === 'AT_RISK');
      const slaAtRiskCount: number | null = hasExplicitAtRisk
        ? rawTickets.filter((t) => t.slaStatus === 'AT_RISK').length
        : null;
      const slaBreachedCount = rawTickets.filter((t) => Boolean(t.slaBreachedAt) || t.slaStatus === 'BREACHED').length;
      const todayIso = new Date().toISOString().split('T')[0];
      const resolvedToday = rawTickets.filter(
        (t) => (t.status === 'CLOSED' || t.status === 'RESOLVED') && t.closedAt && String(t.closedAt).startsWith(todayIso)
      ).length;
      const hasClosedTickets = rawTickets.some((t) => t.status === 'CLOSED' || t.status === 'RESOLVED');

      return {
        kpis: {
          totalTickets,
          unassignedTickets: unassignedTickets.length,
          myAssignedTickets: myCasesTickets.length,
          inProgressTickets: inProgressTickets.length,
          slaImminentBreach,
          escalatedTickets: escalatedTicketsList.length,
          resolvedTickets: resolvedTicketsList.length,
          openUnassignedGrievances: unassignedTickets.length,
          myActiveCases: myCasesTickets.length,
          slaAtRiskCount,
          slaBreachedCount,
          resolvedTodayCount: hasClosedTickets ? resolvedToday : null,
        },
        queues,
        analytics,
      };
    };

    try {
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

            const rawLegacyQueues = raw.queues as Record<string, unknown>;
            const parsedQueues: SupportDashboardQueues = {
              AT_RISK: parseSupportQueueList(rawLegacyQueues.AT_RISK, 'AT_RISK'),
              UNASSIGNED: parseSupportQueueList(rawLegacyQueues.UNASSIGNED, 'UNASSIGNED'),
              MY_CASES: parseSupportQueueList(rawLegacyQueues.MY_CASES, 'MY_CASES'),
              ESCALATED: parseSupportQueueList(rawLegacyQueues.ESCALATED, 'ESCALATED'),
            };

            const totalTickets = typeof metricsSource.totalTickets === 'number'
              ? metricsSource.totalTickets
              : (openUnassignedGrievances ?? 0) + (myActiveCases ?? 0) + (slaBreachedCount ?? 0) + (resolvedTodayCount ?? 0);
            const unassignedTickets = typeof metricsSource.unassignedTickets === 'number'
              ? metricsSource.unassignedTickets
              : openUnassignedGrievances;
            const myAssignedTickets = typeof metricsSource.myAssignedTickets === 'number'
              ? metricsSource.myAssignedTickets
              : myActiveCases;
            const inProgressTickets = typeof metricsSource.inProgressTickets === 'number'
              ? metricsSource.inProgressTickets
              : myActiveCases;
            const slaImminentBreach = typeof metricsSource.slaImminentBreach === 'number'
              ? metricsSource.slaImminentBreach
              : (slaAtRiskCount ?? 0);
            const escalatedTickets = typeof metricsSource.escalatedTickets === 'number'
              ? metricsSource.escalatedTickets
              : slaBreachedCount;
            const resolvedTickets = typeof metricsSource.resolvedTickets === 'number'
              ? metricsSource.resolvedTickets
              : resolvedTodayCount;

            const combinedLegacyItems = [
              ...parsedQueues.AT_RISK,
              ...parsedQueues.UNASSIGNED,
              ...parsedQueues.MY_CASES,
              ...parsedQueues.ESCALATED,
            ];

            return {
              kpis: {
                totalTickets,
                unassignedTickets,
                myAssignedTickets,
                inProgressTickets,
                slaImminentBreach,
                escalatedTickets,
                resolvedTickets,
                openUnassignedGrievances,
                myActiveCases,
                slaAtRiskCount,
                slaBreachedCount,
                resolvedTodayCount,
              },
              queues: parsedQueues,
              analytics: {
                openTickets: unassignedTickets,
                inInvestigationTickets: inProgressTickets,
                escalatedTickets,
                resolvedTickets,
                slaAtRiskOrBreached:
                  slaAtRiskCount !== null && slaBreachedCount !== null
                    ? slaAtRiskCount + slaBreachedCount
                    : null,
                statusDistribution: buildSupportStatusDistribution(
                  unassignedTickets ?? 0,
                  inProgressTickets ?? 0,
                  escalatedTickets ?? 0,
                  resolvedTickets ?? 0
                ),
                slaMonitoring:
                  totalTickets === 0
                    ? { normal: 0, atRisk: 0, breached: 0 }
                    : slaAtRiskCount !== null && slaBreachedCount !== null
                      ? {
                        normal: Math.max(0, totalTickets - slaAtRiskCount - slaBreachedCount),
                        atRisk: slaAtRiskCount,
                        breached: slaBreachedCount,
                      }
                      : null,
                recentActivity: buildRecentActivityFromQueueItems(combinedLegacyItems),
              },
            };
          }

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
      }

      const { rawTickets, metaTotal } = await fetchAllSupportTickets();

      return buildSupportFromTickets(rawTickets, metaTotal, complaintsSection, rawQueues);
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
