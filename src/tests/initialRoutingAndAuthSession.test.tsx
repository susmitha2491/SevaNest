import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderApp(initialEntry = '/', state?: unknown) {
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

describe('Initial Login Page Routing & Session Verification', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('1. Opening / without a session displays the login page', async () => {
    const { router } = renderApp('/');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });

    expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In to Operations Console/i })).toBeInTheDocument();
    expect(screen.queryByText(/Access Restricted/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Required permission: dashboard.view/i)).not.toBeInTheDocument();
  });

  it('2. Opening / with a valid Verification Executive session redirects to /verification', async () => {
    useAuthStore.getState().setSession(
      {
        id: 'adm-003',
        name: 'Verification Executive',
        email: 'verification.exec@sevanest.internal',
        role: 'VERIFICATION_EXECUTIVE',
        permissions: [
          PERMISSIONS.WORKER_VIEW,
          PERMISSIONS.VERIFICATION_REVIEW,
          PERMISSIONS.VERIFICATION_DECIDE,
          PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
        ],
      },
      'verif-token'
    );

    const { router } = renderApp('/');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/verification');
    });

    expect(await screen.findByText('Worker Verification & Trust Operations', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText(/Access Restricted/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Required permission: dashboard.view/i)).not.toBeInTheDocument();
  });

  it('3. Opening / with a valid Super Admin session redirects to /dashboard when authorized', async () => {
    useAuthStore.getState().setSession(
      {
        id: 'adm-001',
        name: 'Super Admin',
        email: 'super@sevanest.internal',
        role: 'SUPER_ADMIN',
        permissions: ['*'],
      },
      'super-token'
    );

    const { router } = renderApp('/');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard');
    });

    expect(await screen.findByRole('heading', { name: /Super Admin Executive Console/i }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText(/Access Restricted/i)).not.toBeInTheDocument();
  });

  it('4. Direct access to a protected route without authentication redirects to login and preserves destination', async () => {
    const { router } = renderApp('/bookings');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });

    expect(router.state.location.state).toEqual({
      from: expect.objectContaining({ pathname: '/bookings' }),
    });

    expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('5. Refreshing a protected page restores a valid session without premature redirect', async () => {
    window.localStorage.setItem('sevanest_refresh_token', 'refresh-oper-1720000000');
    useAuthStore.setState({
      isInitialized: false,
      isRestoring: false,
      isAuthenticated: false,
      user: null,
      accessToken: null,
    });

    const { router } = renderApp('/bookings');

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    expect(useAuthStore.getState().user?.role).toBe('OPERATIONS_ADMIN');
    expect(router.state.location.pathname).toBe('/bookings');
    expect(await screen.findByRole('heading', { name: /Booking & Service Management/i }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText(/Access Restricted/i)).not.toBeInTheDocument();
  });

  it('3b. Opening / with a valid Operations Admin session redirects to /dashboard', async () => {
    useAuthStore.getState().setSession(
      {
        id: 'adm-002',
        name: 'Operations Manager',
        email: 'ops@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.CUSTOMERS_VIEW],
      },
      'ops-token'
    );

    const { router } = renderApp('/');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard');
    });

    expect(await screen.findByRole('heading', { name: /Operations Command Console/i }, { timeout: 4000 })).toBeInTheDocument();
  });

  it('3c. Opening / with a valid Support Executive session redirects to /support', async () => {
    useAuthStore.getState().setSession(
      {
        id: 'adm-004',
        name: 'Support Executive',
        email: 'support@sevanest.internal',
        role: 'SUPPORT_EXECUTIVE',
        permissions: [PERMISSIONS.SUPPORT_VIEW],
      },
      'supp-token'
    );

    const { router } = renderApp('/');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/support');
    });

    expect(await screen.findByRole('heading', { name: /Support Grievance & SLA Queue/i }, { timeout: 4000 })).toBeInTheDocument();
  });

  it('4b. Direct unauthenticated visit to /verification redirects to login and preserves destination', async () => {
    const { router } = renderApp('/verification');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });

    expect(router.state.location.state).toEqual({
      from: expect.objectContaining({ pathname: '/verification' }),
    });

    expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('6. An authenticated user without the required permission sees Access Restricted with return link', async () => {
    useAuthStore.getState().setSession(
      {
        id: 'supp-001',
        name: 'Support Executive',
        email: 'support.exec@sevanest.internal',
        role: 'SUPPORT_EXECUTIVE',
        permissions: [PERMISSIONS.SUPPORT_VIEW, PERMISSIONS.SUPPORT_MANAGE],
      },
      'supp-token'
    );

    renderApp('/configuration');

    expect(await screen.findByRole('heading', { name: /Access Restricted/i }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(/Required permission: configuration\.manage/i)).toBeInTheDocument();

    const returnLink = screen.getByRole('link', { name: /Return to Primary Workstation/i });
    expect(returnLink).toBeInTheDocument();
    expect(returnLink).toHaveAttribute('href', '/support');
  });

  it('7. Expired sessions return to login without redirect loops and clear storage', async () => {
    window.localStorage.setItem('sevanest_refresh_token', 'expired-token-xyz');
    useAuthStore.setState({
      isInitialized: false,
      isRestoring: false,
      isAuthenticated: false,
      user: null,
      accessToken: null,
    });

    const { router } = renderApp('/dashboard');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();

    // Opening / again must simply keep/display the login page without redirect loops
    await act(async () => {
      await router.navigate('/');
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });

    expect(screen.getByText('Staff Sign In')).toBeInTheDocument();
  });

  it('8. Logout clears session, removes refresh tokens from storage, and redirects to login', async () => {
    window.localStorage.setItem('sevanest_refresh_token', 'refresh-oper-1720000000');
    useAuthStore.getState().setSession(
      {
        id: 'adm-002',
        name: 'Operations Manager',
        email: 'ops@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: [PERMISSIONS.DASHBOARD_VIEW],
      },
      'ops-token',
      'refresh-oper-1720000000'
    );

    const { router } = renderApp('/dashboard');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard');
    });

    // Execute logout
    act(() => {
      useAuthStore.getState().clearSession();
      router.navigate('/auth/login', { replace: true });
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();

    // Subsequent navigation to / must stay on login
    await act(async () => {
      await router.navigate('/');
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });
    expect(screen.getByText('Staff Sign In')).toBeInTheDocument();
  });

  it('9. Deep-link return after login securely ignores unsafe or root return destinations', async () => {
    // With unsafe from pathname '//malicious.com' or '/'
    const { router } = renderApp('/auth/login', {
      from: { pathname: '//evil.com' },
    });

    // Authenticate as Support Executive
    act(() => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-004',
          name: 'Support Executive',
          email: 'support@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          permissions: [PERMISSIONS.SUPPORT_VIEW],
        },
        'supp-token'
      );
    });

    // Must safely fallback to Support Executive landing route (/support), not external or malicious url
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/support');
    });
  });
});
