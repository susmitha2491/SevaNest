/* global Response */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SignInPage } from '../features/auth/presentation/SignInPage';
import { authRepository } from '../features/auth/data/authRepository';
import { RateLimitExceededError, UnauthorizedError } from '../core/errors/DomainError';
import { useAuthStore } from '../core/auth/authStore';
import { QUICK_LOGIN_ROLES } from '../features/auth/presentation/quickLoginRoles';

describe('Login Rate-Limiting, Duplicate Submission Guard, and App-Config Audit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearSession(false);
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  describe('1. Successful Login for Each Supported Admin Role', () => {
    it.each(QUICK_LOGIN_ROLES)('logs in successfully for role: $name ($role)', async (roleConfig) => {
      const loginSpy = vi.spyOn(authRepository, 'login').mockResolvedValueOnce({
        user: {
          id: `adm-${roleConfig.id}`,
          email: roleConfig.email,
          name: roleConfig.name,
          role: roleConfig.role,
          permissions: roleConfig.role === 'SUPER_ADMIN' ? ['*'] : ['dashboard.view'],
        },
        accessToken: `test-token-${roleConfig.id}`,
        refreshToken: `test-refresh-${roleConfig.id}`,
      });

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
            <Route path="/dashboard" element={<div>Dashboard Landed</div>} />
            <Route path="/verification" element={<div>Verification Landed</div>} />
          </Routes>
        </MemoryRouter>
      );

      // Select quick login role
      const roleCard = screen.getByTestId(`quick-login-card-${roleConfig.id}`);
      fireEvent.click(roleCard);

      const emailInput = screen.getByLabelText(/Admin Email Address/i) as HTMLInputElement;
      expect(emailInput.value).toBe(roleConfig.email);

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(loginSpy).toHaveBeenCalledTimes(1);
      expect(loginSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: roleConfig.email,
          password: roleConfig.password,
        })
      );
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().user?.role).toBe(roleConfig.role);
    });
  });

  describe('2. Single Submission Guarantee (No Duplicate Requests)', () => {
    it('produces exactly one HTTP request when submit button is clicked multiple times rapidly', async () => {
      let resolveLogin: (val: unknown) => void;
      const inFlightPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      const loginSpy = vi.spyOn(authRepository, 'login').mockImplementation(() => inFlightPromise as never);

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Admin Email Address/i), {
        target: { value: 'operations.manager@sevanest.example.com' },
      });
      fireEvent.change(screen.getByLabelText(/Password \*/i), {
        target: { value: 'Operations@2026' },
      });

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });

      // Click rapidly 4 times
      await act(async () => {
        fireEvent.click(submitBtn);
        fireEvent.click(submitBtn);
        fireEvent.click(submitBtn);
        fireEvent.click(submitBtn);
      });

      expect(loginSpy).toHaveBeenCalledTimes(1);

      // Complete in-flight login
      await act(async () => {
        resolveLogin!({
          user: { id: 'ops-1', email: 'operations.manager@sevanest.example.com', name: 'Ops', role: 'OPERATIONS_ADMIN', permissions: [] },
          accessToken: 'token-xyz',
        });
      });
    });

    it('disables Quick Login cards while submission is in-flight or cooldown is active', async () => {
      let resolveLogin: (val: unknown) => void;
      const inFlightPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      vi.spyOn(authRepository, 'login').mockImplementation(() => inFlightPromise as never);

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
          </Routes>
        </MemoryRouter>
      );

      const opsCard = screen.getByTestId('quick-login-card-ops-admin');
      fireEvent.click(opsCard);

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // Quick login cards should be inert while in-flight
      const superAdminCard = screen.getByTestId('quick-login-card-super-admin');
      fireEvent.click(superAdminCard);

      const emailInput = screen.getByLabelText(/Admin Email Address/i) as HTMLInputElement;
      expect(emailInput.value).toBe('operations.manager@sevanest.example.com');

      await act(async () => {
        resolveLogin!({
          user: { id: 'ops-1', email: 'operations.manager@sevanest.example.com', name: 'Ops', role: 'OPERATIONS_ADMIN', permissions: [] },
          accessToken: 'token-xyz',
        });
      });
    });
  });

  describe('3. Incorrect Credentials Handling Without Endless Retries', () => {
    it('displays exact sanitized error, clears password, and does not allow automatic retries', async () => {
      vi.spyOn(authRepository, 'login').mockRejectedValueOnce(
        new UnauthorizedError('Invalid credentials')
      );

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
          </Routes>
        </MemoryRouter>
      );

      const emailInput = screen.getByLabelText(/Admin Email Address/i);
      const passInput = screen.getByLabelText(/Password \*/i);

      fireEvent.change(emailInput, { target: { value: 'ops@sevanest.internal' } });
      fireEvent.change(passInput, { target: { value: 'WrongPassword' } });

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(screen.getByText('Invalid email id or password')).toBeInTheDocument();
      // Does not show retry button for credential errors
      expect(screen.queryByRole('button', { name: /Retry/i })).toBeNull();
      // Password field cleared for security
      expect((passInput as HTMLInputElement).value).toBe('');
    });
  });

  describe('4. Rate Limit (429) & Retry-After Cooldown Handling', () => {
    it('respects Retry-After header and enforces accurate countdown without endless loops', async () => {
      const rateLimitErr = new RateLimitExceededError(
        'Too many failed login attempts.',
        'req-rate-123',
        'RATE_LIMIT_EXCEEDED',
        45 // 45 seconds from server
      );

      vi.spyOn(authRepository, 'login').mockRejectedValueOnce(rateLimitErr);

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Admin Email Address/i), {
        target: { value: 'operations.manager@sevanest.example.com' },
      });
      fireEvent.change(screen.getByLabelText(/Password \*/i), {
        target: { value: 'Operations@2026' },
      });

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // Clear, accurate rate limit message
      expect(
        screen.getByText(/Too many login attempts.*Try again in 45s/i)
      ).toBeInTheDocument();

      // Submit button is disabled with countdown
      expect(screen.getByText('Wait 45s to Sign In')).toBeInTheDocument();
      expect(submitBtn).toBeDisabled();

      // Retry button is also disabled with countdown
      const retryBtn = screen.getByRole('button', { name: /Retry available in 45s/i });
      expect(retryBtn).toBeDisabled();
    });

    it('enables login again after cooldown countdown reaches zero', async () => {
      vi.useFakeTimers();

      const rateLimitErr = new RateLimitExceededError(
        'Rate limit exceeded',
        'req-429',
        'RATE_LIMIT_EXCEEDED',
        3 // 3 second cooldown for fast test
      );

      const loginSpy = vi.spyOn(authRepository, 'login')
        .mockRejectedValueOnce(rateLimitErr)
        .mockResolvedValueOnce({
          user: { id: 'ops-1', email: 'ops@sevanest.internal', name: 'Ops', role: 'OPERATIONS_ADMIN', permissions: [] },
          accessToken: 'valid-token',
        });

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.change(screen.getByLabelText(/Admin Email Address/i), {
        target: { value: 'ops@sevanest.internal' },
      });
      fireEvent.change(screen.getByLabelText(/Password \*/i), {
        target: { value: 'Pass123' },
      });

      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      expect(screen.getByText('Wait 3s to Sign In')).toBeInTheDocument();

      // Advance timers by 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Now retry button becomes enabled
      const retryBtn = screen.getByRole('button', { name: /Retry Sign In Now/i });
      expect(retryBtn).not.toBeDisabled();

      // Clicking retry triggers exactly one attempt
      await act(async () => {
        fireEvent.click(retryBtn);
      });

      expect(loginSpy).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('5. App-Config Diagnostic Isolation', () => {
    it('app-config 503 Render hibernate is isolated and does not trigger automatic login calls', async () => {
      const loginSpy = vi.spyOn(authRepository, 'login');
      // Mock fetch returning 503 Render hibernate
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Hibernate wake error', {
          status: 503,
          headers: { 'x-render-routing': 'hibernate-wake-error' },
        })
      );

      render(
        <MemoryRouter initialEntries={['/auth/login']}>
          <Routes>
            <Route path="/auth/login" element={<SignInPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Verify that no login calls were triggered by the app-config check
      expect(loginSpy).not.toHaveBeenCalled();

      // Form remains functional and ready for user input
      const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
      expect(submitBtn).not.toBeDisabled();
    });
  });
});
