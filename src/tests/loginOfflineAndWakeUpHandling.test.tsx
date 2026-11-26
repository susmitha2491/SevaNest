/* global Event, Response, CustomEvent */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SignInPage } from '../features/auth/presentation/SignInPage';
import { authRepository, RealAuthRepository } from '../features/auth/data/authRepository';
import { httpClient } from '../core/api/httpClient';
import { mapHttpErrorToDomainError } from '../core/errors/errorMapper';
import { OfflineError, ServerFailureError, UnauthorizedError } from '../core/errors/DomainError';

describe('Login Offline Detection, Error Classification & Render Wake-Up Handling', () => {
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    vi.restoreAllMocks();
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

  it('1. Login page opened while offline displays offline alert and no Render wake-up banner', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route path="/auth/login" element={<SignInPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Displays clear offline message
    expect(screen.getByText(/No internet connection\. Please check your network and try again\./i)).toBeInTheDocument();

    // Does NOT display Render wake-up banner
    expect(screen.queryByText(/Backend server is waking up on Render/i)).toBeNull();

    // Submit button remains enabled (not disabled)
    const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it('2. Submitting login while offline immediately surfaces offline message without network calls', async () => {
    const loginSpy = vi.spyOn(authRepository, 'login');

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route path="/auth/login" element={<SignInPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Simulate going offline right before submit
    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      window.dispatchEvent(new Event('offline'));
    });

    const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(screen.getByText(/No internet connection\. Please check your network and try again\./i)).toBeInTheDocument();
    expect(screen.queryByText(/Backend server is waking up on Render/i)).toBeNull();
    // Did NOT call login API
    expect(loginSpy).not.toHaveBeenCalled();
    // Submit button is NOT permanently disabled
    expect(submitBtn).not.toBeDisabled();
  });

  it('3. Network disconnects while login request is in-flight: clears wake-up state and displays offline banner', async () => {
    let resolveLogin: (val: unknown) => void;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });

    vi.spyOn(authRepository, 'login').mockImplementation(() => loginPromise as never);

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route path="/auth/login" element={<SignInPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Populate valid credentials
    fireEvent.change(screen.getByLabelText(/Admin Email Address/i), {
      target: { value: 'sevanest@admin.in' },
    });
    fireEvent.change(screen.getByLabelText(/Password \*/i), {
      target: { value: 'Sevanest@2026' },
    });

    const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    act(() => {
      fireEvent.click(submitBtn);
    });

    // Simulate browser firing offline event while request is in-flight
    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByText(/No internet connection\. Please check your network and try again\./i)).toBeInTheDocument();
    expect(screen.queryByText(/Backend server is waking up on Render/i)).toBeNull();
    expect(submitBtn).not.toBeDisabled();

    // Clean up in-flight promise
    resolveLogin!(new Error('Aborted'));
  });

  it('4. HTTP 502 while browser is offline is classified as OfflineError and does not trigger wake-up loop', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const nginx502Error = {
      isAxiosError: true,
      response: {
        status: 502,
        headers: { server: 'nginx/1.27.0' },
        data: '<html><head><title>502 Bad Gateway</title></head><body><h1>502 Bad Gateway</h1></body></html>',
      },
    };

    const domainError = mapHttpErrorToDomainError(nginx502Error);
    expect(domainError).toBeInstanceOf(OfflineError);
    expect(domainError.code).toBe('OFFLINE_ERROR');
    expect(domainError.message).toBe('No internet connection. Please check your network and try again.');

    // In RealAuthRepository, it must throw OfflineError immediately without wake-up loop
    const repo = new RealAuthRepository();
    vi.spyOn(httpClient, 'post').mockRejectedValueOnce(nginx502Error);

    let wakeUpEventsFired = 0;
    const wakeListener = () => { wakeUpEventsFired++; };
    window.addEventListener('backend-waking-up', wakeListener);

    await expect(repo.login({ email: 'admin@sevanest.in', password: 'password123' })).rejects.toThrow(
      'No internet connection. Please check your network and try again.'
    );

    expect(wakeUpEventsFired).toBe(0);
    window.removeEventListener('backend-waking-up', wakeListener);
  });

  it('5. HTTP 502 while browser is online is classified as temporary server failure without Render wake-up banner', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    const standard502Error = {
      isAxiosError: true,
      response: {
        status: 502,
        headers: { 'rndr-id': 'req-502-abc' },
        data: '',
      },
    };

    const domainError = mapHttpErrorToDomainError(standard502Error);
    expect(domainError).toBeInstanceOf(ServerFailureError);
    expect(domainError.code).toBe('SERVER_FAILURE');
    expect((domainError as ServerFailureError).errorCode).toBe('HTTP_502');
    expect(domainError.message).toContain('Authentication service is temporarily unavailable (HTTP 502)');

    // In RealAuthRepository, generic 502 does NOT trigger the wake-up loop
    const repo = new RealAuthRepository();
    vi.spyOn(httpClient, 'post').mockRejectedValueOnce(standard502Error);

    let wakeUpEventsFired = 0;
    const wakeListener = () => { wakeUpEventsFired++; };
    window.addEventListener('backend-waking-up', wakeListener);

    await expect(repo.login({ email: 'admin@sevanest.in', password: 'password123' })).rejects.toThrow(
      'Authentication service is temporarily unavailable (HTTP 502)'
    );

    expect(wakeUpEventsFired).toBe(0);
    window.removeEventListener('backend-waking-up', wakeListener);
  });

  it('6. Genuine Render backend cold start (x-render-routing: hibernate-wake-error) still triggers wake-up behavior', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    const renderHibernate503 = {
      isAxiosError: true,
      response: {
        status: 503,
        headers: {
          'x-render-routing': 'hibernate-wake-error',
          'rndr-id': 'rndr-wake-123',
        },
        data: '',
      },
    };

    const domainError = mapHttpErrorToDomainError(renderHibernate503);
    expect(domainError).toBeInstanceOf(ServerFailureError);
    expect((domainError as ServerFailureError).errorCode).toBe('BACKEND_WAKING_UP');
    expect(domainError.message).toContain('waking up on Render');

    const repo = new RealAuthRepository();
    vi.spyOn(httpClient, 'post')
      .mockRejectedValueOnce(renderHibernate503)
      .mockResolvedValueOnce({
        data: {
          accessToken: 'resumed-token',
          refreshToken: 'resumed-refresh',
          user: { id: 'adm-01', name: 'Admin', email: 'admin@test.com', role: 'SUPER_ADMIN', permissions: ['*'] },
        },
      });

    // Mock fetch for /app-config to succeed on first probe
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('OK', { status: 200 }));

    let wakeUpEventDetail: { attempt: number; maxRetries: number } | null = null;
    const wakeListener = (e: Event) => {
      wakeUpEventDetail = (e as CustomEvent).detail;
    };
    window.addEventListener('backend-waking-up', wakeListener);

    const result = await repo.login({
      email: 'admin@test.com',
      password: 'password123',
      _maxWakeRetries: 2,
    } as unknown as Parameters<typeof repo.login>[0]);
    expect(result.accessToken).toBe('resumed-token');
    expect(wakeUpEventDetail).not.toBeNull();
    expect((wakeUpEventDetail as { attempt: number; maxRetries: number } | null)?.attempt).toBe(1);

    window.removeEventListener('backend-waking-up', wakeListener);
    fetchSpy.mockRestore();
  });

  it('7. Internet connection restored: clears offline error and enables Retry action', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route path="/auth/login" element={<SignInPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Initially offline
    expect(screen.getByText(/No internet connection\. Please check your network and try again\./i)).toBeInTheDocument();

    // Simulate network restoring
    act(() => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });
      window.dispatchEvent(new Event('online'));
    });

    // Offline error automatically cleared
    await waitFor(() => {
      expect(screen.queryByText(/No internet connection\. Please check your network and try again\./i)).toBeNull();
    });

    // Login button is enabled and ready to use without refreshing the page
    const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it('8. Invalid 401 credentials wipe password input, while network/offline errors preserve password', async () => {
    vi.spyOn(authRepository, 'login').mockRejectedValueOnce(
      new UnauthorizedError('Invalid administrative credentials. Access denied.')
    );

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route path="/auth/login" element={<SignInPage />} />
        </Routes>
      </MemoryRouter>
    );

    const emailInput = screen.getByLabelText(/Admin Email Address/i) as HTMLInputElement;
    const passInput = screen.getByLabelText(/Password \*/i) as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'admin@sevanest.in' } });
    fireEvent.change(passInput, { target: { value: 'wrongpassword' } });
    expect(passInput.value).toBe('wrongpassword');

    const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // 401 wipes password
    await waitFor(() => {
      expect(passInput.value).toBe('');
      expect(screen.getByText('Invalid email id or password')).toBeInTheDocument();
    });

    // Now test that offline error PRESERVES password
    fireEvent.change(passInput, { target: { value: 'retainedpassword' } });
    vi.spyOn(authRepository, 'login').mockRejectedValueOnce(
      new OfflineError('No internet connection. Please check your network and try again.')
    );

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/No internet connection/i)).toBeInTheDocument();
      // Password is preserved!
      expect(passInput.value).toBe('retainedpassword');
    });
  });

  it('9. Pre-warm app-config request is skipped when browser is offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route path="/auth/login" element={<SignInPage />} />
        </Routes>
      </MemoryRouter>
    );

    // fetch was not invoked for pre-warming while offline
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('10. HTTP 429 Rate Limit does not trigger Render wake-up loop, displays rate limit error, and sets cooldown', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    const rateLimit429 = {
      isAxiosError: true,
      response: {
        status: 429,
        headers: { 'retry-after': '10' },
        data: { message: 'Too many requests. Please wait before retrying.' },
      },
    };

    // 1. Verify RealAuthRepository throws immediately without firing backend-waking-up
    const repo = new RealAuthRepository();
    vi.spyOn(httpClient, 'post').mockRejectedValueOnce(rateLimit429);

    let wakeUpEventsFired = 0;
    const wakeListener = () => { wakeUpEventsFired++; };
    window.addEventListener('backend-waking-up', wakeListener);

    await expect(repo.login({ email: 'admin@sevanest.in', password: 'password123' })).rejects.toThrow(
      /Too many requests/i
    );
    expect(wakeUpEventsFired).toBe(0);
    window.removeEventListener('backend-waking-up', wakeListener);

    // 2. Verify SignInPage surfaces rate limit message and applies cooldown
    vi.spyOn(authRepository, 'login').mockRejectedValueOnce(
      mapHttpErrorToDomainError(rateLimit429)
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
    fireEvent.change(emailInput, { target: { value: 'admin@sevanest.in' } });
    fireEvent.change(passInput, { target: { value: 'password123' } });

    const submitBtn = screen.getByRole('button', { name: /Sign In to Operations Console/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // Displays sanitized unavailable error per Section 5 contract
    expect(screen.getByText(/Authentication service is temporarily unavailable/i)).toBeInTheDocument();
    // Does NOT display Render wake-up banner
    expect(screen.queryByText(/Backend server is waking up on Render/i)).toBeNull();
    // Retry and submit buttons are disabled with cooldown message
    expect(screen.getByText(/Retry available in \d+s/i)).toBeInTheDocument();
    expect(submitBtn).toBeDisabled();
  });
});
