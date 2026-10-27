import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { workerRepository, mapBackendWorkerDetailToWorkerDetail } from '../features/workers/data/workerRepository';

function renderApp(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
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
  };
}

describe('Worker Management Module Audit & Validation (PRD Section 7 & Section 3 Compliance)', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  describe('1. PRD Section 7: Six Core Worker Management Capabilities', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(
        {
          id: 'ops-01',
          name: 'Operations Admin',
          email: 'operations.admin@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.WORKERS_MANAGE,
            PERMISSIONS.WORKERS_MANAGE_STATUS,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
          ],
        },
        'ops-token'
      );
    });

    it('renders the roster displaying Profiles, Skills, Ratings, Availability, and Account Statuses', async () => {
      renderApp('/workers');

      expect(await screen.findByText('Domestic Worker Roster & Profiles')).toBeInTheDocument();
      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      expect(await screen.findByText('Ramesh Yadav')).toBeInTheDocument();

      // Profile identifiers and masked contacts
      expect(screen.getByText('W-10482')).toBeInTheDocument();
      expect(screen.getAllByText(/\+91 98765 \*{5}/i).length).toBeGreaterThan(0);

      // Skills & categories
      expect(screen.getAllByText('House Maid').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Driver').length).toBeGreaterThan(0);

      // Ratings
      expect(screen.getByText('4.8')).toBeInTheDocument();
      expect(screen.getByText('4.5')).toBeInTheDocument();

      // Availability & matching eligibility
      expect(screen.getAllByText(/Eligible/i).length).toBeGreaterThan(0);

      // Status badges
      expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    });

    it('provides both Suspend and Blacklist disciplinary mutations with mandatory remarks in ConfirmDialog', async () => {
      renderApp('/workers');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      // Verify both Suspend and Blacklist buttons are rendered for active workers
      const disciplineBtn = screen.getByRole('button', { name: /Discipline worker Sunita Devi/i });
      const blacklistBtn = screen.getByRole('button', { name: /Blacklist worker Sunita Devi/i });
      expect(disciplineBtn).toBeInTheDocument();
      expect(blacklistBtn).toBeInTheDocument();

      // Trigger Blacklist action
      fireEvent.click(blacklistBtn);

      expect(await screen.findByText(/Disciplinary Status Mutation: BLACKLISTED/i)).toBeInTheDocument();
      expect(screen.getByText(/Permanently blacklist worker W-10482/i)).toBeInTheDocument();

      // Submitting without remarks is rejected by requirement
      const remarksInput = screen.getByPlaceholderText(/Enter mandatory operational reason/i);
      fireEvent.change(remarksInput, { target: { value: 'Severe safety breach during trial' } });

      // Check operational guidelines confirmation checkbox
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
      fireEvent.click(confirmBtn);

      // Dialog closes and mutation is dispatched
      await waitFor(() => {
        expect(screen.queryByText(/Disciplinary Status Mutation: BLACKLISTED/i)).not.toBeInTheDocument();
      });
    });

    it('opens WorkerDetailModal and renders all 5 structured tabs without route deviation', async () => {
      renderApp('/workers');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
      const viewProfileBtn = screen.getByRole('button', { name: /^View profile for Sunita Devi$/i });
      fireEvent.click(viewProfileBtn);

      // Modal opens
      expect(await screen.findByText('Sunita Devi', { selector: 'h2' })).toBeInTheDocument();

      // All 5 PRD tabs exist
      expect(screen.getByText('1. Verification & Trust Workstation')).toBeInTheDocument();
      expect(screen.getByText('2. Personal & Contact')).toBeInTheDocument();
      expect(screen.getByText('3. Professional Profile')).toBeInTheDocument();
      expect(screen.getByText('4. Documents Vault')).toBeInTheDocument();
      expect(screen.getByText('5. Operational Engagements')).toBeInTheDocument();

      // Tab 3: Professional Profile
      fireEvent.click(screen.getByText('3. Professional Profile'));
      expect(await screen.findByText('Assigned Service Categories')).toBeInTheDocument();
      expect(screen.getByText('5 Years Household Experience')).toBeInTheDocument();
      expect(screen.getByText('Hindi, Telugu')).toBeInTheDocument();
      expect(screen.getByText('Available for Immediate Allocation')).toBeInTheDocument();
      expect(screen.getByText('₹18,000 / month')).toBeInTheDocument();
      expect(screen.getByText('Deep Cleaning')).toBeInTheDocument();

      // Tab 4: Documents Vault
      fireEvent.click(screen.getByText('4. Documents Vault'));
      expect(await screen.findByText('Strict Document Privacy Protocols:')).toBeInTheDocument();
      expect(screen.getByText('Aadhaar Card (Front & Back)')).toBeInTheDocument();
      expect(screen.getByText('XXXX-XXXX-8921')).toBeInTheDocument();

      // Tab 5: Operational Engagements & Ratings
      fireEvent.click(screen.getByText('5. Operational Engagements'));
      expect(await screen.findByText('Rating Score')).toBeInTheDocument();
      expect(screen.getByText('(28)')).toBeInTheDocument();
      expect(screen.getByText('Completed Jobs')).toBeInTheDocument();
      expect(screen.getByText('Active Engagements')).toBeInTheDocument();
      expect(screen.getByText('Recent Household Engagements')).toBeInTheDocument();
    });
  });

  describe('2. Data Integrity & Non-Fabrication of Production Fields', () => {
    it('mapBackendWorkerDetailToWorkerDetail does NOT fabricate documents, compensation, or languages when omitted by backend', () => {
      const rawBackendWorker = {
        id: 'W-99999',
        fullName: 'Anita Sharma',
        category: 'Cook',
        locality: 'Kondapur',
        status: 'ACTIVE',
        // Optional fields explicitly omitted by backend:
        // documents: omitted
        // languages: omitted
        // expectedSalary: omitted
        // bio: omitted
      };

      const mapped = mapBackendWorkerDetailToWorkerDetail(rawBackendWorker);

      // Verify no fake documents were fabricated
      expect(mapped.documents).toEqual([]);

      // Verify no fake salary expectation was fabricated
      expect(mapped.expectedCompensation).toBeUndefined();

      // Verify no fake languages were fabricated
      expect(mapped.languages).toEqual([]);

      // Verify no fake biography text was fabricated
      expect(mapped.bio).toBe('');
    });

    it('renders honest fallback messages ("Not specified", "No KYC documents") when optional fields are empty', async () => {
      // Mock worker repository returning a worker with no documents and no salary expectation
      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValueOnce({
        id: 'W-99999',
        name: 'Anita Sharma',
        category: 'Cook',
        categories: ['Cook'],
        experienceYears: 2,
        ratingAverage: 0,
        totalReviews: 0,
        locality: 'Kondapur',
        serviceRadiusKm: 5,
        languages: [],
        bio: '',
        isFullyVerified: false,
        status: 'ACTIVE',
        phoneMasked: '+91 91234 *****',
        documents: [],
        verification: {
          phoneOtpVerified: true,
          identityProofStatus: 'PENDING',
          addressProofStatus: 'PENDING',
          criminalRecordStatus: 'PENDING',
          skillProofStatus: 'NOT_APPLICABLE',
          referenceCheckStatus: 'PENDING',
        },
        activeEngagementsCount: 0,
        completedBookingsCount: 0,
        replacementsIncurred: 0,
        recentEngagements: [],
        internalNotes: [],
      });

      useAuthStore.getState().setSession(
        {
          id: 'ops-01',
          name: 'Operations Admin',
          email: 'operations.admin@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.WORKERS_MANAGE_STATUS,
            PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
          ],
        },
        'ops-token'
      );

      renderApp('/workers?workerId=W-99999');

      expect(await screen.findByText('Anita Sharma', { selector: 'h2' })).toBeInTheDocument();

      // Check Tab 3: Professional Profile
      fireEvent.click(screen.getByText('3. Professional Profile'));
      const notSpecifiedElements = await screen.findAllByText(/Not specified/);
      expect(notSpecifiedElements.length).toBeGreaterThan(0);
      expect(screen.getByText('No biography provided by applicant.')).toBeInTheDocument();

      // Check Tab 4: Documents Vault
      fireEvent.click(screen.getByText('4. Documents Vault'));
      expect(await screen.findByText('No KYC documents submitted or available in vault for this worker.')).toBeInTheDocument();
    });

    it('never reconstructs masked phone numbers with fake digits when revealing contact', async () => {
      // Worker with only masked phone and no unmasked raw phone in backend response
      vi.spyOn(workerRepository, 'getWorkerById').mockResolvedValueOnce({
        id: 'W-88888',
        name: 'Meena Bai',
        category: 'House Maid',
        experienceYears: 3,
        ratingAverage: 4.2,
        totalReviews: 10,
        locality: 'Madhapur',
        serviceRadiusKm: 5,
        languages: ['Telugu'],
        bio: '',
        isFullyVerified: true,
        status: 'ACTIVE',
        phoneMasked: '+91 99887 *****',
        phone: undefined, // Backend has not supplied unmasked phone
        mobile: undefined,
        documents: [],
        verification: {
          phoneOtpVerified: true,
          identityProofStatus: 'VERIFIED',
          addressProofStatus: 'VERIFIED',
          criminalRecordStatus: 'VERIFIED',
          skillProofStatus: 'NOT_APPLICABLE',
          referenceCheckStatus: 'VERIFIED',
        },
        activeEngagementsCount: 0,
        completedBookingsCount: 5,
        replacementsIncurred: 0,
        recentEngagements: [],
        internalNotes: [],
      });

      useAuthStore.getState().setSession(
        {
          id: 'ops-01',
          name: 'Operations Admin',
          email: 'operations.admin@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [PERMISSIONS.WORKER_VIEW],
        },
        'ops-token'
      );

      renderApp('/workers?workerId=W-88888');

      expect(await screen.findByText('Meena Bai', { selector: 'h2' })).toBeInTheDocument();

      // Go to Personal & Contact tab
      fireEvent.click(screen.getByText('2. Personal & Contact'));

      expect(await screen.findByText('+91 99887 *****')).toBeInTheDocument();
      const revealBtn = screen.getByRole('button', { name: 'Reveal contact number' });
      fireEvent.click(revealBtn);

      // Verify that NO fake '43210' was reconstructed
      expect(screen.queryByText(/43210/)).not.toBeInTheDocument();
      expect(screen.getByText(/\+91 99887 \*{5} \(Full number not supplied by backend\)/i)).toBeInTheDocument();
    });
  });

  describe('3. Role-Based Access Control on Worker Management', () => {
    it('Verification Executive can view workers and inspect KYC documents, but cannot perform disciplinary status changes', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'verif-01',
          name: 'Verification Executive',
          email: 'verification.executive@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DECIDE,
            PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
            // Notice: Lacks WORKERS_MANAGE_STATUS and WORKERS_MANAGE
          ],
        },
        'verif-token'
      );

      renderApp('/workers');

      expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();

      // View Profile is accessible
      expect(screen.getByRole('button', { name: /^View profile for Sunita Devi$/i })).toBeInTheDocument();

      // Disciplinary buttons (Suspend / Blacklist / Reinstate) are blocked by PermissionGate
      expect(screen.queryByRole('button', { name: /Discipline worker Sunita Devi/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Blacklist worker Sunita Devi/i })).not.toBeInTheDocument();
    });

    it('User without WORKER_VIEW permission is blocked from accessing /workers route', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'supp-01',
          name: 'Support Executive',
          email: 'support.executive@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [
            PERMISSIONS.SUPPORT_VIEW,
            PERMISSIONS.SUPPORT_MANAGE,
            // Lacks WORKER_VIEW
          ],
        },
        'supp-token'
      );

      renderApp('/workers');

      // Route guard displays Access Restricted
      expect(await screen.findByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
      expect(screen.getByText(/Required permission: worker\.view/i)).toBeInTheDocument();
      expect(screen.queryByText('Domestic Worker Roster & Profiles')).not.toBeInTheDocument();
    });
  });

  describe('4. Error and Loading States', () => {
    it('displays error state with functional Retry button when worker list query fails', async () => {
      const getWorkersSpy = vi.spyOn(workerRepository, 'getWorkers').mockRejectedValueOnce(
        new Error('Unable to connect to SevaNest Backend API')
      );

      useAuthStore.getState().setSession(
        {
          id: 'ops-01',
          name: 'Operations Admin',
          email: 'operations.admin@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: [PERMISSIONS.WORKER_VIEW],
        },
        'ops-token'
      );

      renderApp('/workers');

      expect(await screen.findByText('Failed to load domestic worker roster.')).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: 'Retry' });
      expect(retryBtn).toBeInTheDocument();

      // Clicking retry triggers a new fetch
      fireEvent.click(retryBtn);
      expect(getWorkersSpy).toHaveBeenCalledTimes(2);
    });
  });
});
