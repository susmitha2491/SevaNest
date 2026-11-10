import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { AppShell } from '../app/layouts/AppShell';
import { ProtectedRoute } from '../app/router/ProtectedRoute';
import { DirectoryPage } from '../features/directory/presentation/DirectoryPage';
import { WorkersDirectoryRouteWrapper } from '../app/router/WorkersDirectoryRouteWrapper';
import { workerRepository } from '../features/workers/data/workerRepository';
import { customerRepository } from '../features/customers/data/customerRepository';
import { isRouteAccessibleForUser } from '../core/rbac/navigationRegistry';
import { Worker, WorkerPageResult } from '../features/workers/domain/types';
import { Customer, CustomerPageResult } from '../features/customers/domain/types';

vi.mock('../features/workers/data/workerRepository', () => ({
  workerRepository: {
    getWorkersPage: vi.fn(),
    getWorkers: vi.fn(),
    getWorkerById: vi.fn(),
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

const mockWorker: Worker = {
  id: 'W-DIR-001',
  name: 'Sunita Sharma',
  phone: '+91 98480 11223',
  mobile: '+91 98480 11223',
  category: 'COOKING',
  categories: ['COOKING', 'CLEANING'],
  experienceYears: 5,
  ratingAverage: 4.8,
  totalReviews: 12,
  locality: 'Banjara Hills',
  status: 'ACTIVE',
  accountStatus: 'ACTIVE',
  isFullyVerified: true,
  verificationLevel: 'VERIFIED',
  verificationStatus: 'VERIFIED',
};

const mockCustomer: Customer = {
  id: 'C-DIR-101',
  name: 'Rajiv Mehra',
  phone: '+91 99881 22334',
  maskedPhone: '+91 99**** **34',
  maskedEmail: 'r****@example.com',
  locality: 'Jubilee Hills',
  registeredDate: '2026-10-15T09:30:00.000Z',
  status: 'ACTIVE',
  verificationStatus: 'VERIFIED',
  totalBookings: 3,
};

const SUPPORT_EXEC_PERMISSIONS = [
  'booking.view',
  'customer.view',
  'rating.view',
  'support.manage',
  'support.view',
  'worker.view',
];

function renderDirectoryApp(initialRoute: string = '/directory') {
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
            <Route index element={<div>Home</div>} />
            <Route path="dashboard" element={<div>Dashboard</div>} />
            <Route
              path="directory"
              element={
                <ProtectedRoute>
                  <DirectoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="workers/directory"
              element={
                <ProtectedRoute>
                  <WorkersDirectoryRouteWrapper />
                </ProtectedRoute>
              }
            />
            <Route path="customers" element={<div>Customer Management Page</div>} />
            <Route path="workers" element={<div>Worker Management Page</div>} />
            <Route path="bookings" element={<div>Booking Management Page</div>} />
            <Route path="support" element={<div>Support Tickets Page</div>} />
            <Route path="verification" element={<div>Verification Queue Page</div>} />
            <Route path="payments" element={<div>Payments Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Support Executive: Unified Workers & Customers Directory Specification', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthStore.setState({
      isAuthenticated: true,
      isInitialized: true,
      user: {
        id: 'supp-exec-01',
        name: 'Kavita Rao',
        email: 'support.kavita@sevanest.in',
        role: 'SUPPORT_EXECUTIVE',
        permissions: SUPPORT_EXEC_PERMISSIONS,
      },
    });

    vi.mocked(workerRepository.getWorkersPage).mockResolvedValue({
      items: [mockWorker],
      total: 1,
      page: 1,
      limit: 25,
      hasMore: false,
    } as WorkerPageResult);

    vi.mocked(customerRepository.getCustomersPage).mockResolvedValue({
      items: [mockCustomer],
      total: 1,
      page: 1,
      limit: 20,
      hasMore: false,
    } as CustomerPageResult);
  });

  describe('1. Sidebar Navigation Structure for Support Executive', () => {
    it('displays "Directory" and removes standalone "Workers Directory"', () => {
      renderDirectoryApp('/directory');

      // Directory module visible in sidebar
      expect(screen.getByRole('link', { name: /^Directory$/i })).toBeInTheDocument();

      // Standalone Workers Directory strictly removed
      expect(screen.queryByRole('link', { name: /Workers Directory/i })).not.toBeInTheDocument();

      // Other authorized modules remain intact
      expect(screen.getByRole('link', { name: /Support Dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Customer Management/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Booking Management/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Support$/i })).toBeInTheDocument();

      // Unauthorized modules omitted
      expect(screen.queryByRole('link', { name: /Verification/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Payments/i })).not.toBeInTheDocument();
    });

    it('has no duplicate Directory entries in the sidebar', () => {
      renderDirectoryApp('/directory');

      const directoryLinks = screen.getAllByRole('link', { name: /^Directory$/i });
      expect(directoryLinks).toHaveLength(1);
    });
  });

  describe('2. Unified Directory Interface: Workers & Customers Sections', () => {
    it('renders both Workers and Customers tabs with default to Workers', async () => {
      renderDirectoryApp('/directory');

      expect(await screen.findByRole('heading', { name: /^Directory$/i })).toBeInTheDocument();

      const workersTab = screen.getByRole('tab', { name: /Workers/i });
      const customersTab = screen.getByRole('tab', { name: /Customers/i });

      expect(workersTab).toBeInTheDocument();
      expect(customersTab).toBeInTheDocument();
      expect(workersTab).toHaveAttribute('aria-selected', 'true');
      expect(customersTab).toHaveAttribute('aria-selected', 'false');

      // Workers query called on initial load
      expect(workerRepository.getWorkersPage).toHaveBeenCalled();
      // Customers query NOT called initially while Workers tab is active
      expect(customerRepository.getCustomersPage).not.toHaveBeenCalled();

      // Displays worker row
      expect(await screen.findByText('Sunita Sharma')).toBeInTheDocument();
      expect(screen.getByText('W-DIR-001')).toBeInTheDocument();
      expect(screen.getByText('COOKING')).toBeInTheDocument();
    });

    it('switches to Customers tab and loads customer directory on demand', async () => {
      const user = userEvent.setup();
      renderDirectoryApp('/directory');

      const customersTab = screen.getByRole('tab', { name: /Customers/i });
      await user.click(customersTab);

      expect(customersTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: /Workers/i })).toHaveAttribute('aria-selected', 'false');

      // Customers query executed on tab switch
      await waitFor(() => {
        expect(customerRepository.getCustomersPage).toHaveBeenCalled();
      });

      expect(await screen.findByText('Rajiv Mehra')).toBeInTheDocument();
      expect(screen.getByText('C-DIR-101')).toBeInTheDocument();
      expect(screen.getByText('Jubilee Hills')).toBeInTheDocument();
    });

    it('supports direct section navigation via ?tab=customers search parameter', async () => {
      renderDirectoryApp('/directory?tab=customers');

      expect(await screen.findByRole('heading', { name: /^Directory$/i })).toBeInTheDocument();

      const customersTab = screen.getByRole('tab', { name: /Customers/i });
      expect(customersTab).toHaveAttribute('aria-selected', 'true');

      // Customers query executed directly
      await waitFor(() => {
        expect(customerRepository.getCustomersPage).toHaveBeenCalled();
      });
      expect(await screen.findByText('Rajiv Mehra')).toBeInTheDocument();
    });

    it('redirects /workers/directory to /directory for Support Executive', async () => {
      renderDirectoryApp('/workers/directory');

      // Landing on /directory
      expect(await screen.findByRole('heading', { name: /^Directory$/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Workers/i })).toBeInTheDocument();
    });
  });

  describe('3. Filtering, Search & Read-Only Inspection', () => {
    it('filters workers by category and searches by term', async () => {
      const user = userEvent.setup();
      renderDirectoryApp('/directory');

      await screen.findByText('Sunita Sharma');

      const searchInput = screen.getByPlaceholderText(/Search verified worker by name or mobile/i);
      await user.type(searchInput, 'Sunita');

      const categorySelect = screen.getByLabelText(/Filter by skill category/i);
      await user.selectOptions(categorySelect, 'COOKING');

      await waitFor(() => {
        expect(workerRepository.getWorkersPage).toHaveBeenCalledWith(
          expect.objectContaining({
            searchTerm: 'Sunita',
            category: 'COOKING',
            verified: true,
            status: 'ACTIVE',
          }),
          1,
          25
        );
      });
    });

    it('filters customers by status and searches by term', async () => {
      const user = userEvent.setup();
      renderDirectoryApp('/directory?tab=customers');

      await screen.findByText('Rajiv Mehra');

      const searchInput = screen.getByPlaceholderText(/Search customer by ID, name, or mobile/i);
      await user.type(searchInput, 'Rajiv');

      const statusSelect = screen.getByLabelText(/Filter by account status/i);
      await user.selectOptions(statusSelect, 'ACTIVE');

      await waitFor(() => {
        expect(customerRepository.getCustomersPage).toHaveBeenCalledWith(
          expect.objectContaining({
            searchTerm: 'Rajiv',
            status: 'ACTIVE',
          }),
          1,
          20
        );
      });
    });

    it('enforces strictly read-only inspection without mutating actions', async () => {
      renderDirectoryApp('/directory');

      await screen.findByText('Sunita Sharma');

      // Only View Profile button exists
      expect(screen.getAllByRole('button', { name: /View Profile/i }).length).toBeGreaterThan(0);

      // No mutating buttons
      expect(screen.queryByRole('button', { name: /Create/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Activate/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Suspend/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Blacklist/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Approve/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reject/i })).not.toBeInTheDocument();
    });
  });

  describe('4. Granular Permission & Route Boundary Gates', () => {
    it('hides Customers tab and disables customer query when user lacks customer.view', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        user: {
          id: 'worker-only-staff',
          name: 'Worker Specialist',
          email: 'worker.specialist@sevanest.in',
          role: 'SUPPORT_EXECUTIVE',
          permissions: ['worker.view'], // Lacks customer.view
        },
      });

      renderDirectoryApp('/directory');

      expect(await screen.findByRole('heading', { name: /^Directory$/i })).toBeInTheDocument();

      // Workers tab visible
      expect(screen.getByRole('tab', { name: /Workers/i })).toBeInTheDocument();
      // Customers tab hidden
      expect(screen.queryByRole('tab', { name: /Customers/i })).not.toBeInTheDocument();

      // Customer query never called
      expect(customerRepository.getCustomersPage).not.toHaveBeenCalled();
    });

    it('hides Workers tab and disables worker query when user lacks worker.view', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        user: {
          id: 'customer-only-staff',
          name: 'Customer Specialist',
          email: 'customer.specialist@sevanest.in',
          role: 'SUPPORT_EXECUTIVE',
          permissions: ['customer.view'], // Lacks worker.view
        },
      });

      renderDirectoryApp('/directory');

      expect(await screen.findByRole('heading', { name: /^Directory$/i })).toBeInTheDocument();

      // Customers tab visible and active by default
      expect(screen.getByRole('tab', { name: /Customers/i })).toBeInTheDocument();
      // Workers tab hidden
      expect(screen.queryByRole('tab', { name: /Workers/i })).not.toBeInTheDocument();

      // Worker query never called
      expect(workerRepository.getWorkersPage).not.toHaveBeenCalled();

      // Customers query is called
      await waitFor(() => {
        expect(customerRepository.getCustomersPage).toHaveBeenCalled();
      });
    });

    it('displays NoAccessView when user has neither worker.view nor customer.view', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        isInitialized: true,
        user: {
          id: 'no-perm-staff',
          name: 'No Perm Staff',
          email: 'no.perm@sevanest.in',
          role: 'SUPPORT_EXECUTIVE',
          permissions: ['support.view'], // Lacks both worker.view and customer.view
        },
      });

      renderDirectoryApp('/directory');

      expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
      expect(workerRepository.getWorkersPage).not.toHaveBeenCalled();
      expect(customerRepository.getCustomersPage).not.toHaveBeenCalled();
    });
  });

  describe('5. Regression Protection: Other Roles', () => {
    it('preserves Super Admin full Directory access with both Worker Management and Customer Management', () => {
      const superAdminUser = {
        id: 'super-01',
        name: 'Super Admin',
        email: 'super@sevanest.in',
        role: 'SUPER_ADMIN' as const,
        permissions: ['*'],
      };
      expect(isRouteAccessibleForUser('/directory', superAdminUser)).toBe(true);
    });

    it('blocks Operations Admin from /directory route', () => {
      const opsAdminUser = {
        id: 'ops-01',
        name: 'Ops Admin',
        email: 'ops@sevanest.in',
        role: 'OPERATIONS_ADMIN' as const,
        permissions: [PERMISSIONS.WORKER_VIEW, PERMISSIONS.WORKER_MANAGE],
      };
      expect(isRouteAccessibleForUser('/directory', opsAdminUser)).toBe(false);
    });

    it('blocks Verification Executive from /directory route', () => {
      const verifExecUser = {
        id: 've-01',
        name: 'Verif Exec',
        email: 've@sevanest.in',
        role: 'VERIFICATION_EXECUTIVE' as const,
        permissions: [PERMISSIONS.WORKER_VIEW, PERMISSIONS.VERIFICATION_REVIEW],
      };
      expect(isRouteAccessibleForUser('/directory', verifExecUser)).toBe(false);
    });
  });
});
