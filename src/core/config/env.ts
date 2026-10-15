import { z } from 'zod';

const isTestEnv = import.meta.env.MODE === 'test';
const isDev = import.meta.env.DEV && !isTestEnv;
const defaultApiBaseUrl = isDev ? '/api/v1' : 'https://sevanest-backend.onrender.com/api/v1';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().min(1, 'API Base URL is required').default(defaultApiBaseUrl),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production', 'test']).default(isDev ? 'development' : 'production'),
  VITE_USE_MOCK_AUTH: z.preprocess(
    (val) => (isTestEnv ? true : (val !== undefined ? val === 'true' || val === true : false)),
    z.boolean()
  ).default(isTestEnv),
  VITE_API_TIMEOUT_MS: z.coerce.number().default(15000),
  VITE_ENABLE_TELEMETRY: z.coerce.boolean().default(false),
});

export type AppEnv = z.infer<typeof envSchema>;

const parsedEnv = envSchema.safeParse(import.meta.env);

if (!parsedEnv.success) {
  console.error('Invalid environment configuration:', parsedEnv.error.format());
}

export const env: AppEnv = parsedEnv.success
  ? parsedEnv.data
  : {
      VITE_API_BASE_URL: defaultApiBaseUrl,
      VITE_APP_ENV: isDev ? 'development' : 'production',
      VITE_USE_MOCK_AUTH: isTestEnv,
      VITE_API_TIMEOUT_MS: 15000,
      VITE_ENABLE_TELEMETRY: false,
    };

/**
 * Validates that the API configuration is present and structurally sound.
 * Throws a safe, understandable error if the API configuration is missing or malformed.
 */
export function validateApiConfig(customEnv: AppEnv = env): string {
  const url = customEnv.VITE_API_BASE_URL?.trim();
  if (!url) {
    throw new Error('Configuration Error: VITE_API_BASE_URL is missing. Please define the backend API base URL in your environment.');
  }

  try {
    // Relative URLs (like '/api/v1' for Vite proxy) are valid in browser environments
    if (!url.startsWith('/')) {
      if (typeof window !== 'undefined' && window.URL) {
        new window.URL(url);
      } else {
        new (globalThis.URL)(url);
      }
    }
  } catch {
    throw new Error(`Configuration Error: VITE_API_BASE_URL "${url}" is not a valid URL or path.`);
  }

  return url;
}

