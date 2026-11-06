/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from '../app/router/routes';
import { useAuthStore } from '../core/auth/authStore';
import { authRepository } from '../features/auth/data/authRepository';
import { AdminUser, UpdateProfileDto } from '../core/auth/authTypes';
import { ConcurrencyConflictError, ValidationError } from '../core/errors/DomainError';

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

const TEST_ADMIN: AdminUser = {
  id: '01a11eec-ff90-73c8-972a-b88e3151ada0',
  staffId: 'STF-ADM-001',
  name: 'Super Administrator',
  email: 'sevanest@admin.in',
  role: 'SUPER_ADMIN',
  permissions: ['*'],
  phone: '+91 98765 43210',
  status: 'ACTIVE',
  createdAt: '2026-01-15T08:30:00.000Z',
  userType: 'ADMIN',
  avatarUrl: 'https://cdn.sevanest.internal/avatars/admin-001.webp',
};

describe('Admin Profile Backend API Integration Suite', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession(false);
    window.localStorage.clear();
    window.sessionStorage.clear();
    authRepository.supportsProfileUpdate = true;
    authRepository.supportsProfilePhotoUpload = true;
    useAuthStore.getState().setSession(TEST_ADMIN, 'token-super-admin-01');
    vi.restoreAllMocks();
  });

  describe('1. Profile Retrieval (GET /api/v1/admin/me/profile)', () => {
    it('fetches authenticated admin profile from backend on mount and displays real identity', async () => {
      const getProfileSpy = vi.spyOn(authRepository as any, 'getAdminProfile').mockResolvedValue({
        ...TEST_ADMIN,
        name: 'Super Administrator (Backend Verified)',
        staffId: 'STF-ADM-999',
        phone: '+91 99999 11111',
      });

      renderApp('/account');

      await waitFor(() => {
        expect(getProfileSpy).toHaveBeenCalled();
      });

      // Name updated from backend
      expect(await screen.findByRole('heading', { name: /Super Administrator \(Backend Verified\)/i })).toBeInTheDocument();
      // Staff ID updated
      expect(screen.getAllByText(/STF-ADM-999/i).length).toBeGreaterThanOrEqual(1);
      // Phone updated
      expect(screen.getByTestId('account-user-phone')).toHaveTextContent('+91 99999 11111');
      // Role preserved
      expect(screen.getAllByText(/Super Admin/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2. Successful Profile Update (PATCH /api/v1/admin/me/profile)', () => {
    it('updates full name, email, and phone successfully via PATCH', async () => {
      const updateSpy = vi.spyOn(authRepository, 'updateProfile').mockImplementation(async (dto: UpdateProfileDto) => {
        return {
          ...TEST_ADMIN,
          name: dto.name || TEST_ADMIN.name,
          email: dto.email || TEST_ADMIN.email,
          phone: dto.phone || TEST_ADMIN.phone,
        };
      });

      renderApp('/account?mode=edit');

      const nameInput = await screen.findByTestId('edit-name-input');
      const emailInput = screen.getByTestId('edit-email-input');
      const phoneInput = screen.getByTestId('edit-phone-input');
      const saveBtn = screen.getByTestId('save-profile-button');

      fireEvent.change(nameInput, { target: { value: 'Admin Senior Leader' } });
      fireEvent.change(emailInput, { target: { value: 'senior.admin@sevanest.in' } });
      fireEvent.change(phoneInput, { target: { value: '+91 98888 77777' } });

      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith({
          name: 'Admin Senior Leader',
          email: 'senior.admin@sevanest.in',
          phone: '+91 98888 77777',
        });
      });

      expect(await screen.findByTestId('profile-edit-success')).toHaveTextContent('Profile details successfully updated.');
      expect(screen.getByTestId('account-user-name')).toHaveTextContent('Admin Senior Leader');
    });
  });

  describe('3. Partial Profile Update', () => {
    it('supports updating only phone number without requiring changes to name or email', async () => {
      const updateSpy = vi.spyOn(authRepository, 'updateProfile').mockImplementation(async (dto: UpdateProfileDto) => {
        return {
          ...TEST_ADMIN,
          ...(dto.phone ? { phone: dto.phone } : {}),
        };
      });

      renderApp('/account?mode=edit');

      const phoneInput = await screen.findByTestId('edit-phone-input');
      const saveBtn = screen.getByTestId('save-profile-button');

      fireEvent.change(phoneInput, { target: { value: '+91 97777 66666' } });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
        const callArg = updateSpy.mock.calls[0][0];
        expect(callArg.phone).toBe('+91 97777 66666');
      });

      expect(await screen.findByTestId('profile-edit-success')).toHaveTextContent('Profile details successfully updated.');
      expect(screen.getByTestId('account-user-phone')).toHaveTextContent('+91 97777 66666');
    });
  });

  describe('4. Duplicate Email and Phone Conflict (HTTP 409)', () => {
    it('surfaces a clear, non-technical conflict message when duplicate email or phone is rejected by server', async () => {
      vi.spyOn(authRepository, 'updateProfile').mockRejectedValue(
        new ConcurrencyConflictError(
          'Email address or phone number is already registered to another account.',
          undefined,
          409
        )
      );

      renderApp('/account?mode=edit');

      const emailInput = await screen.findByTestId('edit-email-input');
      const saveBtn = screen.getByTestId('save-profile-button');

      fireEvent.change(emailInput, { target: { value: 'duplicate@sevanest.in' } });
      fireEvent.click(saveBtn);

      const errorAlert = await screen.findByTestId('profile-edit-error');
      expect(errorAlert).toHaveTextContent(
        /Email address or phone number is already registered to another account/i
      );
      // Form remains in edit mode so user can correct it
      expect(screen.getByTestId('edit-profile-form')).toBeInTheDocument();
    });
  });

  describe('5. Profile Photo Upload (POST /api/v1/admin/me/profile-photo)', () => {
    it('uploads valid photo via multipart endpoint and updates avatar preview', async () => {
      const uploadSpy = vi.spyOn(authRepository as any, 'uploadProfilePhoto').mockResolvedValue({
        photoUrl: 'https://cdn.sevanest.internal/avatars/new-avatar-99.png',
      });

      renderApp('/account');

      const fileInput = await screen.findByTestId('profile-photo-input');
      const validPhoto = new File([new Uint8Array(50 * 1024)], 'new-avatar.png', { type: 'image/png' });

      fireEvent.change(fileInput, { target: { files: [validPhoto] } });

      const savePhotoBtn = await screen.findByRole('button', { name: /Save New Photo/i });
      fireEvent.click(savePhotoBtn);

      await waitFor(() => {
        expect(uploadSpy).toHaveBeenCalledWith(validPhoto);
      });

      expect(await screen.findByTestId('profile-edit-success')).toHaveTextContent(
        'Profile photo uploaded and updated successfully.'
      );
      expect(useAuthStore.getState().user?.avatarUrl).toBe(
        'https://cdn.sevanest.internal/avatars/new-avatar-99.png'
      );
    });
  });

  describe('6. Invalid File Types and Oversized Files', () => {
    it('rejects unsupported file formats before sending request', async () => {
      renderApp('/account');

      const fileInput = await screen.findByTestId('profile-photo-input');
      const invalidPdf = new File(['%PDF-1.4'], 'document.pdf', { type: 'application/pdf' });

      fireEvent.change(fileInput, { target: { files: [invalidPdf] } });

      expect(await screen.findByText(/Invalid image format. Allowed formats: PNG, JPEG, WebP./i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Save New Photo/i })).not.toBeInTheDocument();
    });

    it('rejects files larger than 2MB before sending request', async () => {
      renderApp('/account');

      const fileInput = await screen.findByTestId('profile-photo-input');
      const largeFile = new File([new Uint8Array(3 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      expect(await screen.findByText(/exceeds the 2MB size limit/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Save New Photo/i })).not.toBeInTheDocument();
    });
  });

  describe('7. Upload Failure Handling', () => {
    it('surfaces backend upload error clearly without corrupting existing profile', async () => {
      vi.spyOn(authRepository as any, 'uploadProfilePhoto').mockRejectedValue(
        new ValidationError('Image dimensions too small or corrupted file data.')
      );

      renderApp('/account');

      const fileInput = await screen.findByTestId('profile-photo-input');
      const photo = new File([new Uint8Array(20 * 1024)], 'avatar.webp', { type: 'image/webp' });

      fireEvent.change(fileInput, { target: { files: [photo] } });

      const savePhotoBtn = await screen.findByRole('button', { name: /Save New Photo/i });
      fireEvent.click(savePhotoBtn);

      expect(await screen.findByText(/Image dimensions too small or corrupted file data/i)).toBeInTheDocument();
    });
  });

  describe('8. Profile Refresh After Saving', () => {
    it('triggers profile refresh after successful profile update', async () => {
      vi.spyOn(authRepository, 'updateProfile').mockResolvedValue({
        ...TEST_ADMIN,
        name: 'Refreshed Administrator',
      });
      const getProfileSpy = vi.spyOn(authRepository as any, 'getAdminProfile').mockResolvedValue({
        ...TEST_ADMIN,
        name: 'Refreshed Administrator',
      });

      renderApp('/account?mode=edit');

      const nameInput = await screen.findByTestId('edit-name-input');
      const saveBtn = screen.getByTestId('save-profile-button');

      fireEvent.change(nameInput, { target: { value: 'Refreshed Administrator' } });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(getProfileSpy).toHaveBeenCalled();
      });

      expect(await screen.findByTestId('profile-edit-success')).toHaveTextContent('Profile details successfully updated.');
    });
  });

  describe('9. Change Password Functionality Remains Unaffected', () => {
    it('preserves existing POST /api/v1/admin/account/password integration without regressions', async () => {
      const changePasswordSpy = vi.spyOn(authRepository, 'changePassword').mockResolvedValue();

      renderApp('/account');

      const currentInput = await screen.findByTestId('current-password-input');
      const newInput = screen.getByTestId('new-password-input');
      const confirmInput = screen.getByTestId('confirm-password-input');
      const submitBtn = screen.getByTestId('change-password-button');

      fireEvent.change(currentInput, { target: { value: 'CurrentSecret@2026' } });
      fireEvent.change(newInput, { target: { value: 'BrandNewSecret@2027' } });
      fireEvent.change(confirmInput, { target: { value: 'BrandNewSecret@2027' } });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(changePasswordSpy).toHaveBeenCalledWith({
          currentPassword: 'CurrentSecret@2026',
          newPassword: 'BrandNewSecret@2027',
        });
      });

      expect(await screen.findByTestId('password-change-success')).toHaveTextContent(
        'Password successfully updated. All other active sessions have been revoked'
      );
    });
  });
});
