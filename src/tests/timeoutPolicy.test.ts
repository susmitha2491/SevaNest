import { describe, it, expect } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { resolveRequestTimeout, TIMEOUT_TIERS } from '../core/api/timeoutConfig';

describe('Context-Aware Tiered Timeout Policy', () => {
  it('assigns AUTH_LOGIN tier (0) for admin login requests to remove artificial client abort', () => {
    const config = {
      url: '/api/v1/auth/admin/login',
      method: 'post',
      timeout: 15000,
    } as unknown as InternalAxiosRequestConfig;

    expect(resolveRequestTimeout(config)).toBe(TIMEOUT_TIERS.AUTH_LOGIN);
    expect(resolveRequestTimeout(config)).toBe(0);
  });

  it('assigns FAST_PROBE tier (10s) for health and ping checks', () => {
    const healthConfig = {
      url: '/healthz',
      method: 'get',
    } as unknown as InternalAxiosRequestConfig;
    expect(resolveRequestTimeout(healthConfig)).toBe(TIMEOUT_TIERS.FAST_PROBE);
    expect(resolveRequestTimeout(healthConfig)).toBe(10000);

    const pingConfig = {
      url: '/api/v1/ping',
      method: 'get',
    } as unknown as InternalAxiosRequestConfig;
    expect(resolveRequestTimeout(pingConfig)).toBe(TIMEOUT_TIERS.FAST_PROBE);
  });

  it('assigns HEAVY_MUTATION tier (60s) for reconsideration workflows', () => {
    const reconsiderConfig = {
      url: '/api/v1/admin/workers/w-123/reconsider',
      method: 'post',
    } as unknown as InternalAxiosRequestConfig;

    expect(resolveRequestTimeout(reconsiderConfig)).toBe(TIMEOUT_TIERS.HEAVY_MUTATION);
    expect(resolveRequestTimeout(reconsiderConfig)).toBe(60000);
  });

  it('assigns HEAVY_MUTATION tier (60s) for refunds, uploads, exports, and signoffs', () => {
    const refundConfig = {
      url: '/api/v1/admin/payments/pay-456/refund',
      method: 'post',
    } as unknown as InternalAxiosRequestConfig;
    expect(resolveRequestTimeout(refundConfig)).toBe(TIMEOUT_TIERS.HEAVY_MUTATION);

    const docConfig = {
      url: '/api/v1/admin/verification/documents/upload',
      method: 'post',
    } as unknown as InternalAxiosRequestConfig;
    expect(resolveRequestTimeout(docConfig)).toBe(TIMEOUT_TIERS.HEAVY_MUTATION);

    const signoffConfig = {
      url: '/api/v1/admin/verification/signoff',
      method: 'post',
    } as unknown as InternalAxiosRequestConfig;
    expect(resolveRequestTimeout(signoffConfig)).toBe(TIMEOUT_TIERS.HEAVY_MUTATION);
  });

  it('assigns STANDARD_MUTATION tier (35s) for standard writes (POST/PUT/PATCH/DELETE)', () => {
    const postConfig = {
      url: '/api/v1/admin/bookings/bk-100/status',
      method: 'patch',
    } as unknown as InternalAxiosRequestConfig;
    expect(resolveRequestTimeout(postConfig)).toBe(TIMEOUT_TIERS.STANDARD_MUTATION);
    expect(resolveRequestTimeout(postConfig)).toBe(35000);

    const deleteConfig = {
      url: '/api/v1/admin/roles/custom-role',
      method: 'delete',
    } as unknown as InternalAxiosRequestConfig;
    expect(resolveRequestTimeout(deleteConfig)).toBe(TIMEOUT_TIERS.STANDARD_MUTATION);
  });

  it('assigns DEFAULT_QUERY tier (45s) for standard data fetching (GET)', () => {
    const queueConfig = {
      url: '/api/v1/admin/verification/queue',
      method: 'get',
    } as unknown as InternalAxiosRequestConfig;
    expect(resolveRequestTimeout(queueConfig)).toBe(TIMEOUT_TIERS.DEFAULT_QUERY);
    expect(resolveRequestTimeout(queueConfig)).toBe(45000);

    const paymentsConfig = {
      url: '/api/v1/admin/payments',
      method: 'get',
    } as unknown as InternalAxiosRequestConfig;
    expect(resolveRequestTimeout(paymentsConfig)).toBe(TIMEOUT_TIERS.DEFAULT_QUERY);

    const attendanceConfig = {
      url: '/api/v1/admin/attendance/daily-logs',
      method: 'get',
    } as unknown as InternalAxiosRequestConfig;
    expect(resolveRequestTimeout(attendanceConfig)).toBe(TIMEOUT_TIERS.DEFAULT_QUERY);
  });

  it('preserves custom explicit timeout configured by caller', () => {
    const customConfig = {
      url: '/api/v1/admin/special-query',
      method: 'get',
      timeout: 80000,
    } as unknown as InternalAxiosRequestConfig;
    expect(resolveRequestTimeout(customConfig)).toBe(80000);

    const quickConfig = {
      url: '/api/v1/admin/quick-fetch',
      method: 'get',
      timeout: 5000,
    } as unknown as InternalAxiosRequestConfig;
    expect(resolveRequestTimeout(quickConfig)).toBe(5000);
  });
});
