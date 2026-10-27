import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  requireRemarks?: boolean;
  showRemarks?: boolean;
  remarksPlaceholder?: string;
  errorMessage?: string | null;
  onConfirm: (remarks?: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  children?: React.ReactNode;
}

/**
 * Accessible Modal Confirmation Dialog.
 * Enforces mandatory remarks and explicit confirmation before executing critical administrative actions.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  requireRemarks = false,
  showRemarks = false,
  remarksPlaceholder = 'Enter mandatory operational rationale / remarks...',
  errorMessage = null,
  onConfirm,
  onCancel,
  isLoading = false,
  children,
}) => {
  const [remarks, setRemarks] = useState('');
  const [isConfirmedCheckbox, setIsConfirmedCheckbox] = useState(!isDestructive);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireRemarks && !remarks.trim()) return;
    if (isDestructive && !isConfirmedCheckbox) return;
    onConfirm(remarks.trim());
  };

  const isSubmitDisabled = isLoading || (requireRemarks && !remarks.trim()) || (isDestructive && !isConfirmedCheckbox);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--space-4)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget && !isLoading) {
          onCancel();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: '520px',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          boxShadow: 'var(--shadow-xl)',
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {isDestructive && (
              <div style={{ color: 'var(--color-error)' }}>
                <AlertTriangle size={24} />
              </div>
            )}
            <h2 id="confirm-dialog-title" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-navy)' }}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!isLoading) onCancel();
            }}
            style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          {description}
        </p>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-status-danger-bg, #fef2f2)',
              border: '1px solid var(--color-status-danger-border, #fca5a5)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-status-danger-text, #b91c1c)',
              fontSize: 'var(--font-size-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {children}

        {(requireRemarks || showRemarks) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label htmlFor="remarks-input" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Operational Remarks {requireRemarks ? '(Mandatory)' : '(Optional)'}
            </label>
            <textarea
              id="remarks-input"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={remarksPlaceholder}
              rows={3}
              style={{
                backgroundColor: 'var(--color-bg-app)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-primary)',
                padding: 'var(--space-3)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>
        )}

        {isDestructive && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isConfirmedCheckbox}
              onChange={(e) => setIsConfirmedCheckbox(e.target.checked)}
              style={{ accentColor: 'var(--color-error)' }}
            />
            <span>I confirm this action adheres to operational guidelines.</span>
          </label>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleConfirm();
            }}
            disabled={isSubmitDisabled}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isDestructive ? 'var(--color-error)' : 'var(--color-primary)',
              color: '#ffffff',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
              opacity: isSubmitDisabled ? 0.6 : 1,
            }}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
