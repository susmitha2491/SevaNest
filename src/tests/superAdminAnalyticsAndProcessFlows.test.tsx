import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SuperAdminDashboard } from '../features/dashboard/presentation/SuperAdminDashboard';
import { dashboardRepository, RealDashboardRepository } from '../features/dashboard/data/dashboardRepository';
import { httpClient } from '../core/api/httpClient';
import { SuperAdminAnalyticsData } from '../features/dashboard/domain/types';

describe('Super Admin Dashboard: Analytics Charts & Process Flow Removal Verification', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  const renderDashboard = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SuperAdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  const sampleAnalyticsData: SuperAdminAnalyticsData = {
    bookingFunnel: {
      interval: 'month',
      requests: 1200,
      confirmed: 750,
      confirmationRate: 0.625,
      series: [
        { period: '2026-08', requests: 400, confirmed: 250, confirmationRate: 0.625 },
      ],
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
    paymentCollections: {
      interval: 'month',
      totalsByFeeType: [
        { feeCode: 'PLATFORM_FEE', currency: 'INR', payments: 750, grossMinor: 37500000, refundedMinor: 0 },
      ],
      series: [],
    },
    supportTickets: {
      interval: 'month',
      created: 45,
      closed: 40,
      averageResolutionSeconds: 3600,
      byStatus: [
        { status: 'OPEN', count: 5 },
        { status: 'RESOLVED', count: 40 },
      ],
      series: [],
    },
    topRatedWorkers: [
      { workerId: 'W-01', name: 'Sunita Devi', ratingCount: 45, averageRating: 4.95 },
    ],
    repeatCustomers: [
      { customerUserId: 'C-01', name: 'Anand Sharma', bookings: 7 },
    ],
  };

  it('renders all 4 analytical panels with genuine backend metrics', async () => {
    vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValueOnce({
      kpis: {
        grossBookings: 1200,
        activeWorkforce: 160,
        verificationQueue: 10,
        activeGrievances: 5,
        replacementVolume: 16,
        platformRevenueINR: 375000,
        scheduledTrials: 12,
        policeVerifDue: null,
      },
      queues: [],
    });
    vi.spyOn(dashboardRepository, 'getSuperAdminAnalytics').mockResolvedValueOnce(sampleAnalyticsData);

    renderDashboard();

    // 1. Demand & Booking Conversion
    expect(await screen.findByText('Business Analytics & Marketplace Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Demand & Booking Conversion (PRD §14.1, §14.4)')).toBeInTheDocument();
    expect(screen.getByText('Total: 1,200 Requests')).toBeInTheDocument();
    expect(screen.getByText('House Maid')).toBeInTheDocument();
    expect(screen.getByText('Cook')).toBeInTheDocument();
    expect(screen.getByText('Initial Booking Requests')).toBeInTheDocument();
    expect(screen.getByText('Confirmed Engagements')).toBeInTheDocument();
    expect(screen.getByText(/63% Conversion/)).toBeInTheDocument();

    // 2. Geographic Demand & Repeat Customers
    expect(screen.getByText('Geographic Demand & Repeat Customers (PRD §14.5, §14.10)')).toBeInTheDocument();
    expect(screen.getByText('Gachibowli')).toBeInTheDocument();
    expect(screen.getByText('420 requests')).toBeInTheDocument();
    expect(screen.getByText('HITEC City')).toBeInTheDocument();
    expect(screen.getByText('Anand Sharma')).toBeInTheDocument();
    expect(screen.getByText('7 bookings')).toBeInTheDocument();

    // 3. Workforce Capacity & Conversion
    expect(screen.getByText('Workforce Capacity & Conversion (PRD §14.2, §14.6)')).toBeInTheDocument();
    expect(screen.getByText('Verification Conversion')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
    expect(screen.getByText('Workforce Utilization')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
    expect(screen.getByText('Trial Conversion')).toBeInTheDocument();
    expect(screen.getByText('70.0%')).toBeInTheDocument();
    expect(screen.getByText('Sunita Devi')).toBeInTheDocument();
    expect(screen.getByText('4.95')).toBeInTheDocument();

    // 4. Quality, Grievance SLA & Collections
    expect(screen.getByText('Quality, Grievance SLA & Collections (PRD §14.7, §14.8, §14.9)')).toBeInTheDocument();
    expect(screen.getByText('Cancellation Rate')).toBeInTheDocument();
    expect(screen.getByText('5.0%')).toBeInTheDocument();
    expect(screen.getByText('Replacement Rate')).toBeInTheDocument();
    expect(screen.getByText('4.0%')).toBeInTheDocument();
    expect(screen.getByText('Avg Resolution SLA')).toBeInTheDocument();
    expect(screen.getByText('1h')).toBeInTheDocument();
    expect(screen.getByText('40 tickets closed')).toBeInTheDocument();
    expect(screen.getByText('PLATFORM FEE')).toBeInTheDocument();
    expect(screen.getAllByText('₹3,75,000.00')).toHaveLength(2);
  });

  it('preserves legitimate zero values for conversion and rate metrics without substituting placeholders', async () => {
    vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValueOnce({
      kpis: {
        grossBookings: 0,
        activeWorkforce: 0,
        verificationQueue: 0,
        activeGrievances: 0,
        replacementVolume: 0,
        platformRevenueINR: 0,
        scheduledTrials: 0,
        policeVerifDue: null,
      },
      queues: [],
    });

    vi.spyOn(dashboardRepository, 'getSuperAdminAnalytics').mockResolvedValueOnce({
      bookingFunnel: { interval: 'month', requests: 0, confirmed: 0, confirmationRate: 0, series: [] },
      categoryDemand: { total: 0, categories: [{ categoryId: 'cat-maid', code: 'HOUSE_MAID', name: 'House Maid', requests: 0 }] },
      areaDemand: [],
      workerRegistrations: { interval: 'month', registered: 0, verified: 0, verificationConversion: 0, series: [] },
      workerUtilization: { verifiedWorkers: 0, workersWithActiveBooking: 0, utilization: 0 },
      interviewConversion: { interviewsHeld: 0, confirmed: 0, conversion: 0 },
      cancellationRate: { totalBookings: 0, cancelled: 0, cancellationRate: 0 },
      replacementRate: { activeBookings: 0, replacementRequests: 0, replacementRate: 0 },
      paymentCollections: { interval: 'month', totalsByFeeType: [], series: [] },
      supportTickets: { interval: 'month', created: 0, closed: 0, averageResolutionSeconds: 0, byStatus: [], series: [] },
      topRatedWorkers: [],
      repeatCustomers: [],
    });

    renderDashboard();

    expect(await screen.findByText('Business Analytics & Marketplace Intelligence')).toBeInTheDocument();
    // 0.0% is faithfully rendered for genuine zero rate metrics
    const zeroRates = await screen.findAllByText('0.0%');
    expect(zeroRates.length).toBeGreaterThanOrEqual(4);
    // 0 requests in total badge
    expect(screen.getByText('Total: 0 Requests')).toBeInTheDocument();
    // 0s resolution time
    expect(screen.getByText('0s')).toBeInTheDocument();
  });

  it('distinguishes unavailable metrics (null fields) by rendering honest unavailable indicators', async () => {
    vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValueOnce({
      kpis: {
        grossBookings: null,
        activeWorkforce: 10,
        verificationQueue: 5,
        activeGrievances: 1,
        replacementVolume: 0,
        platformRevenueINR: 1000,
        scheduledTrials: 0,
        policeVerifDue: null,
      },
      queues: [],
    });

    vi.spyOn(dashboardRepository, 'getSuperAdminAnalytics').mockResolvedValueOnce({
      bookingFunnel: null,
      categoryDemand: null,
      areaDemand: null,
      workerRegistrations: null,
      workerUtilization: null,
      interviewConversion: null,
      cancellationRate: null,
      replacementRate: null,
      paymentCollections: null,
      supportTickets: null,
      topRatedWorkers: null,
      repeatCustomers: null,
    });

    renderDashboard();

    expect(await screen.findByText('Business Analytics & Marketplace Intelligence')).toBeInTheDocument();
    const missingIndicators = await screen.findAllByText('— Metric not provided by backend contract');
    expect(missingIndicators.length).toBeGreaterThanOrEqual(4);
  });

  it('displays functional retry mechanism when analytics query encounters an error', async () => {
    vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValueOnce({
      kpis: {
        grossBookings: 100,
        activeWorkforce: 10,
        verificationQueue: 5,
        activeGrievances: 1,
        replacementVolume: 0,
        platformRevenueINR: 1000,
        scheduledTrials: 0,
        policeVerifDue: null,
      },
      queues: [],
    });

    const getAnalyticsSpy = vi
      .spyOn(dashboardRepository, 'getSuperAdminAnalytics')
      .mockRejectedValueOnce(new Error('Network error fetching analytics reports'))
      .mockResolvedValueOnce(sampleAnalyticsData);

    renderDashboard();

    expect(await screen.findByText('Network error fetching analytics reports')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry analytics/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(getAnalyticsSpy).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText('House Maid')).toBeInTheDocument();
  });

  it('confirms the process flow & lifecycle visualizations section is completely removed from the dashboard', async () => {
    vi.spyOn(dashboardRepository, 'getSuperAdminDashboard').mockResolvedValueOnce({
      kpis: {
        grossBookings: 100,
        activeWorkforce: 10,
        verificationQueue: 5,
        activeGrievances: 1,
        replacementVolume: 0,
        platformRevenueINR: 1000,
        scheduledTrials: 0,
        policeVerifDue: null,
      },
      queues: [],
    });
    vi.spyOn(dashboardRepository, 'getSuperAdminAnalytics').mockResolvedValueOnce(sampleAnalyticsData);

    renderDashboard();

    // Verify analytics is present
    expect(await screen.findByText('Business Analytics & Marketplace Intelligence')).toBeInTheDocument();

    // Verify Process Flows section and journey tabs are completely absent
    expect(screen.queryByText('PRD Process Flow & Lifecycle Visualizations')).not.toBeInTheDocument();
    expect(screen.queryByText(/Visualizations illustrate official PRD product journeys/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Customer Journey/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Worker Journey/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Replacement Journey/i)).not.toBeInTheDocument();
  });

  it('maps real backend analytics responses via RealDashboardRepository', async () => {
    const realRepo = new RealDashboardRepository();

    vi.spyOn(httpClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/admin/reports/booking-funnel') {
        return { data: { interval: 'month', requests: 50, confirmed: 30, confirmationRate: 0.6, series: [] } };
      }
      if (url === '/admin/reports/demand-by-category') {
        return { data: { total: 50, categories: [{ code: 'COOK', name: 'Cook', requests: 50 }] } };
      }
      if (url === '/admin/reports/demand-by-area') {
        return { data: [{ areaId: 'a-1', name: 'Gachibowli', city: 'Hyderabad', requests: 50 }] };
      }
      if (url === '/admin/reports/worker-registrations') {
        return { data: { interval: 'month', registered: 20, verified: 15, verificationConversion: 0.75, series: [] } };
      }
      if (url === '/admin/reports/worker-utilization') {
        return { data: { verifiedWorkers: 15, workersWithActiveBooking: 10, utilization: 0.6667 } };
      }
      if (url === '/admin/reports/interview-conversion') {
        return { data: { interviewsHeld: 18, confirmed: 12, conversion: 0.6667 } };
      }
      if (url === '/admin/reports/cancellation-rate') {
        return { data: { totalBookings: 50, cancelled: 2, cancellationRate: 0.04 } };
      }
      if (url === '/admin/reports/replacement-rate') {
        return { data: { activeBookings: 30, replacementRequests: 1, replacementRate: 0.0333 } };
      }
      if (url === '/admin/reports/payment-collections') {
        return { data: { interval: 'month', totalsByFeeType: [{ feeCode: 'PLATFORM_FEE', currency: 'INR', payments: 30, grossMinor: 1500000, refundedMinor: 0 }], series: [] } };
      }
      if (url === '/admin/reports/support-tickets') {
        return { data: { interval: 'month', created: 8, closed: 6, averageResolutionSeconds: 1800, byStatus: [{ status: 'OPEN', count: 2 }], series: [] } };
      }
      if (url === '/admin/reports/top-rated-workers') {
        return { data: [{ workerId: 'w-1', name: 'Ramesh', ratingCount: 10, averageRating: 4.8 }] };
      }
      if (url === '/admin/reports/repeat-customers') {
        return { data: [{ customerUserId: 'c-1', name: 'Vikram', bookings: 3 }] };
      }
      return { data: null };
    });

    const result = await realRepo.getSuperAdminAnalytics('2026-01-01', '2026-12-31');

    expect(result.bookingFunnel?.requests).toBe(50);
    expect(result.bookingFunnel?.confirmed).toBe(30);
    expect(result.categoryDemand?.categories[0].name).toBe('Cook');
    expect(result.areaDemand?.[0].name).toBe('Gachibowli');
    expect(result.workerUtilization?.utilization).toBe(0.6667);
    expect(result.cancellationRate?.cancellationRate).toBe(0.04);
    expect(result.supportTickets?.averageResolutionSeconds).toBe(1800);
    expect(result.topRatedWorkers?.[0].name).toBe('Ramesh');
    expect(result.repeatCustomers?.[0].bookings).toBe(3);
  });
});
