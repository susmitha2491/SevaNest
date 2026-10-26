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

    it('renders Operations Command Console with operational KPIs', async () => {
      renderApp('/dashboard');

      expect(await screen.findByText('Operations Command Console')).toBeInTheDocument();
      expect(await screen.findByText('New Requests')).toBeInTheDocument();
      expect(await screen.findByText('Available Workforce')).toBeInTheDocument();
      expect(await screen.findByText('Replacement Queue')).toBeInTheDocument();
      expect(await screen.findByText('Open Disputes')).toBeInTheDocument();
      expect(await screen.findByText("Today's Trials")).toBeInTheDocument();
      expect(await screen.findByText('Pending Refunds')).toBeInTheDocument();
    });

    it('allows switching between operational workstation tabs (New Requests, Replacements, Trials, Refunds)', async () => {
      renderApp('/dashboard');

      expect(await screen.findByText(/New Booking Requests \(\d+\)/)).toBeInTheDocument();
      expect(await screen.findByText('Anand Sharma')).toBeInTheDocument();

      // Switch to Replacements tab
      const replacementTab = await screen.findByText(/Urgent Replacements \(\d+\)/);
      fireEvent.click(replacementTab);
      expect(await screen.findByText('Priya Reddy')).toBeInTheDocument();
      expect((await screen.findAllByText('Process Rematch')).length).toBeGreaterThan(0);

      // Switch to Refunds tab
      const refundTab = await screen.findByText(/Refund Authorizations \(\d+\)/);
      fireEvent.click(refundTab);
      expect((await screen.findAllByText('Authorize Refund')).length).toBeGreaterThan(0);
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
      expect(await screen.findByText('Pending Review')).toBeInTheDocument();
      expect(await screen.findByText('In-Progress Review')).toBeInTheDocument();
      expect(await screen.findByText('Re-Check Due')).toBeInTheDocument();
      expect(await screen.findByText('Decisions Today')).toBeInTheDocument();
      expect(await screen.findByText('Mandatory 6-Point Verification Directive')).toBeInTheDocument();
    });

    it('displays pending worker KYC queue sorted oldest-first and allows tab switching', async () => {
      renderApp('/dashboard');

      expect(await screen.findByText(/Pending Review \(Oldest First\) \(\d+\)/)).toBeInTheDocument();
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect((await screen.findAllByText('Review KYC')).length).toBeGreaterThan(0);

      // Switch to Re-Check Due tab
      const reCheckTab = await screen.findByText(/Re-Check Due \/ Expiring Certs \(\d+\)/);
      fireEvent.click(reCheckTab);
      expect(await screen.findByText('Devendra Singh')).toBeInTheDocument();
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

    it('renders Support Operations Console with SLA metrics and priority queues', async () => {
      renderApp('/dashboard');

      expect(await screen.findByText('Support Operations Console')).toBeInTheDocument();
      expect(await screen.findByText('Open Grievances')).toBeInTheDocument();
      expect(await screen.findByText('Assigned to Me')).toBeInTheDocument();
      expect(await screen.findByText('SLA At Risk')).toBeInTheDocument();
      expect(await screen.findByText('SLA Breached')).toBeInTheDocument();
      expect(await screen.findByText('Resolved Today')).toBeInTheDocument();
    });

    it('allows toggling between SLA At Risk, Unassigned, Active Cases, and Escalated tabs', async () => {
      renderApp('/dashboard');

      expect(await screen.findByText(/SLA At Risk & Breached \(\d+\)/)).toBeInTheDocument();
      expect(await screen.findByText('Unannounced Absence')).toBeInTheDocument();

      // Switch to Unassigned Intake Queue tab
      const unassignedTab = await screen.findByText(/Unassigned Intake Queue \(\d+\)/);
      fireEvent.click(unassignedTab);
      expect(await screen.findByText('Payout Clarification')).toBeInTheDocument();
      expect((await screen.findAllByText('Claim Ticket')).length).toBeGreaterThan(0);

      // Switch to Escalated tab
      const escalatedTab = await screen.findByText(/Escalated to Operations \(\d+\)/);
      fireEvent.click(escalatedTab);
      expect(await screen.findByText('Contract Termination')).toBeInTheDocument();
    });
  });
});
