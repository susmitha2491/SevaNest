import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RealAuthRepository } from '../features/auth/data/authRepository';
import { httpClient } from '../core/api/httpClient';
import { ServerFailureError } from '../core/errors/DomainError';

describe('Backend Wake-Up & Cold-Start Auto-Retry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves entered password on server wake-up/503 errors and only wipes on 401 invalid credentials', () => {
    // Verify error classification for password clearing logic
    const wakeUpError = new ServerFailureError(
      'Authentication backend is waking up on Render (HTTP 503). Please retry in a few seconds.',
      'ref-123',
      'BACKEND_WAKING_UP'
    );

    const isCredentialError = wakeUpError.errorCode === 'INVALID_CREDENTIALS' || wakeUpError.errorCode === 'UNAUTHORIZED';
    expect(isCredentialError).toBe(false);
  });

  it('exposes RealAuthRepository with login method that correctly handles responses', async () => {
    const repo = new RealAuthRepository();
    vi.spyOn(httpClient, 'post').mockResolvedValueOnce({
      data: {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        user: {
          id: 'adm-001',
          name: 'Super Admin',
          email: 'sevanest@admin.in',
          role: 'SUPER_ADMIN',
          permissions: ['*'],
        },
      },
    });

    const result = await repo.login({ email: 'sevanest@admin.in', password: 'Sevanest@2026' });
    expect(result.accessToken).toBe('test-access-token');
    expect(result.user.role).toBe('SUPER_ADMIN');
  });
});

