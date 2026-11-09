import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../core/auth/authStore';
import { AdminRole } from '../core/auth/authTypes';
import { PERMISSIONS } from '../core/rbac/permissions';
import { AppShell } from '../app/layouts/AppShell';
import { ProtectedRoute } from '../app/router/ProtectedRoute';
import { WorkersListPage } from '../features/workers/presentation/WorkersListPage';
import { WorkersDirectoryPage } from '../features/workers/presentation/WorkersDirectoryPage';
import { VerificationQueuePage } from '../features/verification/presentation/VerificationQueuePage';
import { workerRepository } from '../features/workers/data/workerRepository';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { WorkerPageResult, Worker } from '../features/workers/domain/types';
import { PaginatedVerificationQueue } from '../features/verification/domain/types';

vi.mock('../features/workers/data/workerRepository', () => ({
  workerRepository: {
    getWorkersPage: vi.fn(),
    getWorkers: vi.fn(),
    getWorkerById: vi.fn(),
    updateWorkerStatus: vi.fn(),
  },
}));

vi.mock('../features/verification/data/verificationRepository', () => ({
  verificationRepository: {
    getVerificationQueue: vi.fn(),
    getDossier: vi.fn(),
  },
}));

const mockWorkersList: Worker[] = [
  {
    id: 'W-10482',
    name: 'Sunita Devi',
    phone: '+919876543210',
    phoneMasked: '+91 98765 *****',
    category: 'House Maid',
    categories: ['House Maid', 'Cook'],
    experienceYears: 6,
    ratingAverage: 4.8,
    totalReviews: 24,
    locality: 'Kondapur',
    status: 'ACTIVE',
    verificationLevel: 'VERIFIED',
    verificationStatus: 'VERIFIED',
    isFullyVerified: true,
    matchingEligible: true,
    applicationStatus: 'VERIFIED',
    createdAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'W-10892',
    name: 'Ramesh Kumar',
    phone: '+919812345678',
    phoneMasked: '+91 98123 *****',
    category: 'Driver',
    categories: ['Driver'],
    experienceYears: 8,
    ratingAverage: 4.5,
    totalReviews: 10,
    locality: 'Gachibowli',
    status: 'ACTIVE',
    verificationLevel: 'IN_PROGRESS',
    verificationStatus: 'IN_REVIEW',
    isFullyVerified: false,
    matchingEligible: false,
    applicationStatus: 'UNDER_REVIEW',
    createdAt: '2026-02-10T11:00:00.000Z',
  },
];

