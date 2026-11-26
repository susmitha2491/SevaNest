import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MaskedPhoneText } from '../shared/components/MaskedPhoneText';
import { useAuthStore } from '../core/auth/authStore';
import { setCustomerPhone, extractSearchMobileDigits, extractCanonicalMobileDigits } from '../core/utils/phoneDirectory';

describe('MaskedPhoneText Global Component & Visibility Policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();

    // Default authenticated admin with view permissions
    useAuthStore.setState({
      user: {
        id: 'admin-1',
        name: 'Super Admin',
        email: 'admin@sevanest.internal',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        permissions: ['*'],
      },
      isAuthenticated: true,
      accessToken: 'token-xyz',
    });
  });

  describe('Policy 1: Restricted to Customer & Worker Modules (allowReveal={true})', () => {
    it('renders masked phone by default with an eye icon when allowReveal={true} and unmasked data exists', () => {
      render(
        <MaskedPhoneText
          maskedPhone="+91******6655"
          unmaskedPhone="+91 98765 46655"
          allowReveal={true}
          testId="phone-test-1"
        />
      );

      // Default displays masked text
      expect(screen.getByText('+91******6655')).toBeInTheDocument();
      // Eye icon button with accessible label
      const toggleBtn = screen.getByRole('button', { name: /show phone number/i });
      expect(toggleBtn).toBeInTheDocument();
    });

    it('reveals full number when eye icon is clicked and hides it on subsequent click', async () => {
      render(
        <MaskedPhoneText
          maskedPhone="+91******6655"
          unmaskedPhone="+91 98765 46655"
          allowReveal={true}
          testId="phone-test-2"
        />
      );

      const toggleBtn = screen.getByRole('button', { name: /show phone number/i });
      expect(screen.getByText('+91******6655')).toBeInTheDocument();

      // Click reveal
      fireEvent.click(toggleBtn);
      expect(screen.getByText('+91 98765 46655')).toBeInTheDocument();
      expect(screen.queryByText('+91******6655')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /hide phone number/i })).toBeInTheDocument();

      // Click again to hide
      fireEvent.click(screen.getByRole('button', { name: /hide phone number/i }));
      expect(screen.getByText('+91******6655')).toBeInTheDocument();
      expect(screen.queryByText('+91 98765 46655')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /show phone number/i })).toBeInTheDocument();
    });

    it('keeps each number instance completely independent', () => {
      render(
        <div>
          <MaskedPhoneText
            maskedPhone="+91******1111"
            unmaskedPhone="+91 98765 01111"
            allowReveal={true}
            testId="phone-inst-1"
          />
          <MaskedPhoneText
            maskedPhone="+91******2222"
            unmaskedPhone="+91 98765 02222"
            allowReveal={true}
            testId="phone-inst-2"
          />
        </div>
      );

      const buttons = screen.getAllByRole('button', { name: /show phone number/i });
      expect(buttons).toHaveLength(2);

      // Toggle only the first number
      fireEvent.click(buttons[0]);

      // First number is revealed
      expect(screen.getByText('+91 98765 01111')).toBeInTheDocument();
      // Second number remains masked
      expect(screen.getByText('+91******2222')).toBeInTheDocument();
      expect(screen.queryByText('+91 98765 02222')).not.toBeInTheDocument();
    });

    it('resolves unmasked number from phone directory using entityId when allowReveal={true}', () => {
      setCustomerPhone('cust-999', '+91 99988 77766');

      render(
        <MaskedPhoneText
          maskedPhone="+91******7766"
          entityId="cust-999"
          entityType="customer"
          allowReveal={true}
          testId="phone-dir-test"
        />
      );

      const toggleBtn = screen.getByRole('button', { name: /show phone number/i });
      fireEvent.click(toggleBtn);

      expect(screen.getByText('+91 99988 77766')).toBeInTheDocument();
    });
  });

  describe('Policy 2: Strict Masking in All Other Modules (allowReveal={false} or omitted)', () => {
    it('NEVER renders reveal button in other modules even if unmasked number is known', () => {
      render(
        <MaskedPhoneText
          maskedPhone="+91******8888"
          unmaskedPhone="+91 98765 48888"
          entityId="cust-123"
          entityType="customer"
          allowReveal={false}
          testId="booking-phone"
        />
      );

      // Must be masked
      expect(screen.getByText('+91******8888')).toBeInTheDocument();
      // Must NOT render any toggle button
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('phone-reveal-button')).not.toBeInTheDocument();
    });

    it('defaults allowReveal to false when omitted', () => {
      render(
        <MaskedPhoneText
          maskedPhone="+91******9999"
          unmaskedPhone="+91 98765 49999"
          testId="omitted-allow-reveal"
        />
      );

      expect(screen.getByText('+91******9999')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('ignores initialRevealed if allowReveal is false', () => {
      render(
        <MaskedPhoneText
          phone="+91 98765 43210"
          unmaskedPhone="+91 98765 43210"
          initialRevealed={true}
          allowReveal={false}
          testId="disallowed-initial-reveal"
        />
      );

      // Must remain masked
      expect(screen.getByText('+91******3210')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Security & RBAC Enforcement', () => {
    it('does NOT show reveal button if user lacks permission even if allowReveal={true}', () => {
      // User with restricted permissions (e.g. only support view, no customer/worker view)
      useAuthStore.setState({
        user: {
          id: 'support-1',
          name: 'Support Executive',
          email: 'support@sevanest.internal',
          role: 'SUPPORT_EXECUTIVE',
          status: 'ACTIVE',
          permissions: ['support.view'],
        },
        isAuthenticated: true,
        accessToken: 'token-xyz',
      });

      render(
        <MaskedPhoneText
          maskedPhone="+91******6655"
          unmaskedPhone="+91 98765 46655"
          entityType="customer"
          allowReveal={true}
          testId="restricted-user-phone"
        />
      );

      // Masked text is rendered
      expect(screen.getByText('+91******6655')).toBeInTheDocument();
      // No reveal button is present
      expect(screen.queryByRole('button', { name: /phone number/i })).not.toBeInTheDocument();
    });

    it('does NOT write anything to localStorage or sessionStorage upon reveal', () => {
      render(
        <MaskedPhoneText
          maskedPhone="+91******6655"
          unmaskedPhone="+91 98765 46655"
          allowReveal={true}
          testId="storage-leak-check"
        />
      );

      const toggleBtn = screen.getByRole('button', { name: /show phone number/i });
      fireEvent.click(toggleBtn);

      expect(window.localStorage.length).toBe(0);
      expect(window.sessionStorage.length).toBe(0);
    });

    it('renders fallbackText when phone is missing', () => {
      render(
        <MaskedPhoneText
          fallbackText="Phone not provided"
          testId="empty-phone"
        />
      );

      expect(screen.getByText('Phone not provided')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Search Mobile Digits Normalization', () => {
    it('normalizes 10-digit, +91, spaces, hyphens, and leading zero mobile formats', () => {
      expect(extractSearchMobileDigits('9876543210')).toBe('9876543210');
      expect(extractSearchMobileDigits('+919876543210')).toBe('9876543210');
      expect(extractSearchMobileDigits('+91 98765 43210')).toBe('9876543210');
      expect(extractSearchMobileDigits('+91-98765-43210')).toBe('9876543210');
      expect(extractSearchMobileDigits('98765-43210')).toBe('9876543210');
      expect(extractSearchMobileDigits('09876543210')).toBe('9876543210');
    });

    it('returns null for non-phone strings and distinguishes partial queries', () => {
      expect(extractSearchMobileDigits('Sunita Devi')).toBeNull();
      expect(extractSearchMobileDigits('C-1092')).toBeNull();
      expect(extractSearchMobileDigits('W-10482')).toBeNull();
      expect(extractSearchMobileDigits('')).toBeNull();
      expect(extractSearchMobileDigits(null)).toBeNull();

      // Partial queries return digits from extractSearchMobileDigits
      expect(extractSearchMobileDigits('98765')).toBe('98765');
      // but canonical 10-digit helper returns null for partial inputs
      expect(extractCanonicalMobileDigits('98765')).toBeNull();
    });
  });
});
