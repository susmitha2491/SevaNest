import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../core/rbac/permissions';
import {
  formatPhoneNumber,
  getCustomerPhone,
  getWorkerPhone,
  fetchCustomerUnmaskedPhone,
  fetchWorkerUnmaskedPhone,
} from '../../core/utils/phoneDirectory';

export interface MaskedPhoneTextProps {
  /**
   * Raw or formatted phone number (could be masked e.g. '+91******6655' or unmasked e.g. '+91 98765 43210')
   */
  phone?: string | null;
  /**
   * Explicit masked phone representation provided by the backend
   */
  maskedPhone?: string | null;
  /**
   * Explicit unmasked phone number if already available
   */
  unmaskedPhone?: string | null;
  /**
   * Entity ID (customer ID, worker ID, etc.) for dynamic unmasked resolution
   */
  entityId?: string | null;
  /**
   * Entity type to determine the appropriate resolution and default RBAC permission
   */
  entityType?: 'customer' | 'worker' | 'general';
  /**
   * Override RBAC permission required to reveal this number
   */
  permissionKey?: string;
  /**
   * Explicit permission boolean override (e.g. calculated by parent view)
   */
  canReveal?: boolean;
  /**
   * Fallback text if no phone number exists
   */
  fallbackText?: string;
  /**
   * Container style
   */
  style?: React.CSSProperties;
  /**
   * Text style
   */
  textStyle?: React.CSSProperties;
  /**
   * Toggle button style
   */
  buttonStyle?: React.CSSProperties;
  /**
   * Optional custom CSS class
   */
  className?: string;
  /**
   * Test ID for testing and automation
   */
  testId?: string;
  /**
   * Whether revealing the phone number is permitted in this module/context.
   * STRICT SECURITY POLICY: Only Customer Management and Worker Management allow reveal.
   * Defaults to false in all other modules.
   */
  allowReveal?: boolean;
  /**
   * Initial revealed state (defaults to false; only respected if allowReveal is true)
   */
  initialRevealed?: boolean;
}

/**
 * Shared component for displaying masked phone numbers with an accessible reveal/hide eye toggle.
 * Strictly respects RBAC, avoids persistence (in-memory state only), and formats standard numbers cleanly.
 * Reveal functionality is strictly restricted to Customer Management and Worker Management modules.
 */
