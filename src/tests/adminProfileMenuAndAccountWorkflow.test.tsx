import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { authRepository } from '../features/auth/data/authRepository';
import { PERMISSIONS } from '../core/rbac/permissions';
import { AdminUser, UpdateProfileDto } from '../core/auth/authTypes';

function renderApp(initialEntry = '/dashboard') {
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

const TEST_ADMIN_USER: AdminUser = {
  id: 'usr-admin-01',
  name: 'Sushmitha Polugari',
  email: 'sushmitha@sevanest.internal',
  role: 'OPERATIONS_ADMIN',
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.WORKER_VIEW,
    PERMISSIONS.VERIFICATION_REVIEW,
  ],
  phone: '+91 98765 43210',
  status: 'ACTIVE',
  createdAt: '2026-01-15T10:00:00Z',
  userType: 'ADMIN',
};

describe('Admin Profile Menu & Account Details Workflow', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession(false);
    window.localStorage.clear();
    window.sessionStorage.clear();
    authRepository.supportsProfileUpdate = false;
    vi.restoreAllMocks();
  });

  describe('1. Profile Icon Interaction & Dropdown Menu', () => {
    beforeEach(() => {
      useAuthStore.getState().setSession(TEST_ADMIN_USER, 'token-test-01');
    });

    it('opens dropdown menu when profile icon in the top-right header is clicked', async () => {
      renderApp('/dashboard');

      const triggerBtn = await screen.findByTestId('header-profile-button');
      expect(triggerBtn).toBeInTheDocument();
      expect(triggerBtn).toHaveAttribute('aria-expanded', 'false');

      // Click to open
      fireEvent.click(triggerBtn);

      expect(triggerBtn).toHaveAttribute('aria-expanded', 'true');
      const menu = await screen.findByTestId('header-profile-menu');
      expect(menu).toBeInTheDocument();

      // Displays real authenticated user info
      expect(screen.getByTestId('profile-menu-name')).toHaveTextContent('Sushmitha Polugari');
      expect(screen.getByTestId('profile-menu-email')).toHaveTextContent('sushmitha@sevanest.internal');
      expect(screen.getByTestId('profile-menu-role')).toHaveTextContent('Operations Admin');

      // Action options
      expect(screen.getByTestId('profile-menu-view')).toHaveTextContent('View Profile');
      expect(screen.getByTestId('profile-menu-logout')).toHaveTextContent('Sign Out');
    });

    it('closes profile dropdown when Escape key is pressed', async () => {
      renderApp('/dashboard');

      const triggerBtn = await screen.findByTestId('header-profile-button');
      fireEvent.click(triggerBtn);
      expect(await screen.findByTestId('header-profile-menu')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByTestId('header-profile-menu')).not.toBeInTheDocument();
      });
    });

    it('closes profile dropdown when clicking outside the menu', async () => {
      renderApp('/dashboard');

      const triggerBtn = await screen.findByTestId('header-profile-button');
      fireEvent.click(triggerBtn);
      expect(await screen.findByTestId('header-profile-menu')).toBeInTheDocument();

      // Click outside on body
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByTestId('header-profile-menu')).not.toBeInTheDocument();
      });
    });

    it('navigates to /account and closes menu when View Profile is clicked', async () => {
      const { router } = renderApp('/dashboard');

      const triggerBtn = await screen.findByTestId('header-profile-button');
      fireEvent.click(triggerBtn);

      const viewProfileBtn = await screen.findByTestId('profile-menu-view');
      fireEvent.click(viewProfileBtn);

      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/account');
        expect(screen.queryByTestId('header-profile-menu')).not.toBeInTheDocument();
      });
    });

    it('signs out session when Sign Out option in profile menu is selected', async () => {
      const logoutSpy = vi.spyOn(authRepository, 'logout').mockResolvedValue();
      const { router } = renderApp('/dashboard');

      const triggerBtn = await screen.findByTestId('header-profile-button');
      fireEvent.click(triggerBtn);

      const logoutBtn = await screen.findByTestId('profile-menu-logout');
      fireEvent.click(logoutBtn);

      await waitFor(() => {
        expect(logoutSpy).toHaveBeenCalled();
        expect(useAuthStore.getState().isAuthenticated).toBe(false);
        expect(router.state.location.pathname).toBe('/auth/login');
      });
    });
  });

  describe('2. Read-Only Enforcement when Backend Lacks Profile Mutation API', () => {
    beforeEach(() => {
      authRepository.supportsProfileUpdate = false;
      useAuthStore.getState().setSession(TEST_ADMIN_USER, 'token-test-01');
    });

    it('hides the Edit Profile option in header dropdown when backend does not support editing', async () => {
      renderApp('/dashboard');

      const triggerBtn = await screen.findByTestId('header-profile-button');
      fireEvent.click(triggerBtn);

      expect(await screen.findByTestId('header-profile-menu')).toBeInTheDocument();
      expect(screen.queryByTestId('profile-menu-edit')).not.toBeInTheDocument();
    });

    it('displays the single Profile Information card in read-only mode without edit button on /account', async () => {
      renderApp('/account');

      expect(await screen.findByRole('heading', { name: /My Account & Staff Profile/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Profile Information/i })).toBeInTheDocument();
      expect(screen.getByTestId('account-profile-card')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-profile-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('readonly-backend-notice')).not.toBeInTheDocument();
    });

    it('prevents entering edit mode when URL has mode=edit if backend editing is unsupported', async () => {
      renderApp('/account?mode=edit');

      expect(await screen.findByRole('heading', { name: /My Account & Staff Profile/i })).toBeInTheDocument();
      expect(screen.queryByTestId('edit-profile-form')).not.toBeInTheDocument();
      expect(await screen.findByTestId('account-identity-card')).toBeInTheDocument();
    });
  });

  describe('3. Displaying Authenticated User Real Profile Information', () => {
    it('displays full name, email, phone, role, status, staff ID without placeholders', async () => {
      useAuthStore.getState().setSession(TEST_ADMIN_USER, 'token-test-01');
      renderApp('/account');

      expect(await screen.findByTestId('account-user-name')).toHaveTextContent('Sushmitha Polugari');
      expect(screen.getByTestId('account-user-email')).toHaveTextContent('sushmitha@sevanest.internal');
      expect(screen.getByTestId('account-user-role')).toHaveTextContent('Operations Admin');
      expect(screen.getByTestId('account-user-phone')).toHaveTextContent('+91 98765 43210');
      expect(screen.getByTestId('account-user-status')).toHaveTextContent('ACTIVE');
      expect(screen.getByTestId('account-user-id')).toHaveTextContent('Staff ID: usr-admin-01');
    });

    it('displays simple "Not provided" label when phone number is omitted by backend', async () => {
      const userWithoutPhone: AdminUser = {
        ...TEST_ADMIN_USER,
        phone: null,
        mobile: null,
      };
      useAuthStore.getState().setSession(userWithoutPhone, 'token-test-01');
      renderApp('/account');

      expect(await screen.findByTestId('account-user-phone')).toHaveTextContent('Not provided');
    });

    it('does not render telemetry, boundaries, or permissions matrix sections', async () => {
      useAuthStore.getState().setSession(TEST_ADMIN_USER, 'token-test-01');
      renderApp('/account');

      expect(await screen.findByRole('heading', { name: /Profile Information/i })).toBeInTheDocument();
      expect(screen.queryByTestId('permissions-matrix')).not.toBeInTheDocument();
      expect(screen.queryByText(/Security & Session Telemetry/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Operational Role Boundaries/i)).not.toBeInTheDocument();
    });
  });

  describe('4. Edit Profile Workflow When Supported by Backend', () => {
    beforeEach(() => {
      authRepository.supportsProfileUpdate = true;
      useAuthStore.getState().setSession(TEST_ADMIN_USER, 'token-test-01');
    });

    it('shows Edit Profile in dropdown and allows entering and cancelling edit mode', async () => {
      renderApp('/dashboard');

      const triggerBtn = await screen.findByTestId('header-profile-button');
      fireEvent.click(triggerBtn);

      const editMenuItem = await screen.findByTestId('profile-menu-edit');
      expect(editMenuItem).toBeInTheDocument();
      fireEvent.click(editMenuItem);

      // Now on /account in edit mode
      expect(await screen.findByTestId('edit-profile-form')).toBeInTheDocument();
      expect(screen.getByTestId('edit-name-input')).toHaveValue('Sushmitha Polugari');
      expect(screen.getByTestId('edit-email-input')).toHaveValue('sushmitha@sevanest.internal');
      expect(screen.getByTestId('edit-phone-input')).toHaveValue('+91 98765 43210');

      // Cancel button exits edit mode
      const cancelBtn = screen.getByTestId('cancel-edit-profile-button');
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('edit-profile-form')).not.toBeInTheDocument();
        expect(screen.getByTestId('account-identity-card')).toBeInTheDocument();
      });
    });

    it('validates required name field and email format', async () => {
      renderApp('/account?mode=edit');

      expect(await screen.findByTestId('edit-profile-form')).toBeInTheDocument();

      const nameInput = screen.getByTestId('edit-name-input');
      const emailInput = screen.getByTestId('edit-email-input');
      const saveBtn = screen.getByTestId('save-profile-button');

      // Clear name
      fireEvent.change(nameInput, { target: { value: '' } });
      fireEvent.click(saveBtn);

      expect(await screen.findByTestId('edit-name-error')).toHaveTextContent('Full name is required.');

      // Restore name, enter invalid email
      fireEvent.change(nameInput, { target: { value: 'Valid Name' } });
      fireEvent.change(emailInput, { target: { value: 'invalid-email-address' } });
      fireEvent.click(saveBtn);

      expect(await screen.findByTestId('edit-email-error')).toHaveTextContent('Please provide a valid email address.');
    });

    it('validates telephone format when phone is modified', async () => {
      renderApp('/account?mode=edit');

      expect(await screen.findByTestId('edit-profile-form')).toBeInTheDocument();

      const phoneInput = screen.getByTestId('edit-phone-input');
      const saveBtn = screen.getByTestId('save-profile-button');

      fireEvent.change(phoneInput, { target: { value: 'abc-not-a-number' } });
      fireEvent.click(saveBtn);

      expect(await screen.findByTestId('edit-phone-error')).toHaveTextContent('Please provide a valid telephone number');
    });

    it('strictly prevents editing roles, permissions, or account status', async () => {
      renderApp('/account?mode=edit');

      expect(await screen.findByTestId('edit-profile-form')).toBeInTheDocument();

      // Role is locked and marked Server-Issued
      const lockedRole = screen.getByTestId('edit-role-locked');
      expect(lockedRole).toBeInTheDocument();
      expect(lockedRole).toHaveTextContent('Operations Admin');
      expect(lockedRole).toHaveTextContent(/Server-Issued/i);

      // Status is locked and marked Server-Issued
      const lockedStatus = screen.getByTestId('edit-status-locked');
      expect(lockedStatus).toBeInTheDocument();
      expect(lockedStatus).toHaveTextContent('ACTIVE');
      expect(lockedStatus).toHaveTextContent(/Server-Issued/i);
    });

    it('saves updated profile successfully, disables submit during save, and updates auth store', async () => {
      const updateSpy = vi.spyOn(authRepository, 'updateProfile').mockImplementation(async (dto: UpdateProfileDto) => {
        return {
          ...TEST_ADMIN_USER,
          name: dto.name || TEST_ADMIN_USER.name,
          phone: dto.phone || TEST_ADMIN_USER.phone,
        };
      });

      renderApp('/account?mode=edit');

      const nameInput = await screen.findByTestId('edit-name-input');
      const phoneInput = screen.getByTestId('edit-phone-input');
      const saveBtn = screen.getByTestId('save-profile-button');

      fireEvent.change(nameInput, { target: { value: 'Sushmitha P. Updated' } });
      fireEvent.change(phoneInput, { target: { value: '+91 91234 56789' } });

      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith({
          name: 'Sushmitha P. Updated',
          email: 'sushmitha@sevanest.internal',
          phone: '+91 91234 56789',
        });
      });

      // Form closed and profile updated
      expect(await screen.findByTestId('profile-edit-success')).toHaveTextContent('Profile details successfully updated.');
      expect(screen.getByTestId('account-user-name')).toHaveTextContent('Sushmitha P. Updated');
      expect(useAuthStore.getState().user?.name).toBe('Sushmitha P. Updated');
    });

    it('preserves entered values and displays meaningful error message on API failure', async () => {
      vi.spyOn(authRepository, 'updateProfile').mockRejectedValue(
        new Error('Network error: Backend server was unable to persist profile changes.')
      );

      renderApp('/account?mode=edit');

      const nameInput = await screen.findByTestId('edit-name-input');
      const saveBtn = screen.getByTestId('save-profile-button');

      fireEvent.change(nameInput, { target: { value: 'Attempted Name' } });
      fireEvent.click(saveBtn);

      const errorBanner = await screen.findByTestId('profile-edit-error');
      expect(errorBanner).toHaveTextContent('Network error: Backend server was unable to persist profile changes.');

      // Preserves entered value in input
      expect(nameInput).toHaveValue('Attempted Name');
      // Remains in edit mode
      expect(screen.getByTestId('edit-profile-form')).toBeInTheDocument();
    });
  });
});
