import { describe, it, expect } from 'vitest';
import { formatCurrencyINR } from '../shared/formatters/currency';
import { formatDateTimeIST, formatDateIST, formatRegistrationDateIST } from '../shared/formatters/dateTime';

describe('Shared Formatters', () => {
  describe('formatCurrencyINR', () => {
    it('formats numbers to Indian Rupee currency format', () => {
      const result = formatCurrencyINR(499);
      expect(result).toContain('499.00');
    });

    it('formats larger amounts adhering to Indian numbering system', () => {
      const result = formatCurrencyINR(485200);
      expect(result).toContain('4,85,200.00');
    });

    it('handles undefined or null gracefully', () => {
      expect(formatCurrencyINR(undefined)).toBe('₹0.00');
      expect(formatCurrencyINR(null)).toBe('₹0.00');
    });
  });

  describe('formatDateTimeIST', () => {
    it('formats valid ISO date strings to IST representation', () => {
      const isoString = '2026-10-09T08:30:00Z';
      const result = formatDateTimeIST(isoString);
      expect(result).not.toBe('—');
      expect(result.length).toBeGreaterThan(5);
      expect(result).toContain('IST');
    });

    it('returns placeholder for invalid or missing timestamps', () => {
      expect(formatDateTimeIST(undefined)).toBe('—');
      expect(formatDateTimeIST(null)).toBe('—');
      expect(formatDateTimeIST('invalid-date')).toBe('—');
    });
  });

  describe('formatDateIST', () => {
    it('formats date only in IST', () => {
      const isoString = '2026-10-09T08:30:00Z';
      const result = formatDateIST(isoString);
      expect(result).not.toBe('—');
    });
  });

  describe('formatRegistrationDateIST', () => {
    it('formats UTC ISO timestamp accurately to Indian Standard Time (IST)', () => {
      const result = formatRegistrationDateIST('2026-10-15T05:03:33.820Z');
      expect(result).toContain('15 Oct 2026');
      expect(result).toContain('10:33');
      expect(result).toContain('IST');
    });

    it('preserves non-date relative test fixtures like Recent and Prior', () => {
      expect(formatRegistrationDateIST('Recent')).toBe('Recent');
      expect(formatRegistrationDateIST('Prior')).toBe('Prior');
    });

    it('returns fallback placeholder for null or undefined', () => {
      expect(formatRegistrationDateIST(undefined)).toBe('—');
      expect(formatRegistrationDateIST(null)).toBe('—');
      expect(formatRegistrationDateIST('')).toBe('—');
    });
  });
});

