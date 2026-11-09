import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { AppShell } from '../app/layouts/AppShell';
import { ProtectedRoute } from '../app/router/ProtectedRoute';
import { VerificationQueuePage } from '../features/verification/presentation/VerificationQueuePage';
import { verificationRepository } from '../features/verification/data/verificationRepository';

function renderWithProviders(_ui: React.ReactElement, initialRoute = '/') {
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
            <Route path="dashboard" element={<div>Dashboard Content</div>} />
            <Route
              path="verification"
              element={
                <ProtectedRoute permission={PERMISSIONS.VERIFICATION_REVIEW}>
                  <VerificationQueuePage />
                </ProtectedRoute>
              }
            />
            <Route path="customers" element={<div>Customers Content</div>} />
            <Route path="workers" element={<div>Workers Content</div>} />
            <Route path="bookings" element={<div>Bookings Content</div>} />
            <Route path="payments" element={<div>Payments Content</div>} />
            <Route path="support" element={<div>Support Content</div>} />
            <Route path="reports" element={<div>Reports Content</div>} />
            <Route path="configuration" element={<div>Configuration Content</div>} />
            <Route path="audit" element={<div>Audit Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Server-issued permission sets from backend GET /api/v1/admin/roles
const SUPER_ADMIN_PERMISSIONS = ['*'];

const OPERATIONS_ADMIN_ACTUAL_PERMISSIONS = [
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

const VERIFICATION_EXECUTIVE_ACTUAL_PERMISSIONS = [
  'alert.view',
  'verification.decide',
  'verification.document.view',
  'verification.review',
  'worker.view',
];

const SUPPORT_EXECUTIVE_ACTUAL_PERMISSIONS = [
  'booking.view',
  'customer.view',
  'rating.view',
  'support.manage',
  'support.view',
  'worker.view',
];

describe('Verification Management Visibility and Route Access Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession(false);
  });

  describe('1. Operations Admin (Unauthorized for Verification Queue)', () => {
    it('hides Verification Management from sidebar navigation for Operations Admin', () => {
      useAuthStore.getState().setSession(
        {
          id: 'ops-user-1',
          name: 'Pooja Hegde',
          email: 'operations.manager@sevanest.example.com',
          role: 'OPERATIONS_ADMIN',
          permissions: OPERATIONS_ADMIN_ACTUAL_PERMISSIONS,
        },
        'token-ops-1'
      );

      renderWithProviders(<AppShell />, '/dashboard');

      // Primary authorized operational modules are rendered
      expect(screen.getByText('Customer Management')).toBeInTheDocument();
      expect(screen.getByText('Worker Management')).toBeInTheDocument();
      expect(screen.getByText('Booking Management')).toBeInTheDocument();
      expect(screen.getByText('Payments Management')).toBeInTheDocument();

      // Verification Management is strictly HIDDEN
      expect(screen.queryByText('Verification Management')).not.toBeInTheDocument();
      expect(screen.queryByText(/^Verification$/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Verification/i })).not.toBeInTheDocument();
    });

    it('displays standard access-denied state when Operations Admin navigates directly to /verification', async () => {
      const getQueueSpy = vi.spyOn(verificationRepository, 'getVerificationQueue');

      useAuthStore.getState().setSession(
        {
          id: 'ops-user-1',
          name: 'Pooja Hegde',
          email: 'operations.manager@sevanest.example.com',
          role: 'OPERATIONS_ADMIN',
          permissions: OPERATIONS_ADMIN_ACTUAL_PERMISSIONS,
        },
        'token-ops-1'
      );

      renderWithProviders(<AppShell />, '/verification');

      // Does NOT redirect into an unrelated module; renders standard Access Restricted view
      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/Required permission: verification\.review/i)).toBeInTheDocument();
      expect(screen.queryByText('Worker Verification & Trust Operations')).not.toBeInTheDocument();

      // Backend API call is NOT made
      expect(getQueueSpy).not.toHaveBeenCalled();
    });

    it('does not make verification queue API calls when VerificationQueuePage is rendered directly for unauthorized user', async () => {
      const getQueueSpy = vi.spyOn(verificationRepository, 'getVerificationQueue');

      useAuthStore.getState().setSession(
        {
          id: 'ops-user-1',
          name: 'Pooja Hegde',
          email: 'operations.manager@sevanest.example.com',
          role: 'OPERATIONS_ADMIN',
          permissions: OPERATIONS_ADMIN_ACTUAL_PERMISSIONS,
        },
        'token-ops-1'
      );

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/verification']}>
            <VerificationQueuePage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/Required permission: verification\.review/i)).toBeInTheDocument();
      expect(getQueueSpy).not.toHaveBeenCalled();
    });
  });

  describe('2. Verification Executive (Authorized for Verification Queue)', () => {
    it('displays Verification in sidebar navigation for Verification Executive', () => {
      useAuthStore.getState().setSession(
        {
          id: 'verif-user-1',
          name: 'Ravi Teja',
          email: 'verification.executive@sevanest.example.com',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: VERIFICATION_EXECUTIVE_ACTUAL_PERMISSIONS,
        },
        'token-ve-1'
      );

      renderWithProviders(<AppShell />, '/verification');

      expect(screen.getByRole('link', { name: /Verification/i })).toBeInTheDocument();
    });

    it('allows direct route access to /verification and loads verification queue for Verification Executive', async () => {
      vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValueOnce({
        items: [
          {
            id: 'VQ-001',
            workerId: 'W-001',
            workerName: 'Sunita Devi',
            photoUrl: '',
            category: 'House Maid',
            locality: 'Kondapur',
            phoneMasked: '+91 98*** ***12',
            experienceYears: 5,
            status: 'PENDING_REVIEW' as const,
            submissionTime: '2026-10-20T10:00:00Z',
            preCheckOtpVerified: true,
            checks: {},
            assignedReviewer: undefined,
            reviewerUserId: undefined,
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      });

      useAuthStore.getState().setSession(
        {
          id: 'verif-user-1',
          name: 'Ravi Teja',
          email: 'verification.executive@sevanest.example.com',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: VERIFICATION_EXECUTIVE_ACTUAL_PERMISSIONS,
        },
        'token-ve-1'
      );

      renderWithProviders(<AppShell />, '/verification');

      expect(await screen.findByText('Worker Verification & Trust Operations')).toBeInTheDocument();
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
    });
  });

  describe('3. Super Admin (Authorized via Wildcard / Full Permissions)', () => {
    it('displays Verification in sidebar navigation for Super Admin', () => {
      useAuthStore.getState().setSession(
        {
          id: 'super-user-1',
          name: 'Super Admin',
          email: 'sevanest@admin.in',
          role: 'SUPER_ADMIN',
          permissions: SUPER_ADMIN_PERMISSIONS,
        },
        'token-super-1'
      );

      renderWithProviders(<AppShell />, '/dashboard');

      expect(screen.getByRole('link', { name: /Verification/i })).toBeInTheDocument();
    });

    it('allows Super Admin to access /verification directly', async () => {
      vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValueOnce({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      useAuthStore.getState().setSession(
        {
          id: 'super-user-1',
          name: 'Super Admin',
          email: 'sevanest@admin.in',
          role: 'SUPER_ADMIN',
          permissions: SUPER_ADMIN_PERMISSIONS,
        },
        'token-super-1'
      );

      renderWithProviders(<AppShell />, '/verification');

      expect(await screen.findByText('Worker Verification & Trust Operations')).toBeInTheDocument();
    });
  });

  describe('4. Support Executive (Unauthorized for Verification Queue)', () => {
    it('hides Verification from sidebar navigation for Support Executive', () => {
      useAuthStore.getState().setSession(
        {
          id: 'supp-user-1',
          name: 'Kavitha Reddy',
          email: 'support.executive@sevanest.example.com',
          role: 'SUPPORT_EXECUTIVE',
          permissions: SUPPORT_EXECUTIVE_ACTUAL_PERMISSIONS,
        },
        'token-supp-1'
      );

      renderWithProviders(<AppShell />, '/support');

      expect(screen.queryByRole('link', { name: /Verification/i })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Support$/i })).toBeInTheDocument();
    });

    it('displays standard access-denied state when Support Executive navigates directly to /verification', async () => {
      const getQueueSpy = vi.spyOn(verificationRepository, 'getVerificationQueue');

      useAuthStore.getState().setSession(
        {
          id: 'supp-user-1',
          name: 'Kavitha Reddy',
          email: 'support.executive@sevanest.example.com',
          role: 'SUPPORT_EXECUTIVE',
          permissions: SUPPORT_EXECUTIVE_ACTUAL_PERMISSIONS,
        },
        'token-supp-1'
      );

      renderWithProviders(<AppShell />, '/verification');

      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/Required permission: verification\.review/i)).toBeInTheDocument();
      expect(getQueueSpy).not.toHaveBeenCalled();
    });
  });

  describe('5. Granular Permission Governance (Zero Role-Name Hardcoding)', () => {
    it('authorizes Verification module when a custom role is granted verification.review', async () => {
      vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValueOnce({
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      });

      // An Operations Admin dynamically given verification.review by Super Admin
      useAuthStore.getState().setSession(
        {
          id: 'custom-ops-elevated',
          name: 'Elevated Ops Lead',
          email: 'elevated@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [...OPERATIONS_ADMIN_ACTUAL_PERMISSIONS, 'verification.review'],
        },
        'token-elevated'
      );

      renderWithProviders(<AppShell />, '/verification');

      // Renders verification workstation because permission exists
      expect(await screen.findByText('Worker Verification & Trust Operations')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Verification/i })).toBeInTheDocument();
    });

    it('denies Verification module if a Verification Executive is stripped of verification.review', async () => {
      const getQueueSpy = vi.spyOn(verificationRepository, 'getVerificationQueue');

      // A Verification Executive with verification.review revoked
      useAuthStore.getState().setSession(
        {
          id: 've-stripped',
          name: 'Restricted VE',
          email: 'restricted.ve@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: ['worker.view'], // stripped of verification.review
        },
        'token-stripped'
      );

      renderWithProviders(<AppShell />, '/verification');

      // Blocked purely by permission check
      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Verification/i })).not.toBeInTheDocument();
      expect(getQueueSpy).not.toHaveBeenCalled();
    });
  });
});
