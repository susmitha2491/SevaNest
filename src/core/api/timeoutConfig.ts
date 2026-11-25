import type { InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';

/**
 * Context-aware, tiered timeout policies for SevaNest Admin Portal.
 *
 * Tier definitions:
 * - FAST_PROBE (10s): Lightweight status/ping/healthcheck probes.
 * - STANDARD_MUTATION (35s): Standard single-record writes (POST, PUT, PATCH, DELETE).
 * - DEFAULT_QUERY (45s): Standard data fetching (GET requests). Accommodates Render cold starts (typically 20-35s)
 *   while staying under the Nginx proxy_read_timeout (60s).
 * - HEAVY_MUTATION (60s): Multi-step mutations or heavy operations (e.g. reconsideration workflow,
 *   refund processing, document uploads, data export, compliance sign-offs).
 * - AUTH_LOGIN (0): Super Admin / Staff authentication cold-start allowance (no artificial client abort).
 */
export const TIMEOUT_TIERS = {
  FAST_PROBE: 10_000,
  STANDARD_MUTATION: 35_000,
  DEFAULT_QUERY: 45_000,
  HEAVY_MUTATION: 60_000,
  AUTH_LOGIN: 0,
} as const;

/**
 * Resolves the appropriate context-aware timeout for an HTTP request.
 * Respects explicit caller-configured timeouts unless the caller passed
 * the legacy default 15s or the default query timeout.
 */
export function resolveRequestTimeout(config: InternalAxiosRequestConfig): number {
  const url = (config.url || '').toLowerCase();
  const method = (config.method || 'get').toLowerCase();

  // 1. Auth login cold-start allowance (removes artificial frontend timeout)
  if (url.includes('/auth/admin/login')) {
    return TIMEOUT_TIERS.AUTH_LOGIN;
  }

  // 2. If caller explicitly set a custom timeout that is distinct from the defaults/15s, honor it
  if (
    config.timeout !== undefined &&
    config.timeout > 0 &&
    config.timeout !== 15_000 &&
    config.timeout !== env.VITE_API_TIMEOUT_MS &&
    config.timeout !== TIMEOUT_TIERS.DEFAULT_QUERY
  ) {
    return config.timeout;
  }

  // 3. Fast health / status probes
  if (url.includes('/healthz') || url.includes('/health') || url.includes('/ping')) {
    return TIMEOUT_TIERS.FAST_PROBE;
  }

  // 4. Heavy / Multi-step operations and mutations
  const isHeavyOperation =
    url.includes('/reconsider') ||
    url.includes('/refund') ||
    url.includes('/export') ||
    url.includes('/documents') ||
    url.includes('/upload') ||
    url.includes('/signoff') ||
    url.includes('/decision');

  if (isHeavyOperation) {
    return TIMEOUT_TIERS.HEAVY_MUTATION;
  }

  // 5. Standard Mutations (POST, PUT, PATCH, DELETE)
  if (method === 'post' || method === 'put' || method === 'patch' || method === 'delete') {
    return TIMEOUT_TIERS.STANDARD_MUTATION;
  }

  // 6. Standard Data Fetching (GET, HEAD, OPTIONS)
  return TIMEOUT_TIERS.DEFAULT_QUERY;
}
