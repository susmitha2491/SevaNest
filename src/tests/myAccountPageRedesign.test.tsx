import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { authRepository } from '../features/auth/data/authRepository';
import { PERMISSIONS } from '../core/rbac/permissions';
import { AdminUser } from '../core/auth/authTypes';

function renderApp(initialEntry = '/account') {
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

const TEST_SUPPORT_EXEC: AdminUser = {
  id: 'usr-support-01',
  name: 'Rahul Varma',
  email: 'support.exec@sevanest.internal',
  role: 'SUPPORT_EXECUTIVE',
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.SUPPORT_VIEW,
    PERMISSIONS.SUPPORT_MANAGE,
    PERMISSIONS.BOOKINGS_VIEW,
  ],
  phone: '+91 98765 12345',
  status: 'ACTIVE',
  createdAt: '2026-02-01T10:00:00Z',
  userType: 'ADMIN',
};

describe('My Account & Staff Profile Redesign', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession(false);
    window.localStorage.clear();
    window.sessionStorage.clear();
    authRepository.supportsProfileUpdate = true;
    useAuthStore.getState().setSession(TEST_SUPPORT_EXEC, 'token-support-01');
    vi.restoreAllMocks();
  });

  describe('1. Profile Overview Header Banner', () => {
    it('renders the complete profile overview header with staff details, role, ID, and status badge', async () => {
      renderApp('/account');

      expect(await screen.findByRole('heading', { name: /My Account & Staff Profile/i })).toBeInTheDocument();
      expect(screen.getByTestId('account-profile-overview-card')).toBeInTheDocument();

      // Staff Full Name in overview
      expect(screen.getAllByText('Rahul Varma').length).toBeGreaterThanOrEqual(1);

      // Role badge
      expect(screen.getAllByText(/Support Executive/i).length).toBeGreaterThanOrEqual(1);

      // Staff ID
      expect(screen.getAllByText(/usr-support-01/i).length).toBeGreaterThanOrEqual(1);

      // Status badge
      expect(screen.getAllByText(/ACTIVE/i).length).toBeGreaterThanOrEqual(1);

      // Edit Profile button
      expect(screen.getByTestId('edit-profile-button')).toBeInTheDocument();
    });

    it('renders Return to Workstation button that navigates back to landing dashboard', async () => {
      const { router } = renderApp('/account');

      const returnBtn = await screen.findByTestId('return-workstation-button');
      expect(returnBtn).toBeInTheDocument();

      fireEvent.click(returnBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/dashboard');
      });
    });
  });

  describe('2. Profile Information Two-Column Grid', () => {
    it('displays the key administrative identity values in a clean key-value layout', async () => {
      renderApp('/account');

      expect(await screen.findByTestId('account-profile-card')).toBeInTheDocument();
      expect(screen.getByTestId('account-identity-card')).toBeInTheDocument();

      expect(screen.getByTestId('account-user-name')).toHaveTextContent('Rahul Varma');
      expect(screen.getByTestId('account-user-email')).toHaveTextContent('support.exec@sevanest.internal');
      expect(screen.getByTestId('account-user-phone')).toHaveTextContent('+91 98765 12345');
      expect(screen.getByTestId('account-user-role')).toHaveTextContent('Support Executive');
      expect(screen.getByTestId('account-user-id')).toHaveTextContent('Staff ID: usr-support-01');
      expect(screen.getByTestId('account-user-status')).toHaveTextContent('ACTIVE');
    });

    it('confirms Assigned Permissions Scope card and badges are absent from the UI (BUG-001)', async () => {
      renderApp('/account');

      expect(await screen.findByTestId('account-profile-card')).toBeInTheDocument();
      expect(screen.queryByTestId('account-permissions-scope-card')).not.toBeInTheDocument();
      expect(screen.queryByText(/Assigned Permissions Scope/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Authoritative permissions granted by backend security tokens/i)).not.toBeInTheDocument();
    });
  });

  describe('3. Profile Photo Removal & Non-clickable Initials Display', () => {
    it('confirms photo upload input, camera icon button, and preview controls are absent', async () => {
      renderApp('/account');

      expect(await screen.findByTestId('account-profile-card')).toBeInTheDocument();

      // Simple initials-based avatar is present
      expect(screen.getByTestId('account-avatar')).toBeInTheDocument();
      expect(screen.getByTestId('account-avatar')).toHaveTextContent('R');

      // Camera button, file input, and photo action controls are removed
      expect(screen.queryByTitle(/Upload or change profile photo/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId('profile-photo-input')).not.toBeInTheDocument();
      expect(screen.queryByTestId('profile-photo-preview')).not.toBeInTheDocument();
      expect(screen.queryByTestId('remove-photo-button')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Save New Photo/i })).not.toBeInTheDocument();
    });
  });

  describe('4. Dedicated Secure Change Password Section', () => {
    it('renders all required password fields with visibility toggles and never prefills values', async () => {
      renderApp('/account');

      expect(await screen.findByTestId('account-change-password-card')).toBeInTheDocument();

      const currentInput = screen.getByTestId('current-password-input');
      const newInput = screen.getByTestId('new-password-input');
      const confirmInput = screen.getByTestId('confirm-password-input');

      // Never prefilled
      expect(currentInput).toHaveValue('');
      expect(newInput).toHaveValue('');
      expect(confirmInput).toHaveValue('');

      // Visibility toggles
      expect(currentInput).toHaveAttribute('type', 'password');
      const toggleCurrentBtn = screen.getByTestId('toggle-current-password-visibility');
      fireEvent.click(toggleCurrentBtn);
      expect(currentInput).toHaveAttribute('type', 'text');
      fireEvent.click(toggleCurrentBtn);
      expect(currentInput).toHaveAttribute('type', 'password');

      expect(newInput).toHaveAttribute('type', 'password');
      const toggleNewBtn = screen.getByTestId('toggle-new-password-visibility');
      fireEvent.click(toggleNewBtn);
      expect(newInput).toHaveAttribute('type', 'text');
    });

    it('validates required fields, minimum 8 characters, and password mismatch', async () => {
      renderApp('/account');

      const submitBtn = await screen.findByTestId('change-password-button');
      const currentInput = screen.getByTestId('current-password-input');
      const newInput = screen.getByTestId('new-password-input');
      const confirmInput = screen.getByTestId('confirm-password-input');

      // 1. Submit empty
      fireEvent.click(submitBtn);
      expect(await screen.findByText('Current password is required.')).toBeInTheDocument();
      expect(screen.getByText('New password is required.')).toBeInTheDocument();

      // 2. Short new password (< 8 chars)
      fireEvent.change(currentInput, { target: { value: 'oldPassword123' } });
      fireEvent.change(newInput, { target: { value: 'short' } });
      fireEvent.change(confirmInput, { target: { value: 'short' } });
      fireEvent.click(submitBtn);

      expect(await screen.findByText('New password must be at least 8 characters.')).toBeInTheDocument();

      // 3. New password identical to current
      fireEvent.change(newInput, { target: { value: 'oldPassword123' } });
      fireEvent.change(confirmInput, { target: { value: 'oldPassword123' } });
      fireEvent.click(submitBtn);

      expect(await screen.findByText('New password cannot be identical to current password.')).toBeInTheDocument();

      // 4. Password mismatch
      fireEvent.change(newInput, { target: { value: 'NewSecurePass@2026' } });
      fireEvent.change(confirmInput, { target: { value: 'MismatchPass@2026' } });
      fireEvent.click(submitBtn);

      expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    });

    it('calls real backend change password API, shows success alert, and clears fields', async () => {
      const changePasswordSpy = vi.spyOn(authRepository, 'changePassword').mockResolvedValue();

      renderApp('/account');

      const currentInput = await screen.findByTestId('current-password-input');
      const newInput = screen.getByTestId('new-password-input');
      const confirmInput = screen.getByTestId('confirm-password-input');
      const submitBtn = screen.getByTestId('change-password-button');

      fireEvent.change(currentInput, { target: { value: 'currentSecret@123' } });
      fireEvent.change(newInput, { target: { value: 'brandNewSecret@456' } });
      fireEvent.change(confirmInput, { target: { value: 'brandNewSecret@456' } });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(changePasswordSpy).toHaveBeenCalledWith({
          currentPassword: 'currentSecret@123',
          newPassword: 'brandNewSecret@456',
        });
      });

      // Shows success message
      expect(await screen.findByTestId('password-change-success')).toHaveTextContent(
        'Password successfully updated. All other active sessions have been revoked'
      );

      // Clears inputs
      expect(currentInput).toHaveValue('');
      expect(newInput).toHaveValue('');
      expect(confirmInput).toHaveValue('');
    });

    it('displays meaningful error when backend rejects password change and clears inputs', async () => {
      vi.spyOn(authRepository, 'changePassword').mockRejectedValue(
        new Error('Incorrect current password. Verification failed.')
      );

      renderApp('/account');

      const currentInput = await screen.findByTestId('current-password-input');
      const newInput = screen.getByTestId('new-password-input');
      const confirmInput = screen.getByTestId('confirm-password-input');
      const submitBtn = screen.getByTestId('change-password-button');

      fireEvent.change(currentInput, { target: { value: 'wrongSecret' } });
      fireEvent.change(newInput, { target: { value: 'brandNewSecret@456' } });
      fireEvent.change(confirmInput, { target: { value: 'brandNewSecret@456' } });

      fireEvent.click(submitBtn);

      expect(await screen.findByTestId('password-change-error')).toHaveTextContent(
        'Incorrect current password. Verification failed.'
      );

      // Inputs cleared for security
      expect(currentInput).toHaveValue('');
      expect(newInput).toHaveValue('');
      expect(confirmInput).toHaveValue('');
    });
  });
});
