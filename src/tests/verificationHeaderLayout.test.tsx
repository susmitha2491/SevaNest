/* global HTMLElement */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VerificationQueuePage } from '../features/verification/presentation/VerificationQueuePage';
import { verificationRepository } from '../features/verification/data/verificationRepository';
import { useAuthStore } from '../core/auth/authStore';
import { AdminUser } from '../core/auth/authTypes';
import { PERMISSIONS } from '../core/rbac/permissions';

const VERIFICATION_USER: AdminUser = {
  id: 've-01',
  name: 'Verification Officer',
  email: 'verif.officer@sevanest.internal',
  role: 'VERIFICATION_EXECUTIVE',
  permissions: [
    PERMISSIONS.WORKER_VIEW,
    PERMISSIONS.VERIFICATION_REVIEW,
    PERMISSIONS.VERIFICATION_DECIDE,
  ],
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Worker Verification Page Header Layout & Refresh Button Placement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: VERIFICATION_USER, isAuthenticated: true });
    vi.spyOn(verificationRepository, 'getVerificationQueue').mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    });
  });

  it('renders heading on the left and SLA indicator before Refresh button on the right', async () => {
    renderWithClient(<VerificationQueuePage viewMode="all" />);

    // 1. Heading & description
    const heading = await screen.findByRole('heading', { name: /Worker Verification & Trust Operations/i });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText(/Mandatory 6-point verification/i)).toBeInTheDocument();

    // 2. SLA indicator and Refresh button
    const slaIndicator = screen.getByText(/Operational Verification SLA: 48 Hours/i);
    expect(slaIndicator).toBeInTheDocument();

    const refreshBtn = screen.getByRole('button', { name: /^Refresh$/i });
    expect(refreshBtn).toBeInTheDocument();

    // 3. Verify ordering: Refresh button is to the far right (after SLA indicator in DOM)
    const actionsContainer = refreshBtn.parentElement as HTMLElement;
    expect(actionsContainer).toBeInTheDocument();
    expect(actionsContainer.contains(slaIndicator)).toBe(true);
    expect(actionsContainer.contains(refreshBtn)).toBe(true);

    // Refresh button should follow SLA badge in the container
    const slaBadgeWrapper = slaIndicator.closest('div') as HTMLElement;
    const children = Array.from(actionsContainer.children);
    const slaIndex = children.indexOf(slaBadgeWrapper);
    const refreshIndex = children.indexOf(refreshBtn);

    expect(slaIndex).toBeGreaterThanOrEqual(0);
    expect(refreshIndex).toBeGreaterThan(slaIndex);

    // 4. Verify Refresh button is NOT inside search or filter sections
    const searchInput = screen.getByPlaceholderText(/Search by worker name/i);
    const filterSection = searchInput.closest('div');
    expect(filterSection?.contains(refreshBtn)).toBe(false);
  });

  it('triggers verification queue refetch when Refresh button is clicked', async () => {
    const getSpy = vi.spyOn(verificationRepository, 'getVerificationQueue');
    renderWithClient(<VerificationQueuePage viewMode="all" />);

    const refreshBtn = await screen.findByRole('button', { name: /^Refresh$/i });
    await userEvent.click(refreshBtn);

    expect(getSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