export const MaskedPhoneText: React.FC<MaskedPhoneTextProps> = ({
  phone,
  maskedPhone,
  unmaskedPhone,
  entityId,
  entityType,
  permissionKey,
  canReveal,
  allowReveal = false,
  fallbackText,
  style,
  textStyle,
  buttonStyle,
  className,
  testId,
  initialRevealed = false,
}) => {
  const effectiveInitialRevealed = allowReveal ? initialRevealed : false;
  const [isRevealed, setIsRevealed] = useState<boolean>(effectiveInitialRevealed);

  const [resolvedUnmasked, setResolvedUnmasked] = useState<string | undefined>(() => {
    if (unmaskedPhone && !unmaskedPhone.includes('*')) {
      return formatPhoneNumber(unmaskedPhone);
    }
    if (phone && !phone.includes('*')) {
      return formatPhoneNumber(phone);
    }
    if (entityId) {
      const fromDir = entityType === 'worker' ? getWorkerPhone(entityId) : getCustomerPhone(entityId);
      if (fromDir && !fromDir.includes('*')) {
        return formatPhoneNumber(fromDir);
      }
    }
    return undefined;
  });
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [fetchFailed, setFetchFailed] = useState<boolean>(false);

  // Sync if unmaskedPhone or phone prop changes
  useEffect(() => {
    if (unmaskedPhone && !unmaskedPhone.includes('*')) {
      setResolvedUnmasked(formatPhoneNumber(unmaskedPhone));
    } else if (phone && !phone.includes('*')) {
      setResolvedUnmasked(formatPhoneNumber(phone));
    } else if (entityId) {
      const fromDir = entityType === 'worker' ? getWorkerPhone(entityId) : getCustomerPhone(entityId);
      if (fromDir && !fromDir.includes('*')) {
        setResolvedUnmasked(formatPhoneNumber(fromDir));
      }
    }
  }, [unmaskedPhone, phone, entityId, entityType]);

  // Auth & RBAC check
  const user = useAuthStore((state) => state.user);
  const userPermissions = user?.permissions;

  const defaultRequiredPermission = permissionKey || (
    entityType === 'customer' ? PERMISSIONS.CUSTOMER_VIEW :
    entityType === 'worker' ? PERMISSIONS.WORKER_VIEW :
    undefined
  );

  const isAuthorized = canReveal !== undefined
    ? canReveal
    : (!defaultRequiredPermission || hasPermission(userPermissions, defaultRequiredPermission));

  // Compute standard masked display text
  const computeMaskedText = (): string => {
    if (maskedPhone && maskedPhone.trim()) {
      return maskedPhone.trim();
    }
    const raw = phone || resolvedUnmasked;
    if (!raw || !raw.trim()) {
      return fallbackText !== undefined ? fallbackText : 'Phone not on file';
    }
    const trimmed = raw.trim();
    if (trimmed.includes('*')) {
      return trimmed;
    }
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length >= 10) {
      return `+91******${digits.slice(-4)}`;
    }
    return '+91 ******';
  };

  const maskedText = computeMaskedText();
  const isEmptyOrMissing = !phone && !maskedPhone && !unmaskedPhone && !resolvedUnmasked;

  // If there is no phone information at all, display fallback text without toggle
  if (isEmptyOrMissing) {
    return (
      <span
        data-testid={testId || 'masked-phone-container'}
        className={className}
        style={{ display: 'inline-block', ...style, ...textStyle }}
      >
        {fallbackText !== undefined ? fallbackText : 'Phone not on file'}
      </span>
    );
  }

  // Determine whether unmasked number is available or fetchable
  // Rule: reveal toggle is ONLY enabled if allowReveal === true, user is authorized, and unmasked data exists/is fetchable
  const canFetchFromBackend = Boolean(allowReveal && entityId && !fetchFailed && (entityType === 'customer' || entityType === 'worker'));
  const hasUnmaskedData = Boolean(resolvedUnmasked && !resolvedUnmasked.includes('*'));
  const canToggle = Boolean(allowReveal && isAuthorized && (hasUnmaskedData || canFetchFromBackend));

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!allowReveal || !isAuthorized) return;

    if (isRevealed) {
      setIsRevealed(false);
      return;
    }

    if (resolvedUnmasked && !resolvedUnmasked.includes('*')) {
      setIsRevealed(true);
      return;
    }

    if (canFetchFromBackend && entityId) {
      setIsFetching(true);
      try {
        const fetched = entityType === 'worker'
          ? await fetchWorkerUnmaskedPhone(entityId)
          : await fetchCustomerUnmaskedPhone(entityId);

        if (fetched && !fetched.includes('*')) {
          setResolvedUnmasked(formatPhoneNumber(fetched));
          setIsRevealed(true);
        } else {
          setFetchFailed(true);
        }
      } catch {
        setFetchFailed(true);
      } finally {
        setIsFetching(false);
      }
    }
  };

  const displayText = allowReveal && isRevealed && resolvedUnmasked ? resolvedUnmasked : maskedText;

  return (
    <span
      data-testid={testId || 'masked-phone-container'}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        verticalAlign: 'baseline',
        ...style,
      }}
    >
      <span style={textStyle}>{displayText}</span>

      {canToggle && (
        <button
          type="button"
          onClick={handleToggle}
          disabled={isFetching}
          data-testid={testId ? `${testId}-toggle` : 'phone-reveal-button'}
          aria-label={isRevealed ? 'Hide phone number' : 'Show phone number'}
          title={isRevealed ? 'Hide phone number' : 'Show phone number'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            padding: '2px',
            margin: 0,
            cursor: isFetching ? 'wait' : 'pointer',
            color: isRevealed ? 'var(--color-brand-600, #2563eb)' : 'var(--color-text-tertiary, #94a3b8)',
            borderRadius: '4px',
            lineHeight: 1,
            verticalAlign: 'middle',
            transition: 'color 150ms ease, background-color 150ms ease',
            outline: 'none',
            ...buttonStyle,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-brand-600, #2563eb)';
            e.currentTarget.style.backgroundColor = 'var(--color-bg-hover, #f1f5f9)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = isRevealed
              ? 'var(--color-brand-600, #2563eb)'
              : 'var(--color-text-tertiary, #94a3b8)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {isFetching ? (
            <RefreshCw size={12} className="animate-spin" aria-hidden="true" />
          ) : isRevealed ? (
            <EyeOff size={13} aria-hidden="true" />
          ) : (
            <Eye size={13} aria-hidden="true" />
          )}
        </button>
      )}
    </span>
  );
};
