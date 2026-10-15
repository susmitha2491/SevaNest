import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderApp(initialEntry = '/dashboard', state?: unknown) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const memoryRouter = createMemoryRouter(routes, {
    initialEntries: [{ pathname: initialEntry, state }],
  });

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={memoryRouter} />
      </QueryClientProvider>
    ),
    router: memoryRouter,
    queryClient,
  };
}

const VERIFICATION_EXECUTIVE_USER = {
  id: 'usr-verif-77',
  name: 'Pooja Nair',
  email: 'pooja.nair@sevanest.internal',
  role: 'VERIFICATION_EXECUTIVE' as const,
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.VERIFICATION_REVIEW,
    PERMISSIONS.VERIFICATION_DECIDE,
    PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
    PERMISSIONS.WORKER_VIEW,
  ],
};

describe('Verification Executive Workspace & Role-Specific Sidebar', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Role-Specific Sidebar Navigation Structure', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(VERIFICATION_EXECUTIVE_USER, 'token-ve-77');
    });

    it('organizes sidebar into the 5 required sections with all working destinations', async () => {
      renderApp('/dashboard');

      // Overview section
      expect(await screen.findByText('Overview', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();

      // Verification Operations section
      expect(screen.getByText('Verification Operations')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Verification Queue/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /My Reviews/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Rechecks & Expiry/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Corrections Required/i })).toBeInTheDocument();

      // Worker Records section
      expect(screen.getByText('Worker Records')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Workers Directory/i })).toBeInTheDocument();

      // Insights section
      expect(screen.getByText('Insights')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Review History/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Verification Insights/i })).toBeInTheDocument();

      // Account section
      expect(screen.getByText('Account')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /My Account/i })).toBeInTheDocument();
    });

    it('strictly hides unauthorized platform modules from the Verification Executive sidebar', async () => {
      renderApp('/dashboard');

      await screen.findByText('Trust & Verification Console', {}, { timeout: 4000 });

      // Unrelated modules must be hidden
      expect(screen.queryByRole('link', { name: /Customers/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Booking Pipeline/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Transactions & Fees/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Support Tickets/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Configuration Masters/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Audit Trail/i })).not.toBeInTheDocument();
    });
  });

  describe('2. Dedicated Workspace Views & Route Guarding', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(VERIFICATION_EXECUTIVE_USER, 'token-ve-77');
    });

    it('navigates to /verification/my-reviews and renders In-Progress workstation view with truthful assignment disclaimer', async () => {
      renderApp('/verification/my-reviews');

      expect(await screen.findByRole('heading', { name: /My Reviews Workstation/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/Reviewer Assignment & Claim Scope/i)).toBeInTheDocument();
      expect(screen.getByText(/My In-Progress Reviews/i)).toBeInTheDocument();
    });

    it('navigates to /verification/rechecks and renders Re-Check & Expiry Queue with re-verification notice', async () => {
      renderApp('/verification/rechecks');

      expect(await screen.findByRole('heading', { name: /Rechecks & Credential Expiry/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/Re-Verification & Credential Renewal/i)).toBeInTheDocument();
      expect(screen.getByText(/Re-Check & Expiry Queue/i)).toBeInTheDocument();
    });

    it('navigates to /verification/corrections and renders Correction Cases Queue', async () => {
      renderApp('/verification/corrections');

      expect(await screen.findByRole('heading', { name: /Corrections Required Workstation/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/Document Rectification Queue/i)).toBeInTheDocument();
      expect(screen.getByText(/Correction Cases Queue/i)).toBeInTheDocument();
    });

    it('navigates to /verification/history and renders Review History decision audit ledger', async () => {
      renderApp('/verification/history');

      expect(await screen.findByRole('heading', { name: /Authoritative Review History & Audit/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'All Decided' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Approved Only' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Rejected Only' })).toBeInTheDocument();

      // Check that completed decision records are rendered
      expect(await screen.findByText('Suresh Kumar', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getAllByText('Approved').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Anil Rao')).toBeInTheDocument();
      expect(screen.getAllByText('Rejected').length).toBeGreaterThanOrEqual(1);
    });

    it('navigates to /verification/insights and renders workload analytics with honest SLA telemetry notice', async () => {
      renderApp('/verification/insights');

      expect(await screen.findByRole('heading', { name: /Verification Workload & Performance Insights/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText('Queue Distribution by Status')).toBeInTheDocument();
      expect(screen.getByText('Workload by Service Category')).toBeInTheDocument();
      expect(screen.getByText('Frequent Rejection & Rectification Causes')).toBeInTheDocument();
      expect(screen.getByText('Operational Turnaround SLA Assessment')).toBeInTheDocument();
    });

    it('navigates to /account and displays authenticated staff profile, canonical role, and server permissions', async () => {
      renderApp('/account');

      expect(await screen.findByRole('heading', { name: /My Account & Staff Profile/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getAllByText('Pooja Nair').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('pooja.nair@sevanest.internal')).toBeInTheDocument();
      expect(screen.getByText(/Staff ID:\s*usr-verif-77/i)).toBeInTheDocument();
      expect(screen.getAllByText('Verification Executive').length).toBeGreaterThanOrEqual(1);

      // Verify granted permissions matrix
      expect(screen.getByText(PERMISSIONS.VERIFICATION_REVIEW)).toBeInTheDocument();
      expect(screen.getByText(PERMISSIONS.WORKER_VIEW)).toBeInTheDocument();
    });

    it('blocks unauthorized access to /verification/history when role lacks verification.review', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'usr-support-10',
          name: 'Amit Patel',
          email: 'amit@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.SUPPORT_VIEW],
        },
        'token-supp-10'
      );

      renderApp('/verification/history');

      expect(await screen.findByRole('heading', { name: /Access Restricted/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/verification.review/i)).toBeInTheDocument();
    });
  });

  describe('3. Verification Executive Dashboard Metrics & Navigation Links', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(VERIFICATION_EXECUTIVE_USER, 'token-ve-77');
    });

    it('renders real backend metrics and honestly displays unavailable SLA metrics', async () => {
      renderApp('/dashboard');

      expect(await screen.findByText('Trust & Verification Console', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
      expect(screen.getByText('In-Progress Review')).toBeInTheDocument();
      expect(screen.getByText('Completed Reviews')).toBeInTheDocument();
      expect(screen.getAllByText('Re-Check Due').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Corrections Required').length).toBeGreaterThan(0);

      // Honest SLA unavailable representation
      expect(screen.getByText('Overdue Reviews (SLA)')).toBeInTheDocument();
      expect(screen.getByText('SLA targets not returned by backend')).toBeInTheDocument();
      expect(screen.getByText('Avg Processing Time')).toBeInTheDocument();
      expect(screen.getByText('Duration telemetry pending backend contract')).toBeInTheDocument();
    });

    it('navigates to relevant workstation view when metric cards are clicked', async () => {
      const { router } = renderApp('/dashboard');

      await screen.findByText('Trust & Verification Console', {}, { timeout: 4000 });

      // Click Re-Check Due card
      const recheckCard = screen.getAllByText('Re-Check Due')[0].closest('.kpi-card');
      expect(recheckCard).toBeInTheDocument();
      fireEvent.click(recheckCard!);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification/rechecks');
      });
    });

    it('allows toggling between queue workstation tabs', async () => {
      renderApp('/dashboard');

      expect(await screen.findByText(/Pending Review \(Oldest First\) \(\d+\)/, {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText('Sunita Devi')).toBeInTheDocument();

      // Click In-Review Workstation tab
      const inReviewTab = screen.getByText(/In-Review Workstation \(\d+\)/);
      fireEvent.click(inReviewTab);
      expect(await screen.findByText('Ramesh Yadav', {}, { timeout: 4000 })).toBeInTheDocument();

      // Click Corrections Required tab
      const correctionsTab = screen.getByText(/Corrections Required \(\d+\)/);
      fireEvent.click(correctionsTab);
      expect(await screen.findByText('Anil Rao', {}, { timeout: 4000 })).toBeInTheDocument();
    });
  });

  describe('4. Preservation of Non-Verification Executive Navigation', () => {
    it('preserves standard navigation structure for Operations Admin without Verification Executive sections', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'usr-ops-01',
          name: 'Vikram Mehta',
          email: 'vikram@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.CUSTOMERS_VIEW,
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.BOOKINGS_VIEW,
          ],
        },
        'token-ops-01'
      );

      renderApp('/dashboard');

      expect(await screen.findByText('Operations', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Customers$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Workers$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Booking Pipeline/i })).toBeInTheDocument();

      // Verification Executive specific section titles should NOT be rendered
      expect(screen.queryByText('Verification Operations')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /My Reviews/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Rechecks & Expiry/i })).not.toBeInTheDocument();
    });
  });
});
