import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderWithRouter(initialEntry = '/auth/login') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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

describe('Application Bootstrap & Foundational Shell', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it('renders sign in screen when unauthenticated', async () => {
    renderWithRouter('/auth/login');
    expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(await screen.findByText('Sign In to Operations Console')).toBeInTheDocument();
  });

  it('does not render quick persona selectors on the login page', async () => {
    renderWithRouter('/auth/login');
    expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText('Quick Persona Testing Selectors:')).not.toBeInTheDocument();
    expect(screen.queryByText('Super Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Operations Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Verification Exec')).not.toBeInTheDocument();
    expect(screen.queryByText('Support Exec')).not.toBeInTheDocument();
  });

  it('renders 404 Not Found view for non-existent routes when authenticated', async () => {
    useAuthStore.getState().setSession(
      {
        id: 'ops-01',
        name: 'Operations Staff',
        email: 'ops@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: ['*'],
      },
      'mock-token'
    );

    renderWithRouter('/non-existent-subpage');
    expect(await screen.findByText('404 — Page Not Found')).toBeInTheDocument();
  });

  it('renders NoAccessView when authenticated user lacks route permissions', async () => {
    // Authenticate user with Support Executive permissions (lacks configuration.manage)
    useAuthStore.getState().setSession(
      {
        id: 'supp-01',
        name: 'Support Staff',
        email: 'supp@sevanest.internal',
        role: 'SUPPORT_EXECUTIVE',
        permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.SUPPORT_VIEW],
      },
      'mock-token'
    );

    renderWithRouter('/configuration');
    expect(await screen.findByText('Access Restricted')).toBeInTheDocument();
    expect(await screen.findByText(/Required permission: configuration\.manage/)).toBeInTheDocument();
  });
});
