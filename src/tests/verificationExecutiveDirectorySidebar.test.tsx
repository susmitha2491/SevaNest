/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../core/auth/authStore';
import { AdminRole, AdminUser } from '../core/auth/authTypes';
import { PERMISSIONS } from '../core/rbac/permissions';
import { getAccessibleNavigation, isRouteAccessibleForUser } from '../core/rbac/navigationRegistry';
import { AppShell } from '../app/layouts/AppShell';
import { ProtectedRoute } from '../app/router/ProtectedRoute';
import { DirectoryPage } from '../features/directory/presentation/DirectoryPage';
import { VerificationQueuePage } from '../features/verification/presentation/VerificationQueuePage';
import { WorkersListPage } from '../features/workers/presentation/WorkersListPage';
import { workerRepository } from '../features/workers/data/workerRepository';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { customerRepository } from '../features/customers/data/customerRepository';

vi.mock('../features/workers/data/workerRepository', () => ({
  workerRepository: {
    getWorkersPage: vi.fn(),
    getWorkers: vi.fn(),
    getWorkerById: vi.fn(),
    updateWorkerStatus: vi.fn(),
    getServiceCategoriesCatalog: vi.fn().mockResolvedValue([]),
    getServiceAreasCatalog: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../features/verification/data/verificationRepository', () => ({
  verificationRepository: {
    getVerificationQueue: vi.fn(),
    getDossier: vi.fn(),
  },
}));

vi.mock('../features/customers/data/customerRepository', () => ({
  customerRepository: {
    getCustomersPage: vi.fn(),
    getCustomerById: vi.fn(),
  },
}));

const VE_USER: AdminUser = {
  id: 've-dir-01',
  name: 'Verification Executive',
  email: 'verification.executive@sevanest.example.com',
  role: 'VERIFICATION_EXECUTIVE' as AdminRole,
  permissions: [
    'alert.view',
    PERMISSIONS.WORKER_VIEW,
    PERMISSIONS.VERIFICATION_REVIEW,
    PERMISSIONS.VERIFICATION_DECIDE,
    PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
  ],
};

const OPS_ADMIN_USER: AdminUser = {
  id: 'ops-dir-01',
  name: 'Operations Manager',
  email: 'operations.manager@sevanest.example.com',
  role: 'OPERATIONS_ADMIN' as AdminRole,
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.WORKER_VIEW,
    PERMISSIONS.WORKERS_MANAGE,
    PERMISSIONS.VERIFICATION_REVIEW,
    PERMISSIONS.BOOKINGS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
  ],
};

const SUPPORT_EXEC_USER: AdminUser = {
  id: 'se-dir-01',
  name: 'Support Executive',
  email: 'support.executive@sevanest.example.com',
  role: 'SUPPORT_EXECUTIVE' as AdminRole,
  permissions: [
    PERMISSIONS.SUPPORT_VIEW,
    PERMISSIONS.SUPPORT_MANAGE,
    PERMISSIONS.WORKER_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
  ],
};

const SUPER_ADMIN_USER: AdminUser = {
  id: 'sa-dir-01',
  name: 'Super Admin',
  email: 'sevanest@admin.in',
  role: 'SUPER_ADMIN' as AdminRole,
  permissions: ['*'],
};

