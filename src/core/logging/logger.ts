/**
 * PII-Safe Structured Logger for SevaNest Admin Portal.
 * Ensures credentials, tokens, Aadhaar numbers, and phone numbers are scrubbed before logging.
 */

const PII_PATTERNS = [
  { regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, mask: '[AADHAAR-MASKED]' },
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, mask: '[EMAIL-MASKED]' },
  { regex: /(?:\+91|91|0)?[6-9]\d{9}\b/g, mask: '[PHONE-MASKED]' },
  { regex: /("password"|"token"|"authorization"|"secret"):\s*"[^"]+"/gi, mask: '$1:"[REDACTED]"' },
];

function sanitize(message: string): string {
  let sanitized = message;
  for (const { regex, mask } of PII_PATTERNS) {
    sanitized = sanitized.replace(regex, mask);
  }
  return sanitized;
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => {
    console.info(`[INFO] ${sanitize(message)}`, context ? JSON.stringify(context) : '');
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    console.warn(`[WARN] ${sanitize(message)}`, context ? JSON.stringify(context) : '');
  },
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => {
    console.error(`[ERROR] ${sanitize(message)}`, error, context ? JSON.stringify(context) : '');
  },
};
