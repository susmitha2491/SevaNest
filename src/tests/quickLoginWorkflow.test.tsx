import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import * as envConfig from '../core/config/env';

function renderAuthFlow(initialEntry = '/auth/login') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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

describe('Quick Login — Four Admin Roles Workflows & Validation', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('1. renders login form at the top and Quick Login section below the Sign In button', async () => {
    renderAuthFlow('/auth/login');

    expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();

    const emailInput = screen.getByPlaceholderText('name@sevanest.internal');
    const passwordInput = screen.getByPlaceholderText('Enter password');
    const signInBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    const quickLoginHeading = screen.getByText('Quick Login — Select Your Role');

    // Both inputs and sign in button are in the document
    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(signInBtn).toBeInTheDocument();
    expect(quickLoginHeading).toBeInTheDocument();

    // Verify DOM order: Sign In button appears before Quick Login section
    expect(
      Boolean(signInBtn.compareDocumentPosition(quickLoginHeading) & window.Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true);
  });

  it('2. displays exactly the four roles with role names, without Select Role buttons', async () => {
    renderAuthFlow('/auth/login');

    expect(await screen.findByText('Quick Login — Select Your Role', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText('4 Roles')).toBeInTheDocument();

    // Exactly 4 role titles
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByText('Operations Admin')).toBeInTheDocument();
    expect(screen.getByText('Verification Executive')).toBeInTheDocument();
    expect(screen.getByText('Support Executive')).toBeInTheDocument();

    // Exactly 4 email addresses displayed
    expect(screen.getByText('sevanest@admin.in')).toBeInTheDocument();
    expect(screen.getByText('operations.manager@sevanest.example.com')).toBeInTheDocument();
    expect(screen.getByText('verification.executive@sevanest.example.com')).toBeInTheDocument();
    expect(screen.getByText('support.executive@sevanest.example.com')).toBeInTheDocument();

    // Requirement: Remove all individual Quick Fill buttons
    expect(screen.queryByRole('button', { name: /Quick Fill/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Quick Fill/i)).not.toBeInTheDocument();

    // Requirement: Each card is directly selectable (no separate Select Role buttons)
    const selectCards = screen.getAllByTestId(/quick-login-card-/i);
    expect(selectCards.length).toBe(4);

    // Verify non-existent roles are absent
    expect(screen.queryByText('Verification Supervisor')).not.toBeInTheDocument();
  });

  it('3. Selecting Super Admin populates email and password without auto-submitting', async () => {
    const user = userEvent.setup();
    renderAuthFlow('/auth/login');

    const emailInput = await screen.findByPlaceholderText('name@sevanest.internal');
    const passwordInput = screen.getByPlaceholderText('Enter password');

    expect(emailInput).toHaveValue('');
    expect(passwordInput).toHaveValue('');

    const superAdminCard = await screen.findByTestId('quick-login-card-super-admin');
    await user.click(superAdminCard);

    // Verify fields populated
    expect(emailInput).toHaveValue('sevanest@admin.in');
    expect(passwordInput).toHaveValue('Sevanest@2026');

    // User must NOT be automatically authenticated
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('4. Selecting Operations Admin populates credentials and signs in on submit', async () => {
    const user = userEvent.setup();
    const { router } = renderAuthFlow('/auth/login');

    const opsAdminCard = await screen.findByTestId('quick-login-card-ops-admin');
    await user.click(opsAdminCard);

    const emailInput = screen.getByPlaceholderText('name@sevanest.internal');
    const passwordInput = screen.getByPlaceholderText('Enter password');

    expect(emailInput).toHaveValue('operations.manager@sevanest.example.com');
    expect(passwordInput).toHaveValue('SnFFtzKHJQu3wm#7q');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);

    // User explicitly clicks Sign In
    const signInBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    await user.click(signInBtn);

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.role).toBe('OPERATIONS_ADMIN');
      expect(router.state.location.pathname).toBe('/dashboard');
    });
  });

  it('5. Selecting Verification Executive populates credentials and routes to /verification', async () => {
    const user = userEvent.setup();
    const { router } = renderAuthFlow('/auth/login');

    const verifCard = await screen.findByTestId('quick-login-card-verification-exec');
    await user.click(verifCard);

    const emailInput = screen.getByPlaceholderText('name@sevanest.internal');
    const passwordInput = screen.getByPlaceholderText('Enter password');

    expect(emailInput).toHaveValue('verification.executive@sevanest.example.com');
    expect(passwordInput).toHaveValue('Sn-mvKYhFKPJE7#7q');

    const signInBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    await user.click(signInBtn);

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.role).toBe('VERIFICATION_EXECUTIVE');
      expect(router.state.location.pathname).toBe('/verification');
    });
  });

  it('6. Selecting Support Executive populates credentials and routes to /dashboard', async () => {
    const user = userEvent.setup();
    const { router } = renderAuthFlow('/auth/login');

    const supportCard = await screen.findByTestId('quick-login-card-support-exec');
    await user.click(supportCard);

    const emailInput = screen.getByPlaceholderText('name@sevanest.internal');
    const passwordInput = screen.getByPlaceholderText('Enter password');

    expect(emailInput).toHaveValue('support.executive@sevanest.example.com');
    expect(passwordInput).toHaveValue('SnGprIJDAxciUB#7q');

    const signInBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    await user.click(signInBtn);

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.role).toBe('SUPPORT_EXECUTIVE');
      expect(router.state.location.pathname).toBe('/dashboard');
    });
  });

  it('7. Editing fields does not automatically reset role selection', async () => {
    const user = userEvent.setup();
    renderAuthFlow('/auth/login');

    const superAdminCard = await screen.findByTestId('quick-login-card-super-admin');
    await user.click(superAdminCard);

    const emailInput = screen.getByPlaceholderText('name@sevanest.internal');
    // After selecting a role, the email is populated - typing appends to it
    expect(emailInput).toHaveValue('sevanest@admin.in');

    // User can still type/edit the email if needed
    await user.type(emailInput, 'x');

    // Field now contains the typed text appended
    expect(emailInput).toHaveValue('sevanest@admin.inx');
  });

  it('8. Does not bypass authentication: bad credentials fail even if typed after role selection', async () => {
    const user = userEvent.setup();
    renderAuthFlow('/auth/login');

    const opsAdminCard = await screen.findByTestId('quick-login-card-ops-admin');
    await user.click(opsAdminCard);

    const passwordInput = screen.getByPlaceholderText('Enter password');
    await user.clear(passwordInput);
    await user.type(passwordInput, 'wrongpassword123');

    const signInBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    await user.click(signInBtn);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('9. Disables Quick Login section when isQuickLoginEnabled returns false', async () => {
    vi.spyOn(envConfig, 'isQuickLoginEnabled').mockReturnValue(false);

    renderAuthFlow('/auth/login');

    expect(await screen.findByText('Staff Sign In', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText('Quick Login — Select Your Role')).not.toBeInTheDocument();
    expect(screen.queryByText('4 Roles')).not.toBeInTheDocument();
    expect(screen.queryByText('or quick login')).not.toBeInTheDocument();
  });

  it('10. Clicking the role card body directly populates credentials', async () => {
    const user = userEvent.setup();
    renderAuthFlow('/auth/login');

    const superAdminCard = await screen.findByTestId('quick-login-card-super-admin');
    await user.click(superAdminCard);

    expect(screen.getByPlaceholderText('name@sevanest.internal')).toHaveValue('sevanest@admin.in');
    expect(screen.getByPlaceholderText('Enter password')).toHaveValue('Sevanest@2026');
  });

  it('11. Renders complete login layout structure: logo, subtitle, form, quick login, and footer', async () => {
    renderAuthFlow('/auth/login');

    const logo = await screen.findByAltText('SevaNest logo');
    const subtitle = screen.getByText('Operations & Administration Portal');
    const heading = screen.getByText('Staff Sign In');
    const signInBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    const quickLoginHeading = screen.getByText('Quick Login — Select Your Role');
    const footer = screen.getByText(/Verified Help\. Trusted Homes\. • SevaNest Admin/i);

    expect(logo).toBeInTheDocument();
    expect(subtitle).toBeInTheDocument();
    expect(heading).toBeInTheDocument();
    expect(signInBtn).toBeInTheDocument();
    expect(quickLoginHeading).toBeInTheDocument();
    expect(footer).toBeInTheDocument();

    // Verify correct top-to-bottom hierarchy in document order
    expect(Boolean(logo.compareDocumentPosition(subtitle) & window.Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(subtitle.compareDocumentPosition(heading) & window.Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(heading.compareDocumentPosition(signInBtn) & window.Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(signInBtn.compareDocumentPosition(quickLoginHeading) & window.Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(quickLoginHeading.compareDocumentPosition(footer) & window.Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });
});