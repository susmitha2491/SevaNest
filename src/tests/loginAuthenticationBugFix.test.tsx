import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SignInPage } from '../features/auth/presentation/SignInPage';
import { authRepository } from '../features/auth/data/authRepository';
import { normalizeAuthError } from '../core/errors/authErrorNormalizer';
import {
  UnauthorizedError,
  RateLimitExceededError,
  ServerFailureError,
  NetworkError,
  TimeoutError,
} from '../core/errors/DomainError';
import { useAuthStore } from '../core/auth/authStore';
import { QUICK_LOGIN_ROLES } from '../features/auth/presentation/quickLoginRoles';

describe('SevaNest Admin Portal — Complete Login Authentication Bug Fix', () => {
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession(false);
    window.localStorage.clear();
    window.sessionStorage.clear();
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: originalOnLine,
    });
  });

  describe('1. Centralized Auth Error Normalizer & Message Sanitization', () => {
    it('normalizes HTTP 401 Unauthorized to exact contract "Invalid email id or password"', () => {
      const err = new UnauthorizedError('Invalid credentials', 'ref-id-401');
      const normalized = normalizeAuthError(err);
      expect(normalized.userMessage).toBe('Invalid email id or password');
      expect(normalized.isCredentialError).toBe(true);
      expect(normalized.isRetryable).toBe(false);
      expect(normalized.cooldownSeconds).toBe(0);
      expect(normalized.userMessage).not.toContain('ref-id-401');
      expect(normalized.userMessage).not.toContain('Ref:');
    });

    it('normalizes HTTP 400 Bad Request ("Invalid request") to exact contract "Invalid email id or password"', () => {
      const axiosErr = {
        isAxiosError: true,
        response: {
          status: 400,
          data: { code: 'BAD_REQUEST', message: 'Invalid request', requestId: '01885182-5fa5-4913' },
        },
      };
      const normalized = normalizeAuthError(axiosErr);
      expect(normalized.userMessage).toBe('Invalid email id or password');
      expect(normalized.isCredentialError).toBe(true);
      expect(normalized.isRetryable).toBe(false);
      expect(normalized.userMessage).not.toContain('01885182-5fa5-4913');
      expect(normalized.userMessage).not.toContain('Ref:');
    });

    it('produces the exact same message for invalid email and invalid password without field disclosure', () => {
      const invalidEmailErr = new UnauthorizedError('Administrative account not found.');
      const invalidPassErr = new UnauthorizedError('Invalid administrative credentials.');

      const normEmail = normalizeAuthError(invalidEmailErr);
      const normPass = normalizeAuthError(invalidPassErr);

      expect(normEmail.userMessage).toBe('Invalid email id or password');
      expect(normPass.userMessage).toBe('Invalid email id or password');
      expect(normEmail.userMessage).toBe(normPass.userMessage);
    });

    it('normalizes Cloudflare challenge responses to exact contract message without raw HTML or reference IDs', () => {
      const cfHtmlError = {
        isAxiosError: true,
        response: {
          status: 403,
          headers: {
            'cf-mitigated': 'challenge',
            'cf-ray': 'a6071b50edfcaf9e-MAA',
          },
          data: '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>challenges.cloudflare.com</body></html>',
        },
      };

      const normalized = normalizeAuthError(cfHtmlError);
      expect(normalized.userMessage).toBe('Unable to connect to the authentication service. Please try again later.');
      expect(normalized.isRetryable).toBe(true);
      expect(normalized.cooldownSeconds).toBe(10);
      expect(normalized.isCredentialError).toBe(false);
      expect(normalized.userMessage).not.toContain('Just a moment');
      expect(normalized.userMessage).not.toContain('challenges.cloudflare.com');
      expect(normalized.userMessage).not.toContain('a6071b50edfcaf9e-MAA');
      expect(normalized.userMessage).not.toContain('Ref:');
    });

    it('normalizes server downtime, 502/503/504, and network errors to generic backend unavailable message', () => {
      const serverErr = new ServerFailureError('503 Service Unavailable', 'rndr-err-123');
      const networkErr = new NetworkError('ERR_NETWORK', 'req-net-456');
      const timeoutErr = new TimeoutError('Request timed out', 'req-time-789');

      expect(normalizeAuthError(serverErr).userMessage).toBe(
        'Authentication service is temporarily unavailable. Please try again later.'
      );
      expect(normalizeAuthError(networkErr).userMessage).toBe(
        'Authentication service is temporarily unavailable. Please try again later.'
      );
      expect(normalizeAuthError(timeoutErr).userMessage).toBe(
        'Authentication service is temporarily unavailable. Please try again later.'
      );

      // Verify no reference IDs leak
      expect(normalizeAuthError(serverErr).userMessage).not.toContain('rndr-err-123');
      expect(normalizeAuthError(serverErr).userMessage).not.toContain('Ref:');
    });

    it('normalizes unexpected/unclassified errors to generic fallback message', () => {
      const unknownErr = new Error('Unexpected runtime failure');
      const normalized = normalizeAuthError(unknownErr);
      expect(normalized.userMessage).toBe('Unable to sign in. Please try again.');
      expect(normalized.userMessage).not.toContain('Unexpected runtime failure');
    });
  });

  describe('2. Login Submission & Duplicate Request Prevention', () => {
    it('produces exactly one login request for a valid submission', async () => {
      const loginSpy = vi.spyOn(authRepository, 'login').mockResolvedValueOnce({
        accessToken: 'jwt-token-123',
        refreshToken: 'refresh-token-456',
        user: {
          id: 'adm-001',
          name: 'Super Admin',
          email: 'sevanest@admin.in',
          role: 'SUPER_ADMIN',
          permissions: ['*'],
        },
      });

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
            <Route path="/dashboard" element={<div>Dashboard Home</div>} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Admin Email Address/i), {
        target: { value: 'sevanest@admin.in' },
      });
      fireEvent.change(screen.getByLabelText(/Password \*/i), {
        target: { value: 'Sevanest@2026' },
      });

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(loginSpy).toHaveBeenCalledTimes(1);
      expect(loginSpy).toHaveBeenCalledWith({
        email: 'sevanest@admin.in',
        password: 'Sevanest@2026',
      });
    });

    it('synchronously blocks duplicate login requests when double-clicked rapidly', async () => {
      let resolveLogin: (val: unknown) => void;
      const slowLoginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      const loginSpy = vi.spyOn(authRepository, 'login').mockImplementation(() => slowLoginPromise as never);

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Admin Email Address/i), {
        target: { value: 'sevanest@admin.in' },
      });
      fireEvent.change(screen.getByLabelText(/Password \*/i), {
        target: { value: 'Sevanest@2026' },
      });

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });

      // Simulate rapid double click before React state re-renders
      await act(async () => {
        fireEvent.click(submitBtn);
        fireEvent.click(submitBtn);
        fireEvent.click(submitBtn);
      });

      // Synchronous ref guard must prevent duplicate repository calls
      expect(loginSpy).toHaveBeenCalledTimes(1);

      // Clean up in-flight promise
      act(() => {
        resolveLogin!({
          accessToken: 'jwt-token',
          user: { id: '1', role: 'SUPER_ADMIN', permissions: ['*'], name: 'Admin', email: 'admin@in' },
        });
      });
    });

    it('disables submit button and shows loading state while authentication is in progress', async () => {
      let resolveLogin: (val: unknown) => void;
      const slowLoginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      vi.spyOn(authRepository, 'login').mockImplementation(() => slowLoginPromise as never);

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Admin Email Address/i), {
        target: { value: 'sevanest@admin.in' },
      });
      fireEvent.change(screen.getByLabelText(/Password \*/i), {
        target: { value: 'Sevanest@2026' },
      });

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(submitBtn).toBeDisabled();
        expect(screen.getByText(/Authenticating\.\.\./i)).toBeInTheDocument();
      });

      // Clean up
      act(() => {
        resolveLogin!({
          accessToken: 'jwt',
          user: { id: '1', role: 'SUPER_ADMIN', permissions: ['*'], name: 'Admin', email: 'admin@in' },
        });
      });
    });

    it('does NOT automatically retry login requests on 401 Unauthorized', async () => {
      const loginSpy = vi.spyOn(authRepository, 'login').mockRejectedValueOnce(
        new UnauthorizedError('Invalid credentials', 'ref-401')
      );

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Admin Email Address/i), {
        target: { value: 'sevanest@admin.in' },
      });
      fireEvent.change(screen.getByLabelText(/Password \*/i), {
        target: { value: 'wrongpassword' },
      });

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // Exactly 1 call was made, zero automatic retries
      expect(loginSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Invalid email id or password')).toBeInTheDocument();
      // No reference ID in the DOM
      expect(screen.queryByText(/ref-401/i)).toBeNull();
      expect(screen.queryByText(/Ref:/i)).toBeNull();
    });
  });

  describe('3. UI Error Rendering & Reference ID Sanitization', () => {
    it('displays exact "Invalid email id or password" when backend returns 401 with requestId', async () => {
      vi.spyOn(authRepository, 'login').mockRejectedValueOnce(
        new UnauthorizedError('Invalid email or password', '830cd905-f0b3-4d0f-a097-4bee3e3c43e8')
      );

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Admin Email Address/i), {
        target: { value: 'sevanest@admin.in' },
      });
      fireEvent.change(screen.getByLabelText(/Password \*/i), {
        target: { value: 'wrongpassword' },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Sign In to Operations Console/i }));
      });

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Invalid email id or password');
      expect(alert).not.toHaveTextContent('830cd905-f0b3-4d0f-a097-4bee3e3c43e8');
      expect(alert).not.toHaveTextContent('Ref:');
    });

    it('clears password input field when invalid credentials error occurs', async () => {
      vi.spyOn(authRepository, 'login').mockRejectedValueOnce(
        new UnauthorizedError('Invalid email or password')
      );

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
          </Routes>
        </MemoryRouter>
      );

      const passInput = screen.getByLabelText(/Password \*/i) as HTMLInputElement;
      fireEvent.change(screen.getByLabelText(/Admin Email Address/i), {
        target: { value: 'sevanest@admin.in' },
      });
      fireEvent.change(passInput, {
        target: { value: 'wrongpassword' },
      });
      expect(passInput.value).toBe('wrongpassword');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Sign In to Operations Console/i }));
      });

      await waitFor(() => {
        expect(passInput.value).toBe('');
      });
    });
  });

  describe('4. Cloudflare Challenge & Controlled Manual Retry', () => {
    it('displays safe message on Cloudflare challenge and enforces cooldown countdown', async () => {
      vi.spyOn(authRepository, 'login').mockRejectedValueOnce(
        new RateLimitExceededError(
          'Blocked by Cloudflare security challenge at the backend gateway.',
          'cf-ray-12345',
          'CLOUDFLARE_CHALLENGE'
        )
      );

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Admin Email Address/i), {
        target: { value: 'sevanest@admin.in' },
      });
      fireEvent.change(screen.getByLabelText(/Password \*/i), {
        target: { value: 'Sevanest@2026' },
      });

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // Displays exact safe gateway message
      expect(
        screen.getByText('Unable to connect to the authentication service. Please try again later.')
      ).toBeInTheDocument();
      expect(screen.queryByText(/cf-ray-12345/i)).toBeNull();
      expect(screen.queryByText(/Ref:/i)).toBeNull();

      // Submit button is disabled with countdown
      expect(screen.getByText(/Wait 10s to Sign In/i)).toBeInTheDocument();
      expect(submitBtn).toBeDisabled();

      // Retry button shows cooldown and is disabled
      const retryBtn = screen.getByRole('button', { name: /Retry available in 10s/i });
      expect(retryBtn).toBeDisabled();
    });

    it('enables manual retry button after cooldown expires and executes exactly one retry request', async () => {
      vi.useFakeTimers();

      const loginSpy = vi
        .spyOn(authRepository, 'login')
        .mockRejectedValueOnce(
          new RateLimitExceededError(
            'Blocked by Cloudflare challenge',
            'cf-ray-xyz',
            'CLOUDFLARE_CHALLENGE'
          )
        )
        .mockResolvedValueOnce({
          accessToken: 'resumed-jwt',
          user: { id: 'adm-01', name: 'Admin', email: 'sevanest@admin.in', role: 'SUPER_ADMIN', permissions: ['*'] },
        });

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
            <Route path="/dashboard" element={<div>Dashboard Home</div>} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Admin Email Address/i), {
        target: { value: 'sevanest@admin.in' },
      });
      fireEvent.change(screen.getByLabelText(/Password \*/i), {
        target: { value: 'Sevanest@2026' },
      });

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(loginSpy).toHaveBeenCalledTimes(1);

      // Fast forward 10 seconds
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Retry button is now enabled
      const retryBtn = screen.getByRole('button', { name: /Retry Sign In Now/i });
      expect(retryBtn).not.toBeDisabled();

      // Click retry
      await act(async () => {
        fireEvent.click(retryBtn);
      });

      // Exactly 2 total calls (1 initial + 1 manual retry)
      expect(loginSpy).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('5. Quick Login Configuration & Role Cards', () => {
    it('verifies all 4 Quick Login role cards populate valid email addresses and do not auto-submit', () => {
      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
          </Routes>
        </MemoryRouter>
      );

      const emailInput = screen.getByLabelText(/Admin Email Address/i) as HTMLInputElement;
      const passInput = screen.getByLabelText(/Password \*/i) as HTMLInputElement;

      // Check Super Admin card
      const superAdminCard = screen.getByTestId('quick-login-card-super-admin');
      fireEvent.click(superAdminCard);
      expect(emailInput.value).toBe('sevanest@admin.in');
      expect(passInput.value).toBe('Sevanest@2026');

      // Check Operations Admin card
      const opsAdminCard = screen.getByTestId('quick-login-card-ops-admin');
      fireEvent.click(opsAdminCard);
      expect(emailInput.value).toBe('operations.manager@sevanest.example.com');
      expect(passInput.value).toBe('Operations@2026');

      // Check Verification Executive card
      const verifCard = screen.getByTestId('quick-login-card-verification-exec');
      fireEvent.click(verifCard);
      expect(emailInput.value).toBe('verification.executive@sevanest.example.com');
      expect(passInput.value).toBe('Verification@2026');

      // Check Support Executive card
      const supportCard = screen.getByTestId('quick-login-card-support-exec');
      fireEvent.click(supportCard);
      expect(emailInput.value).toBe('support.executive@sevanest.example.com');
      expect(passInput.value).toBe('Support@2026');

      // Verify that selecting role cards did NOT automatically submit the form
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('verifies Quick Login roles array conforms to type contract and contains 4 roles', () => {
      expect(QUICK_LOGIN_ROLES).toHaveLength(4);
      const roleIds = QUICK_LOGIN_ROLES.map((r) => r.id);
      expect(roleIds).toEqual(['super-admin', 'ops-admin', 'verification-exec', 'support-exec']);
    });
  });
});
