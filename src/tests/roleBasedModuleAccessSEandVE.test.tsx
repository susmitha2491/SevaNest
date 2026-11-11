import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../core/auth/authStore';
import { AdminRole } from '../core/auth/authTypes';
import { PERMISSIONS } from '../core/rbac/permissions';
import { AppShell } from '../app/layouts/AppShell';
import { ProtectedRoute } from '../app/router/ProtectedRoute';
import { VerificationQueuePage } from '../features/verification/presentation/VerificationQueuePage';
import { SupportTicketsPage } from '../features/support/presentation/SupportTicketsPage';
import { CustomersListPage } from '../features/customers/presentation/CustomersListPage';
import { BookingsListPage } from '../features/bookings/presentation/BookingsListPage';
import { WorkersListPage } from '../features/workers/presentation/WorkersListPage';
import { WorkersDirectoryPage } from '../features/workers/presentation/WorkersDirectoryPage';
import { PaymentsListPage } from '../features/payments/presentation/PaymentsListPage';
import { ReportsDashboardPage } from '../features/reports/presentation/ReportsDashboardPage';
import { ConfigurationMastersPage } from '../features/configuration/presentation/ConfigurationMastersPage';
import { AuditTrailPage } from '../features/audit/presentation/AuditTrailPage';
import { DirectoryPage } from '../features/directory/presentation/DirectoryPage';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { PaginatedVerificationQueue } from '../features/verification/domain/types';
import { supportRepository } from '../features/support/data/supportRepository';
import { customerRepository } from '../features/customers/data/customerRepository';
import { bookingRepository } from '../features/bookings/data/bookingRepository';
import { paymentRepository } from '../features/payments/data/paymentRepository';
import { workerRepository } from '../features/workers/data/workerRepository';
import { TicketDetailModal } from '../features/support/presentation/TicketDetailModal';

// Mock all backend repositories to track API execution
vi.mock('../features/workers/data/workerRepository', () => ({
  workerRepository: {
    getWorkersPage: vi.fn(),
    getWorkers: vi.fn(),
    getWorkerById: vi.fn(),
  },
}));

vi.mock('../features/verification/data/verificationRepository', () => ({
  verificationRepository: {
    getVerificationQueue: vi.fn(),
    getDossier: vi.fn(),
    submitDecisions: vi.fn(),
    getSignedDocumentUrl: vi.fn(),
    recheckCheck: vi.fn(),
    activateWorker: vi.fn(),
    getVerificationLevel: vi.fn(),
  },
}));

vi.mock('../features/support/data/supportRepository', () => ({
  supportRepository: {
    getTickets: vi.fn(),
    getTicketById: vi.fn(),
    claimTicket: vi.fn(),
    setPriority: vi.fn(),
    addCaseNote: vi.fn(),
    resolveTicket: vi.fn(),
    escalateTicket: vi.fn(),
    requestReplacement: vi.fn(),
  },
}));

vi.mock('../features/customers/data/customerRepository', () => ({
  customerRepository: {
    getCustomersPage: vi.fn(),
    getCustomers: vi.fn(),
    getCustomerById: vi.fn(),
    suspendCustomer: vi.fn(),
    activateCustomer: vi.fn(),
  },
}));

vi.mock('../features/bookings/data/bookingRepository', () => ({
  bookingRepository: {
    getBookings: vi.fn(),
    getBookingById: vi.fn(),
    confirmBooking: vi.fn(),
    cancelBooking: vi.fn(),
  },
}));

vi.mock('../features/payments/data/paymentRepository', () => ({
  paymentRepository: {
    getTransactions: vi.fn(),
    getTransactionSummary: vi.fn(),
  },
}));

