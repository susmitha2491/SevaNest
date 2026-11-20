/* global WheelEvent, KeyboardEvent, PopStateEvent */
import React, { useState } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  acquireBodyScrollLock,
  releaseBodyScrollLock,
  getBodyScrollLockCount,
  forceResetBodyScrollLock,
} from '../shared/utils/bodyScrollLock';
import { useBodyScrollLock } from '../shared/hooks/useBodyScrollLock';
import { ConfirmDialog } from '../components/modals/ConfirmDialog';
import { CustomerDetailModal } from '../features/customers/presentation/CustomerDetailModal';
import { BookingDetailModal } from '../features/bookings/presentation/BookingDetailModal';
import { AuditDetailModal } from '../features/audit/presentation/AuditDetailModal';
import { ReportPreviewModal } from '../features/reports/presentation/ReportPreviewModal';
import { BookingDetail } from '../features/bookings/domain/types';
import { AuditLogItem } from '../features/audit/domain/types';
import { ReportItem } from '../features/reports/domain/types';

// Mock scrollTo
const scrollToMock = vi.fn();
Object.defineProperty(window, 'scrollTo', {
  value: scrollToMock,
  writable: true,
});

const testQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('Global Modal Background Scroll Lock Suite', () => {
  beforeEach(() => {
    forceResetBodyScrollLock();
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    document.documentElement.style.overflow = '';
    document.body.className = '';
    scrollToMock.mockClear();
  });

  afterEach(() => {
    forceResetBodyScrollLock();
  });

  describe('Core Scroll Lock Controller (bodyScrollLock.ts)', () => {
    it('initializes with 0 active locks and clean body style', () => {
      expect(getBodyScrollLockCount()).toBe(0);
      expect(document.body.style.overflow).toBe('');
      expect(document.documentElement.style.overflow).toBe('');
      expect(document.body.classList.contains('modal-scroll-locked')).toBe(false);
    });

    it('locks background on initial acquisition and applies modal-scroll-locked class', () => {
      acquireBodyScrollLock();

      expect(getBodyScrollLockCount()).toBe(1);
      expect(document.body.style.overflow).toBe('hidden');
      expect(document.documentElement.style.overflow).toBe('hidden');
      expect(document.body.classList.contains('modal-scroll-locked')).toBe(true);
    });

    it('handles nested modal locks via reference counting without premature unlock', () => {
      // Parent modal opens
      acquireBodyScrollLock();
      expect(getBodyScrollLockCount()).toBe(1);
      expect(document.body.style.overflow).toBe('hidden');

      // Nested child dialog opens
      acquireBodyScrollLock();
      expect(getBodyScrollLockCount()).toBe(2);
      expect(document.body.style.overflow).toBe('hidden');

      // Nested child dialog closes -> parent remains open, background must remain locked
      releaseBodyScrollLock();
      expect(getBodyScrollLockCount()).toBe(1);
      expect(document.body.style.overflow).toBe('hidden');
      expect(document.documentElement.style.overflow).toBe('hidden');
      expect(document.body.classList.contains('modal-scroll-locked')).toBe(true);

      // Parent modal closes -> lock count drops to 0, background unlocked
      releaseBodyScrollLock();
      expect(getBodyScrollLockCount()).toBe(0);
      expect(document.body.style.overflow).toBe('');
      expect(document.documentElement.style.overflow).toBe('');
      expect(document.body.classList.contains('modal-scroll-locked')).toBe(false);
    });

    it('preserves and restores original inline styles and scroll position', () => {
      document.body.style.overflow = 'visible';
      document.body.style.paddingRight = '12px';
      document.documentElement.style.overflow = 'auto';

      acquireBodyScrollLock();
      expect(document.body.style.overflow).toBe('hidden');
      expect(document.documentElement.style.overflow).toBe('hidden');

      releaseBodyScrollLock();
      expect(document.body.style.overflow).toBe('visible');
      expect(document.body.style.paddingRight).toBe('12px');
      expect(document.documentElement.style.overflow).toBe('auto');
      expect(scrollToMock).toHaveBeenCalled();
    });

    it('forceResetBodyScrollLock cleans up all locks and listeners', () => {
      acquireBodyScrollLock();
      acquireBodyScrollLock();
      acquireBodyScrollLock();
      expect(getBodyScrollLockCount()).toBe(3);

      forceResetBodyScrollLock();
      expect(getBodyScrollLockCount()).toBe(0);
      expect(document.body.style.overflow).toBe('');
      expect(document.documentElement.style.overflow).toBe('');
      expect(document.body.classList.contains('modal-scroll-locked')).toBe(false);
    });

    it('resets locks automatically on popstate event (route navigation)', () => {
      acquireBodyScrollLock();
      expect(getBodyScrollLockCount()).toBe(1);

      window.dispatchEvent(new PopStateEvent('popstate'));
      expect(getBodyScrollLockCount()).toBe(0);
      expect(document.body.style.overflow).toBe('');
      expect(document.body.classList.contains('modal-scroll-locked')).toBe(false);
    });

    it('blocks wheel events on backdrop and static areas when locked', () => {
      acquireBodyScrollLock();

      const backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      document.body.appendChild(backdrop);

      const wheelEvent = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: 50,
      });

      const dispatched = backdrop.dispatchEvent(wheelEvent);
      expect(wheelEvent.defaultPrevented).toBe(true);
      expect(dispatched).toBe(false);

      document.body.removeChild(backdrop);
    });

    it('permits wheel scrolling inside scrollable container and prevents at boundary', () => {
      acquireBodyScrollLock();

      const scrollContainer = document.createElement('div');
      scrollContainer.className = 'modal-scrollable-body';
      scrollContainer.style.overflowY = 'auto';
      // Mock layout properties
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 300, configurable: true });
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 800, configurable: true });
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 150, writable: true, configurable: true });
      document.body.appendChild(scrollContainer);

      // Normal scroll inside content: not prevented
      const midWheelEvent = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: 20,
      });
      scrollContainer.dispatchEvent(midWheelEvent);
      expect(midWheelEvent.defaultPrevented).toBe(false);

      // Scroll past top boundary: prevented to stop chaining
      scrollContainer.scrollTop = 0;
      const topBoundaryEvent = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: -20,
      });
      scrollContainer.dispatchEvent(topBoundaryEvent);
      expect(topBoundaryEvent.defaultPrevented).toBe(true);

      // Scroll past bottom boundary: prevented to stop chaining
      scrollContainer.scrollTop = 500; // 500 + 300 = 800 = scrollHeight
      const bottomBoundaryEvent = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: 20,
      });
      scrollContainer.dispatchEvent(bottomBoundaryEvent);
      expect(bottomBoundaryEvent.defaultPrevented).toBe(true);

      document.body.removeChild(scrollContainer);
    });

    it('prevents keyboard navigation keys outside form controls and permits inside them', () => {
      acquireBodyScrollLock();

      const staticElement = document.createElement('div');
      document.body.appendChild(staticElement);

      const inputElement = document.createElement('input');
      document.body.appendChild(inputElement);

      const arrowDownOnDiv = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      });
      staticElement.dispatchEvent(arrowDownOnDiv);
      expect(arrowDownOnDiv.defaultPrevented).toBe(true);

      const pageDownOnDiv = new KeyboardEvent('keydown', {
        key: 'PageDown',
        bubbles: true,
        cancelable: true,
      });
      staticElement.dispatchEvent(pageDownOnDiv);
      expect(pageDownOnDiv.defaultPrevented).toBe(true);

      // In editable controls, navigation keys must not be blocked
      const arrowDownOnInput = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      });
      inputElement.dispatchEvent(arrowDownOnInput);
      expect(arrowDownOnInput.defaultPrevented).toBe(false);

      document.body.removeChild(staticElement);
      document.body.removeChild(inputElement);
    });
  });

  describe('useBodyScrollLock Hook Lifecycle', () => {
    const TestComponent: React.FC<{ locked: boolean }> = ({ locked }) => {
      useBodyScrollLock(locked);
      return <div data-testid="test-content">Hook Test Component</div>;
    };

    it('locks when mounted with isLocked=true and releases on unmount', () => {
      expect(getBodyScrollLockCount()).toBe(0);

      const { unmount } = render(<TestComponent locked={true} />);
      expect(getBodyScrollLockCount()).toBe(1);
      expect(document.body.style.overflow).toBe('hidden');

      unmount();
      expect(getBodyScrollLockCount()).toBe(0);
      expect(document.body.style.overflow).toBe('');
    });

    it('dynamically toggles lock as prop changes', () => {
      const { rerender } = render(<TestComponent locked={false} />);
      expect(getBodyScrollLockCount()).toBe(0);
      expect(document.body.style.overflow).toBe('');

      rerender(<TestComponent locked={true} />);
      expect(getBodyScrollLockCount()).toBe(1);
      expect(document.body.style.overflow).toBe('hidden');

      rerender(<TestComponent locked={false} />);
      expect(getBodyScrollLockCount()).toBe(0);
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('ConfirmDialog Scroll Lock Integration', () => {
    it('locks body when open and releases when closed', () => {
      const { rerender } = render(
        <ConfirmDialog
          isOpen={false}
          title="Confirm Action"
          description="Are you sure?"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(getBodyScrollLockCount()).toBe(0);
      expect(document.body.style.overflow).toBe('');

      rerender(
        <ConfirmDialog
          isOpen={true}
          title="Confirm Action"
          description="Are you sure?"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(getBodyScrollLockCount()).toBe(1);
      expect(document.body.style.overflow).toBe('hidden');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('dialog').classList.contains('modal-backdrop')).toBe(true);

      rerender(
        <ConfirmDialog
          isOpen={false}
          title="Confirm Action"
          description="Are you sure?"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      );

      expect(getBodyScrollLockCount()).toBe(0);
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Nested Modals Workflow (CustomerDetailModal + ConfirmDialog)', () => {
    const NestedModalWrapper: React.FC = () => {
      const [isParentOpen, setIsParentOpen] = useState(true);
      const [isChildConfirmOpen, setIsChildConfirmOpen] = useState(false);

      return (
        <QueryClientProvider client={testQueryClient}>
          <MemoryRouter>
            <div>
              {isParentOpen && (
                <CustomerDetailModal
                  customerId="cust-101"
                  onClose={() => setIsParentOpen(false)}
                />
              )}
              <button
                data-testid="open-nested-dialog"
                onClick={() => setIsChildConfirmOpen(true)}
              >
                Open Child
              </button>
              <button
                data-testid="close-parent-modal"
                onClick={() => setIsParentOpen(false)}
              >
                Close Parent
              </button>
              <ConfirmDialog
                isOpen={isChildConfirmOpen}
                title="Nested Action"
                description="Nested confirmation prompt."
                onConfirm={() => setIsChildConfirmOpen(false)}
                onCancel={() => setIsChildConfirmOpen(false)}
              />
            </div>
          </MemoryRouter>
        </QueryClientProvider>
      );
    };

    it('correctly tracks nested modal locks across open and close sequences', () => {
      render(<NestedModalWrapper />);

      // Parent CustomerDetailModal is open -> lockCount 1
      expect(getBodyScrollLockCount()).toBe(1);
      expect(document.body.style.overflow).toBe('hidden');

      // Open child ConfirmDialog
      fireEvent.click(screen.getByTestId('open-nested-dialog'));
      expect(getBodyScrollLockCount()).toBe(2);
      expect(document.body.style.overflow).toBe('hidden');

      // Close child ConfirmDialog by clicking Cancel
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      // Child is closed, parent is still open -> lockCount 1, background remains locked!
      expect(getBodyScrollLockCount()).toBe(1);
      expect(document.body.style.overflow).toBe('hidden');
      expect(document.body.classList.contains('modal-scroll-locked')).toBe(true);

      // Close parent modal via button
      fireEvent.click(screen.getByTestId('close-parent-modal'));

      // Both closed -> lockCount 0, background unlocked
      expect(getBodyScrollLockCount()).toBe(0);
      expect(document.body.style.overflow).toBe('');
      expect(document.body.classList.contains('modal-scroll-locked')).toBe(false);
    });
  });

  describe('Multiple Modal Types Render Containment Verification', () => {
    it('AuditDetailModal locks body and provides scrollable container', () => {
      const mockAuditLog: AuditLogItem = {
        id: 'aud-201',
        actorStaffId: 'staff-01',
        actorName: 'Ops Admin',
        actorRole: 'OPERATIONS_ADMIN',
        actionType: 'CONFIG_UPDATE_ROLE',
        targetRecordId: 'cust-101',
        targetEntityType: 'CUSTOMER',
        timestamp: '18 Nov 2026, 11:30 AM',
        summary: 'Updated locality for customer',
      };

      const { rerender } = render(
        <AuditDetailModal
          isOpen={true}
          auditLog={mockAuditLog}
          onClose={() => {}}
        />
      );

      expect(getBodyScrollLockCount()).toBe(1);
      expect(document.body.style.overflow).toBe('hidden');

      const modalDialog = screen.getByRole('dialog');
      expect(modalDialog.classList.contains('modal-backdrop')).toBe(true);

      const scrollableBody = modalDialog.querySelector('.modal-scrollable-body');
      expect(scrollableBody).not.toBeNull();
      expect(scrollableBody?.classList.contains('modal-scrollable-body')).toBe(true);

      rerender(
        <AuditDetailModal
          isOpen={false}
          auditLog={mockAuditLog}
          onClose={() => {}}
        />
      );

      expect(getBodyScrollLockCount()).toBe(0);
      expect(document.body.style.overflow).toBe('');
    });

    it('BookingDetailModal locks body when open and renders scrollable body', () => {
      const mockBooking: BookingDetail = {
        id: 'bk-501',
        customerId: 'cust-101',
        customerName: 'Aarav Patel',
        customerPhoneMasked: 'XXXXX 98765',
        customerLocality: 'Koramangala',
        serviceCategory: 'Home Cleaning',
        timingShift: 'MORNING',
        salaryBudgetMax: 15000,
        createdAt: '2026-11-18T10:00:00Z',
        platformFeePaid: true,
        platformFeeAmount: 500,
        internalNotes: [],
        serviceStartDate: '2026-11-20',
        status: 'CONFIRMED',
        engagementType: 'ONE_TIME',
        assignedWorkerName: 'Ramesh Kumar',
        assignedWorkerPhoneMasked: 'XXXXX 12345',
      };

      const { rerender } = render(
        <QueryClientProvider client={testQueryClient}>
          <BookingDetailModal
            isOpen={true}
            booking={mockBooking}
            onClose={() => {}}
          />
        </QueryClientProvider>
      );

      expect(getBodyScrollLockCount()).toBe(1);
      expect(document.body.style.overflow).toBe('hidden');

      const dialog = screen.getByRole('dialog');
      expect(dialog.classList.contains('modal-backdrop')).toBe(true);

      rerender(
        <QueryClientProvider client={testQueryClient}>
          <BookingDetailModal
            isOpen={false}
            booking={mockBooking}
            onClose={() => {}}
          />
        </QueryClientProvider>
      );

      expect(getBodyScrollLockCount()).toBe(0);
      expect(document.body.style.overflow).toBe('');
    });

    it('ReportPreviewModal locks body when open and renders scrollable body', () => {
      const mockReport: ReportItem = {
        id: 'rep-01',
        requirement: 'FR-RPT-001',
        name: 'Weekly Marketplace Fulfillment Audit',
        category: 'Marketplace',
        description: 'Comprehensive report on worker attendance and booking SLAs.',
        cadence: 'Weekly',
        previewColumns: ['Booking Ref', 'Worker', 'Status'],
        metricsSummary: [
          { label: 'Completed Bookings', value: '124' },
          { label: 'Disputed Transactions', value: '3' },
        ],
        previewRows: [],
      };

      const { rerender } = render(
        <ReportPreviewModal
          isOpen={true}
          report={mockReport}
          onClose={() => {}}
        />
      );

      expect(getBodyScrollLockCount()).toBe(1);
      expect(document.body.style.overflow).toBe('hidden');

      const dialog = screen.getByRole('dialog');
      expect(dialog.classList.contains('modal-backdrop')).toBe(true);

      rerender(
        <ReportPreviewModal
          isOpen={false}
          report={mockReport}
          onClose={() => {}}
        />
      );

      expect(getBodyScrollLockCount()).toBe(0);
      expect(document.body.style.overflow).toBe('');
    });
  });
});