function renderPortal(initialRoute = '/') {
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
            <Route index element={<div>Dashboard Index</div>} />
            <Route path="dashboard" element={<div>Dashboard Workspace</div>} />
            <Route
              path="verification"
              element={
                <ProtectedRoute permission={PERMISSIONS.VERIFICATION_REVIEW}>
                  <VerificationQueuePage viewMode="all" />
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
            <Route path="customers" element={<div>Customer Management Page</div>} />
            <Route path="bookings" element={<div>Bookings Page</div>} />
            <Route path="payments" element={<div>Payments Page</div>} />
            <Route path="support" element={<div>Support Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Server permissions definitions
const VE_SERVER_PERMISSIONS = [
  'alert.view',
  'verification.decide',
  'verification.document.view',
  'verification.review',
  'worker.view',
];

const SE_SERVER_PERMISSIONS = [
  'booking.view',
  'customer.view',
  'rating.view',
  'support.manage',
  'support.view',
  'worker.view',
];

const OPS_ADMIN_SERVER_PERMISSIONS = [
  'alert.manage',
  'alert.view',
  'area.manage',
  'attendance.manage',
  'attendance.view',
  'booking.manage',
  'booking.view',
  'category.manage',
  'customer.manage',
  'customer.view',
  'matching.run',
  'notification.manage',
  'payment.view',
  'rating.moderate',
  'rating.view',
  'replacement.manage',
  'replacement.view',
  'report.view',
  'support.view',
  'user.view',
  'verification.reassign',
  'verification.signoff',
  'worker.activate',
  'worker.manage',
  'worker.view',
];

const SUPER_ADMIN_PERMISSIONS = ['*'];

describe('Workers Management in Verification Executive Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockPageResult: WorkerPageResult = {
      items: mockWorkersList,
      total: mockWorkersList.length,
      page: 1,
      limit: 20,
      hasMore: false,
    };

    vi.mocked(workerRepository.getWorkersPage).mockResolvedValue(mockPageResult);
    vi.mocked(workerRepository.getWorkers).mockResolvedValue(mockWorkersList);
    vi.mocked(verificationRepository.getVerificationQueue).mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    } as unknown as PaginatedVerificationQueue);
  });

  describe('1. Verification Executive Sidebar & Functionality', () => {
    beforeEach(() => {
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        user: {
          id: 've-101',
          name: 'Priya Sharma',
          email: 'priya.sharma@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: VE_SERVER_PERMISSIONS,
        },
      });
    });

    it('renders Workers Management in sidebar placed near Verification and preserves Dashboard', () => {
      renderPortal('/dashboard');

      // Preserved authorized items
      const dashboardLink = screen.getByRole('link', { name: /^Dashboard$/i });
      const verificationLink = screen.getByRole('link', { name: /^Verification$/i });
      const workersLink = screen.getByRole('link', { name: /^Workers Management$/i });

      expect(dashboardLink).toBeInTheDocument();
      expect(verificationLink).toBeInTheDocument();
      expect(workersLink).toBeInTheDocument();
      expect(workersLink).toHaveAttribute('href', '/workers');

      // Prohibited items are omitted
      expect(screen.queryByRole('link', { name: /Customer Management/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Booking Management/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Payments/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Support$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Workers Directory/i })).not.toBeInTheDocument();
    });

    it('highlights Workers Management as active when navigating to /workers', async () => {
      renderPortal('/workers');

      const workersLink = screen.getByRole('link', { name: /^Workers Management$/i });
      expect(workersLink).toHaveClass('active');

      const verificationLink = screen.getByRole('link', { name: /^Verification$/i });
      expect(verificationLink).not.toHaveClass('active');
    });

    it('highlights Verification as active when navigating to /verification', async () => {
      renderPortal('/verification');

      const verificationLink = screen.getByRole('link', { name: /^Verification$/i });
      expect(verificationLink).toHaveClass('active');

      const workersLink = screen.getByRole('link', { name: /^Workers Management$/i });
      expect(workersLink).not.toHaveClass('active');
    });

    it('displays worker roster with all 6 operational verification tabs on /workers', async () => {
      renderPortal('/workers');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
      expect(screen.getByText('W-10482')).toBeInTheDocument();
      expect(screen.getByText('W-10892')).toBeInTheDocument();

      // All 6 tabs must be present
      expect(screen.getByRole('button', { name: /All Registered Workers/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Active & Verified Roster/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pending Verification/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /In Review Pipeline/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Rejected \/ Corrections/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Re-Check Due/i })).toBeInTheDocument();

      expect(workerRepository.getWorkersPage).toHaveBeenCalled();
    });

    it('provides View Profile action but strictly omits mutation actions (no Approve, Reject, Suspend, Activate)', async () => {
      renderPortal('/workers');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      // View Profile buttons are present
      const viewButtons = screen.getAllByRole('button', { name: /View Profile/i });
      expect(viewButtons.length).toBeGreaterThan(0);

      // Independent KYC Approve and Reject buttons are NOT present
      expect(screen.queryByRole('button', { name: /^Approve$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Reject$/i })).not.toBeInTheDocument();

      // Disciplinary mutation buttons are NOT present in the table
      expect(screen.queryByRole('button', { name: /Suspend/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Blacklist/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument();
    });
  });

  describe('2. Support Executive Persona Validation', () => {
    beforeEach(() => {
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        user: {
          id: 'se-201',
          name: 'Pooja Sharma',
          email: 'support.exec@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          permissions: SE_SERVER_PERMISSIONS,
        },
      });
    });

    it('renders Workers Directory in sidebar and omits Workers Management', () => {
      renderPortal('/dashboard');

      expect(screen.getByRole('link', { name: /Workers Directory/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Workers Directory/i })).toHaveAttribute('href', '/workers/directory');

      expect(screen.queryByRole('link', { name: /^Workers Management$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Verification$/i })).not.toBeInTheDocument();
    });
  });

  describe('3. Operations Admin Persona Validation', () => {
    beforeEach(() => {
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        user: {
          id: 'ops-301',
          name: 'Vikram Mehta',
          email: 'ops.admin@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: OPS_ADMIN_SERVER_PERMISSIONS,
        },
      });
    });

    it('renders Worker Management in sidebar and omits Verification Management', () => {
      renderPortal('/dashboard');

      expect(screen.getByRole('link', { name: /^Worker Management$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Worker Management$/i })).toHaveAttribute('href', '/workers');

      expect(screen.queryByRole('link', { name: /^Verification/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Workers Directory/i })).not.toBeInTheDocument();
    });
  });

  describe('4. Super Admin Persona Validation', () => {
    beforeEach(() => {
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        user: {
          id: 'super-001',
          name: 'Super Administrator',
          email: 'sevanest@admin.in',
          role: 'SUPER_ADMIN',
          permissions: SUPER_ADMIN_PERMISSIONS,
        },
      });
    });

    it('renders both Worker Management and Verification in sidebar for Super Admin', () => {
      renderPortal('/dashboard');

      expect(screen.getByRole('link', { name: /^Worker Management$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Verification$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Customer Management/i })).toBeInTheDocument();
    });
  });

  describe('5. Direct Route Protection for Unauthorized User', () => {
    it('blocks direct navigation to /workers when user lacks worker.view and suppresses API query', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        user: {
          id: 'unauth-401',
          name: 'Restricted User',
          email: 'restricted@sevanest.internal',
          role: 'RESTRICTED_AGENT' as unknown as AdminRole,
          permissions: ['alert.view'], // lacks worker.view
        },
      });

      renderPortal('/workers');

      expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
      expect(screen.getByText(/worker\.view/i)).toBeInTheDocument();
      expect(workerRepository.getWorkersPage).not.toHaveBeenCalled();
    });
  });
});

