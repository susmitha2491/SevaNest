/* global HTMLDivElement, HTMLButtonElement, HTMLSelectElement, HTMLElement, MouseEvent, TouchEvent, Node, Event */
import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectOptionInput = string | SelectOption;

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOptionInput[];
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  minWidth?: string | number;
  maxWidth?: string | number;
  width?: string | number;
  className?: string;
  style?: React.CSSProperties;
  triggerStyle?: React.CSSProperties;
  menuStyle?: React.CSSProperties;
  'data-testid'?: string;
  testId?: string;
}

/**
 * Normalizes string[] or SelectOption[] into SelectOption[]
 */
function normalizeOptions(options: SelectOptionInput[]): SelectOption[] {
  return options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });
}

/**
 * Enterprise Custom Dropdown Component with React Portal Rendering.
 * - Zoom-resilient (50% - 200%) by avoiding native OS select popups in favor of portal-rendered listbox.
 * - Automatically positions relative to trigger and flips upward if near the bottom viewport edge.
 * - Renders into document.body to avoid clipping inside tables, cards, modals, or overflow containers.
 * - Full keyboard navigation (Enter, Space, Escape, Arrow Up/Down, Home, End).
 * - Synchronizes with an underlying accessible select element to ensure test suites, screen readers,
 *   and form controls remain 100% compatible.
 */