function renderShellWithRoutes(initialRoute = '/directory') {
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
            <Route index element={<div>Dashboard Home</div>} />
            <Route path="dashboard" element={<div>Dashboard Console</div>} />
            <Route
              path="verification"
              element={
                <ProtectedRoute permission={PERMISSIONS.VERIFICATION_REVIEW}>
                  <VerificationQueuePage viewMode="all" />
                </ProtectedRoute>
              }
            />
            <Route
              path="directory"
              element={
                <ProtectedRoute>
                  <DirectoryPage />
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
              path="configuration"
              element={
                <ProtectedRoute permission={PERMISSIONS.CONFIGURATION_MANAGE}>
                  <div>Configuration Management</div>
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Directory Navigation Item for Verification Executive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearSession();

    vi.mocked(workerRepository.getWorkersPage).mockResolvedValue({
      items: [
        {
          id: '01a1cdfb-54c9-75ad-9c2a-8d0830a89f90',
          name: 'Peekuuu Chickiiii',
          phone: '+91 96857 43210',
          category: 'Cook',
          categories: ['Cook', 'Cleaning Helper'],
          status: 'ACTIVE',
          verificationStatus: 'VERIFIED',
          isFullyVerified: true,
          locality: 'Hyderabad',
          experienceYears: 0,
          ratingAverage: 4.8,
          totalReviews: 12,
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
      hasMore: false,
    });

    vi.mocked(verificationRepository.getVerificationQueue).mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    } as any);

    vi.mocked(customerRepository.getCustomersPage).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
    });
  });

  describe('1. Sidebar Navigation Ordering & Contract', () => {
    it('places Directory strictly below Verification and above Workers Management in VE sidebar', () => {
      const nav = getAccessibleNavigation(VE_USER);
      const navIds = nav.map((item) => item.id);

      expect(navIds).toEqual(['dashboard', 'verification', 'directory', 'workers']);

      const verificationIdx = nav.findIndex((item) => item.id === 'verification');
      const directoryIdx = nav.findIndex((item) => item.id === 'directory');
      const workersIdx = nav.findIndex((item) => item.id === 'workers');

      expect(verificationIdx).toBe(1);
      expect(directoryIdx).toBe(2);
      expect(workersIdx).toBe(3);

      expect(directoryIdx).toBe(verificationIdx + 1);
      expect(workersIdx).toBe(directoryIdx + 1);

      expect(nav[directoryIdx].name).toBe('Directory');
      expect(nav[directoryIdx].path).toBe('/directory');
    });

    it('preserves existing navigation items for other roles without unintended alterations', () => {
      // Super Admin sees Directory among standard administrative modules
      const saNav = getAccessibleNavigation(SUPER_ADMIN_USER).map((m) => m.id);
      expect(saNav).toContain('directory');
      expect(saNav).toContain('workers');
      expect(saNav).toContain('customers');

      // Operations Admin retains dedicated Workers Management and Verification Management, without duplicate Directory
      const opsNav = getAccessibleNavigation(OPS_ADMIN_USER).map((m) => m.id);
      expect(opsNav).toContain('workers');
      expect(opsNav).toContain('verification');
      expect(opsNav).not.toContain('directory');

      // Support Executive retains Support, Directory, Workers Management, and Customer Management
      const seNav = getAccessibleNavigation(SUPPORT_EXEC_USER).map((m) => m.id);
      expect(seNav).toContain('support');
      expect(seNav).toContain('directory');
      expect(seNav).toContain('workers');
      expect(seNav).toContain('customers');
    });
  });

  describe('2. RBAC Route Accessibility Verification', () => {
    it('authorizes Verification Executive to access /directory via minimum necessary permission (worker.view)', () => {
      expect(isRouteAccessibleForUser('/directory', VE_USER)).toBe(true);
    });

    it('strictly denies Verification Executive access to administrative/mutation routes', () => {
      expect(isRouteAccessibleForUser('/configuration', VE_USER)).toBe(false);
      expect(isRouteAccessibleForUser('/payments', VE_USER)).toBe(false);
      expect(isRouteAccessibleForUser('/bookings', VE_USER)).toBe(false);
      expect(isRouteAccessibleForUser('/audit', VE_USER)).toBe(false);
    });
  });

  describe('3. Live Portal Rendering and Directory Interaction', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(VE_USER, 'test-ve-jwt-token');
    });

    it('renders Directory in sidebar between Verification and Workers Management links', async () => {
      renderShellWithRoutes('/directory');

      const links = screen.getAllByRole('link');
      const navLinkLabels = links
        .map((link) => link.textContent?.trim())
        .filter((text): text is string => Boolean(text && ['Dashboard', 'Verification', 'Directory', 'Workers Management'].includes(text)));

      expect(navLinkLabels).toEqual(['Dashboard', 'Verification', 'Directory', 'Workers Management']);

      const directoryLink = screen.getByRole('link', { name: /^Directory$/i });
      expect(directoryLink).toBeInTheDocument();
      expect(directoryLink).toHaveAttribute('href', '/directory');
    });

    it('successfully opens and displays Directory page for Verification Executive with verified workers roster', async () => {
      renderShellWithRoutes('/directory');

      expect(await screen.findByRole('heading', { name: /^Directory$/i })).toBeInTheDocument();
      expect(screen.getByText(/Authoritative unified directory of active domestic workforce professionals/i)).toBeInTheDocument();

      // Verified worker card / table row renders
      await waitFor(() => {
        expect(screen.getByText('Peekuuu Chickiiii')).toBeInTheDocument();
      });

      // Verification Executive sees workers tab
      expect(screen.getByRole('tab', { name: /Workers/i })).toBeInTheDocument();

      // Prohibited administrative mutations are absent
      expect(screen.queryByText(/Access Restricted/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Delete$/i })).not.toBeInTheDocument();
    });

    it('blocks direct navigation to prohibited modules and renders NoAccessView', async () => {
      renderShellWithRoutes('/configuration');

      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/configuration\.manage/i)).toBeInTheDocument();
    });
  });
});

