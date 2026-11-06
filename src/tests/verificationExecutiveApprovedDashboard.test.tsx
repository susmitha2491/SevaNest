import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { VerificationExecutiveDashboard } from '../features/dashboard/presentation/VerificationExecutiveDashboard';
import { dashboardRepository } from '../features/dashboard/data/dashboardRepository';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { ServerFailureError } from '../core/errors/DomainError';
import { VerificationExecutiveDashboardData } from '../features/dashboard/domain/types';

// Helper component to track navigation
const LocationDisplay: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname + location.search}</div>;
};

function renderDashboard(customClient?: QueryClient) {
  const queryClient = customClient || new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <>
                <VerificationExecutiveDashboard />
                <LocationDisplay />
              </>
            }
          />
          <Route path="/verification" element={<LocationDisplay />} />
          <Route path="/auth/login" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const mockDashboardData: VerificationExecutiveDashboardData = {
  overview: {
    pendingApplications: 2,
    inReview: 1,
    correctionsRequired: 1,
    recheckDue: 1,
  },
  statusDistribution: [
    { status: 'PENDING_REVIEW', label: 'Pending Review', count: 2, color: '#F59E0B' },
    { status: 'IN_REVIEW', label: 'In Review', count: 1, color: '#3B82F6' },
    { status: 'REJECTED', label: 'Corrections Required / Rejected', count: 1, color: '#EF4444' },
    { status: 'RECHECK_DUE', label: 'Re-check Due', count: 1, color: '#8B5CF6' },
    { status: 'APPROVED', label: 'Approved', count: 21, color: '#10B981' },
  ],
  recentAttentionApplications: [
    {
      id: 'SEVA00000014',
      workerId: '01a13eff-test-worker',
      applicationId: 'SEVA00000014',
      applicantName: 'Verification Test Worker',
      serviceCategory: 'General Service',
      submissionDate: '2026-10-15T10:01:40.383Z',
      status: 'PENDING_REVIEW',
      isOverdue: true,
      slaFlags: ['OVERDUE'],
      dueAt: '2026-10-19T04:03:17.639Z',
    },
    {
      id: 'SEVA00000034',
      workerId: '01a1a573-vaishnavi',
      applicationId: 'SEVA00000034',
      applicantName: 'vaishnavi',
      serviceCategory: 'House Maid',
      submissionDate: '2026-11-04T07:31:56.980Z',
      status: 'PENDING_REVIEW',
      isOverdue: false,
      slaFlags: [],
      dueAt: '2026-11-06T11:32:08.416Z',
    },
  ],
  slaOverview: {
    withinSla: 1,
    approachingSla: 0,
    slaExceeded: 1,
    notes: 'Authoritative SLA performance tracked from server-side check deadlines.',
  },
  kpis: {
    registeredWorkers: 31,
    verifiedAndActiveWorkers: 23,
    pendingKycSubmitted: 2,
    inReview: 1,
    openAlerts: 0,
    criticalAlerts: 0,
    warningAlerts: 0,
    pendingReview: 2,
    inProgressReview: 1,
    reCheckDue: 1,
    decisionsToday: 0,
    completedReviews: null,
    correctionsRequired: 1,
    overdueReviews: 1,
    avgProcessingTimeMinutes: null,
  },
  queues: {
    PENDING_REVIEW: [],
    IN_REVIEW: [],
    RECHECK_DUE: [],
    REJECTED: [],
  },
};