function renderFullPortal(initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<div>Default Home</div>} />
            <Route path="dashboard" element={<div>Dashboard Workspace</div>} />
            <Route
              path="support"
              element={
                <ProtectedRoute permission={PERMISSIONS.SUPPORT_VIEW}>
                  <SupportTicketsPage viewMode="all" />
                </ProtectedRoute>
              }
            />
            <Route
              path="verification"
              element={
                <ProtectedRoute permission={PERMISSIONS.VERIFICATION_REVIEW}>
                  <VerificationQueuePage viewMode="all" />
                </ProtectedRoute>
              }
            />
            <Route
              path="customers"
              element={
                <ProtectedRoute permission={PERMISSIONS.CUSTOMER_VIEW}>
                  <CustomersListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="workers"
              element={
                <ProtectedRoute permission={PERMISSIONS.WORKER_VIEW}>
                  <WorkersListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="workers/directory"
              element={
                <ProtectedRoute permission={PERMISSIONS.WORKER_VIEW}>
                  <WorkersDirectoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="bookings"
              element={
                <ProtectedRoute permission={PERMISSIONS.BOOKINGS_VIEW}>
                  <BookingsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="payments"
              element={
                <ProtectedRoute permission={PERMISSIONS.PAYMENTS_VIEW}>
                  <PaymentsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute permission={PERMISSIONS.REPORTS_VIEW}>
                  <ReportsDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="configuration"
              element={
                <ProtectedRoute permission={PERMISSIONS.CONFIGURATION_MANAGE}>
                  <ConfigurationMastersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit"
              element={
                <ProtectedRoute permission={PERMISSIONS.AUDIT_VIEW}>
                  <AuditTrailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="directory"
              element={
                <ProtectedRoute permission={PERMISSIONS.WORKER_VIEW}>
                  <DirectoryPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Server-issued permission sets from backend GET /api/v1/admin/roles
const SUPPORT_EXECUTIVE_SERVER_PERMISSIONS = [
  'booking.view',
  'customer.view',
  'rating.view',
  'support.manage',
  'support.view',
  'worker.view',
];

const VERIFICATION_EXECUTIVE_SERVER_PERMISSIONS = [
  'alert.view',
  'verification.decide',
  'verification.document.view',
  'verification.review',
  'worker.view',
];

const SUPER_ADMIN_PERMISSIONS = ['*'];

describe('Role-Based Module Access Audit & Correction: Support Executive & Verification Executive', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(supportRepository.getTickets).mockResolvedValue({
      items: [
        {
          id: 'TKT-101',
          complainantId: 'CUST-1',
          complainantName: 'Aarav Mehta',
          complainantType: 'CUSTOMER',
          complainantPhoneMasked: '+91 ••••• ••210',
          serviceCategory: 'House Maid',
          disputeCategory: 'ATTENDANCE_BREACH',
          description: 'Worker did not report for morning shift.',
          status: 'CREATED',
          priority: 'HIGH',
          slaStatus: 'NORMAL',
          createdAt: new Date().toISOString(),
          caseNotes: [],
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
      slaAtRiskCount: 0,
      unassignedCount: 0,
      escalatedCount: 0,
      resolvedTodayCount: 0,
    });

    const mockQueueResult = {
      items: [
        {
          id: 'VQ-9901',
          workerId: 'W-9901',
          workerName: 'Lalitha Devi',
          category: 'HOUSEKEEPER',
          status: 'PENDING_REVIEW',
          submissionTime: new Date().toISOString(),
          locality: 'Madhapur',
          experienceYears: 4,
          phoneMasked: '+91 ••••• ••123',
          preCheckOtpVerified: true,
          checks: {},
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    };

    vi.mocked(verificationRepository.getVerificationQueue).mockResolvedValue(mockQueueResult as unknown as PaginatedVerificationQueue);

    vi.mocked(workerRepository.getWorkersPage).mockResolvedValue({
      items: [
        {
          id: 'W-9901',
          name: 'Lalitha Devi',
          category: 'HOUSEKEEPER',
          status: 'ACTIVE',
          verificationStatus: 'VERIFIED',
          isFullyVerified: true,
          phone: '+91 98765 43210',
          experienceYears: 4,
          ratingAverage: 4.8,
          totalReviews: 10,
          locality: 'Madhapur',
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
      hasMore: false,
    });

    vi.mocked(customerRepository.getCustomersPage).mockResolvedValue({
      items: [
        {
          id: 'CUST-100',
          name: 'Vikram Seth',
          maskedEmail: 'v****@example.com',
          maskedPhone: '+91 98765 *****',
          status: 'ACTIVE',
          verificationStatus: 'VERIFIED',
          locality: 'Banjara Hills',
          registeredDate: new Date().toISOString(),
          totalBookings: 3,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      hasMore: false,
    });

    vi.mocked(bookingRepository.getBookings).mockResolvedValue({
      items: [
        {
          id: 'BKG-501',
          customerId: 'CUST-100',
          customerName: 'Ananya Roy',
          customerPhoneMasked: '+91 98765 *****',
          customerLocality: 'Gachibowli',
          serviceCategory: 'COOK',
          engagementType: 'FULL_TIME_LIVE_OUT',
          timingShift: 'MORNING',
          salaryBudgetMax: 12000,
          platformFeePaid: true,
          platformFeeAmount: 1500,
          internalNotes: [],
          assignedWorkerName: 'Meena Bai',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    });

    vi.mocked(paymentRepository.getTransactions).mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
      totalGrossCollectionsINR: 0,
      pendingRefundsCount: 0,
    });
  });

  describe('1. Support Executive Module Visibility & Route Access', () => {
    beforeEach(() => {
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        user: {
          id: 'se-user-1',
          email: 'support.executive@sevanest.example.com',
          name: 'Kavita Rao',
          role: 'SUPPORT_EXECUTIVE',
          permissions: SUPPORT_EXECUTIVE_SERVER_PERMISSIONS,
        },
      });
    });

    it('renders only authorized navigation items in sidebar and omits prohibited modules', () => {
      renderFullPortal('/support');

      // Authorized modules visible
      expect(screen.getByRole('link', { name: /Support Dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Customer Management/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Directory$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Booking Management/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Support$/i })).toBeInTheDocument();

      // Prohibited modules strictly omitted
      expect(screen.queryByRole('link', { name: /Workers Directory/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Verification/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Payments/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Reports/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Configuration/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Audit/i })).not.toBeInTheDocument();
    });

    it('allows direct navigation to /support and loads support tickets', async () => {
      renderFullPortal('/support');

      expect(await screen.findByText('TKT-101')).toBeInTheDocument();
      expect(screen.getByText('Aarav Mehta')).toBeInTheDocument();
      expect(supportRepository.getTickets).toHaveBeenCalled();
    });

    it('blocks direct navigation to /verification and does not trigger verification API', async () => {
      renderFullPortal('/verification');

      expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
      expect(screen.getByText(/verification\.review/i)).toBeInTheDocument();
      expect(verificationRepository.getVerificationQueue).not.toHaveBeenCalled();
    });

    it('blocks direct navigation to /payments and does not trigger payments API', async () => {
      renderFullPortal('/payments');

      expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
      expect(screen.getByText(/payments\.view/i)).toBeInTheDocument();
      expect(paymentRepository.getTransactions).not.toHaveBeenCalled();
    });

    it('blocks direct navigation to /configuration and displays NoAccessView', async () => {
      renderFullPortal('/configuration');

      expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
      expect(screen.getByText(/configuration\.manage/i)).toBeInTheDocument();
    });

    it('blocks direct navigation to /audit and displays NoAccessView', async () => {
      renderFullPortal('/audit');

      expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
      expect(screen.getByText(/audit\.view/i)).toBeInTheDocument();
    });

    it('allows Support Executive direct navigation to /directory', async () => {
      renderFullPortal('/directory');

      expect(await screen.findByRole('heading', { name: /^Directory$/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Workers/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Customers/i })).toBeInTheDocument();
    });

    it('enforces action-level permissions in TicketDetailModal: support.manage permits case note logging and triage', () => {
      const mockTicket = {
        id: 'TKT-101',
        complainantId: 'CUST-1',
        complainantName: 'Aarav Mehta',
        complainantType: 'CUSTOMER' as const,
        complainantPhoneMasked: '+91 ••••• ••210',
        serviceCategory: 'House Maid',
        disputeCategory: 'ATTENDANCE_BREACH' as const,
        description: 'Worker did not report for morning shift.',
        status: 'CREATED' as const,
        priority: 'HIGH' as const,
        slaStatus: 'NORMAL' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        caseNotes: [],
        timelineEvents: [],
      };

      render(
        <QueryClientProvider client={new QueryClient()}>
          <TicketDetailModal
            ticket={mockTicket}
            isOpen={true}
            onClose={vi.fn()}
            onOpenResolve={vi.fn()}
            onOpenEscalate={vi.fn()}
          />
        </QueryClientProvider>
      );

      // Actions permitted because user holds support.manage
      expect(screen.getByRole('textbox', { name: /Support reply text/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Mark Resolved/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Escalate Ops/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Claim Ticket/i })).not.toBeInTheDocument();
    });

    it('restricts actions in TicketDetailModal when support.manage is absent', () => {
      // Simulate user with read-only support.view
      useAuthStore.setState({
        isAuthenticated: true,
        user: {
          id: 'se-readonly',
          email: 'auditor@sevanest.example.com',
          name: 'Auditor',
          role: 'SUPPORT_EXECUTIVE',
          permissions: ['support.view', 'booking.view'],
        },
      });

      const mockTicket = {
        id: 'TKT-101',
        complainantId: 'CUST-1',
        complainantName: 'Aarav Mehta',
        complainantType: 'CUSTOMER' as const,
        complainantPhoneMasked: '+91 ••••• ••210',
        serviceCategory: 'House Maid',
        disputeCategory: 'ATTENDANCE_BREACH' as const,
        description: 'Worker did not report for morning shift.',
        status: 'CREATED' as const,
        priority: 'HIGH' as const,
        slaStatus: 'NORMAL' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        caseNotes: [],
        timelineEvents: [],
      };

      render(
        <QueryClientProvider client={new QueryClient()}>
          <TicketDetailModal
            ticket={mockTicket}
            isOpen={true}
            onClose={vi.fn()}
            onOpenResolve={vi.fn()}
            onOpenEscalate={vi.fn()}
          />
        </QueryClientProvider>
      );

      // Actions hidden because user lacks support.manage
      expect(screen.queryByRole('textbox', { name: /Support reply text/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Mark Resolved/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Escalate Ops/i })).not.toBeInTheDocument();
      expect(screen.getByText(/You do not have permission to send messages/i)).toBeInTheDocument();
    });
  });

  describe('2. Verification Executive Module Visibility & Route Access', () => {
    beforeEach(() => {
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        user: {
          id: 've-user-1',
          email: 'verification.executive@sevanest.example.com',
          name: 'Suresh Nambiar',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: VERIFICATION_EXECUTIVE_SERVER_PERMISSIONS,
        },
      });
    });

    it('renders only authorized navigation items in sidebar and omits prohibited modules', () => {
      renderFullPortal('/verification');

      // Authorized modules visible
      expect(screen.getByRole('link', { name: /^Verification$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Workers Management/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Dashboard$/i })).toBeInTheDocument();

      // Prohibited modules strictly omitted
      expect(screen.queryByRole('link', { name: /Workers Directory/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Customer Management/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Booking Management/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Payments/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Support$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Reports/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Configuration/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Audit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Directory$/i })).not.toBeInTheDocument();
    });

    it('allows direct navigation to /verification and loads verification queue', async () => {
      renderFullPortal('/verification');

      expect(await screen.findByText('Lalitha Devi')).toBeInTheDocument();
      expect(verificationRepository.getVerificationQueue).toHaveBeenCalled();
    });

    it('blocks direct navigation to /customers and does not trigger customers API', async () => {
      renderFullPortal('/customers');

      expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
      expect(screen.getByText(/customer\.view/i)).toBeInTheDocument();
      expect(customerRepository.getCustomersPage).not.toHaveBeenCalled();
    });

    it('blocks direct navigation to /bookings and does not trigger bookings API', async () => {
      renderFullPortal('/bookings');

      expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
      expect(screen.getByText(/bookings\.view/i)).toBeInTheDocument();
      expect(bookingRepository.getBookings).not.toHaveBeenCalled();
    });

    it('blocks direct navigation to /support and does not trigger support tickets API', async () => {
      renderFullPortal('/support');

      expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
      expect(screen.getByText(/support\.view/i)).toBeInTheDocument();
      expect(supportRepository.getTickets).not.toHaveBeenCalled();
    });

    it('blocks direct navigation to /payments and displays NoAccessView', async () => {
      renderFullPortal('/payments');

      expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
      expect(screen.getByText(/payments\.view/i)).toBeInTheDocument();
      expect(paymentRepository.getTransactions).not.toHaveBeenCalled();
    });

    it('blocks direct navigation to /directory for Verification Executive and displays NoAccessView', async () => {
      renderFullPortal('/directory');

      expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
    });
  });

  describe('3. Dynamic Custom Role Verification', () => {
    it('grants access to Support Console when custom role holds support.view and support.manage without role name check', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        user: {
          id: 'custom-staff-1',
          email: 'custom.specialist@sevanest.example.com',
          name: 'Specialist Staff',
          role: 'CUSTOM_OPERATIONAL_STAFF' as unknown as AdminRole,
          permissions: ['support.view', 'support.manage', 'worker.view'],
        },
      });

      renderFullPortal('/support');

      expect(await screen.findByRole('link', { name: /^Support$/i })).toBeInTheDocument();
      expect(await screen.findByText('TKT-101')).toBeInTheDocument();
      expect(screen.getByText('Aarav Mehta')).toBeInTheDocument();
    });

    it('immediately hides module and blocks route when permission is revoked dynamically', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        user: {
          id: 'custom-staff-2',
          email: 'temp.user@sevanest.example.com',
          name: 'Temporary User',
          role: 'TIER_1_AGENT' as unknown as AdminRole,
          permissions: ['worker.view'], // Lacks support.view and verification.review
        },
      });

      renderFullPortal('/support');

      expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Support$/i })).not.toBeInTheDocument();
    });
  });

  describe('4. Super Admin Regression Coverage', () => {
    it('preserves full module visibility and unrestricted navigation for Super Admin via wildcard', () => {
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        user: {
          id: 'super-admin-1',
          email: 'sevanest@admin.in',
          name: 'Super Administrator',
          role: 'SUPER_ADMIN',
          permissions: SUPER_ADMIN_PERMISSIONS,
        },
      });

      renderFullPortal('/dashboard');

      expect(screen.getByRole('link', { name: /^Dashboard$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Customer Management/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Worker Management/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Directory$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Verification/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Booking Management/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Payments/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Support$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Reports/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Configuration/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Audit/i })).toBeInTheDocument();
    });
  });
});
