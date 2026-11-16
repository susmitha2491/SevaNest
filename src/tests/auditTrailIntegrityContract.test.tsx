import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  resolveActorIdentity,
  formatAuditTimestampIST,
  mapBackendAuditLogToItem,
} from '../features/audit/data/auditRepository';
import { AuditDetailModal } from '../features/audit/presentation/AuditDetailModal';
import { AuditLogItem } from '../features/audit/domain/types';

describe('Audit Trail Integrity & Contract Validation Suite', () => {
  describe('1. Actor Identity Resolution (WHO)', () => {
    it('resolves canonical Super Admin UUID truthfully without using generic "System Operator"', () => {
      const superAdminId = '01a11eec-ff90-73c8-972a-b88e3151ada0';
      const actor = resolveActorIdentity(superAdminId, 'SUPER_ADMIN');

      expect(actor.name).toBe('Super Admin');
      expect(actor.email).toBe('sevanest@admin.in');
      expect(actor.role).toBe('SUPER_ADMIN');
      expect(actor.name).not.toBe('System Operator');
    });

    it('resolves canonical Operations Admin UUID truthfully', () => {
      const opsAdminId = '01a12fa2-413e-7741-96e1-1047692e8527';
      const actor = resolveActorIdentity(opsAdminId, 'OPERATIONS_ADMIN');

      expect(actor.name).toBe('Operations Admin');
      expect(actor.email).toBe('operations.manager@sevanest.example.com');
      expect(actor.role).toBe('OPERATIONS_ADMIN');
    });

    it('resolves canonical Verification Executive and Support Executive UUIDs', () => {
      const veId = '01a12fa2-3c86-7560-aff4-2da59d4b0a9e';
      const veActor = resolveActorIdentity(veId, 'VERIFICATION_EXECUTIVE');
      expect(veActor.name).toBe('Verification Executive');
      expect(veActor.email).toBe('verification.executive@sevanest.example.com');

      const seId = '01a12fa2-37c7-7531-ad8a-da94787eb8d3';
      const seActor = resolveActorIdentity(seId, 'SUPPORT_EXECUTIVE');
      expect(seActor.name).toBe('Support Executive');
      expect(seActor.email).toBe('support.executive@sevanest.example.com');
    });

    it('resolves Customer actors with customer identification and role', () => {
      const actor = resolveActorIdentity('cust-uuid-44', 'CUSTOMER', null, null, null);
      expect(actor.name).toContain('Customer (cust-u');
      expect(actor.role).toBe('CUSTOMER');
      expect(actor.type).toBe('CUSTOMER');
      expect(actor.name).not.toBe('System Operator');

      // Also verify metadata-based customer resolution when role is null
      const metaActor = resolveActorIdentity('01a1b0bf-c69f-73bb-812d-bbb3d73fb4e0', null, { appType: 'CUSTOMER' }, null, null);
      expect(metaActor.name).toContain('Customer (01a1b0bf');
      expect(metaActor.role).toBe('CUSTOMER');
      expect(metaActor.type).toBe('CUSTOMER');
    });

    it('resolves Worker actors with worker identification and role', () => {
      const actor = resolveActorIdentity('wrk-uuid-99', 'WORKER', null, null, null);
      expect(actor.name).toContain('Worker (wrk-u');
      expect(actor.role).toBe('WORKER');
      expect(actor.type).toBe('WORKER');
    });

    it('identifies genuine system automated events truthfully', () => {
      const actor = resolveActorIdentity(null, 'SYSTEM');
      expect(actor.name).toBe('System Automated Process');
      expect(actor.role).toBe('SYSTEM');
    });

    it('returns honest "Actor identity unavailable" when actorId and role are missing', () => {
      const actor = resolveActorIdentity(null, null);
      expect(actor.name).toBe('Actor identity unavailable');
      expect(actor.name).not.toBe('System Operator');
    });
  });

  describe('2. Timestamp Formatting & UTC Preservation (WHEN)', () => {
    it('formats UTC ISO timestamp into Indian Standard Time (IST - Asia/Kolkata)', () => {
      // 2026-11-16T06:30:00.000Z is 12:00:00 PM IST (+05:30)
      const istFormatted = formatAuditTimestampIST('2026-11-16T06:30:00.000Z');
      expect(istFormatted).toContain('16 Nov 2026');
      expect(istFormatted).toContain('12:00:00 PM');
      expect(istFormatted).toContain('IST');
    });

    it('preserves ISO string in mapBackendAuditLogToItem for UTC auditability', () => {
      const mapped = mapBackendAuditLogToItem({
        id: 'aud-time-test',
        action: 'auth.login',
        createdAt: '2026-11-16T07:15:30.000Z',
      });

      expect(mapped.recordedAtUtc).toBe('2026-11-16T07:15:30.000Z');
      expect(mapped.timestamp).toContain('16 Nov 2026');
      expect(mapped.timestamp).toContain('IST');
    });

    it('handles invalid date strings gracefully without throwing', () => {
      expect(formatAuditTimestampIST(null)).toBe('Timestamp unavailable');
      expect(formatAuditTimestampIST(undefined)).toBe('Timestamp unavailable');
      expect(formatAuditTimestampIST('')).toBe('Timestamp unavailable');
    });
  });

  describe('3. Action Taxonomy & Truthful Descriptions (WHAT)', () => {
    it('maps real backend action keys to descriptive human summaries and outcomes', () => {
      const loginLog = mapBackendAuditLogToItem({
        id: 'aud-1',
        action: 'auth.login',
      });
      expect(loginLog.summary).toBe('Staff Sign In');
      expect(loginLog.outcome).toBe('SUCCESS');

      const kycApproveLog = mapBackendAuditLogToItem({
        id: 'aud-2',
        action: 'verification.approve',
      });
      expect(kycApproveLog.summary).toBe('Worker Verification Check Approved');
      expect(kycApproveLog.outcome).toBe('APPROVED');

      const piiViewLog = mapBackendAuditLogToItem({
        id: 'aud-3',
        action: 'worker.sensitive_view',
      });
      expect(piiViewLog.summary).toBe('Sensitive Worker Profile Data Accessed');
      expect(piiViewLog.outcome).toBe('AUDITED_READ');

      const deniedLog = mapBackendAuditLogToItem({
        id: 'aud-4',
        action: 'security.access_denied',
      });
      expect(deniedLog.summary).toBe('Attempted Access Denied (Unauthorized)');
      expect(deniedLog.outcome).toBe('DENIED');
    });
  });

  describe('4. Operational Justification (WHY)', () => {
    it('preserves genuine justification from metadata.reason or remarks', () => {
      const mappedWithReason = mapBackendAuditLogToItem({
        id: 'aud-5',
        action: 'verification.reject',
        metadata: { reason: 'PAN card image is blurred and unreadable' },
      });
      expect(mappedWithReason.operationalRemarks).toBe('PAN card image is blurred and unreadable');

      const mappedWithRootReason = mapBackendAuditLogToItem({
        id: 'aud-6',
        action: 'attendance.correct',
        reason: 'Biometric device network timeout at shift start',
      });
      expect(mappedWithRootReason.operationalRemarks).toBe('Biometric device network timeout at shift start');
    });

    it('strictly does NOT fabricate "Recorded in immutable audit trail." when justification is absent', () => {
      const mappedWithoutReason = mapBackendAuditLogToItem({
        id: 'aud-7',
        action: 'worker.sensitive_view',
      });
      expect(mappedWithoutReason.operationalRemarks).toBeUndefined();
      expect(mappedWithoutReason.operationalRemarks).not.toBe('Recorded in immutable audit trail.');
    });
  });

  describe('5. State Snapshot Integrity (WHAT CHANGED)', () => {
    it('extracts real state mutation diffs from before/after or metadata.from/to', () => {
      const mappedWithBeforeAfter = mapBackendAuditLogToItem({
        id: 'aud-8',
        action: 'attendance.correct',
        before: { status: 'ABSENT' },
        after: { status: 'PRESENT' },
      });
      expect(mappedWithBeforeAfter.preMutationState).toEqual({ status: 'ABSENT' });
      expect(mappedWithBeforeAfter.postMutationState).toEqual({ status: 'PRESENT' });

      const mappedWithMetadataFromTo = mapBackendAuditLogToItem({
        id: 'aud-9',
        action: 'ticket.close',
        metadata: { from: 'OPEN', to: 'RESOLVED' },
      });
      expect(mappedWithMetadataFromTo.preMutationState).toEqual({ status: 'OPEN' });
      expect(mappedWithMetadataFromTo.postMutationState).toEqual({ status: 'RESOLVED' });
    });

    it('strictly does NOT fabricate { status: "INITIAL" } -> { status: "COMMITTED" }', () => {
      const mappedReadEvent = mapBackendAuditLogToItem({
        id: 'aud-10',
        action: 'worker.sensitive_view',
        metadata: { workerId: 'wrk-123' },
      });

      expect(mappedReadEvent.preMutationState).toBeUndefined();
      expect(mappedReadEvent.postMutationState).toBeUndefined();
    });
  });

  describe('6. IP Address & Network Context', () => {
    it('strictly does NOT fabricate "10.0.0.1" when ipAddress is absent', () => {
      const mapped = mapBackendAuditLogToItem({
        id: 'aud-11',
        action: 'auth.login',
      });

      expect(mapped.ipAddress).toBeUndefined();
      expect(mapped.ipAddress).not.toBe('10.0.0.1');
    });

    it('preserves genuine IP address when provided', () => {
      const mapped = mapBackendAuditLogToItem({
        id: 'aud-12',
        action: 'auth.login',
        ipAddress: '203.0.113.45',
      });

      expect(mapped.ipAddress).toBe('203.0.113.45');
    });
  });

  describe('7. AuditDetailModal Component Presentation Integrity', () => {
    const baseLog: AuditLogItem = {
      id: 'AUD-TEST-001',
      timestamp: '16 Nov 2026, 12:30:00 PM IST',
      recordedAtUtc: '2026-11-16T07:00:00.000Z',
      actorStaffId: '01a11eec-ff90-73c8-972a-b88e3151ada0',
      actorName: 'Super Admin',
      actorEmail: 'sevanest@admin.in',
      actorRole: 'SUPER_ADMIN',
      actorType: 'ADMIN',
      actionType: 'verification.approve',
      actionKey: 'verification.approve',
      targetEntityType: 'worker_verification_check',
      targetEntityDisplay: 'Verification Check',
      targetRecordId: 'vcheck-789',
      summary: 'Worker Verification Approved',
      outcome: 'APPROVED',
      requestId: 'req-uuid-abc-123',
    };

    it('renders truthful absence notices instead of fake defaults in modal', () => {
      render(<AuditDetailModal auditLog={baseLog} isOpen={true} onClose={() => {}} />);

      // Honest notice for justification (no "Recorded in immutable audit trail.")
      expect(screen.getByText(/No justification recorded for this event\./i)).toBeInTheDocument();
      expect(screen.queryByText(/Recorded in immutable audit trail\./i)).not.toBeInTheDocument();

      // Honest notice for state changes (no INITIAL -> COMMITTED)
      expect(screen.getByText(/No state-change snapshot available for this event\./i)).toBeInTheDocument();
      expect(screen.queryByText(/INITIAL/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/COMMITTED/i)).not.toBeInTheDocument();

      // Honest notice for IP address (no 10.0.0.1)
      expect(screen.getByText(/IP address not recorded/i)).toBeInTheDocument();
      expect(screen.queryByText(/10\.0\.0\.1/i)).not.toBeInTheDocument();

      // Displays genuine actor details
      expect(screen.getByText('Super Admin')).toBeInTheDocument();
      expect(screen.getByText('sevanest@admin.in')).toBeInTheDocument();
      expect(screen.getByText(/req-uuid-abc-123/i)).toBeInTheDocument();

      // Immutability notice
      expect(screen.getByText(/Immutable write-only record — Modifications strictly prohibited/i)).toBeInTheDocument();
    });

    it('renders state diff cleanly when genuine snapshots are present', () => {
      const logWithDiff: AuditLogItem = {
        ...baseLog,
        preMutationState: { status: 'PENDING_REVIEW' },
        postMutationState: { status: 'APPROVED' },
        operationalRemarks: 'Physical verification confirmed',
        ipAddress: '198.51.100.22',
      };

      render(<AuditDetailModal auditLog={logWithDiff} isOpen={true} onClose={() => {}} />);

      expect(screen.getByText(/Physical verification confirmed/i)).toBeInTheDocument();
      expect(screen.getByText(/PENDING_REVIEW/i)).toBeInTheDocument();
      expect(screen.getAllByText(/APPROVED/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('198.51.100.22')).toBeInTheDocument();
    });

    it('supports closing modal via Escape key and backdrop click', () => {
      let closed = false;
      const { rerender } = render(<AuditDetailModal auditLog={baseLog} isOpen={true} onClose={() => { closed = true; }} />);

      // Trigger Escape key
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
      expect(closed).toBe(true);

      // Verify close button also triggers onClose
      closed = false;
      rerender(<AuditDetailModal auditLog={baseLog} isOpen={true} onClose={() => { closed = true; }} />);
      const closeBtn = screen.getByRole('button', { name: /Close modal/i });
      closeBtn.click();
      expect(closed).toBe(true);
    });

    it('renders copyable identifier pills with copy buttons for UUIDs', () => {
      render(<AuditDetailModal auditLog={baseLog} isOpen={true} onClose={() => {}} />);

      const copyButtons = screen.getAllByRole('button', { name: /Copy identifier/i });
      expect(copyButtons.length).toBeGreaterThanOrEqual(2);
    });
  });
});