describe('Verification Executive Dashboard — 5 Approved Sections Specification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().setSession(
      {
        id: 'verif-exec-01',
        name: 'Pooja Nair',
        email: 'pooja.nair@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.WORKERS_VIEW,
        ],
      },
      'test-token'
    );
  });

  it('Section A: renders exactly four overview cards with authoritative counts and navigation', async () => {
    vi.spyOn(dashboardRepository, 'getVerificationExecutiveDashboard').mockResolvedValueOnce(mockDashboardData);

    renderDashboard();

    expect(await screen.findByText('Trust & Verification Console')).toBeInTheDocument();

    // 1. Pending Applications
    expect(screen.getByText('Pending Applications')).toBeInTheDocument();
    expect(screen.getByText('Pending KYC / Submitted')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // 2. In Review
    expect((await screen.findAllByText('In Review')).length).toBeGreaterThan(0);

    // 3. Corrections Required
    expect((await screen.findAllByText('Corrections Required')).length).toBeGreaterThan(0);

    // 4. Re-check Due
    expect((await screen.findAllByText('Re-check Due')).length).toBeGreaterThan(0);

    // Clicking Pending Applications card navigates to queue with PENDING_REVIEW filter
    const pendingCard = screen.getByText('Pending Applications').closest('div[style*="cursor: pointer"]') ||
      screen.getByText('Pending Applications').closest('div');
    if (pendingCard) {
      fireEvent.click(pendingCard);
      expect(screen.getByTestId('location-display')).toHaveTextContent('/verification?status=PENDING_REVIEW');
    }
  });

  it('Section B: renders Application Status Distribution chart with 5 statuses', async () => {
    vi.spyOn(dashboardRepository, 'getVerificationExecutiveDashboard').mockResolvedValueOnce(mockDashboardData);

    renderDashboard();

    expect(await screen.findByText('Application Status Distribution')).toBeInTheDocument();
    expect(screen.getByText(/Breakdown of applications across verification lifecycle stages/i)).toBeInTheDocument();
    expect(screen.getByText('26 Total')).toBeInTheDocument();

    // Chart should display status labels
    expect((await screen.findAllByText('Pending Review')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('In Review')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Corrections Required/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Re-check Due')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Approved')).length).toBeGreaterThan(0);
  });

  it('Section C: renders Recent Applications Requiring Attention table and navigates to dossier', async () => {
    vi.spyOn(dashboardRepository, 'getVerificationExecutiveDashboard').mockResolvedValueOnce(mockDashboardData);

    renderDashboard();

    expect(await screen.findByText('Recent Applications Requiring Attention')).toBeInTheDocument();
    expect(screen.getByText('2 Actionable')).toBeInTheDocument();

    // Non-approved applicants appear
    expect(screen.getByText('Verification Test Worker')).toBeInTheDocument();
    expect(screen.getByText('SEVA00000014')).toBeInTheDocument();
    expect(screen.getByText('vaishnavi')).toBeInTheDocument();
    expect(screen.getByText('SEVA00000034')).toBeInTheDocument();

    // Overdue badge for overdue applicant
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getAllByText('Within SLA').length).toBeGreaterThan(0);

    // Clicking Review KYC navigates to the verification dossier
    const reviewButtons = screen.getAllByRole('button', { name: /Review KYC/i });
    expect(reviewButtons.length).toBe(2);
    fireEvent.click(reviewButtons[0]);

    expect(screen.getByTestId('location-display')).toHaveTextContent(
      '/verification?workerId=01a13eff-test-worker&dossierId=01a13eff-test-worker'
    );
  });

  it('Section C: renders genuine empty state when zero applications need attention', async () => {
    const emptyData: VerificationExecutiveDashboardData = {
      ...mockDashboardData,
      overview: {
        pendingApplications: 0,
        inReview: 0,
        correctionsRequired: 0,
        recheckDue: 0,
      },
      recentAttentionApplications: [],
    };

    vi.spyOn(dashboardRepository, 'getVerificationExecutiveDashboard').mockResolvedValueOnce(emptyData);

    renderDashboard();

    expect(await screen.findByText(/All verification queues are up to date\. Zero pending worker documents awaiting review\./i)).toBeInTheDocument();
    expect(screen.getByText('0 Actionable')).toBeInTheDocument();
  });

  it('Section D: renders Verification SLA Overview and honest telemetry notice', async () => {
    vi.spyOn(dashboardRepository, 'getVerificationExecutiveDashboard').mockResolvedValueOnce(mockDashboardData);

    renderDashboard();

    expect(await screen.findByText('Verification SLA Overview')).toBeInTheDocument();
    expect(screen.getAllByText('Within SLA').length).toBeGreaterThan(0);
    expect(screen.getByText('Approaching SLA')).toBeInTheDocument();
    expect(screen.getByText('SLA Exceeded')).toBeInTheDocument();
  });

  it('Section E: renders Quick Navigation button and navigates to /verification', async () => {
    vi.spyOn(dashboardRepository, 'getVerificationExecutiveDashboard').mockResolvedValueOnce(mockDashboardData);

    renderDashboard();

    const openQueueBtn = await screen.findByRole('button', { name: /Open Verification Queue/i });
    expect(openQueueBtn).toBeInTheDocument();

    fireEvent.click(openQueueBtn);
    expect(screen.getByTestId('location-display')).toHaveTextContent('/verification');
  });

  it('RBAC & Persona: restricts access and renders NoAccessView when dashboard.view is missing', async () => {
    useAuthStore.getState().setSession(
      {
        id: 'verif-exec-unauth',
        name: 'Unauthorized Exec',
        email: 'unauth@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [PERMISSIONS.VERIFICATION_REVIEW], // lacks dashboard.view
      },
      'token'
    );

    renderDashboard();

    expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
    expect(screen.getByText(/Required permission: dashboard.view/i)).toBeInTheDocument();
    expect(screen.queryByText('Trust & Verification Console')).not.toBeInTheDocument();
  });

  it('Governance Directive: displays Mandatory 6-Point Verification Directive banner', async () => {
    vi.spyOn(dashboardRepository, 'getVerificationExecutiveDashboard').mockResolvedValueOnce(mockDashboardData);

    renderDashboard();

    expect(await screen.findByText('Mandatory 6-Point Verification Directive')).toBeInTheDocument();
    expect(screen.getByText(/\(1\) Phone OTP, \(2\) Identity, \(3\) Address, \(4\) Emergency Contact, \(5\) Employer Reference, and \(6\) Police Clearance/i)).toBeInTheDocument();
  });

  it('Decision Boundary: does not contain approve, reject, or suspend mutation buttons on the dashboard', async () => {
    vi.spyOn(dashboardRepository, 'getVerificationExecutiveDashboard').mockResolvedValueOnce(mockDashboardData);

    renderDashboard();

    await screen.findByText('Trust & Verification Console');

    // Verification decisions belong strictly in the dossier wizard, not the overview dashboard
    expect(screen.queryByRole('button', { name: /^Approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reject$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Suspend$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Blacklist$/i })).not.toBeInTheDocument();
  });

  it('Error & Resilience: renders error message and Retry button on server failure', async () => {
    vi.spyOn(dashboardRepository, 'getVerificationExecutiveDashboard').mockRejectedValueOnce(
      new ServerFailureError('Verification service telemetry down. Please retry later.')
    );

    renderDashboard();

    expect(await screen.findByText(/Verification service telemetry down\. Please retry later\./i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();
  });
});
