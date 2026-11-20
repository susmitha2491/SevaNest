import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AnalyticsChartsSection } from '../features/dashboard/presentation/analytics/AnalyticsChartsSection';
import { SuperAdminAnalyticsData } from '../features/dashboard/domain/types';
import { PaymentsListPage } from '../features/payments/presentation/PaymentsListPage';
import { ReportsDashboardPage } from '../features/reports/presentation/ReportsDashboardPage';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { clearReportEnrichmentCache } from '../features/reports/data/reportDetailEnricher';

describe('UI Cleanliness: Zero Internal PRD References or Annotations Rendered in UI', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    clearReportEnrichmentCache();
    useAuthStore.setState({
      user: {
        id: 'STAFF-SUPER-01',
        name: 'Super Administrator',
        email: 'superadmin@sevanest.local',
        role: 'SUPER_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.PAYMENTS_VIEW,
          PERMISSIONS.REPORTS_VIEW,
          PERMISSIONS.EXPORTS_GENERATE,
        ],
      },
      isAuthenticated: true,
    });
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  it('renders AnalyticsChartsSection without any PRD section symbols (§) or PRD labels in headings and captions', () => {
    const sampleAnalytics: SuperAdminAnalyticsData = {
      bookingFunnel: {
        interval: 'month',
        requests: 1200,
        confirmed: 750,
        confirmationRate: 0.625,
        series: [{ period: '2026-08', requests: 400, confirmed: 250, confirmationRate: 0.625 }],
      },
      categoryDemand: {
        total: 1200,
        categories: [
          { categoryId: 'cat-maid', code: 'HOUSE_MAID', name: 'House Maid', requests: 500 },
          { categoryId: 'cat-cook', code: 'COOK', name: 'Cook', requests: 350 },
        ],
      },
      areaDemand: [
        { areaId: 'area-gachibowli', name: 'Gachibowli', city: 'Hyderabad', requests: 420 },
        { areaId: 'area-hitec', name: 'HITEC City', city: 'Hyderabad', requests: 380 },
      ],
      workerRegistrations: {
        interval: 'month',
        registered: 200,
        verified: 160,
        verificationConversion: 0.8,
        series: [],
      },
      workerUtilization: {
        verifiedWorkers: 160,
        workersWithActiveBooking: 120,
        utilization: 0.75,
      },
      interviewConversion: {
        interviewsHeld: 300,
        confirmed: 210,
        conversion: 0.7,
      },
      cancellationRate: {
        totalBookings: 1200,
        cancelled: 60,
        cancellationRate: 0.05,
      },
      replacementRate: {
        activeBookings: 400,
        replacementRequests: 16,
        replacementRate: 0.04,
      },
      repeatCustomers: [
        { customerUserId: 'cust-1', name: 'Anand Sharma', bookings: 7 },
      ],
      topRatedWorkers: [
        { workerId: 'w-1', name: 'Sunita Devi', ratingCount: 42, averageRating: 4.95 },
      ],
      supportTickets: {
        interval: 'month',
        created: 40,
        closed: 40,
        averageResolutionSeconds: 3600,
        byStatus: [{ status: 'RESOLVED', count: 40 }],
        series: [],
      },
      paymentCollections: {
        interval: 'month',
        totalsByFeeType: [
          { feeCode: 'PLATFORM_FEE', currency: 'INR', payments: 50, grossMinor: 2500000, refundedMinor: 0 },
        ],
        series: [],
      },
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AnalyticsChartsSection
            analytics={sampleAnalytics}
            isLoading={false}
            isError={false}
            onRetry={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify clean business headings
    expect(screen.getByText('Demand & Booking Conversion')).toBeInTheDocument();
    expect(screen.getByText('Geographic Demand & Repeat Customers')).toBeInTheDocument();
    expect(screen.getByText('Workforce Capacity & Conversion')).toBeInTheDocument();
    expect(screen.getByText('Quality, Grievance SLA & Collections')).toBeInTheDocument();
    expect(screen.getByText('Fee Collections Breakdown')).toBeInTheDocument();

    // Verify absence of internal annotations
    expect(screen.queryByText(/PRD/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/§/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Â§/)).not.toBeInTheDocument();
  });

  it('renders PaymentsListPage without internal PRD Section or Model Policy references', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PaymentsListPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole('heading', { name: /Financial Transactions/i })).toBeInTheDocument();

    // Verify sub-heading has clean business wording
    expect(screen.getByText(/Commercial operations: transaction status tracking/i)).toBeInTheDocument();
    expect(screen.queryByText(/PRD commercial operations/i)).not.toBeInTheDocument();
  });

  it('renders ReportsDashboardPage catalogue without "PRD Reports" or "PRD Definition" labels', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ReportsDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole('heading', { name: /Reports & Analytics/i })).toBeInTheDocument();

    // Should render "12 Reports", never "12 PRD Reports"
    expect(await screen.findByText('12 Reports')).toBeInTheDocument();
    expect(screen.queryByText(/12 PRD Reports/i)).not.toBeInTheDocument();

    // Table header should say "Report Name & Description", never "PRD Definition"
    expect(screen.getByText('Report Name & Description')).toBeInTheDocument();
    expect(screen.queryByText(/PRD Definition/i)).not.toBeInTheDocument();
  });
});
