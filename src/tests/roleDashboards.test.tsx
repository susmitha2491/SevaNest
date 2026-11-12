import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderApp(initialEntry = '/dashboard') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const memoryRouter = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={memoryRouter} />
    </QueryClientProvider>
  );
}

describe('Role-Based Operational Dashboards', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  describe('Super Admin Dashboard', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(
        {
          id: 'super-01',
          name: 'Vikram Mehta (Super Admin)',
          email: 'vikram@sevanest.internal',
          role: 'SUPER_ADMIN',
          permissions: ['*'],
        },
        'super-token'
      );
    });

    it('renders the Executive Console with 8 platform-level KPI cards', async () => {
      renderApp('/dashboard');

      expect(await screen.findByText('Super Admin Executive Console', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(await screen.findByText('Gross Bookings')).toBeInTheDocument();
      expect(await screen.findByText('Active Workforce')).toBeInTheDocument();
      expect(await screen.findByText('Verification Queue')).toBeInTheDocument();
      expect(await screen.findByText('Active Grievances')).toBeInTheDocument();
      expect(await screen.findByText('Replacement Volume')).toBeInTheDocument();
      expect(await screen.findByText('Gross Collections')).toBeInTheDocument();
      expect(await screen.findByText('Scheduled Trials')).toBeInTheDocument();
      expect(await screen.findByText('Police Verif Due')).toBeInTheDocument();
    });

    it('renders system operational queue summaries and governance shortcuts', async () => {
      renderApp('/dashboard');

      expect(await screen.findByText('System Operational Queues')).toBeInTheDocument();
      expect(await screen.findByText('Worker Verification Backlog (42 pending)')).toBeInTheDocument();
      expect(await screen.findByText('Governance Shortcuts')).toBeInTheDocument();
      expect((await screen.findAllByText(/Pricing & Fee Schedule/i)).length).toBeGreaterThan(0);
      expect((await screen.findAllByText(/Authoritative Audit Logs/i)).length).toBeGreaterThan(0);
    });
  });

  describe('Operations Admin Dashboard', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(
        {
          id: 'ops-01',
          name: 'Sneha Rao (Ops Admin)',
          email: 'sneha@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.BOOKINGS_VIEW,
            PERMISSIONS.BOOKINGS_MANAGE,
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.CUSTOMERS_VIEW,
            PERMISSIONS.PAYMENTS_VIEW,
            PERMISSIONS.REFUNDS_MANAGE,
          ],
        },
        'ops-token'
      );
    });

    it('renders Operations Command Console with essential operational KPIs and visualizations', async () => {
      renderApp('/dashboard');

      expect(await screen.findByRole('heading', { name: 'Operations Command Console' })).toBeInTheDocument();
      expect(await screen.findAllByText('Total Bookings')).not.toHaveLength(0);
      expect(await screen.findByText('Verified & Active Workers')).toBeInTheDocument();
      expect(await screen.findByText('Replacement Requests')).toBeInTheDocument();
      expect(await screen.findByText('Active Complaints')).toBeInTheDocument();
      expect(await screen.findByText('Open Alerts')).toBeInTheDocument();
      expect(await screen.findByText('Collections (MTD)')).toBeInTheDocument();

      expect(screen.getByRole('heading', { name: /Booking Status Distribution/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Alerts & Complaints Breakdown/i })).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByText('Pending Refunds')).not.toBeInTheDocument();
    });

    it('navigates directly to Bookings from dashboard chart action while respecting support permission gate', async () => {
      renderApp('/dashboard');

      const openBookingsBtn = await screen.findByRole('button', { name: /Open Bookings/i });
      // Caller permissions in this suite omit SUPPORT_VIEW, so Open Support trigger stays gated
      expect(screen.queryByRole('button', { name: /Open Support/i })).not.toBeInTheDocument();
      fireEvent.click(openBookingsBtn);

      expect(await screen.findByRole('heading', { name: /Booking/i })).toBeInTheDocument();
    });
  });

  describe('Verification Executive Dashboard', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(
        {
          id: 'verif-01',
          name: 'Pooja Nair (Verification Exec)',
          email: 'pooja@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.WORKERS_VIEW,
          ],
        },
        'verif-token'
      );
    });

    it('renders Trust & Verification Console and 6-Point Verification Directive', async () => {
      renderApp('/dashboard');

      expect(await screen.findByText('Trust & Verification Console')).toBeInTheDocument();
      expect(await screen.findByText('Pending Applications')).toBeInTheDocument();
      expect(await screen.findByText('Pending KYC / Submitted')).toBeInTheDocument();
      expect((await screen.findAllByText('In Review')).length).toBeGreaterThan(0);
      expect((await screen.findAllByText('Corrections Required')).length).toBeGreaterThan(0);
      expect((await screen.findAllByText('Re-check Due')).length).toBeGreaterThan(0);
      expect(await screen.findByText('Mandatory 6-Point Verification Directive')).toBeInTheDocument();
    });

    it('renders the approved 5 sections: Overview, Status Distribution, Recent Applications, SLA Overview, and Quick Navigation', async () => {
      renderApp('/dashboard');

      // Section A: Overview Cards
      expect(await screen.findByText('Pending Applications')).toBeInTheDocument();
      expect((await screen.findAllByText('Corrections Required')).length).toBeGreaterThan(0);
      expect((await screen.findAllByText('Re-check Due')).length).toBeGreaterThan(0);

      // Section B: Application Status Distribution
      expect(await screen.findByText('Application Status Distribution')).toBeInTheDocument();
      expect(await screen.findByText(/Breakdown of applications across verification lifecycle stages/i)).toBeInTheDocument();

      // Section C: Recent Applications Requiring Attention
      expect(await screen.findByText('Recent Applications Requiring Attention')).toBeInTheDocument();
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect((await screen.findAllByText('Review KYC')).length).toBeGreaterThan(0);

      // Section D: Verification SLA Overview
      expect(await screen.findByText('Verification SLA Overview')).toBeInTheDocument();
      expect((await screen.findAllByText('Within SLA')).length).toBeGreaterThan(0);
      expect((await screen.findAllByText('Approaching SLA')).length).toBeGreaterThan(0);
      expect((await screen.findAllByText('SLA Exceeded')).length).toBeGreaterThan(0);

      // Section E: Quick Navigation
      const navBtn = await screen.findByRole('button', { name: /Open Verification Queue/i });
      expect(navBtn).toBeInTheDocument();
    });
  });

  describe('Support Executive Dashboard', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(
        {
          id: 'supp-01',
          name: 'Amit Patel (Support Exec)',
          email: 'amit@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.SUPPORT_VIEW,
            PERMISSIONS.SUPPORT_MANAGE,
            PERMISSIONS.CUSTOMER_VIEW,
          ],
        },
        'supp-token'
      );
    });

    it('renders Support Analytics Dashboard with 6 KPI cards, distribution & SLA charts, and activity feed', async () => {
      renderApp('/dashboard');

      expect(await screen.findByRole('heading', { name: /^Dashboard$/i })).toBeInTheDocument();
      expect(screen.getByText(/Support operations overview and ticket monitoring\./i)).toBeInTheDocument();
      expect(screen.getAllByText('Total Tickets').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Open Tickets')).toBeInTheDocument();
      expect(screen.getAllByText('In Investigation').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Escalated Tickets')).toBeInTheDocument();
      expect(screen.getByText('Resolved Tickets')).toBeInTheDocument();
      expect(screen.getByText('SLA At Risk / Breached')).toBeInTheDocument();

      expect(screen.getByRole('heading', { name: /Ticket Status Distribution/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /SLA Monitoring/i })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Ticket Trends/i })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Recent Support Activity/i })).toBeInTheDocument();
    });

    it('renders SLA tier bars and omits duplicate ticket table from the Dashboard', async () => {
      renderApp('/dashboard');

      expect(await screen.findByRole('heading', { name: /SLA Monitoring/i })).toBeInTheDocument();
      expect(screen.getByText('Normal')).toBeInTheDocument();
      expect(screen.getByText('At Risk')).toBeInTheDocument();
      expect(screen.getByText('Breached')).toBeInTheDocument();

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Unassigned Intake Queue/i })).not.toBeInTheDocument();
    });
  });
});