export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options: rawOptions,
  placeholder,
  ariaLabel,
  id,
  name,
  disabled = false,
  minWidth = '140px',
  maxWidth,
  width,
  className = '',
  style,
  triggerStyle,
  menuStyle,
  'data-testid': dataTestId,
  testId,
}) => {
  const options = normalizeOptions(rawOptions);
  const effectiveTestId = dataTestId || testId;
  const generatedId = useId();
  const selectId = id || `select-${generatedId}`;
  const listboxId = `listbox-${generatedId}`;

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [portalPosition, setPortalPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    openUpward: boolean;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const nativeSelectRef = useRef<HTMLSelectElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder || (options[0]?.label ?? '');

  // Calculate position in viewport
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const bodyZoom = (typeof window !== 'undefined' && parseFloat(window.getComputedStyle(document.body).zoom)) || 1;
    const rawRect = triggerRef.current.getBoundingClientRect();
    const rect = {
      top: rawRect.top / bodyZoom,
      bottom: rawRect.bottom / bodyZoom,
      left: rawRect.left / bodyZoom,
      right: rawRect.right / bodyZoom,
      width: rawRect.width / bodyZoom,
      height: rawRect.height / bodyZoom,
    };
    const viewportHeight = window.innerHeight / bodyZoom;
    const viewportWidth = window.innerWidth / bodyZoom;

    const estimatedMenuHeight = Math.min(260, options.length * 36 + 16);
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    const openUpward = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, openUpward ? spaceAbove - 16 : spaceBelow - 16);

    const menuWidth = Math.max(rect.width, typeof minWidth === 'number' ? minWidth : parseInt(minWidth, 10) || 140);
    let left = rect.left;
    if (left + menuWidth > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - menuWidth - 8);
    }

    setPortalPosition({
      top: openUpward ? rect.top - 4 : rect.bottom + 4,
      left: Math.max(8, left),
      width: menuWidth,
      maxHeight,
      openUpward,
    });
  }, [options.length, minWidth]);

  // Open / Close toggles
  const handleOpen = useCallback(() => {
    if (disabled) return;
    updatePosition();
    const currentIndex = options.findIndex((opt) => opt.value === value);
    setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    setIsOpen(true);
  }, [disabled, updatePosition, options, value]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  // Update position on scroll / resize while open
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      handleClose();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen, handleClose]);

  // Selection handler
  const handleSelect = (val: string, optDisabled?: boolean) => {
    if (optDisabled) return;
    onChange(val);
    if (nativeSelectRef.current) {
      nativeSelectRef.current.value = val;
      nativeSelectRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
    handleClose();
    triggerRef.current?.focus();
  };

  // Keyboard navigation on trigger button
  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          handleOpen();
        } else if (e.key === 'ArrowDown') {
          setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          handleOpen();
        } else {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        }
        break;
      case 'Escape':
        if (isOpen) {
          e.preventDefault();
          handleClose();
        }
        break;
      case 'Tab':
        if (isOpen) {
          handleClose();
        }
        break;
      default:
        break;
    }
  };

  // Keyboard navigation inside the menu
  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          const opt = options[highlightedIndex];
          if (!opt.disabled) {
            handleSelect(opt.value, opt.disabled);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        handleClose();
        triggerRef.current?.focus();
        break;
      case 'Tab':
        handleClose();
        break;
      default:
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !menuRef.current) return;
    const items = menuRef.current.querySelectorAll('[role="option"]');
    const targetItem = items[highlightedIndex] as HTMLElement | undefined;
    targetItem?.scrollIntoView?.({ block: 'nearest' });
  }, [isOpen, highlightedIndex]);

  const minWidthStyle = typeof minWidth === 'number' ? `${minWidth}px` : minWidth;
  const maxWidthStyle = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;
  const widthStyle = width || 'auto';

  return (
    <div
      ref={containerRef}
      className={`custom-select-wrapper ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        minWidth: minWidthStyle,
        maxWidth: maxWidthStyle,
        width: widthStyle,
        verticalAlign: 'middle',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* 
        1. Hidden Native Select for 100% Test & Form & Screen Reader Compatibility.
        Keeps aria-label, options, values, and minWidth bounds intact.
      */}
      <select
        ref={nativeSelectRef}
        id={selectId}
        name={name}
        data-testid={effectiveTestId}
        aria-label={ariaLabel}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        className="custom-select-native"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          pointerEvents: 'none',
          minWidth: minWidthStyle,
          maxWidth: maxWidthStyle,
          zIndex: -1,
          margin: 0,
          padding: 0,
          border: 'none',
          ...triggerStyle,
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* 
        2. Visible Zoom-Resilient Custom Dropdown Trigger
      */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        onKeyDown={handleTriggerKeyDown}
        className="custom-select-trigger"
        style={{
          width: '100%',
          minHeight: '38px',
          height: '38px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '0 12px',
          fontSize: 'var(--font-size-sm, 13px)',
          fontWeight: 500,
          lineHeight: '36px',
          borderRadius: 'var(--radius-md, 8px)',
          border: isOpen
            ? '1px solid var(--color-primary, #0f766e)'
            : '1px solid var(--color-border, #cbd5e1)',
          backgroundColor: disabled
            ? 'var(--color-bg-disabled, #f1f5f9)'
            : 'var(--color-bg-surface, #ffffff)',
          color: disabled
            ? 'var(--color-text-disabled, #94a3b8)'
            : 'var(--color-text-primary, #0f172a)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxSizing: 'border-box',
          boxShadow: isOpen ? '0 0 0 3px rgba(15, 118, 110, 0.15)' : 'none',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
          ...triggerStyle,
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'left',
            flex: 1,
          }}
        >
          {displayLabel}
        </span>
        <ChevronDown
          size={14}
          color="var(--color-text-tertiary, #64748b)"
          style={{
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform var(--transition-fast, 150ms)',
          }}
          aria-hidden="true"
        />
      </button>

      {/* 
        3. Portal-Rendered Dropdown Menu
      */}
      {isOpen &&
        portalPosition &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel || 'Select options'}
            tabIndex={-1}
            onKeyDown={handleMenuKeyDown}
            style={{
              position: 'fixed',
              top: portalPosition.openUpward ? undefined : portalPosition.top,
              bottom: portalPosition.openUpward
                ? (window.innerHeight / ((typeof window !== 'undefined' && parseFloat(window.getComputedStyle(document.body).zoom)) || 1)) - portalPosition.top
                : undefined,
              left: portalPosition.left,
              width: portalPosition.width,
              maxHeight: `${portalPosition.maxHeight}px`,
              backgroundColor: 'var(--color-bg-surface, #ffffff)',
              borderRadius: 'var(--radius-md, 8px)',
              border: '1px solid var(--color-border, #cbd5e1)',
              boxShadow:
                '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              overflowY: 'auto',
              overflowX: 'hidden',
              zIndex: 99999,
              padding: '4px',
              boxSizing: 'border-box',
              ...menuStyle,
            }}
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled}
                  tabIndex={-1}
                  onClick={() => handleSelect(opt.value, opt.disabled)}
                  onMouseEnter={() => !opt.disabled && setHighlightedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm, 4px)',
                    fontSize: 'var(--font-size-xs, 12px)',
                    fontWeight: isSelected ? 600 : 400,
                    lineHeight: 1.4,
                    color: opt.disabled
                      ? 'var(--color-text-disabled, #94a3b8)'
                      : isSelected
                      ? 'var(--color-primary, #0f766e)'
                      : 'var(--color-text-primary, #0f172a)',
                    backgroundColor: opt.disabled
                      ? 'transparent'
                      : isHighlighted
                      ? 'var(--color-bg-subtle, #f1f5f9)'
                      : isSelected
                      ? 'var(--color-primary-subtle, #f0fdfa)'
                      : 'transparent',
                    cursor: opt.disabled ? 'not-allowed' : 'pointer',
                    userSelect: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {opt.label}
                  </span>
                  {isSelected && (
                    <Check
                      size={14}
                      color="var(--color-primary, #0f766e)"
                      style={{ flexShrink: 0 }}
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};
