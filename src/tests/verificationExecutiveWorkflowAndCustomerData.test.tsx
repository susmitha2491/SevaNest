import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderApp(initialEntry = '/verification') {
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

const VERIFICATION_EXECUTIVE_WITH_CUSTOMER_VIEW = {
  id: 'adm-ve-101',
  name: 'Sunita Raman',
  email: 'sunita.raman@sevanest.internal',
  role: 'VERIFICATION_EXECUTIVE' as const,
  permissions: [
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.WORKER_VIEW,
    PERMISSIONS.VERIFICATION_REVIEW,
    PERMISSIONS.VERIFICATION_DECIDE,
    PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
  ],
};

const VERIFICATION_EXECUTIVE_WITHOUT_CUSTOMER_VIEW = {
  id: 'adm-ve-102',
  name: 'Rajesh Varma',
  email: 'rajesh.varma@sevanest.internal',
  role: 'VERIFICATION_EXECUTIVE' as const,
  permissions: [
    PERMISSIONS.WORKER_VIEW,
    PERMISSIONS.VERIFICATION_REVIEW,
    PERMISSIONS.VERIFICATION_DECIDE,
    PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
  ],
};

describe('SevaNest Admin Portal: Verification Executive Workflow & Customer Data', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Worker List & Verification Processing for Verification Executive', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(VERIFICATION_EXECUTIVE_WITH_CUSTOMER_VIEW, 'token-ve-cust');
    });

    it('renders the complete worker directory with all 6 operational verification tabs', async () => {
      renderApp('/workers');

      expect(await screen.findByRole('button', { name: /All Registered Workers/i }, { timeout: 10000 })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Active & Verified Roster/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Pending Verification/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /In Review Pipeline/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Rejected \/ Corrections/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Re-Check Due/i })).toBeInTheDocument();
    });

    it('displays actual backend-provided worker records and verification statuses', async () => {
      renderApp('/workers');

      // Workers from directory should be visible
      expect(await screen.findByText('Sunita Devi', {}, { timeout: 10000 })).toBeInTheDocument();
      expect(screen.getByText('W-10482')).toBeInTheDocument();
    });

    it('provides Approve or Reject action buttons in the workers roster', async () => {
      renderApp('/workers');

      // Verify the table renders action buttons (Approve and Reject)
      const approveButtons = await screen.findAllByRole('button', { name: /Approve/i });
      const rejectButtons = await screen.findAllByRole('button', { name: /Reject/i });
      expect(approveButtons.length).toBeGreaterThan(0);
      expect(rejectButtons.length).toBeGreaterThan(0);
    });

    it('filters workers by verification status without conflating commercial active status', async () => {
      renderApp('/workers');

      // Click "Active & Verified Roster (Matching Eligible)" tab
      const verifiedTab = await screen.findByText('Active & Verified Roster (Matching Eligible)');
      fireEvent.click(verifiedTab);

      // Sunita Devi is verified and should remain visible
      await waitFor(() => {
        expect(screen.getByText('Sunita Devi')).toBeInTheDocument();
      });
    });

    it('supports search by name, id, and locality', async () => {
      renderApp('/workers');

      const searchInput = await screen.findByPlaceholderText(/Search by worker name, ID, category, or locality/i);
      fireEvent.change(searchInput, { target: { value: 'Devi' } });

      await waitFor(() => {
        expect(screen.getByText('Sunita Devi')).toBeInTheDocument();
      });
    });
  });

  describe('2. Customer Directory & Customer Data Access for Verification Executive', () => {
    it('strictly excludes Customer Records and Customers Directory from Verification Executive sidebar even when customer.view is granted', async () => {
      useAuthStore.getState().setSession(VERIFICATION_EXECUTIVE_WITH_CUSTOMER_VIEW, 'token-ve-cust');

      renderApp('/verification');

      expect(await screen.findByText(/^Verification Queue$/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^All Applications$/i })).toBeInTheDocument();
      expect(screen.queryByText('Customer Records')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Customers/i })).not.toBeInTheDocument();
    });

    it('hides Customer Records and Worker Records from sidebar when customer.view is not granted', async () => {
      useAuthStore.getState().setSession(VERIFICATION_EXECUTIVE_WITHOUT_CUSTOMER_VIEW, 'token-ve-no-cust');

      renderApp('/verification');

      expect(await screen.findByText(/^Verification Queue$/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^All Applications$/i })).toBeInTheDocument();
      expect(screen.queryByText('Worker Records')).not.toBeInTheDocument();
      expect(screen.queryByText('Customer Records')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Customers/i })).not.toBeInTheDocument();
    });

    it('allows Verification Executive to view customer directory and renders backend customer records', async () => {
      useAuthStore.getState().setSession(VERIFICATION_EXECUTIVE_WITH_CUSTOMER_VIEW, 'token-ve-cust');

      renderApp('/customers');

      expect(await screen.findByText('Anand Sharma')).toBeInTheDocument();
      expect(screen.getByText('C-1092')).toBeInTheDocument();
      expect(screen.getByText('Priya Reddy')).toBeInTheDocument();
      expect(screen.getByText('C-2091')).toBeInTheDocument();
    });

    it('enforces read-only behavior on customer details: suspend and reactivate buttons are strictly hidden', async () => {
      useAuthStore.getState().setSession(VERIFICATION_EXECUTIVE_WITH_CUSTOMER_VIEW, 'token-ve-cust');

      renderApp('/customers');

      // Click "View Profile" on Anand Sharma
      const viewProfileButtons = await screen.findAllByRole('button', { name: /View Profile/i });
      fireEvent.click(viewProfileButtons[0]);

      // Anand Sharma customer modal should open
      await waitFor(() => {
        expect(screen.getByText('Anand Sharma')).toBeInTheDocument();
      });

      // Actions requiring customers.manage_status MUST NOT be rendered
      expect(screen.queryByRole('button', { name: /Suspend Customer Account/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Restore \/ Reactivate Account/i })).not.toBeInTheDocument();
    });

    it('blocks direct navigation to /customers when customer.view is absent', async () => {
      useAuthStore.getState().setSession(VERIFICATION_EXECUTIVE_WITHOUT_CUSTOMER_VIEW, 'token-ve-no-cust');

      renderApp('/customers');

      expect(await screen.findByText('Access Restricted')).toBeInTheDocument();
    });
  });

  describe('3. Worker Detail Modal & Decision Guarding', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(VERIFICATION_EXECUTIVE_WITH_CUSTOMER_VIEW, 'token-ve-cust');
    });

    it('opens worker detail modal without fabricated doc number placeholder strings', async () => {
      renderApp('/workers?workerId=W-10482');

      // Worker details modal should open for Sunita Devi
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      // Ensure no fabricated placeholder is displayed
      expect(screen.queryByText(/XXXX-XXXX-VALID/)).not.toBeInTheDocument();
    });

    it('provides Inspect in Verification Queue on matching eligible banner', async () => {
      renderApp('/workers?workerId=W-10482');

      const queueLink = await screen.findByRole('button', { name: /Inspect in Verification Queue/i });
      expect(queueLink).toBeInTheDocument();
    });
  });
});
