import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { AppShell } from '../app/layouts/AppShell';
import { DirectoryPage } from '../features/directory/presentation/DirectoryPage';
import { workerRepository } from '../features/workers/data/workerRepository';
import { customerRepository } from '../features/customers/data/customerRepository';
import { isRouteAccessibleForUser } from '../core/rbac/navigationRegistry';
import { Worker, WorkerPageResult } from '../features/workers/domain/types';
import { Customer, CustomerPageResult } from '../features/customers/domain/types';

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

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/directory']}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Unified Directory Module Specification for Super Admin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'super-admin-01',
        name: 'Master Super Admin',
        email: 'super@sevanest.in',
        role: 'SUPER_ADMIN',
        permissions: ['*'],
      },
      isAuthenticated: true,
    });
  });

  describe('1. Sidebar Navigation & Access Control', () => {
    it('renames sidebar item to "Directory" for Super Admin and does not show "Workers Directory"', () => {
      const queryClient = new QueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/directory']}>
            <AppShell />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByRole('link', { name: /^Directory$/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Workers Directory$/i })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Worker Management$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Customer Management$/i })).toBeInTheDocument();
    });

    it('provides "Workers Management" for Verification Executive and "Workers Directory" for Support Executive', () => {
      // Verification Executive
      useAuthStore.setState({
        user: {
          id: 'verif-01',
          name: 'Verif Exec',
          email: 'verif@sevanest.in',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [PERMISSIONS.WORKER_VIEW, PERMISSIONS.VERIFICATION_REVIEW],
        },
        isAuthenticated: true,
      });

      const queryClient = new QueryClient();
      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/workers']}>
            <AppShell />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByRole('link', { name: /^Workers Management$/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Workers Directory$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Directory$/i })).not.toBeInTheDocument();
      unmount();

      // Support Executive
      useAuthStore.setState({
        user: {
          id: 'supp-01',
          name: 'Supp Exec',
          email: 'supp@sevanest.in',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [PERMISSIONS.WORKER_VIEW, PERMISSIONS.SUPPORT_VIEW],
        },
        isAuthenticated: true,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/workers/directory']}>
            <AppShell />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByRole('link', { name: /^Workers Directory$/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Workers Management$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Directory$/i })).not.toBeInTheDocument();
    });

    it('enforces RBAC route boundaries so /directory is only accessible to SUPER_ADMIN', () => {
      const superAdminUser = {
        id: 'admin-1',
        name: 'Super',
        email: 'admin@sevanest.in',
        role: 'SUPER_ADMIN' as const,
        permissions: ['*'],
      };

      const opsAdminUser = {
        id: 'ops-1',
        name: 'Ops',
        email: 'ops@sevanest.in',
        role: 'OPERATIONS_ADMIN' as const,
        permissions: [PERMISSIONS.WORKER_VIEW, PERMISSIONS.WORKER_MANAGE],
      };

      const verifExecUser = {
        id: 'verif-1',
        name: 'Verif',
        email: 'verif@sevanest.in',
        role: 'VERIFICATION_EXECUTIVE' as const,
        permissions: [PERMISSIONS.WORKER_VIEW],
      };

      expect(isRouteAccessibleForUser('/directory', superAdminUser)).toBe(true);
      expect(isRouteAccessibleForUser('/directory', opsAdminUser)).toBe(false);
      expect(isRouteAccessibleForUser('/directory', verifExecUser)).toBe(false);
    });
  });

  describe('2. Unified Directory Tabs, Fields & Functionality', () => {
    it('renders both Workers and Customers tabs with correct backend fields and default Workers tab', async () => {
      const workerPageRes: WorkerPageResult = {
        items: [mockWorker],
        total: 1,
        page: 1,
        limit: 25,
        hasMore: false,
      };

      const customerPageRes: CustomerPageResult = {
        items: [mockCustomer],
        total: 1,
        page: 1,
        limit: 20,
        hasMore: false,
      };

      vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValue(workerPageRes);
      vi.spyOn(customerRepository, 'getCustomersPage').mockResolvedValue(customerPageRes);

      renderWithProviders(<DirectoryPage />);

      // Verify Page Header and Tab buttons
      expect(screen.getByRole('heading', { name: /^Directory$/i })).toBeInTheDocument();
      const workersTab = screen.getByRole('tab', { name: /Workers/i });
      const customersTab = screen.getByRole('tab', { name: /Customers/i });
      expect(workersTab).toBeInTheDocument();
      expect(customersTab).toBeInTheDocument();
      expect(workersTab).toHaveAttribute('aria-selected', 'true');

      // Verify Workers Table fields
      expect(await screen.findByText('W-DIR-001')).toBeInTheDocument();
      expect(screen.getByText('Sunita Sharma')).toBeInTheDocument();
      expect(screen.getByText('+91 98480 11223')).toBeInTheDocument();
      expect(screen.getByText('COOKING')).toBeInTheDocument();
      expect(screen.getByText('Banjara Hills')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
      expect(screen.getAllByText('Active')[0]).toBeInTheDocument();

      // Switch to Customers Tab
      fireEvent.click(customersTab);
      expect(customersTab).toHaveAttribute('aria-selected', 'true');

      // Verify Customers Table fields
      expect(await screen.findByText('C-DIR-101')).toBeInTheDocument();
      expect(screen.getByText('Rajiv Mehra')).toBeInTheDocument();
      expect(screen.getByText('+91 99881 22334')).toBeInTheDocument();
      expect(screen.getByText('Jubilee Hills')).toBeInTheDocument();
      // Registration Date in IST
      expect(screen.getByText(/15 Oct 2026/i)).toBeInTheDocument();
      expect(screen.getAllByText('Active')[0]).toBeInTheDocument();
    });

    it('supports search and filtering in both tabs', async () => {
      const getWorkersPageSpy = vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValue({
        items: [mockWorker],
        total: 1,
        page: 1,
        limit: 25,
        hasMore: false,
      });

      const getCustomersPageSpy = vi.spyOn(customerRepository, 'getCustomersPage').mockResolvedValue({
        items: [mockCustomer],
        total: 1,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      renderWithProviders(<DirectoryPage />);

      // Search in Workers tab
      const workerSearchInput = screen.getByPlaceholderText(/Search verified worker/i);
      fireEvent.change(workerSearchInput, { target: { value: 'Sunita' } });

      await waitFor(() => {
        expect(getWorkersPageSpy).toHaveBeenCalledWith(
          expect.objectContaining({ searchTerm: 'Sunita' }),
          1,
          25
        );
      });

      // Filter category in Workers tab
      const categorySelect = screen.getByLabelText(/Filter by skill category/i);
      fireEvent.change(categorySelect, { target: { value: 'COOKING' } });

      await waitFor(() => {
        expect(getWorkersPageSpy).toHaveBeenCalledWith(
          expect.objectContaining({ category: 'COOKING' }),
          1,
          25
        );
      });

      // Switch to Customers tab
      fireEvent.click(screen.getByRole('tab', { name: /Customers/i }));

      // Search in Customers tab
      const customerSearchInput = await screen.findByPlaceholderText(/Search customer by ID, name, or mobile/i);
      fireEvent.change(customerSearchInput, { target: { value: 'Rajiv' } });

      await waitFor(() => {
        expect(getCustomersPageSpy).toHaveBeenCalledWith(
          expect.objectContaining({ searchTerm: 'Rajiv' }),
          1,
          20
        );
      });

      // Filter status in Customers tab
      const statusSelect = screen.getByLabelText(/Filter by account status/i);
      fireEvent.change(statusSelect, { target: { value: 'ACTIVE' } });

      await waitFor(() => {
        expect(getCustomersPageSpy).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'ACTIVE' }),
          1,
          20
        );
      });
    });

    it('is strictly read-only with no add, edit, delete, approve, reject, activate or deactivate actions', async () => {
      vi.spyOn(workerRepository, 'getWorkersPage').mockResolvedValue({
        items: [mockWorker],
        total: 1,
        page: 1,
        limit: 25,
        hasMore: false,
      });

      vi.spyOn(customerRepository, 'getCustomersPage').mockResolvedValue({
        items: [mockCustomer],
        total: 1,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      renderWithProviders(<DirectoryPage />);

      // Wait for table to load
      expect(await screen.findByText('W-DIR-001')).toBeInTheDocument();

      // Confirm no mutating buttons on Workers tab
      expect(screen.queryByRole('button', { name: /add worker/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /suspend/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /activate/i })).not.toBeInTheDocument();

      // Only View Profile action exists
      expect(screen.getAllByRole('button', { name: /view profile/i })[0]).toBeInTheDocument();

      // Switch to Customers tab
      fireEvent.click(screen.getByRole('tab', { name: /Customers/i }));

      // Wait for customer table to load
      expect(await screen.findByText('C-DIR-101')).toBeInTheDocument();

      // Confirm no mutating buttons on Customers tab
      expect(screen.queryByRole('button', { name: /add customer/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /suspend/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /activate/i })).not.toBeInTheDocument();

      // Only View Profile action exists
      expect(screen.getAllByRole('button', { name: /view profile/i })[0]).toBeInTheDocument();
    });
  });
});
