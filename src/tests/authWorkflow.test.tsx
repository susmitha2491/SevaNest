import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { authRepository } from '../features/auth/data/authRepository';
import { PERMISSIONS } from '../core/rbac/permissions';

function renderAuthFlow(initialEntry = '/auth/login', state?: unknown) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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
  };
}

describe('SV-7: Authentication Module & Session Management Workflows', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the sign-in form with all required inputs without gateway or sandbox banner', async () => {
    renderAuthFlow('/auth/login');

    expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@sevanest.internal')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In to Operations Console/i })).toBeInTheDocument();

    // Verify gateway banner and development sandbox notice are absent
    expect(screen.queryByText(/Backend API Gateway/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Simulated Sandbox/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/In-memory mock authentication/i)).not.toBeInTheDocument();

    // Verify persona preset buttons are absent
    expect(screen.queryByText('Quick Persona Testing Selectors:')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Super Admin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Operations Admin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verification Exec' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Support Exec' })).not.toBeInTheDocument();
  });

  it('toggles password visibility with show/hide eye icon without submitting the form', async () => {
    const user = userEvent.setup();
    renderAuthFlow('/auth/login');

    const passwordInput = await screen.findByPlaceholderText('Enter password', {}, { timeout: 4000 });
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Button should initially have label 'Show password'
    const toggleBtn = screen.getByRole('button', { name: /Show password/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('type', 'button');

    // Type a test password
    await user.clear(passwordInput);
    await user.type(passwordInput, 'SecretPass123!');
    expect(passwordInput).toHaveValue('SecretPass123!');
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle button -> reveals password
    await user.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(passwordInput).toHaveValue('SecretPass123!');
    expect(screen.getByRole('button', { name: /Hide password/i })).toBeInTheDocument();

    // Click toggle button again -> masks password
    await user.click(screen.getByRole('button', { name: /Hide password/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveValue('SecretPass123!');
    expect(screen.getByRole('button', { name: /Show password/i })).toBeInTheDocument();

    // Ensure form was not submitted (no validation errors or redirects occurred)
    expect(screen.queryByText(/Please enter a valid administrative email address/i)).not.toBeInTheDocument();
  });

  it('displays validation error messages when submitting empty or invalid fields', async () => {
    const user = userEvent.setup();
    renderAuthFlow('/auth/login');

    const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
    const passwordInput = screen.getByPlaceholderText('Enter password');
    const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });

    // Clear inputs and enter invalid format
    await user.clear(emailInput);
    await user.type(emailInput, 'invalid-email-format');
    await user.clear(passwordInput);
    await user.type(passwordInput, '123'); // Less than 6 characters

    await user.click(submitBtn);

    // Assert validation error messages from Zod schema
    expect(await screen.findByText(/Please enter a valid administrative email address/i)).toBeInTheDocument();
    expect(await screen.findByText(/Password must be at least 6 characters/i)).toBeInTheDocument();

    // Verify unauthenticated state remains intact
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('displays authentication error alert when invalid credentials are provided', async () => {
    const user = userEvent.setup();
    renderAuthFlow('/auth/login');

    const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
    const passwordInput = screen.getByPlaceholderText('Enter password');
    const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });

    // Submit unrecognized email
    await user.clear(emailInput);
    await user.type(emailInput, 'unknown.staff@othercompany.com');
    await user.clear(passwordInput);
    await user.type(passwordInput, 'password123');

    await user.click(submitBtn);

    // Verify error banner is rendered with role="alert"
    const alertBanner = await screen.findByRole('alert');
    expect(alertBanner).toBeInTheDocument();
    expect(alertBanner).toHaveTextContent(/Administrative account not found/i);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    // Submit recognized email with wrong password
    await user.clear(emailInput);
    await user.type(emailInput, 'ops.admin@sevanest.internal');
    await user.clear(passwordInput);
    await user.type(passwordInput, 'wrongpassword');

    await user.click(submitBtn);

    const updatedAlert = await screen.findByRole('alert');
    expect(updatedAlert).toHaveTextContent(/Invalid administrative credentials/i);

    // Submit recognized email with an arbitrary unexpected password (verifying positive whitelist check)
    await user.clear(passwordInput);
    await user.type(passwordInput, 'unexpectedSecret999');
    await user.click(submitBtn);

    const unexpectedPassAlert = await screen.findByRole('alert');
    expect(unexpectedPassAlert).toHaveTextContent(/Invalid administrative credentials/i);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('clears authentication error when user edits email input', async () => {
    const user = userEvent.setup();
    renderAuthFlow('/auth/login');

    const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
    const passwordInput = screen.getByPlaceholderText('Enter password');
    const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });

    // Trigger an error first
    await user.clear(emailInput);
    await user.type(emailInput, 'ops.admin@sevanest.internal');
    await user.clear(passwordInput);
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitBtn);

    expect(await screen.findByRole('alert')).toBeInTheDocument();

    // Modifying email input should dismiss the error alert
    await user.type(emailInput, 'x');

    // Error alert should be dismissed
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('authenticates Super Admin and sets wildcard permissions in-memory only', async () => {
    const user = userEvent.setup();
    renderAuthFlow('/auth/login');

    const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
    await user.type(emailInput, 'super.admin@sevanest.internal');

    const passwordInput = screen.getByPlaceholderText('Enter password');
    await user.type(passwordInput, 'password123');

    const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    await user.click(submitBtn);

    // Wait for authentication and session update
    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    const sessionUser = useAuthStore.getState().user;
    expect(sessionUser?.role).toBe('SUPER_ADMIN');
    expect(sessionUser?.email).toBe('super.admin@sevanest.internal');
    expect(sessionUser?.permissions).toContain('*');

    // Confirm access token is stored in memory ONLY
    const token = useAuthStore.getState().accessToken;
    expect(token).toBeTruthy();
    expect(token).toMatch(/^token-super-/);
    expect(window.localStorage.getItem('token')).toBeNull();
    expect(window.localStorage.getItem('accessToken')).toBeNull();
    expect(window.sessionStorage.getItem('token')).toBeNull();
    expect(window.sessionStorage.getItem('accessToken')).toBeNull();
  });

  it('authenticates Operations Admin with full operational permissions', async () => {
    const user = userEvent.setup();
    renderAuthFlow('/auth/login');

    const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
    await user.type(emailInput, 'ops.admin@sevanest.internal');

    const passwordInput = screen.getByPlaceholderText('Enter password');
    await user.type(passwordInput, 'password123');

    const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    const sessionUser = useAuthStore.getState().user;
    expect(sessionUser?.role).toBe('OPERATIONS_ADMIN');
    expect(sessionUser?.permissions).toContain(PERMISSIONS.BOOKINGS_VIEW);
    expect(sessionUser?.permissions).toContain(PERMISSIONS.PAYMENTS_VIEW);
    expect(sessionUser?.permissions).toContain(PERMISSIONS.VERIFICATION_REVIEW);
    expect(sessionUser?.permissions).not.toContain(PERMISSIONS.CONFIGURATION_MANAGE);
  });

  it('authenticates Verification Executive with verification permissions', async () => {
    const user = userEvent.setup();
    renderAuthFlow('/auth/login');

    const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
    await user.type(emailInput, 'verif.exec@sevanest.internal');

    const passwordInput = screen.getByPlaceholderText('Enter password');
    await user.type(passwordInput, 'password123');

    const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    const sessionUser = useAuthStore.getState().user;
    expect(sessionUser?.role).toBe('VERIFICATION_EXECUTIVE');
    expect(sessionUser?.permissions).toContain(PERMISSIONS.VERIFICATION_REVIEW);
    expect(sessionUser?.permissions).toContain(PERMISSIONS.WORKER_VIEW);
    expect(sessionUser?.permissions).toContain(PERMISSIONS.VERIFICATION_DECIDE);
    expect(sessionUser?.permissions).toContain(PERMISSIONS.VERIFICATION_DOCUMENT_VIEW);
    expect(sessionUser?.permissions).not.toContain(PERMISSIONS.BOOKINGS_VIEW);
  });

  it('authenticates Support Executive with grievance management permissions', async () => {
    const user = userEvent.setup();
    renderAuthFlow('/auth/login');

    const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
    await user.type(emailInput, 'support.exec@sevanest.internal');

    const passwordInput = screen.getByPlaceholderText('Enter password');
    await user.type(passwordInput, 'password123');

    const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    const sessionUser = useAuthStore.getState().user;
    expect(sessionUser?.role).toBe('SUPPORT_EXECUTIVE');
    expect(sessionUser?.permissions).toContain(PERMISSIONS.SUPPORT_VIEW);
    expect(sessionUser?.permissions).toContain(PERMISSIONS.SUPPORT_MANAGE);
    expect(sessionUser?.permissions).not.toContain(PERMISSIONS.PAYMENTS_VIEW);
  });

  it('redirects unauthenticated users to login and preserves target route in state', async () => {
    const { router } = renderAuthFlow('/bookings');

    // Should redirect to /auth/login
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });

    // Verify destination was preserved in router state
    expect(router.state.location.state).toEqual({
      from: expect.objectContaining({ pathname: '/bookings' }),
    });
  });

  describe('Regression: Role-Based Default Dashboard After Sign-In', () => {
    it('1. Super Admin signs in and lands on the Super Admin dashboard', async () => {
      const user = userEvent.setup();
      const { router } = renderAuthFlow('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'super.admin@sevanest.internal');

      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'password123');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      expect(await screen.findByRole('heading', { name: /Super Admin Executive Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('2. Operations Admin signs in and lands on the Operations Admin dashboard', async () => {
      const user = userEvent.setup();
      const { router } = renderAuthFlow('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'ops.admin@sevanest.internal');

      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'password123');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      expect(await screen.findByRole('heading', { name: /Operations Command Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('3. Verification Executive signs in and lands on their authorized workstation/dashboard', async () => {
      const user = userEvent.setup();
      const { router } = renderAuthFlow('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'verif.exec@sevanest.internal');

      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'password123');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/verification');
      });

      expect(await screen.findByText('Worker Verification & Trust Operations', {}, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
    });

    it('3b. Verification Executive with dashboard.view lands on Verification Executive dashboard (/dashboard)', async () => {
      vi.spyOn(authRepository, 'login').mockResolvedValueOnce({
        user: {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 'verif.exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.DASHBOARD_VIEW,
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
            PERMISSIONS.VERIFICATION_DECIDE,
            PERMISSIONS.VERIFICATION_DOCUMENT_VIEW,
          ],
        },
        accessToken: 'token-ve-dash',
        refreshToken: 'refresh-ve-dash',
      });

      const user = userEvent.setup();
      const { router } = renderAuthFlow('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'verif.exec@sevanest.internal');

      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'password123');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      expect(await screen.findByRole('heading', { name: /Trust & Verification Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('4. Support Executive signs in and lands on the Support Executive dashboard (/dashboard)', async () => {
      const user = userEvent.setup();
      const { router } = renderAuthFlow('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'support.exec@sevanest.internal');

      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'password123');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      expect(await screen.findByRole('heading', { name: /Support Operations Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('5. A stale previous route such as /workers does not override the default dashboard after fresh sign-in', async () => {
      const user = userEvent.setup();
      // Simulate stale 'from' in location state pointing to /workers
      const { router } = renderAuthFlow('/auth/login', { from: { pathname: '/workers', search: '' } });

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'ops.admin@sevanest.internal');

      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'password123');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        // Must land on /dashboard, NOT on stale /workers
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      expect(await screen.findByRole('heading', { name: /Operations Command Console/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('6. A stale returnTo or from value cannot redirect a fresh sign-in to another role page', async () => {
      const user = userEvent.setup();
      // Simulate stale returnTo or foreign role path /configuration
      const { router } = renderAuthFlow('/auth/login?returnTo=/configuration', { from: { pathname: '/configuration' } });

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'support.exec@sevanest.internal');

      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'password123');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        // Must open Support Executive dashboard (/dashboard), NOT /configuration
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      expect(await screen.findByRole('heading', { name: /Support Operations Console/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: /Access Restricted/i })).not.toBeInTheDocument();
    });

    it('7. A valid authenticated session can still navigate to protected pages normally', async () => {
      const user = userEvent.setup();
      const { router } = renderAuthFlow('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'ops.admin@sevanest.internal');

      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'password123');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });

      // Intentional navigation during active session to /workers
      await act(async () => {
        await router.navigate('/workers');
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/workers');
      });

      expect(await screen.findByRole('heading', { name: /Domestic Worker Roster & Profiles/i }, { timeout: 4000 })).toBeInTheDocument();
    });

    it('8. Signing out and signing in as another role does not retain the previous role route', async () => {
      const user = userEvent.setup();

      // Step 1: User A (Operations Admin) is active on /workers
      useAuthStore.getState().setSession(
        {
          id: 'ops-01',
          name: 'Operations Admin',
          email: 'ops.admin@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: ['*'],
        },
        'token-ops'
      );

      const { router } = renderAuthFlow('/workers');
      expect(await screen.findByRole('heading', { name: /Domestic Worker Roster & Profiles/i }, { timeout: 4000 })).toBeInTheDocument();

      // Step 2: Sign out
      act(() => {
        useAuthStore.getState().clearSession();
      });
      await act(async () => {
        await router.navigate('/auth/login', { replace: true, state: null });
      });

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });

      // Step 3: User B (Verification Executive) signs in
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal', {}, { timeout: 4000 });
      await user.type(emailInput, 'verif.exec@sevanest.internal');

      const passwordInput = screen.getByPlaceholderText('Enter password');
      await user.type(passwordInput, 'password123');

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await user.click(submitBtn);

      await waitFor(() => {
        // User B must land on /verification, NOT retain User A's /workers
        expect(router.state.location.pathname).toBe('/verification');
      });

      expect(await screen.findByText('Worker Verification & Trust Operations', {}, { timeout: 4000 })).toBeInTheDocument();
    });

    it('9. Unauthorized dashboard destinations follow existing RBAC fallback behavior', async () => {
      // User without dashboard.view attempting to access /dashboard
      useAuthStore.getState().setSession(
        {
          id: 'adm-003',
          name: 'Verification Executive',
          email: 'verification.exec@sevanest.internal',
          role: 'VERIFICATION_EXECUTIVE',
          permissions: [
            PERMISSIONS.WORKER_VIEW,
            PERMISSIONS.VERIFICATION_REVIEW,
          ],
        },
        'verif-token'
      );

      renderAuthFlow('/dashboard');

      expect(await screen.findByRole('heading', { name: /Access Restricted/i }, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/Required permission: dashboard.view/i)).toBeInTheDocument();

      const returnLink = screen.getByRole('link', { name: /Return to Primary Workstation/i });
      expect(returnLink).toBeInTheDocument();
      expect(returnLink).toHaveAttribute('href', '/verification');
    });
  });

  it('redirects already-authenticated users away from login page to dashboard', async () => {
    useAuthStore.getState().setSession(
      {
        id: 'adm-001',
        name: 'Super Admin',
        email: 'super@sevanest.internal',
        role: 'SUPER_ADMIN',
        permissions: ['*'],
      },
      'active-token'
    );

    const { router } = renderAuthFlow('/auth/login');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/dashboard');
    });
  });

  it('executes full logout flow: calls repository, clears in-memory session, and blocks protected access', async () => {
    const user = userEvent.setup();
    const logoutSpy = vi.spyOn(authRepository, 'logout');

    // Start with active authenticated session on dashboard
    useAuthStore.getState().setSession(
      {
        id: 'ops-01',
        name: 'Operations Manager',
        email: 'ops.admin@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: ['*'],
      },
      'token-ops-active'
    );

    const { router } = renderAuthFlow('/dashboard');

    // Find and click Sign Out button in sidebar/shell
    const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
    await user.click(signOutBtn);

    // Verify authRepository.logout was invoked
    expect(logoutSpy).toHaveBeenCalledTimes(1);

    // Verify session state is completely cleared
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();

    // Verify redirection to /auth/login
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });

    // Try navigating back to protected route /dashboard
    await router.navigate('/dashboard');

    // Should immediately be redirected back to /auth/login
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });
  });

  it('clears in-memory session and redirects to login even when logout repository operation rejects', async () => {
    const user = userEvent.setup();
    vi.spyOn(authRepository, 'logout').mockRejectedValueOnce(new Error('Simulated network disconnect'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    useAuthStore.getState().setSession(
      {
        id: 'ops-01',
        name: 'Operations Manager',
        email: 'ops.admin@sevanest.internal',
        role: 'OPERATIONS_ADMIN',
        permissions: ['*'],
      },
      'token-ops-active'
    );

    const { router } = renderAuthFlow('/dashboard');

    const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
    await user.click(signOutBtn);

    // Session must be cleared despite repository rejection
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();

    // Redirection to /auth/login must succeed
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });

    // Protected route must remain blocked
    await router.navigate('/dashboard');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/auth/login');
    });

    warnSpy.mockRestore();
  });

  describe('Regression: Secure Login Form Reset & Credential Hygiene', () => {
    it('1. initializes with completely empty email and password fields and no bullet dots', async () => {
      renderAuthFlow('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal');
      const passwordInput = screen.getByPlaceholderText('Enter password');

      expect(emailInput).toHaveValue('');
      expect(passwordInput).toHaveValue('');
      expect(passwordInput).toHaveAttribute('type', 'password');
      // Critical check: placeholder must NOT contain bullet dots
      expect(passwordInput.getAttribute('placeholder')).not.toContain('•');
      expect(passwordInput.getAttribute('placeholder')).toBe('Enter password');
      expect(screen.getByRole('button', { name: /Show password/i })).toBeInTheDocument();
      expect(emailInput).toHaveAttribute('autoComplete', 'username');
      expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
    });

    it('2 & 3. entering credentials works normally and password remains masked by default', async () => {
      const user = userEvent.setup();
      renderAuthFlow('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal');
      const passwordInput = screen.getByPlaceholderText('Enter password');

      await user.type(emailInput, 'staff.test@sevanest.internal');
      await user.type(passwordInput, 'MySecurePassword123!');

      expect(emailInput).toHaveValue('staff.test@sevanest.internal');
      expect(passwordInput).toHaveValue('MySecurePassword123!');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('4. visibility toggle only changes input type without altering value or submitting the form', async () => {
      const user = userEvent.setup();
      renderAuthFlow('/auth/login');

      const passwordInput = await screen.findByPlaceholderText('Enter password');
      const toggleBtn = screen.getByRole('button', { name: /Show password/i });

      await user.type(passwordInput, 'SecretCredentials456!');
      expect(passwordInput).toHaveAttribute('type', 'password');

      await user.click(toggleBtn);
      expect(passwordInput).toHaveAttribute('type', 'text');
      expect(passwordInput).toHaveValue('SecretCredentials456!');

      const hideBtn = screen.getByRole('button', { name: /Hide password/i });
      await user.click(hideBtn);
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(passwordInput).toHaveValue('SecretCredentials456!');

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('5. refreshing or remounting the login page does not restore previously entered credentials', async () => {
      const user = userEvent.setup();
      const firstRender = renderAuthFlow('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal');
      const passwordInput = screen.getByPlaceholderText('Enter password');

      await user.type(emailInput, 'sensitive.operator@sevanest.internal');
      await user.type(passwordInput, 'TopSecretPassword999!');

      expect(emailInput).toHaveValue('sensitive.operator@sevanest.internal');
      expect(passwordInput).toHaveValue('TopSecretPassword999!');

      // Unmount first render (simulating page navigation / component unmount)
      firstRender.unmount();

      // Ensure no browser storage mechanism captured credentials
      expect(window.localStorage.getItem('email')).toBeNull();
      expect(window.localStorage.getItem('password')).toBeNull();
      expect(window.sessionStorage.getItem('email')).toBeNull();
      expect(window.sessionStorage.getItem('password')).toBeNull();

      // Fresh render (simulating page reload / fresh visit)
      renderAuthFlow('/auth/login');

      const freshEmailInput = await screen.findByPlaceholderText('name@sevanest.internal');
      const freshPasswordInput = screen.getByPlaceholderText('Enter password');

      expect(freshEmailInput).toHaveValue('');
      expect(freshPasswordInput).toHaveValue('');
      expect(freshPasswordInput).toHaveAttribute('type', 'password');
    });

    it('6 & 7. persona selectors are removed and credentials must be typed manually', async () => {
      renderAuthFlow('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal');
      const passwordInput = screen.getByPlaceholderText('Enter password');

      expect(emailInput).toHaveValue('');
      expect(passwordInput).toHaveValue('');

      // Verify all persona selector buttons and sections are absent
      expect(screen.queryByText('Quick Persona Testing Selectors:')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Super Admin' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Operations Admin' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Verification Exec' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Support Exec' })).not.toBeInTheDocument();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('8. failed authentication does not leave the password persisted, while preserving email for usability', async () => {
      const user = userEvent.setup();
      renderAuthFlow('/auth/login');

      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal');
      const passwordInput = screen.getByPlaceholderText('Enter password');
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });

      await user.type(emailInput, 'ops.admin@sevanest.internal');
      await user.type(passwordInput, 'incorrectPassword!');

      await user.click(submitBtn);

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      // Email is preserved for user convenience
      expect(emailInput).toHaveValue('ops.admin@sevanest.internal');
      // Password field is cleared immediately for security
      expect(passwordInput).toHaveValue('');
      // Storage never contains the password
      expect(window.localStorage.getItem('password')).toBeNull();
      expect(window.sessionStorage.getItem('password')).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('9. logout clears sensitive authentication state and leaves the login form in a fresh clean state', async () => {
      const user = userEvent.setup();

      // Establish authenticated session
      useAuthStore.getState().setSession(
        {
          id: 'ops-01',
          name: 'Operations Manager',
          email: 'ops.admin@sevanest.internal',
          role: 'OPERATIONS_ADMIN',
          permissions: ['*'],
        },
        'token-ops-active',
        'refresh-oper-test'
      );

      const { router } = renderAuthFlow('/dashboard');

      const signOutBtn = await screen.findByRole('button', { name: /Sign Out/i }, { timeout: 4000 });
      await user.click(signOutBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });

      // Assert store state is wiped
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();

      // Assert login form inputs are clean and empty
      const emailInput = await screen.findByPlaceholderText('name@sevanest.internal');
      const passwordInput = screen.getByPlaceholderText('Enter password');

      expect(emailInput).toHaveValue('');
      expect(passwordInput).toHaveValue('');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('SevaNest Branding & Logo Integration', () => {
    it('renders the official SevaNest logo on the login page', async () => {
      renderAuthFlow('/auth/login');

      const logo = await screen.findByAltText('SevaNest logo');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', '/sevanest-logo.png');
    });

    it('renders the official SevaNest logo in the authenticated shell sidebar', async () => {
      useAuthStore.getState().setSession(
        {
          id: 'adm-001',
          name: 'Super Administrator',
          email: 'super.admin@sevanest.internal',
          role: 'SUPER_ADMIN',
          permissions: ['*'],
        },
        'token-super-123'
      );

      renderAuthFlow('/dashboard');

      const logo = await screen.findByAltText('SevaNest logo');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', '/sevanest-logo.png');
    });
  });

  describe('Session Restoration & Refresh Persistence', () => {
    it('restores authenticated session across simulated browser refresh when valid refresh token is stored', async () => {
      // Simulate stored refresh token in localStorage from previous session
      window.localStorage.setItem('sevanest_refresh_token', 'refresh-oper-1720000000');
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: false,
        isAuthenticated: false,
        user: null,
        accessToken: null,
      });

      const { router } = renderAuthFlow('/dashboard');

      // Should restore session and stay on dashboard without redirecting to /auth/login
      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
      });

      expect(useAuthStore.getState().user?.role).toBe('OPERATIONS_ADMIN');
      expect(router.state.location.pathname).toBe('/dashboard');
    });

    it('clears stored session and redirects to login when refresh token is invalid or expired', async () => {
      window.localStorage.setItem('sevanest_refresh_token', 'invalid-token-xyz');
      useAuthStore.setState({
        isInitialized: false,
        isRestoring: false,
        isAuthenticated: false,
        user: null,
        accessToken: null,
      });

      const { router } = renderAuthFlow('/dashboard');

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/auth/login');
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(window.localStorage.getItem('sevanest_refresh_token')).toBeNull();
    });
  });
});


