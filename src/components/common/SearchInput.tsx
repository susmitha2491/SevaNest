import React, { forwardRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onSearchSubmit?: (value: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  minWidth?: string | number;
  maxWidth?: string | number;
  containerStyle?: React.CSSProperties;
}

/**
 * Standardized Accessible SearchInput for SevaNest Admin Portal.
 * Prevents unintended form submissions / page reloads on Enter,
 * provides immediate visual input feedback, and includes a clear button.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onClear,
      onSearchSubmit,
      isLoading = false,
      placeholder = 'Search...',
      ariaLabel = 'Search records',
      minWidth = 'min(100%, 200px)',
      maxWidth,
      containerStyle,
      disabled,
      className,
      style,
      ...rest
    },
    ref
  ) => {
    const handleClear = () => {
      onChange('');
      if (onClear) {
        onClear();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (onSearchSubmit) {
          onSearchSubmit(value);
        }
      }
      if (rest.onKeyDown) {
        rest.onKeyDown(e);
      }
    };

    return (
      <div
        className={`search-input-wrapper ${className || ''}`}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          flex: '1 1 240px',
          minWidth: typeof minWidth === 'number' ? `${minWidth}px` : (minWidth || 'min(100%, 200px)'),
          maxWidth: maxWidth || 'none',
          boxSizing: 'border-box',
          ...containerStyle,
        }}
      >
        <Search
          size={16}
          color="var(--color-text-tertiary, #94a3b8)"
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            flexShrink: 0,
            zIndex: 1,
          }}
          aria-hidden="true"
        />

        <input
          ref={ref}
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="search-input-field"
          style={{
            width: '100%',
            height: '38px',
            minHeight: '38px',
            padding: '0 38px 0 38px',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid var(--color-border, #cbd5e1)',
            fontSize: 'var(--font-size-sm, 13px)',
            color: 'var(--color-text-primary, #0f172a)',
            backgroundColor: disabled
              ? 'var(--color-bg-disabled, #f1f5f9)'
              : 'var(--color-bg-surface, #ffffff)',
            outline: 'none',
            boxSizing: 'border-box',
            lineHeight: '36px',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
            ...style,
          }}
          {...rest}
        />

        {/* Loading / Clear Controls */}
        <div
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            zIndex: 1,
          }}
        >
          {isLoading && (
            <Loader2
              size={15}
              className="animate-spin"
              style={{ color: 'var(--color-primary, #0f766e)' }}
              aria-label="Searching..."
            />
          )}

          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              title="Clear search"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-bg-subtle, #f1f5f9)',
                color: 'var(--color-text-muted, #64748b)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'background-color 150ms ease, color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-border-subtle, #e2e8f0)';
                e.currentTarget.style.color = 'var(--color-text-primary, #0f172a)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle, #f1f5f9)';
                e.currentTarget.style.color = 'var(--color-text-muted, #64748b)';
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
