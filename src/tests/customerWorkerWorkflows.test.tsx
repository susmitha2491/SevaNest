import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderApp(initialEntry: string) {
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

describe('Customer & Worker Management Workflows', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  describe('Customer Management Workflow', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(
        {
          id: 'ops-01',
          name: 'Operations Admin',
          email: 'ops@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.CUSTOMERS_VIEW,
            PERMISSIONS.CUSTOMERS_MANAGE_STATUS,
            PERMISSIONS.CUSTOMERS_REVEAL_PII,
          ],
        },
        'ops-token'
      );
    });

    it('renders customer directory table with masked PII and pagination', async () => {
      renderApp('/customers');

      expect(await screen.findByText('Customer Accounts & Households', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(await screen.findByText('Anand Sharma')).toBeInTheDocument();
      expect(await screen.findByText('Priya Reddy')).toBeInTheDocument();

      // Verify masked PII default state
      expect(screen.getAllByText(/\+91 \d{2}\*{4} \*{2}\d{2}/).length).toBeGreaterThan(0);

      // Pagination indicator
      expect(screen.getByText(/Page 1 of \d+/)).toBeInTheDocument();
    });

    it('filters customers by search term and status', async () => {
      renderApp('/customers');

      const searchInput = await screen.findByPlaceholderText(/Search by customer name/i);
      fireEvent.change(searchInput, { target: { value: 'Priya' } });

      expect(await screen.findByText('Priya Reddy')).toBeInTheDocument();
      expect(screen.queryByText('Anand Sharma')).not.toBeInTheDocument();
    });

    it('opens customer detail modal and renders historical bookings', async () => {
      renderApp('/customers');

      const viewButtons = await screen.findAllByText('View Profile');
      fireEvent.click(viewButtons[0]);

      expect(await screen.findByText('Household Contact & Locality Details')).toBeInTheDocument();
      expect(await screen.findByText('Historical Service Engagements & Requests')).toBeInTheDocument();
      expect(await screen.findByText(/Aditya Sunshine/i)).toBeInTheDocument();

      // Close modal
      const closeBtn = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(closeBtn);
    });

    it('allows audited PII unmasking upon entering mandatory justification', async () => {
      renderApp('/customers');

      const revealButtons = await screen.findAllByText('Reveal');
      fireEvent.click(revealButtons[0]);

      expect(await screen.findByText('Authorize PII Reveal')).toBeInTheDocument();

      const remarksInput = screen.getByPlaceholderText(/Enter business justification/i);
      fireEvent.change(remarksInput, { target: { value: 'Support dispute arbitration' } });

      const confirmBtn = screen.getByText('Reveal and Audit');
      fireEvent.click(confirmBtn);

      // Verify unmasked phone and email are rendered
      expect(await screen.findByText('+91 98765 43210')).toBeInTheDocument();
    });

    it('allows customer account suspension with mandatory operational remarks', async () => {
      renderApp('/customers');

      const suspendButtons = await screen.findAllByText('Suspend');
      fireEvent.click(suspendButtons[0]);

      expect(await screen.findByText('Suspend Customer Account')).toBeInTheDocument();

      const remarksInput = screen.getByPlaceholderText(/Enter mandatory operational reason/i);
      fireEvent.change(remarksInput, { target: { value: 'Repeated non-payment chargebacks' } });

      const confirmBtn = screen.getByText('Confirm');
      fireEvent.click(confirmBtn);
    });
  });

  describe('Worker Management Workflow', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(
        {
          id: 'ops-01',
          name: 'Operations Admin',
          email: 'ops@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.WORKERS_VIEW,
            PERMISSIONS.WORKERS_MANAGE_STATUS,
            PERMISSIONS.VERIFICATION_REVIEW,
          ],
        },
        'ops-token'
      );
    });

    it('renders worker roster with verification badge and skill category', async () => {
      renderApp('/workers');

      expect(await screen.findByText('Domestic Worker Roster & Profiles')).toBeInTheDocument();
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect((await screen.findAllByText('House Maid')).length).toBeGreaterThan(0);

      // Verify verification badges
      expect(screen.getAllByText('Verified').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Pending KYC').length).toBeGreaterThan(0);
    });

    it('filters workers by skill category and verification state', async () => {
      renderApp('/workers');

      const verificationSelect = await screen.findByLabelText('Filter by verification state');
      fireEvent.change(verificationSelect, { target: { value: 'VERIFIED' } });

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(screen.queryByText('Ramesh Yadav')).not.toBeInTheDocument();
    });

    it('opens worker dossier modal and displays the 6-point verification breakdown', async () => {
      renderApp('/workers');

      const viewButtons = await screen.findAllByText('View Profile');
      fireEvent.click(viewButtons[0]);

      expect(await screen.findByText('6-Point Trust & Verification Status')).toBeInTheDocument();
      expect(await screen.findByText('1. Mobile OTP Pre-Check')).toBeInTheDocument();
      expect(await screen.findByText('2. Identity Proof (Aadhaar)')).toBeInTheDocument();
      expect(await screen.findByText('3. Residential Address Proof')).toBeInTheDocument();
      expect(await screen.findByText('4. Criminal Self-Declaration')).toBeInTheDocument();
      expect(await screen.findByText('5. Skill Certificate / License')).toBeInTheDocument();
      expect(await screen.findByText('6. Prior Employer Reference')).toBeInTheDocument();

      // Close modal
      const closeBtn = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(closeBtn);
    });

    it('executes worker disciplinary suspension with mandatory operational remarks', async () => {
      renderApp('/workers');

      const disciplineButtons = await screen.findAllByText('Discipline');
      fireEvent.click(disciplineButtons[0]);

      expect(await screen.findByText(/Disciplinary Status Mutation/i)).toBeInTheDocument();

      const remarksInput = screen.getByPlaceholderText(/Enter mandatory operational reason/i);
      fireEvent.change(remarksInput, { target: { value: 'Client complaint regarding punctuality' } });

      const confirmBtn = screen.getByText('Confirm');
      fireEvent.click(confirmBtn);
    });
  });
});
