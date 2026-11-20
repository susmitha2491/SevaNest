import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../core/auth/authStore';
import { AdminRole, AdminUser } from '../core/auth/authTypes';
import { PERMISSIONS } from '../core/rbac/permissions';
import { AppShell } from '../app/layouts/AppShell';

const VE_USER: AdminUser = {
  id: 've-01',
  name: 'Verification Executive',
  email: 've@sevanest.internal',
  role: 'VERIFICATION_EXECUTIVE' as AdminRole,
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.WORKER_VIEW,
    PERMISSIONS.VERIFICATION_REVIEW,
    PERMISSIONS.VERIFICATION_DECIDE,
    PERMISSIONS.VERIFICATION_SIGNOFF,
    PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
  ],
};

const OPS_ADMIN_USER: AdminUser = {
  id: 'ops-01',
  name: 'Operations Admin',
  email: 'ops@sevanest.internal',
  role: 'OPERATIONS_ADMIN' as AdminRole,
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.WORKER_VIEW,
    PERMISSIONS.WORKER_MANAGE,
    PERMISSIONS.VERIFICATION_REVIEW,
    PERMISSIONS.BOOKINGS_VIEW,
  ],
};

function renderSidebarWithRoute(initialRoute: string, user: AdminUser = VE_USER) {
  useAuthStore.setState({ user, isAuthenticated: true });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard Page</div>} />
            <Route path="/verification" element={<div data-testid="verification-all-page">All Applications Page</div>} />
            <Route path="/verification/rechecks" element={<div data-testid="verification-rechecks-page">Rechecks Page</div>} />
            <Route path="/verification/corrections" element={<div data-testid="verification-corrections-page">Corrections Page</div>} />
            <Route path="/verification/history" element={<div data-testid="verification-history-page">History Page</div>} />
            <Route path="/directory" element={<div data-testid="directory-page">Directory Page</div>} />
            <Route path="/workers" element={<div data-testid="workers-page">Workers Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Verification Executive Sidebar Active-State Styling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. On /verification: highlights ONLY "All Applications", parent Verification stays in neutral background', () => {
    renderSidebarWithRoute('/verification');

    const parentVerification = screen.getByRole('link', { name: /^Verification$/i });
    const allAppsSub = screen.getByRole('link', { name: /^All Applications$/i });
    const rechecksSub = screen.getByRole('link', { name: /^Rechecks & Expiry$/i });
    const correctionsSub = screen.getByRole('link', { name: /^Corrections Required$/i });
    const historySub = screen.getByRole('link', { name: /^Review History$/i });

    // Parent item must NOT be active (no active class, no teal bg, no teal border, no teal text)
    expect(parentVerification).not.toHaveClass('active');
    expect(parentVerification.style.backgroundColor).toBe('var(--color-bg-subtle, #f8fafc)');
    expect(parentVerification.style.color).toBe('var(--color-text-secondary)');
    expect(parentVerification.style.borderLeft).toBe('3px solid transparent');
    expect(parentVerification.style.fontWeight).toBe('500');

    // "All Applications" MUST be active (has active class, primary subtle bg, primary border, primary text, 600 weight)
    expect(allAppsSub).toHaveClass('active');
    expect(allAppsSub.style.backgroundColor).toBe('var(--color-primary-subtle)');
    expect(allAppsSub.style.color).toBe('var(--color-primary)');
    expect(allAppsSub.style.borderLeft).toBe('3px solid var(--color-primary)');
    expect(allAppsSub.style.fontWeight).toBe('600');

    // Other submenus must NOT be active
    expect(rechecksSub).not.toHaveClass('active');
    expect(rechecksSub.style.backgroundColor).toBe('transparent');
    expect(correctionsSub).not.toHaveClass('active');
    expect(correctionsSub.style.backgroundColor).toBe('transparent');
    expect(historySub).not.toHaveClass('active');
    expect(historySub.style.backgroundColor).toBe('transparent');
  });

  it('2. On /verification/rechecks: highlights ONLY "Rechecks & Expiry", parent Verification stays neutral', () => {
    renderSidebarWithRoute('/verification/rechecks');

    const parentVerification = screen.getByRole('link', { name: /^Verification$/i });
    const allAppsSub = screen.getByRole('link', { name: /^All Applications$/i });
    const rechecksSub = screen.getByRole('link', { name: /^Rechecks & Expiry$/i });
    const correctionsSub = screen.getByRole('link', { name: /^Corrections Required$/i });
    const historySub = screen.getByRole('link', { name: /^Review History$/i });

    // Parent item neutral
    expect(parentVerification).not.toHaveClass('active');
    expect(parentVerification.style.backgroundColor).toBe('var(--color-bg-subtle, #f8fafc)');
    expect(parentVerification.style.color).toBe('var(--color-text-secondary)');
    expect(parentVerification.style.borderLeft).toBe('3px solid transparent');

    // Only "Rechecks & Expiry" active
    expect(rechecksSub).toHaveClass('active');
    expect(rechecksSub.style.backgroundColor).toBe('var(--color-primary-subtle)');
    expect(rechecksSub.style.color).toBe('var(--color-primary)');
    expect(rechecksSub.style.borderLeft).toBe('3px solid var(--color-primary)');

    expect(allAppsSub).not.toHaveClass('active');
    expect(correctionsSub).not.toHaveClass('active');
    expect(historySub).not.toHaveClass('active');
  });

  it('3. On /verification/corrections: highlights ONLY "Corrections Required", parent Verification stays neutral', () => {
    renderSidebarWithRoute('/verification/corrections');

    const parentVerification = screen.getByRole('link', { name: /^Verification$/i });
    const allAppsSub = screen.getByRole('link', { name: /^All Applications$/i });
    const correctionsSub = screen.getByRole('link', { name: /^Corrections Required$/i });

    expect(parentVerification).not.toHaveClass('active');
    expect(parentVerification.style.backgroundColor).toBe('var(--color-bg-subtle, #f8fafc)');
    expect(parentVerification.style.borderLeft).toBe('3px solid transparent');

    expect(correctionsSub).toHaveClass('active');
    expect(correctionsSub.style.backgroundColor).toBe('var(--color-primary-subtle)');
    expect(correctionsSub.style.color).toBe('var(--color-primary)');
    expect(correctionsSub.style.borderLeft).toBe('3px solid var(--color-primary)');

    expect(allAppsSub).not.toHaveClass('active');
  });

  it('4. On /verification/history: highlights ONLY "Review History", parent Verification stays neutral', () => {
    renderSidebarWithRoute('/verification/history');

    const parentVerification = screen.getByRole('link', { name: /^Verification$/i });
    const allAppsSub = screen.getByRole('link', { name: /^All Applications$/i });
    const historySub = screen.getByRole('link', { name: /^Review History$/i });

    expect(parentVerification).not.toHaveClass('active');
    expect(parentVerification.style.backgroundColor).toBe('var(--color-bg-subtle, #f8fafc)');
    expect(parentVerification.style.borderLeft).toBe('3px solid transparent');

    expect(historySub).toHaveClass('active');
    expect(historySub.style.backgroundColor).toBe('var(--color-primary-subtle)');
    expect(historySub.style.color).toBe('var(--color-primary)');
    expect(historySub.style.borderLeft).toBe('3px solid var(--color-primary)');

    expect(allAppsSub).not.toHaveClass('active');
  });

  it('5. On /dashboard: highlights Dashboard, Verification and its submenus are not active', () => {
    renderSidebarWithRoute('/dashboard');

    const dashboardLink = screen.getByRole('link', { name: /^Dashboard$/i });
    const parentVerification = screen.getByRole('link', { name: /^Verification$/i });

    expect(dashboardLink).toHaveClass('active');
    expect(dashboardLink.style.backgroundColor).toBe('var(--color-primary-subtle)');
    expect(dashboardLink.style.color).toBe('var(--color-primary)');
    expect(dashboardLink.style.borderLeft).toBe('3px solid var(--color-primary)');

    expect(parentVerification).not.toHaveClass('active');
    expect(parentVerification.style.backgroundColor).toBe('transparent');
    expect(parentVerification.style.borderLeft).toBe('3px solid transparent');
  });

  it('6. On /directory: highlights Directory, Verification is not active', () => {
    renderSidebarWithRoute('/directory');

    const directoryLink = screen.getByRole('link', { name: /^Directory$/i });
    const parentVerification = screen.getByRole('link', { name: /^Verification$/i });

    expect(directoryLink).toHaveClass('active');
    expect(directoryLink.style.backgroundColor).toBe('var(--color-primary-subtle)');
    expect(directoryLink.style.color).toBe('var(--color-primary)');

    expect(parentVerification).not.toHaveClass('active');
    expect(parentVerification.style.backgroundColor).toBe('transparent');
  });

  it('7. On /workers: highlights Workers Management, Verification is not active', () => {
    renderSidebarWithRoute('/workers');

    const workersLink = screen.getByRole('link', { name: /^Workers Management$/i });
    const parentVerification = screen.getByRole('link', { name: /^Verification$/i });

    expect(workersLink).toHaveClass('active');
    expect(parentVerification).not.toHaveClass('active');
    expect(parentVerification.style.backgroundColor).toBe('transparent');
  });

  it('8. Operations Admin on /verification: parent Verification has no submenus and takes normal active highlight', () => {
    renderSidebarWithRoute('/verification', OPS_ADMIN_USER);

    const parentVerification = screen.getByRole('link', { name: /^Verification Management$/i });

    // Since Operations Admin has no submenus, parent itself is active
    expect(parentVerification).toHaveClass('active');
    expect(parentVerification.style.backgroundColor).toBe('var(--color-primary-subtle)');
    expect(parentVerification.style.color).toBe('var(--color-primary)');
    expect(parentVerification.style.borderLeft).toBe('3px solid var(--color-primary)');

    // Submenus should not exist for Operations Admin
    expect(screen.queryByRole('link', { name: /^All Applications$/i })).not.toBeInTheDocument();
  });

  it('9. Preserves expand/collapse toggling on parent Verification without breaking route state', () => {
    renderSidebarWithRoute('/verification');

    const parentVerification = screen.getByRole('link', { name: /^Verification$/i });

    // Initially expanded on verification route
    expect(screen.getByRole('link', { name: /^All Applications$/i })).toBeInTheDocument();

    // Clicking parent toggles to collapsed
    fireEvent.click(parentVerification);
    expect(screen.queryByRole('link', { name: /^All Applications$/i })).not.toBeInTheDocument();

    // When collapsed, parent still keeps light neutral background (not active teal)
    expect(parentVerification).not.toHaveClass('active');
    expect(parentVerification.style.backgroundColor).toBe('var(--color-bg-subtle, #f8fafc)');
    expect(parentVerification.style.borderLeft).toBe('3px solid transparent');

    // Clicking parent again re-expands submenus
    fireEvent.click(parentVerification);
    expect(screen.getByRole('link', { name: /^All Applications$/i })).toBeInTheDocument();
  });
});
