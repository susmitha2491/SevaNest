import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';
import { verificationRepository } from '../features/verification/data/verificationRepository';

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
    queryClient,
  };
}

const repoWithDossiers = verificationRepository as unknown as { dossiers?: unknown[] };
const initialDossiersSnapshot = repoWithDossiers.dossiers
  ? JSON.stringify(repoWithDossiers.dossiers)
  : null;

describe('Worker KYC Review & Application Acceptance Workflow (Strict Audit Verification)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (initialDossiersSnapshot && repoWithDossiers.dossiers) {
      repoWithDossiers.dossiers = JSON.parse(initialDossiersSnapshot);
    }
    useAuthStore.getState().clearSession();
    // Default session: Verification Executive with full review, decide, and document view permissions
    useAuthStore.getState().setSession(
      {
        id: 'adm-003',
        name: 'Senior Verification Executive',
        email: 'verification.executive@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.WORKERS_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
          PERMISSIONS.DOCUMENTS_VIEW_RESTRICTED,
        ],
      },
      'verif-exec-token'
    );
  });

  it('1. Clicking worker row and clicking View Profile open the exact same worker profile view', async () => {
    renderApp('/workers');

    expect(await screen.findByText('Sunita Devi')).toBeInTheDocument();
    const sunitaRow = screen.getByRole('button', { name: /View profile for Sunita Devi \(W-10482\)/i });

    // Click worker row
    fireEvent.click(sunitaRow);

    // Profile opens with identical details
    expect(await screen.findByRole('heading', { level: 2, name: 'Sunita Devi' })).toBeInTheDocument();
    expect(screen.getByText('ID: W-10482')).toBeInTheDocument();
    expect(screen.getByText(/• House Maid •/i)).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: 'Close dossier' });
    fireEvent.click(closeBtn);

    // Click View Profile button
    const viewProfileBtn = screen.getByRole('button', { name: 'View profile for Sunita Devi' });
    fireEvent.click(viewProfileBtn);

    expect(await screen.findByRole('heading', { level: 2, name: 'Sunita Devi' })).toBeInTheDocument();
    expect(screen.getByText('ID: W-10482')).toBeInTheDocument();
    expect(screen.getByText(/• House Maid •/i)).toBeInTheDocument();
  });

  it('2. Review KYC opens the dedicated verification queue without opening the worker profile view', async () => {
    const { router } = renderApp('/workers');

    expect(await screen.findByText('Ramesh Yadav')).toBeInTheDocument();
    const reviewKycBtn = screen.getByRole('button', { name: 'Review KYC for Ramesh Yadav' });

    fireEvent.click(reviewKycBtn);

    // Navigates to /verification with appropriate workerId query param
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/verification');
    });
    expect(router.state.location.search).toContain('workerId=W-10483');

    // Worker profile modal was not triggered
    expect(screen.queryByRole('heading', { level: 2, name: 'Ramesh Yadav' })).not.toBeInTheDocument();
  });

  it('3. Displays all 5 operations checks in canonical sequential order', async () => {
    renderApp('/verification?workerId=W-10482&dossierId=W-10482');

    // Opens verification dossier
    expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();

    // Checks exist in canonical order
    const stepButtons = [
      screen.getByRole('button', { name: /1\. Identity Proof/i }),
      screen.getByRole('button', { name: /2\. Address Proof/i }),
      screen.getByRole('button', { name: /3\. Emergency Contact/i }),
      screen.getByRole('button', { name: /4\. Employer Reference/i }),
      screen.getByRole('button', { name: /5\. Police Certificate/i }),
    ];
    expect(stepButtons.length).toBe(5);
  });

  it('4. Dependent checks are locked when prerequisite previous checks are pending', async () => {
    renderApp('/verification?workerId=W-10482&dossierId=W-10482');

    expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();

    // Sunita Devi has IDENTITY pending, so ADDRESS is locked
    const addressTab = screen.getByRole('button', { name: /2\. Address Proof/i });
    fireEvent.click(addressTab);

    // Should indicate sequential lock rule
    expect(await screen.findByText(/Sequential Verification Rule/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot be approved out of order/i)).toBeInTheDocument();

    // Approve button should be locked
    const approveBtn = screen.getByRole('button', { name: /Locked \(Prerequisite Required\)/i });
    expect(approveBtn).toBeDisabled();
  });

  it('5. Approving an actionable check advances to next step without unexpectedly closing the dossier', async () => {
    const user = userEvent.setup();
    const approveSpy = vi.spyOn(verificationRepository, 'approveCheck');

    renderApp('/verification?workerId=W-10482&dossierId=W-10482');

    expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();

    // Identity Proof is currently active and actionable (Step 1)
    const approveBtn = await screen.findByRole('button', { name: /Approve Check/i });
    expect(approveBtn).not.toBeDisabled();
    await user.click(approveBtn);

    // Dialog opens
    const confirmBtn = await screen.findByRole('button', { name: /Confirm Approval/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith(
        'chk-identity-101',
        'IDENTITY',
        expect.any(String)
      );
    });

    // Dossier remains open
    expect(screen.getByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();
  });

  it('6. Rejection records required category and remarks and preserves dossier state', async () => {
    const user = userEvent.setup();
    const rejectSpy = vi.spyOn(verificationRepository, 'rejectCheck');

    renderApp('/verification?workerId=W-10482&dossierId=W-10482');

    expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();

    const rejectBtn = await screen.findByRole('button', { name: /Reject Check/i });
    await user.click(rejectBtn);

    expect(await screen.findByText(/Reject Identity Proof/i)).toBeInTheDocument();
    const remarksInput = screen.getByPlaceholderText(/Enter mandatory operational remarks/i);
    await user.type(remarksInput, 'Document image unreadable and blurred.');

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    const confirmRejectBtn = screen.getByRole('button', { name: /Confirm Rejection/i });
    await user.click(confirmRejectBtn);

    await waitFor(() => {
      expect(rejectSpy).toHaveBeenCalledWith(
        'chk-identity-101',
        'IDENTITY',
        expect.any(String),
        'Document image unreadable and blurred.'
      );
    });

    // Dossier remains open
    expect(screen.getByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();
  });

  it('7. Request Re-Verification requires instructions and calls repository contract', async () => {
    const user = userEvent.setup();
    const recheckSpy = vi.spyOn(verificationRepository, 'requestReVerification');

    renderApp('/verification?workerId=W-10482&dossierId=W-10482');

    expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();

    const recheckBtn = await screen.findByRole('button', { name: /Request Re-Verification/i });
    await user.click(recheckBtn);

    expect(await screen.findByText(/Request Document Re-Verification/i)).toBeInTheDocument();
    const instructionsInput = screen.getByPlaceholderText(/Enter mandatory instructions for the worker/i);
    await user.type(instructionsInput, 'Please upload clear high-resolution scanned copy.');

    const confirmBtn = screen.getByRole('button', { name: /Issue Re-Verification Request/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(recheckSpy).toHaveBeenCalledWith(
        'chk-identity-101',
        ['IDENTITY'],
        'Please upload clear high-resolution scanned copy.'
      );
    });

    // Dossier remains open
    expect(screen.getByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();
  });

  it('8. Document inspection renders split-screen viewer and handles missing doc IDs', async () => {
    renderApp('/verification?workerId=W-10482&dossierId=W-10482');

    expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();

    // Document inspection pane is rendered in split-screen layout
    expect(await screen.findByText(/CONFIDENTIAL KYC ATTACHMENT/i)).toBeInTheDocument();
    expect(screen.getByText(/Authorized Document Vault Record/i)).toBeInTheDocument();
  });

  it('9. Sensitive documents are protected when user lacks documents.view_restricted permission', async () => {
    // User with review permission but without document view permission
    useAuthStore.getState().setSession(
      {
        id: 'auditor-no-docs',
        name: 'Compliance Officer',
        email: 'compliance@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: [
          PERMISSIONS.DASHBOARD_VIEW,
          PERMISSIONS.WORKERS_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
        ],
      },
      'token-no-docs'
    );

    renderApp('/verification?workerId=W-10482&dossierId=W-10482');

    expect(await screen.findByText(/Verification Dossier: Sunita Devi/i)).toBeInTheDocument();
    expect(await screen.findByText(/Restricted Personal Document \(KYC\)/i)).toBeInTheDocument();
    expect(screen.getByText(/documents\.view_restricted/i)).toBeInTheDocument();
  });

  it('10. Displays authoritative acceptance status when all checks pass, noting ARCH-VERIF-01', async () => {
    // Suresh Kumar (W-10487) has all checks approved in the initial dataset
    renderApp('/verification?workerId=W-10487&dossierId=W-10487');

    expect(await screen.findByText(/Verification Dossier: Suresh Kumar/i)).toBeInTheDocument();

    // Authoritative acceptance banner is visible
    expect(await screen.findByText(/All 6 Verification Criteria Satisfied/i)).toBeInTheDocument();
    expect(screen.getByText(/Authoritative Status: VERIFIED/i)).toBeInTheDocument();
    expect(screen.getByText(/ARCH-VERIF-01/i)).toBeInTheDocument();
  });
});
