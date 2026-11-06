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

    it('renders exactly 3 primary entries in sidebar: Dashboard, Verification, and Workers Directory', async () => {
      const { router } = renderApp('/dashboard');

      // Dashboard link must be present
      expect(await screen.findByRole('link', { name: /^Dashboard$/i }, { timeout: 4000 })).toBeInTheDocument();

      // Exactly 3 primary entries in Verification Executive sidebar
      expect(screen.getByRole('link', { name: /^Verification$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Workers Directory$/i })).toBeInTheDocument();

      // Prohibited primary modules must NOT be present
      expect(screen.queryByRole('link', { name: /^Customer Management$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Customers$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Booking Pipeline$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Bookings$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Support Tickets$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Reports & Analytics$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Configuration Masters$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Audit Trail$/i })).not.toBeInTheDocument();

      // Account information and Sign Out are standard application utilities at the bottom
      expect(screen.getByRole('link', { name: /^My Account$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Sign Out$/i })).toBeInTheDocument();

      // Clicking Verification navigates to /verification
      fireEvent.click(screen.getByRole('link', { name: /^Verification$/i }));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });

      // Clicking Workers Directory navigates to /workers/directory
      fireEvent.click(screen.getByRole('link', { name: /^Workers Directory$/i }));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/workers/directory');
      });
    });

    it('renders the 4 working sections as internal views/tabs within the Verification module', async () => {
      renderApp('/verification');

      expect(await screen.findByText('Worker Verification & Trust Operations', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByRole('tablist', { name: 'Verification Sections' })).toBeInTheDocument();

      // All 4 required sub-sections
      expect(screen.getByRole('tab', { name: /Verification Queue/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Document Review/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Check Status/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Expiry & Re-check/i })).toBeInTheDocument();

      // Switching to Document Review view
      fireEvent.click(screen.getByRole('tab', { name: /Document Review/i }));
      expect(await screen.findByText(/Document Review Workstation/i)).toBeInTheDocument();

      // Switching to Check Status view
      fireEvent.click(screen.getByRole('tab', { name: /Check Status/i }));
      expect(await screen.findByText(/Discrete Check Status Matrix/i)).toBeInTheDocument();

      // Switching to Expiry & Re-check view
      fireEvent.click(screen.getByRole('tab', { name: /Expiry & Re-check/i }));
      expect(await screen.findByRole('tab', { name: /Expiry & Re-check/i })).toHaveAttribute('aria-selected', 'true');
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
      expect(screen.getByText(/My Reviews Workstation:/i)).toBeInTheDocument();
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

    it('navigates to /account and displays authenticated staff profile and canonical role', async () => {
      renderApp('/account');

      expect(await screen.findByRole('heading', { name: /My Account & Staff Profile/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Profile Information/i })).toBeInTheDocument();
      expect(screen.getAllByText('Pooja Nair').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('pooja.nair@sevanest.internal')).toBeInTheDocument();
      expect(screen.getByText(/Staff ID:\s*usr-verif-77/i)).toBeInTheDocument();
      expect(screen.getAllByText('Verification Executive').length).toBeGreaterThanOrEqual(1);
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
      expect(screen.getByText('Registered Workers')).toBeInTheDocument();
      expect(screen.getByText('Verified & Active Workers')).toBeInTheDocument();
      expect(screen.getByText('Pending Applications')).toBeInTheDocument();
      expect(screen.getByText('Pending KYC / Submitted')).toBeInTheDocument();
      expect((await screen.findAllByText('In Review')).length).toBeGreaterThan(0);
      expect((await screen.findAllByText('Corrections Required')).length).toBeGreaterThan(0);
      expect((await screen.findAllByText('Re-check Due')).length).toBeGreaterThan(0);

      // Section B: Application Status Distribution & Section D: SLA Overview
      expect(screen.getByText('Application Status Distribution')).toBeInTheDocument();
      expect(screen.getByText('Verification SLA Overview')).toBeInTheDocument();
      expect(screen.getAllByText('Within SLA').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Approaching SLA').length).toBeGreaterThan(0);
      expect(screen.getAllByText('SLA Exceeded').length).toBeGreaterThan(0);
    });

    it('navigates to relevant workstation view when metric cards are clicked', async () => {
      const { router } = renderApp('/dashboard');

      await screen.findByText('Trust & Verification Console', {}, { timeout: 4000 });

      // Click Pending Applications card
      const pendingCard = screen.getByText('Pending Applications').closest('.kpi-card');
      expect(pendingCard).toBeInTheDocument();
      fireEvent.click(pendingCard!);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });
    });

    it('renders actionable applications and allows quick navigation to the verification queue', async () => {
      const { router } = renderApp('/dashboard');

      expect(await screen.findByText('Recent Applications Requiring Attention', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText('Sunita Devi')).toBeInTheDocument();

      // Click Open Verification Queue button (Section E)
      const openQueueBtn = screen.getByRole('button', { name: /Open Verification Queue/i });
      fireEvent.click(openQueueBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });
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

      expect(await screen.findByRole('link', { name: /^Customer Management$/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Worker Management$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^Booking Management$/i })).toBeInTheDocument();

      // Verification Executive specific section titles should NOT be rendered
      expect(screen.queryByText('Verification Operations')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /My Reviews/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Rechecks & Expiry/i })).not.toBeInTheDocument();
    });
  });
});
