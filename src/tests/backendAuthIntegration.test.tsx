import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RealAuthRepository, mapBackendUserToAdminUser } from '../features/auth/data/authRepository';
import { useAuthStore } from '../core/auth/authStore';
import { validateApiConfig } from '../core/config/env';
import { httpClient } from '../core/api/httpClient';
import {
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  RateLimitExceededError,
  ServerFailureError,
  NetworkError,
} from '../core/errors/DomainError';
import { PERMISSIONS } from '../core/rbac/permissions';

describe('SevaNest Backend Integration Foundation & Authentication', () => {
  let realRepo: RealAuthRepository;

  beforeEach(() => {
    useAuthStore.getState().clearSession();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    realRepo = new RealAuthRepository();
  });

  describe('Phase 2: API Configuration & Validation', () => {
    it('validates a valid backend API base URL', () => {
      const validUrl = 'https://sevanest-backend.onrender.com/api/v1';
      expect(validateApiConfig({
        VITE_API_BASE_URL: validUrl,
        VITE_APP_ENV: 'development',
        VITE_USE_MOCK_AUTH: false,
        VITE_API_TIMEOUT_MS: 15000,
        VITE_ENABLE_TELEMETRY: false,
      })).toBe(validUrl);
    });

    it('accepts relative API base path for Vite reverse proxy in browser', () => {
      const relativePath = '/api/v1';
      expect(validateApiConfig({
        VITE_API_BASE_URL: relativePath,
        VITE_APP_ENV: 'development',
        VITE_USE_MOCK_AUTH: false,
        VITE_API_TIMEOUT_MS: 15000,
        VITE_ENABLE_TELEMETRY: false,
      })).toBe(relativePath);
    });

    it('throws understandable configuration error when API base URL is missing', () => {
      expect(() => validateApiConfig({
        VITE_API_BASE_URL: '',
        VITE_APP_ENV: 'development',
        VITE_USE_MOCK_AUTH: false,
        VITE_API_TIMEOUT_MS: 15000,
        VITE_ENABLE_TELEMETRY: false,
      })).toThrowError(/Configuration Error: VITE_API_BASE_URL is missing/i);
    });

    it('throws understandable configuration error when API base URL is malformed', () => {
      expect(() => validateApiConfig({
        VITE_API_BASE_URL: 'htt p://invalid url with spaces',
        VITE_APP_ENV: 'development',
        VITE_USE_MOCK_AUTH: false,
        VITE_API_TIMEOUT_MS: 15000,
        VITE_ENABLE_TELEMETRY: false,
      })).toThrowError(/Configuration Error: VITE_API_BASE_URL .* is not a valid URL/i);
    });
  });

  describe('Phase 3: Authentication Request Construction & Response Mapping', () => {
    it('rejects login attempt if credentials are missing required fields', async () => {
      await expect(realRepo.login({ email: '', password: '' })).rejects.toThrow(UnauthorizedError);
      await expect(realRepo.login({ email: 'admin@sevanest.internal', password: '' })).rejects.toThrow(UnauthorizedError);
    });

    it('constructs correct POST /auth/admin/login request with email and password', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          accessToken: 'jwt-real-token-xyz',
          user: {
            id: 'adm-001',
            email: 'ops.admin@sevanest.internal',
            name: 'Operations Manager',
            role: 'OPERATIONS_ADMIN',
          },
        },
      });

      const result = await realRepo.login({
        email: 'ops.admin@sevanest.internal',
        password: 'SecurePassword123!',
      });

      expect(postSpy).toHaveBeenCalledWith('/auth/admin/login', {
        email: 'ops.admin@sevanest.internal',
        password: 'SecurePassword123!',
      });
      expect(result.accessToken).toBe('jwt-real-token-xyz');
      expect(result.user.role).toBe('OPERATIONS_ADMIN');
      expect(result.user.permissions).toContain(PERMISSIONS.BOOKINGS_VIEW);
    });

    it('maps Super Admin backend response with wildcard permissions', async () => {
      vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          accessToken: 'jwt-super-token',
          user: {
            id: 'adm-super',
            email: 'super.admin@sevanest.internal',
            name: 'Super Admin',
            roleCode: 'SUPER_ADMIN',
          },
        },
      });

      const { user, accessToken } = await realRepo.login({
        email: 'super.admin@sevanest.internal',
        password: 'Password123',
      });

      expect(accessToken).toBe('jwt-super-token');
      expect(user.role).toBe('SUPER_ADMIN');
      expect(user.permissions).toEqual(['*']);
    });

    it('queries /users/me when user object is not returned in the login payload', async () => {
      vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          accessToken: 'jwt-token-needs-me',
        },
      });

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          id: 'adm-verif-99',
          email: 'verification.exec@sevanest.internal',
          name: 'Verification Executive',
          role: 'VERIFICATION_EXECUTIVE',
        },
      });

      const { user, accessToken } = await realRepo.login({
        email: 'verification.exec@sevanest.internal',
        password: 'Password123',
      });

      expect(getSpy).toHaveBeenCalledWith('/users/me', expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-token-needs-me',
        }),
      }));
      expect(accessToken).toBe('jwt-token-needs-me');
      expect(user.role).toBe('VERIFICATION_EXECUTIVE');
      expect(user.permissions).toContain(PERMISSIONS.VERIFICATION_REVIEW);
    });

    it('stores token in memory only and never writes to localStorage or sessionStorage', async () => {
      vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          accessToken: 'secret-jwt-in-memory',
          user: {
            id: 'adm-support',
            email: 'support.exec@sevanest.internal',
            role: 'SUPPORT_EXECUTIVE',
          },
        },
      });

      const { user, accessToken } = await realRepo.login({
        email: 'support.exec@sevanest.internal',
        password: 'Password123',
      });

      useAuthStore.getState().setSession(user, accessToken);

      // Verify stored in Zustand memory
      expect(useAuthStore.getState().accessToken).toBe('secret-jwt-in-memory');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Verify zero storage in browser persistence
      expect(window.localStorage.getItem('token')).toBeNull();
      expect(window.localStorage.getItem('accessToken')).toBeNull();
      expect(window.sessionStorage.getItem('token')).toBeNull();
      expect(window.sessionStorage.getItem('accessToken')).toBeNull();
    });

    it('throws ForbiddenError and denies elevated access when backend role is unrecognized', () => {
      expect(() =>
        mapBackendUserToAdminUser({
          id: 'user-123',
          email: 'customer@example.com',
          role: 'CUSTOMER',
        })
      ).toThrow(ForbiddenError);

      expect(() =>
        mapBackendUserToAdminUser({
          id: 'user-456',
          email: 'hacker@example.com',
          role: 'UNKNOWN_ROLE',
        })
      ).toThrow(ForbiddenError);
    });

    it('throws ServerFailureError if backend returns invalid or missing accessToken shape', async () => {
      vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          status: 'success', // Missing accessToken!
        },
      });

      await expect(
        realRepo.login({ email: 'ops@sevanest.internal', password: 'Password123' })
      ).rejects.toThrow(ServerFailureError);
    });
  });

  describe('Phase 4: Error Handling & Diagnostics', () => {
    it('maps HTTP 401 INVALID_CREDENTIALS to UnauthorizedError with backend requestId', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 401,
          headers: { 'x-request-id': 'req-error-401-id' },
          data: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            requestId: 'req-error-401-id',
          },
        },
      };

      vi.spyOn(httpClient, 'post').mockRejectedValueOnce(axiosError);

      try {
        await realRepo.login({ email: 'wrong@example.com', password: 'wrong' });
        expect.unreachable('Should have thrown UnauthorizedError');
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedError);
        expect((err as UnauthorizedError).message).toBe('Invalid email or password');
        expect((err as UnauthorizedError).correlationId).toBe('req-error-401-id');
      }
    });

    it('maps HTTP 400 VALIDATION_FAILED to ValidationError with field errors', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 400,
          headers: { 'x-request-id': 'req-val-fail' },
          data: {
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed',
            details: [
              { field: 'email', messages: ['email must be an email'] },
              { field: 'password', messages: ['password must be longer than 1 character'] },
            ],
            requestId: 'req-val-fail',
          },
        },
      };

      vi.spyOn(httpClient, 'post').mockRejectedValueOnce(axiosError);

      try {
        await realRepo.login({ email: 'not-an-email', password: 'short' });
        expect.unreachable('Should have thrown ValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).fieldErrors).toHaveProperty('email');
        expect((err as ValidationError).fieldErrors).toHaveProperty('password');
      }
    });

    it('maps HTTP 429 ADMIN_LOGIN_LOCKED to RateLimitExceededError', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 429,
          data: {
            code: 'ADMIN_LOGIN_LOCKED',
            message: 'Account temporarily locked due to repeated failures',
          },
        },
      };

      vi.spyOn(httpClient, 'post').mockRejectedValueOnce(axiosError);

      await expect(
        realRepo.login({ email: 'ops@sevanest.internal', password: 'pass' })
      ).rejects.toThrow(RateLimitExceededError);
    });

    it('maps network or CORS failures to NetworkError with actionable diagnostic message', async () => {
      const networkError = {
        isAxiosError: true,
        code: 'ERR_NETWORK',
        message: 'Network Error',
        response: undefined, // No response occurs on CORS preflight rejection
      };

      vi.spyOn(httpClient, 'post').mockRejectedValueOnce(networkError);

      try {
        await realRepo.login({ email: 'ops@sevanest.internal', password: 'pass' });
        expect.unreachable('Should have thrown NetworkError');
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError);
        expect((err as NetworkError).message).toContain('Unable to connect to SevaNest Backend API');
        expect((err as NetworkError).message).toContain('CORS configuration');
      }
    });
  });

  describe('Logout & Session Invalidation', () => {
    it('executes POST /auth/logout to invalidate backend session', async () => {
      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        status: 204,
        data: null,
      });

      await realRepo.logout();
      expect(postSpy).toHaveBeenCalledWith('/auth/logout');
    });

    it('propagates error when backend logout rejects', async () => {
      vi.spyOn(httpClient, 'post').mockRejectedValueOnce(new Error('Backend logout error'));
      await expect(realRepo.logout()).rejects.toThrow();
    });
  });

  describe('Token Refresh & Session Management Contracts', () => {
    it('rejects refreshToken call when no refresh token is present in memory', async () => {
      useAuthStore.getState().clearSession();
      await expect(realRepo.refreshToken()).rejects.toThrow(UnauthorizedError);
    });

    it('dispatches POST /auth/token/refresh with single-use refreshToken payload and updates in-memory store', async () => {
      useAuthStore.getState().setTokens('old-access-token', 'old-refresh-token-xyz-123456');

      const postSpy = vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: {
          accessToken: 'new-rotated-access-token',
          refreshToken: 'new-rotated-refresh-token-987654',
        },
      });

      const result = await realRepo.refreshToken();

      expect(postSpy).toHaveBeenCalledWith('/auth/token/refresh', {
        refreshToken: 'old-refresh-token-xyz-123456',
      });
      expect(result.accessToken).toBe('new-rotated-access-token');
      expect(result.refreshToken).toBe('new-rotated-refresh-token-987654');

      // Verify in-memory store was updated
      expect(useAuthStore.getState().accessToken).toBe('new-rotated-access-token');
      expect(useAuthStore.getState().refreshToken).toBe('new-rotated-refresh-token-987654');
    });

    it('fetches active device sessions from GET /auth/sessions', async () => {
      const mockSessions = [
        { id: 'sess-1', deviceName: 'Chrome on Windows', ipAddress: '10.0.0.1', isCurrent: true },
        { id: 'sess-2', deviceName: 'Firefox on Linux', ipAddress: '10.0.0.2', isCurrent: false },
      ];

      const getSpy = vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: mockSessions,
      });

      const sessions = await realRepo.listSessions();
      expect(getSpy).toHaveBeenCalledWith('/auth/sessions');
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('sess-1');
    });

    it('dispatches DELETE /auth/sessions/{sessionId} for remote session revocation', async () => {
      const deleteSpy = vi.spyOn(httpClient, 'delete').mockResolvedValueOnce({
        status: 204,
        data: null,
      });

      await realRepo.revokeSession('sess-target-99');
      expect(deleteSpy).toHaveBeenCalledWith('/auth/sessions/sess-target-99');
    });

    it('validates current session via GET /users/me', async () => {
      useAuthStore.getState().setAccessToken('active-token-xyz');

      vi.spyOn(httpClient, 'get').mockResolvedValueOnce({
        data: {
          id: 'adm-001',
          email: 'super.admin@sevanest.internal',
          name: 'Super Admin',
          roleCode: 'SUPER_ADMIN',
        },
      });

      const session = await realRepo.getCurrentSession();
      expect(session).not.toBeNull();
      expect(session?.role).toBe('SUPER_ADMIN');
      expect(session?.permissions).toContain('*');
    });

    it('returns null for getCurrentSession when no in-memory token exists', async () => {
      useAuthStore.getState().clearSession();
      const session = await realRepo.getCurrentSession();
      expect(session).toBeNull();
    });
  });

  describe('HTTP Client In-Memory Token Attachment & Refresh Interceptor Safety', () => {
    it('automatically attaches Bearer token from in-memory auth store', async () => {
      useAuthStore.getState().setTokens('test-bearer-token-123');

      // Test interceptor directly
      interface InterceptorManagerWithHandlers {
        handlers: Array<{
          fulfilled: (config: { headers: Record<string, string> }) => Promise<{ headers: Record<string, string> }>;
          rejected: (error: unknown) => Promise<unknown>;
        }>;
      }
      const reqManager = httpClient.interceptors.request as unknown as InterceptorManagerWithHandlers;
      const requestInterceptor = reqManager.handlers[0].fulfilled;
      const config = await requestInterceptor({
        headers: {},
      });

      expect(config.headers.Authorization).toBe('Bearer test-bearer-token-123');
      expect(config.headers['X-Correlation-ID']).toBeDefined();
    });

    it('does not retry 401 on /auth/admin/login and propagates credentials rejection', async () => {
      interface ResInterceptorManagerWithHandlers {
        handlers: Array<{
          rejected: (error: unknown) => Promise<unknown>;
        }>;
      }
      const resManager = httpClient.interceptors.response as unknown as ResInterceptorManagerWithHandlers;
      const responseInterceptor = resManager.handlers[0].rejected;

      const mock401Error = {
        isAxiosError: true,
        config: { url: '/auth/admin/login' },
        response: {
          status: 401,
          data: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        },
      };

      await expect(responseInterceptor(mock401Error)).rejects.toThrow(UnauthorizedError);
      // Ensure clearSession was NOT called (user was trying to log in)
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('clears session when token refresh itself returns 401 REFRESH_TOKEN_INVALID', async () => {
      useAuthStore.getState().setTokens('expired-access', 'expired-refresh');

      interface ResInterceptorManagerWithHandlers {
        handlers: Array<{
          rejected: (error: unknown) => Promise<unknown>;
        }>;
      }
      const resManager = httpClient.interceptors.response as unknown as ResInterceptorManagerWithHandlers;
      const responseInterceptor = resManager.handlers[0].rejected;

      const mockRefresh401 = {
        isAxiosError: true,
        config: { url: '/auth/token/refresh' },
        response: {
          status: 401,
          data: { code: 'REFRESH_TOKEN_INVALID', message: 'The refresh token is invalid or expired.' },
        },
      };

      await expect(responseInterceptor(mockRefresh401)).rejects.toThrow(UnauthorizedError);
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().refreshToken).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });
});
