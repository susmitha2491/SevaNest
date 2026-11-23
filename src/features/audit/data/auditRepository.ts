import {
  AuditLogItem,
  AuditFilterCriteria,
  PaginatedAuditLogs,
  IAuditRepository,
  AuditActionType,
} from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';

/**
 * Authoritative SevaNest Administrative Account Personas
 * Fixed UUID mappings matching live deployed backend database records.
 */
export const KNOWN_ADMIN_ACTORS: Record<string, { name: string; email: string; role: string }> = {
  '01a11eec-ff90-73c8-972a-b88e3151ada0': {
    name: 'Super Admin',
    email: 'sevanest@admin.in',
    role: 'SUPER_ADMIN',
  },
  '01a12fa2-413e-7741-96e1-1047692e8527': {
    name: 'Operations Admin',
    email: 'operations.manager@sevanest.example.com',
    role: 'OPERATIONS_ADMIN',
  },
  '01a12fa2-3c86-7560-aff4-2da59d4b0a9e': {
    name: 'Verification Executive',
    email: 'verification.executive@sevanest.example.com',
    role: 'VERIFICATION_EXECUTIVE',
  },
  '01a12fa2-37c7-7531-ad8a-da94787eb8d3': {
    name: 'Support Executive',
    email: 'support.executive@sevanest.example.com',
    role: 'SUPPORT_EXECUTIVE',
  },
};

/**
 * Dynamic in-memory cache for admin user accounts fetched via GET /admin/users?type=ADMIN
 */
export const dynamicAdminAccountsCache = new Map<string, { name: string; email: string; role: string }>();

let hasAttemptedAdminSync = false;

export async function syncAdminAccountsCache(): Promise<void> {
  if (hasAttemptedAdminSync || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')) return;
  hasAttemptedAdminSync = true;
  try {
    const res = await httpClient.get<{ data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
      '/admin/users',
      { params: { type: 'ADMIN', limit: 100 } }
    );
    const list = Array.isArray(res.data)
      ? res.data
      : Array.isArray((res.data as Record<string, unknown>)?.data)
      ? ((res.data as Record<string, unknown>).data as Array<Record<string, unknown>>)
      : [];

    list.forEach((u) => {
      const id = String(u.id || '');
      const email = String(u.email || '');
      const rawRole = String((Array.isArray(u.roles) ? u.roles[0] : u.role) || 'ADMIN');
      const roleMap: Record<string, string> = {
        SUPER_ADMIN: 'Super Admin',
        OPERATIONS_ADMIN: 'Operations Admin',
        VERIFICATION_EXECUTIVE: 'Verification Executive',
        SUPPORT_EXECUTIVE: 'Support Executive',
      };
      const name = roleMap[rawRole] || (email ? email.split('@')[0] : 'Admin User');
      if (id) {
        dynamicAdminAccountsCache.set(id, { name, email, role: rawRole });
      }
    });
  } catch {
    // Non-blocking: falls back to KNOWN_ADMIN_ACTORS
  }
}

/**
 * Truthfully resolves the actor's identity from authoritative backend data.
 * Never defaults to generic names like "System Operator".
 */
export function resolveActorIdentity(
  actorId?: string | null,
  actorRole?: string | null,
  metadata?: Record<string, unknown> | null,
  rawActorName?: string | null,
  rawActorEmail?: string | null
): {
  name: string;
  email?: string;
  role: string;
  type: string;
} {
  const cleanId = String(actorId || '').trim();
  const cleanRole = String(actorRole || '').trim();

  // If specific non-generic actor name is already passed (e.g. from mock fixtures or enriched payload)
  if (rawActorName && rawActorName !== 'System Operator' && rawActorName !== 'STAFF' && rawActorName !== 'ADMIN') {
    return {
      name: rawActorName,
      email: rawActorEmail || undefined,
      role: cleanRole || 'ADMIN',
      type: 'ADMIN',
    };
  }

  // If specific actor email is passed
  if (rawActorEmail && rawActorEmail.trim()) {
    return {
      name: rawActorEmail.trim(),
      email: rawActorEmail.trim(),
      role: cleanRole || 'ADMIN',
      type: 'ADMIN',
    };
  }

  // Check known canonical admin personas
  if (cleanId && KNOWN_ADMIN_ACTORS[cleanId]) {
    const known = KNOWN_ADMIN_ACTORS[cleanId];
    return {
      name: known.name,
      email: known.email,
      role: cleanRole || known.role,
      type: 'ADMIN',
    };
  }

  // Check dynamic admin cache
  if (cleanId && dynamicAdminAccountsCache.has(cleanId)) {
    const cached = dynamicAdminAccountsCache.get(cleanId)!;
    return {
      name: cached.name,
      email: cached.email,
      role: cleanRole || cached.role,
      type: 'ADMIN',
    };
  }

  // If role is known (e.g. from backend actorRole)
  if (cleanRole) {
    const roleLabels: Record<string, string> = {
      SUPER_ADMIN: 'Super Admin',
      OPERATIONS_ADMIN: 'Operations Admin',
      VERIFICATION_EXECUTIVE: 'Verification Executive',
      SUPPORT_EXECUTIVE: 'Support Executive',
      SYSTEM: 'System Automated Process',
    };
    if (roleLabels[cleanRole]) {
      return {
        name: roleLabels[cleanRole],
        role: cleanRole,
        type: cleanRole === 'SYSTEM' ? 'SYSTEM' : 'ADMIN',
      };
    }
  }

  // Check if this event was generated by a Customer or Domestic Worker
  const userType = String(
    metadata?.userType ||
    metadata?.type ||
    metadata?.creatorKind ||
    metadata?.authorKind ||
    metadata?.appType ||
    ''
  ).toUpperCase();
  if (cleanRole === 'CUSTOMER' || userType === 'CUSTOMER') {
    return {
      name: cleanId ? `Customer (${cleanId.slice(0, 8)}…)` : 'Customer Account',
      role: 'CUSTOMER',
      type: 'CUSTOMER',
    };
  }
  if (cleanRole === 'WORKER' || userType === 'WORKER') {
    return {
      name: cleanId ? `Worker (${cleanId.slice(0, 8)}…)` : 'Domestic Worker',
      role: 'WORKER',
      type: 'WORKER',
    };
  }

  // System-generated action with explicit SYSTEM indicator
  if (cleanId.toUpperCase() === 'SYSTEM' || cleanRole.toUpperCase() === 'SYSTEM') {
    return {
      name: 'System Automated Process',
      role: 'SYSTEM',
      type: 'SYSTEM',
    };
  }

  // Unresolvable actor ID: state truthfully that identity is unavailable
  return {
    name: 'Actor identity unavailable',
    role: cleanRole || 'UNAVAILABLE',
    type: 'UNKNOWN',
  };
}

/**
 * Meaningful Human-Readable Descriptions & Status based on genuine backend event keys.
 */
export const ACTION_DESCRIPTIONS: Record<string, { label: string; outcome: string }> = {
  'auth.login': { label: 'Staff Sign In', outcome: 'SUCCESS' },
  'auth.logout': { label: 'Staff Sign Out', outcome: 'SUCCESS' },
  'worker.sensitive_view': { label: 'Sensitive Worker Profile Data Accessed', outcome: 'AUDITED_READ' },
  'attendance.correct': { label: 'Attendance Record Corrected', outcome: 'MUTATED' },
  'matching.candidates': { label: 'Candidate Matching Query Executed', outcome: 'QUERY' },
  'verification.start_review': { label: 'Worker KYC Review Initiated', outcome: 'IN_REVIEW' },
  'verification.approve': { label: 'Worker Verification Check Approved', outcome: 'APPROVED' },
  'verification.reject': { label: 'Worker Verification Check Rejected', outcome: 'REJECTED' },
  'verification.document_view': { label: 'KYC Verification Document Inspected', outcome: 'AUDITED_READ' },
  'ticket.close': { label: 'Support Grievance Ticket Closed', outcome: 'CLOSED' },
  'ticket.message': { label: 'Support Ticket Staff Message Logged', outcome: 'RECORDED' },
  'payment.refund': { label: 'Customer Payment Refund Processed', outcome: 'REFUNDED' },
  'worker.blacklist': { label: 'Worker Blacklisted with Disciplinary Cause', outcome: 'BLACKLISTED' },
  'worker.unblacklist': { label: 'Worker Blacklist Disciplinary Hold Lifted', outcome: 'UNBLACKLISTED' },
  'worker.status_change': { label: 'Worker Account Status Modified', outcome: 'MUTATED' },
  'customer.profile_create': { label: 'Customer Account Profile Created', outcome: 'CREATED' },
  'user.register': { label: 'User Account Registered', outcome: 'REGISTERED' },
  'user.status_change': { label: 'Admin User Account Status Changed', outcome: 'MUTATED' },
  'user.role_change': { label: 'Admin User Role Modified', outcome: 'MUTATED' },
  'security.access_denied': { label: 'Attempted Access Denied (Unauthorized)', outcome: 'DENIED' },
  'security.access_denied_repeated': { label: 'Repeated Unauthorized Access Blocked', outcome: 'BLOCKED' },
  'role.permissions_set': { label: 'Role Permissions Modified', outcome: 'MUTATED' },
  'role.permissions_update': { label: 'Role Permission Matrix Updated', outcome: 'MUTATED' },
  'report.export': { label: 'Operational Analytics Report Exported', outcome: 'EXPORTED' },
  // Backward compatibility labels for mock fixtures
  'VERIF_APPROVE_DOC': { label: 'Approved Aadhaar Identity & Address Proof', outcome: 'APPROVED' },
  'VERIF_REJECT_DOC': { label: 'Rejected Worker Verification Document', outcome: 'REJECTED' },
  'CONFIG_PUBLISH_FEES': { label: 'Fee Schedule Revision Published', outcome: 'MUTATED' },
  'CONFIG_UPDATE_ROLE': { label: 'Administrative Role Privileges Updated', outcome: 'MUTATED' },
  'REFUND_PROCESSED': { label: 'Authorized 100% Customer Refund', outcome: 'REFUNDED' },
  'WORKER_SUSPEND': { label: 'Suspended Worker Account', outcome: 'MUTATED' },
  'CUSTOMER_SUSPEND': { label: 'Suspended Customer Account', outcome: 'MUTATED' },
  'PII_REVEAL_CONTACT': { label: 'Revealed Customer Phone Number for Mediation', outcome: 'AUDITED_READ' },
  'BOOKING_CANCEL': { label: 'Cancelled Household Booking', outcome: 'CANCELLED' },
  'DISPUTE_ESCALATE': { label: 'Escalated Customer Dispute to Operations', outcome: 'ESCALATED' },
};

/**
 * Human-readable Entity Type Labels
 */
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  worker_profile: 'Worker Profile',
  customer_profile: 'Customer Profile',
  worker_verification_check: 'Verification Check',
  verification_document: 'Verification Document',
  support_ticket: 'Support Ticket',
  attendance_record: 'Attendance Record',
  session: 'Session Context',
  route: 'API Endpoint / Route',
  matching_request: 'Candidate Matcher',
  user: 'User Account',
  booking: 'Household Booking',
  payment: 'Payment Transaction',
  configuration: 'System Configuration',
  role: 'Administrative Role',
  WORKER: 'Worker Profile',
  CUSTOMER: 'Customer Profile',
  BOOKING: 'Household Booking',
  TRANSACTION: 'Payment Transaction',
  SUPPORT_TICKET: 'Support Ticket',
  CONFIGURATION: 'System Configuration',
  USER: 'User Account',
};

/**
 * Formats timestamps in Indian Standard Time (IST - Asia/Kolkata / UTC+05:30)
 * Preserves original ISO timestamp when valid.
 */
export function formatAuditTimestampIST(dateInput: string | number | Date | undefined | null): string {
  if (!dateInput) return 'Timestamp unavailable';

  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      if (typeof dateInput === 'string' && dateInput.trim()) return dateInput.trim();
      return 'Timestamp unavailable';
    }

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    })
      .format(date)
      .replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
  } catch {
    return 'Timestamp unavailable';
  }
}

/**
 * Maps raw backend audit log objects into truthful, high-integrity domain items.
 * Strictly eliminates fake values (e.g. "System Operator", "10.0.0.1", "INITIAL -> COMMITTED").
 */
export function mapBackendAuditLogToItem(raw: Record<string, unknown>): AuditLogItem {
  const id = String(raw.id || raw.auditId || 'AUD-0');
  const rawActorId = raw.actorId !== undefined ? (raw.actorId ? String(raw.actorId) : '') : String(raw.actorStaffId || '');
  const rawActorRole = raw.actorRole !== undefined && raw.actorRole !== null ? String(raw.actorRole) : undefined;
  const rawAction = String(raw.action || raw.actionType || 'system.event');
  const metadata = (raw.metadata && typeof raw.metadata === 'object' ? (raw.metadata as Record<string, unknown>) : null);

  // 1. Truthful Actor Identity Resolution
  const actor = resolveActorIdentity(
    rawActorId,
    rawActorRole,
    metadata,
    typeof raw.actorName === 'string' ? raw.actorName : null,
    typeof raw.actorEmail === 'string' ? raw.actorEmail : null
  );

  // 2. Action and Outcome Details
  const actionKey = rawAction;
  const actionType = rawAction as Exclude<AuditActionType, 'ALL'>;
  const actionLookup = ACTION_DESCRIPTIONS[rawAction];

  let summary = '';
  if (typeof raw.summary === 'string' && raw.summary.trim() && raw.summary !== 'Audit action logged') {
    summary = raw.summary.trim();
  } else if (typeof raw.description === 'string' && raw.description.trim()) {
    summary = raw.description.trim();
  } else if (actionLookup) {
    summary = actionLookup.label;
    // Enrich with metadata context if available
    if (metadata) {
      if (Array.isArray(metadata.groups) && metadata.groups.length > 0) {
        summary = `${actionLookup.label} (${metadata.groups.join(', ')})`;
      } else if (metadata.checkType) {
        summary = `${actionLookup.label} (${metadata.checkType})`;
      } else if (metadata.from && metadata.to) {
        summary = `${actionLookup.label} (${metadata.from} → ${metadata.to})`;
      } else if (metadata.method) {
        summary = `${actionLookup.label} (via ${metadata.method})`;
      } else if (metadata.roleCode) {
        summary = `${actionLookup.label} (${metadata.roleCode})`;
      }
    }
  } else {
    // Humanize unknown dot-separated action key
    summary = rawAction
      .split('.')
      .map((part) => part.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
      .join(': ');
  }

  // Determine outcome
  let outcome = actionLookup?.outcome || 'RECORDED';
  if (rawAction === 'security.access_denied') outcome = 'DENIED';
  else if (rawAction === 'security.access_denied_repeated') outcome = 'BLOCKED';
  else if (metadata?.to === 'REJECTED') outcome = 'REJECTED';
  else if (metadata?.to === 'APPROVED') outcome = 'APPROVED';

  // 3. Target Entity Resolution
  const rawEntityType = String(raw.entityType || raw.targetEntityType || 'system');
  const targetEntityType = rawEntityType;
  const targetEntityDisplay = ENTITY_TYPE_LABELS[rawEntityType] || rawEntityType;

  let targetRecordId = raw.entityId !== undefined && raw.entityId !== null ? String(raw.entityId) : '';
  if (!targetRecordId && raw.targetRecordId) {
    targetRecordId = String(raw.targetRecordId);
  }
  if (!targetRecordId && metadata?.route) {
    targetRecordId = String(metadata.route);
  }

  // 4. Genuine Timestamp
  const recordedAtUtc = raw.createdAt ? String(raw.createdAt) : raw.timestamp ? String(raw.timestamp) : undefined;
  const timestamp = recordedAtUtc ? formatAuditTimestampIST(recordedAtUtc) : 'Timestamp unavailable';

  // 5. Genuine Operational Justification (Reason)
  let operationalRemarks: string | undefined = undefined;
  if (
    typeof raw.operationalRemarks === 'string' &&
    raw.operationalRemarks.trim() &&
    raw.operationalRemarks.trim() !== 'Recorded in immutable audit trail.'
  ) {
    operationalRemarks = raw.operationalRemarks.trim();
  } else if (
    typeof raw.remarks === 'string' &&
    raw.remarks.trim() &&
    raw.remarks.trim() !== 'Recorded in immutable audit trail.'
  ) {
    operationalRemarks = raw.remarks.trim();
  } else if (typeof raw.reason === 'string' && raw.reason.trim()) {
    operationalRemarks = raw.reason.trim();
  } else if (typeof metadata?.reason === 'string' && metadata.reason.trim()) {
    operationalRemarks = metadata.reason.trim();
  } else if (typeof metadata?.reasonCode === 'string' && metadata.reasonCode.trim()) {
    operationalRemarks = `Reason code: ${metadata.reasonCode.trim()}`;
  } else if (typeof metadata?.justification === 'string' && metadata.justification.trim()) {
    operationalRemarks = metadata.justification.trim();
  } else if (typeof metadata?.auditReason === 'string' && metadata.auditReason.trim()) {
    operationalRemarks = metadata.auditReason.trim();
  } else if (typeof raw.auditReason === 'string' && raw.auditReason.trim()) {
    operationalRemarks = raw.auditReason.trim();
  }

  // 6. Before vs After State Snapshots
  let preMutationState = (raw.preMutationState || raw.before || undefined) as Record<string, unknown> | undefined;
  let postMutationState = (raw.postMutationState || raw.after || undefined) as Record<string, unknown> | undefined;
  let changedFields: string[] = [];

  if (raw.changedFields && Array.isArray(raw.changedFields)) {
    changedFields = raw.changedFields.map(String);
  }

  // Handle role.permissions_set metadata snapshots
  if (rawAction === 'role.permissions_set' && metadata) {
    if (Array.isArray(metadata.added) || Array.isArray(metadata.removed)) {
      preMutationState = {
        roleCode: metadata.roleCode,
        removedPermissions: Array.isArray(metadata.removed) ? metadata.removed : [],
      };
      postMutationState = {
        roleCode: metadata.roleCode,
        addedPermissions: Array.isArray(metadata.added) ? metadata.added : [],
      };
      changedFields = ['permissions'];
    }
  }

  // If explicit snapshots were not recorded, check if metadata records 'from' and 'to'
  if (!preMutationState && !postMutationState && metadata) {
    if (metadata.from !== undefined || metadata.to !== undefined) {
      preMutationState = { status: metadata.from ?? null };
      postMutationState = { status: metadata.to ?? null };
      changedFields = ['status'];
      if (metadata.date) {
        preMutationState.date = metadata.date;
        postMutationState.date = metadata.date;
      }
      if (metadata.checkType) {
        preMutationState.checkType = metadata.checkType;
        postMutationState.checkType = metadata.checkType;
      }
    }
  }

  // 7. Session & Network Metadata (Strictly NO fake 10.0.0.1)
  let ipAddress: string | undefined = undefined;
  if (typeof raw.ipAddress === 'string' && raw.ipAddress.trim() && raw.ipAddress.trim() !== '10.0.0.1') {
    ipAddress = raw.ipAddress.trim();
  } else if (typeof raw.ip === 'string' && raw.ip.trim() && raw.ip.trim() !== '10.0.0.1') {
    ipAddress = raw.ip.trim();
  } else if (typeof metadata?.ipAddress === 'string' && metadata.ipAddress.trim()) {
    ipAddress = metadata.ipAddress.trim();
  }

  const requestId = raw.requestId ? String(raw.requestId) : undefined;
  const sessionId = rawEntityType === 'session' && targetRecordId ? targetRecordId : undefined;

  return {
    id,
    actorStaffId: rawActorId || 'SYSTEM',
    actorName: actor.name,
    actorEmail: actor.email,
    actorRole: actor.role,
    actorType: actor.type,
    actionType,
    actionKey,
    targetRecordId: targetRecordId || 'N/A',
    targetEntityType,
    targetEntityDisplay,
    summary,
    ipAddress,
    timestamp,
    recordedAtUtc,
    preMutationState,
    postMutationState,
    operationalRemarks,
    outcome,
    requestId,
    sessionId,
    metadata: metadata || undefined,
    changedFields: changedFields.length > 0 ? changedFields : undefined,
  };
}

export class MockAuditRepository implements IAuditRepository {
  private auditLogs: AuditLogItem[] = [
    {
      id: 'AUD-901',
      actorStaffId: '01a12fa2-3c86-7560-aff4-2da59d4b0a9e',
      actorName: 'Verification Executive',
      actorEmail: 'verification.executive@sevanest.example.com',
      actorRole: 'VERIFICATION_EXECUTIVE',
      actorType: 'ADMIN',
      actionType: 'VERIF_APPROVE_DOC',
      actionKey: 'verification.approve',
      targetRecordId: 'W-10482',
      targetEntityType: 'WORKER',
      targetEntityDisplay: 'Worker Profile',
      summary: 'Approved Aadhaar Identity & Address Proof',
      ipAddress: '10.0.4.12',
      timestamp: '16 Nov 2026, 10:15:00 AM IST',
      recordedAtUtc: '2026-11-16T04:45:00.000Z',
      preMutationState: {
        workerId: 'W-10482',
        verificationStatus: 'UNDER_REVIEW',
        checkAadhaar: 'PENDING',
      },
      postMutationState: {
        workerId: 'W-10482',
        verificationStatus: 'VERIFIED',
        checkAadhaar: 'APPROVED',
      },
      changedFields: ['verificationStatus', 'checkAadhaar'],
      operationalRemarks: 'Aadhaar QR verified against UIDAI offline XML standard. Photograph and address match residential inspection.',
      outcome: 'APPROVED',
    },
    {
      id: 'AUD-902',
      actorStaffId: '01a11eec-ff90-73c8-972a-b88e3151ada0',
      actorName: 'Super Admin',
      actorEmail: 'sevanest@admin.in',
      actorRole: 'SUPER_ADMIN',
      actorType: 'ADMIN',
      actionType: 'CONFIG_PUBLISH_FEES',
      actionKey: 'configuration.publish_fees',
      targetRecordId: 'CFG-FEES-V2',
      targetEntityType: 'CONFIGURATION',
      targetEntityDisplay: 'System Configuration',
      summary: 'Updated Commercial Maid Booking Fee from ₹399 to ₹499',
      ipAddress: '10.0.1.2',
      timestamp: '16 Nov 2026, 09:30:00 AM IST',
      recordedAtUtc: '2026-11-16T04:00:00.000Z',
      preMutationState: {
        maidBookingFeeINR: 399,
        version: 'V1.4',
      },
      postMutationState: {
        maidBookingFeeINR: 499,
        version: 'V2.0',
      },
      changedFields: ['maidBookingFeeINR', 'version'],
      operationalRemarks: 'Q3 operational price revision approved by commercial management committee.',
      outcome: 'MUTATED',
    },
    {
      id: 'AUD-903',
      actorStaffId: '01a12fa2-413e-7741-96e1-1047692e8527',
      actorName: 'Operations Admin',
      actorEmail: 'operations.manager@sevanest.example.com',
      actorRole: 'OPERATIONS_ADMIN',
      actorType: 'ADMIN',
      actionType: 'REFUND_PROCESSED',
      actionKey: 'payment.refund',
      targetRecordId: 'TXN-892104',
      targetEntityType: 'TRANSACTION',
      targetEntityDisplay: 'Payment Transaction',
      summary: 'Authorized 100% Refund (₹499.00) for Unsatisfactory Trial',
      ipAddress: '10.0.2.18',
      timestamp: '16 Nov 2026, 08:45:00 AM IST',
      recordedAtUtc: '2026-11-16T03:15:00.000Z',
      preMutationState: {
        transactionId: 'TXN-892104',
        paymentStatus: 'REFUND_PENDING',
        settledAmountINR: 499,
      },
      postMutationState: {
        transactionId: 'TXN-892104',
        paymentStatus: 'REFUNDED',
        refundAmountINR: 499,
      },
      changedFields: ['paymentStatus', 'refundAmountINR'],
      operationalRemarks: 'Customer reported punctuality mismatch in scheduled cook trial; replacement declined. Refund approved under 100% money-back policy.',
      outcome: 'REFUNDED',
    },
    {
      id: 'AUD-904',
      actorStaffId: '01a12fa2-413e-7741-96e1-1047692e8527',
      actorName: 'Operations Admin',
      actorEmail: 'operations.manager@sevanest.example.com',
      actorRole: 'OPERATIONS_ADMIN',
      actorType: 'ADMIN',
      actionType: 'WORKER_SUSPEND',
      actionKey: 'worker.blacklist',
      targetRecordId: 'W-3819',
      targetEntityType: 'WORKER',
      targetEntityDisplay: 'Worker Profile',
      summary: 'Suspended Worker: Unannounced absence and dispute escalation',
      ipAddress: '10.0.2.18',
      timestamp: '15 Nov 2026, 04:20:00 PM IST',
      recordedAtUtc: '2026-11-15T10:50:00.000Z',
      preMutationState: {
        workerId: 'W-3819',
        status: 'ACTIVE',
        isSuspended: false,
      },
      postMutationState: {
        workerId: 'W-3819',
        status: 'SUSPENDED',
        isSuspended: true,
      },
      changedFields: ['status', 'isSuspended'],
      operationalRemarks: 'Worker logged 3 consecutive unannounced absences without notice; pending disciplinary review by Operations.',
      outcome: 'BLACKLISTED',
    },
    {
      id: 'AUD-905',
      actorStaffId: '01a12fa2-37c7-7531-ad8a-da94787eb8d3',
      actorName: 'Support Executive',
      actorEmail: 'support.executive@sevanest.example.com',
      actorRole: 'SUPPORT_EXECUTIVE',
      actorType: 'ADMIN',
      actionType: 'PII_REVEAL_CONTACT',
      actionKey: 'worker.reveal_emergency_contact',
      targetRecordId: 'C-1092',
      targetEntityType: 'CUSTOMER',
      targetEntityDisplay: 'Customer Profile',
      summary: 'Revealed Customer Phone Number for Mediation in Ticket TKT-4921',
      ipAddress: '10.0.3.45',
      timestamp: '15 Nov 2026, 02:10:00 PM IST',
      recordedAtUtc: '2026-11-15T08:40:00.000Z',
      preMutationState: {
        maskedPhone: '+91 98765 *****',
      },
      postMutationState: {
        revealedSessionDurationSec: 300,
      },
      changedFields: ['revealedSessionDurationSec'],
      operationalRemarks: 'Customer requested direct callback regarding urgent morning maid schedule dispute.',
      outcome: 'AUDITED_READ',
    },
    {
      id: 'AUD-906',
      actorStaffId: '01a12fa2-413e-7741-96e1-1047692e8527',
      actorName: 'Operations Admin',
      actorEmail: 'operations.manager@sevanest.example.com',
      actorRole: 'OPERATIONS_ADMIN',
      actorType: 'ADMIN',
      actionType: 'BOOKING_CANCEL',
      actionKey: 'booking.cancel',
      targetRecordId: 'B-84920',
      targetEntityType: 'BOOKING',
      targetEntityDisplay: 'Household Booking',
      summary: 'Cancelled Booking B-84920 upon Customer Relocation',
      ipAddress: '10.0.2.18',
      timestamp: '15 Nov 2026, 11:30:00 AM IST',
      recordedAtUtc: '2026-11-15T06:00:00.000Z',
      preMutationState: {
        bookingId: 'B-84920',
        status: 'INTERVIEW_SCHEDULED',
      },
      postMutationState: {
        bookingId: 'B-84920',
        status: 'CANCELLED',
      },
      changedFields: ['status'],
      operationalRemarks: 'Customer relocated outside Hyderabad operating zone; slot released to workforce roster.',
      outcome: 'CANCELLED',
    },
    {
      id: 'AUD-907',
      actorStaffId: '01a11eec-ff90-73c8-972a-b88e3151ada0',
      actorName: 'Super Admin',
      actorEmail: 'sevanest@admin.in',
      actorRole: 'SUPER_ADMIN',
      actorType: 'ADMIN',
      actionType: 'CONFIG_UPDATE_ROLE',
      actionKey: 'user.role_change',
      targetRecordId: 'ROLE-OPERATIONS_ADMIN',
      targetEntityType: 'CONFIGURATION',
      targetEntityDisplay: 'System Configuration',
      summary: 'Delegated refunds.manage privilege to Operations Admin role',
      ipAddress: '10.0.1.2',
      timestamp: '14 Nov 2026, 05:00:00 PM IST',
      recordedAtUtc: '2026-11-14T11:30:00.000Z',
      preMutationState: {
        role: 'OPERATIONS_ADMIN',
        permissionsCount: 15,
      },
      postMutationState: {
        role: 'OPERATIONS_ADMIN',
        permissionsCount: 16,
      },
      changedFields: ['permissionsCount'],
      operationalRemarks: 'Empowered Operations Admins to directly arbitrate customer trial refund requests without Super Admin escalation.',
      outcome: 'MUTATED',
    },
    {
      id: 'AUD-908',
      actorStaffId: '01a12fa2-37c7-7531-ad8a-da94787eb8d3',
      actorName: 'Support Executive',
      actorEmail: 'support.executive@sevanest.example.com',
      actorRole: 'SUPPORT_EXECUTIVE',
      actorType: 'ADMIN',
      actionType: 'DISPUTE_ESCALATE',
      actionKey: 'ticket.message',
      targetRecordId: 'TKT-4902',
      targetEntityType: 'SUPPORT_TICKET',
      targetEntityDisplay: 'Support Ticket',
      summary: 'Escalated Grievance TKT-4902 to Operations for Replacement Rematch',
      ipAddress: '10.0.3.45',
      timestamp: '14 Nov 2026, 01:15:00 PM IST',
      recordedAtUtc: '2026-11-14T07:45:00.000Z',
      preMutationState: {
        ticketId: 'TKT-4902',
        status: 'INVESTIGATION_PENDING',
      },
      postMutationState: {
        ticketId: 'TKT-4902',
        status: 'ESCALATED',
      },
      changedFields: ['status'],
      operationalRemarks: 'Mediation failed: Customer requests immediate replacement under 30-day guarantee.',
      outcome: 'ESCALATED',
    },
  ];

  async getAuditLogs(criteria?: AuditFilterCriteria): Promise<PaginatedAuditLogs> {
    let filtered = this.auditLogs;

    if (criteria?.actionType && criteria.actionType !== 'ALL') {
      const selected = criteria.actionType.toLowerCase();
      if (!selected.includes('.') || selected.endsWith('.')) {
        const cleanPrefix = selected.endsWith('.') ? selected.slice(0, -1) : selected;
        filtered = filtered.filter(
          (l) =>
            l.actionType.toLowerCase().startsWith(cleanPrefix) ||
            (l.actionKey && l.actionKey.toLowerCase().startsWith(cleanPrefix))
        );
      } else {
        filtered = filtered.filter(
          (l) => l.actionType === criteria.actionType || l.actionKey === criteria.actionType
        );
      }
    } else if (criteria?.actionPrefix) {
      const prefix = criteria.actionPrefix.toLowerCase();
      filtered = filtered.filter(
        (l) => l.actionType.toLowerCase().startsWith(prefix) || (l.actionKey && l.actionKey.toLowerCase().startsWith(prefix))
      );
    }

    if (criteria?.actorStaffId && criteria.actorStaffId.trim()) {
      const q = criteria.actorStaffId.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.actorStaffId.toLowerCase().includes(q) ||
          l.actorName.toLowerCase().includes(q) ||
          (l.actorEmail && l.actorEmail.toLowerCase().includes(q))
      );
    }

    if (criteria?.targetRecordId && criteria.targetRecordId.trim()) {
      const q = criteria.targetRecordId.toLowerCase();
      filtered = filtered.filter((l) => l.targetRecordId.toLowerCase().includes(q));
    }

    if (criteria?.search && criteria.search.trim()) {
      const q = criteria.search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.summary.toLowerCase().includes(q) ||
          l.targetRecordId.toLowerCase().includes(q) ||
          l.actorName.toLowerCase().includes(q) ||
          (l.actorEmail && l.actorEmail.toLowerCase().includes(q)) ||
          l.actorStaffId.toLowerCase().includes(q) ||
          l.id.toLowerCase().includes(q) ||
          l.actionType.toLowerCase().includes(q) ||
          (l.operationalRemarks && l.operationalRemarks.toLowerCase().includes(q))
      );
    }

    const page = criteria?.page || 1;
    const pageSize = criteria?.pageSize || 10;
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startIndex = (page - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize);

    return {
      items: JSON.parse(JSON.stringify(items)),
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  }

  async getAuditLogById(id: string): Promise<AuditLogItem | null> {
    const log = this.auditLogs.find((l) => l.id === id);
    return log ? JSON.parse(JSON.stringify(log)) : null;
  }
}

export class RealAuditRepository implements IAuditRepository {
  async getAuditLogs(criteria?: AuditFilterCriteria): Promise<PaginatedAuditLogs> {
    try {
      // Lazy background synchronization of dynamic admin accounts
      syncAdminAccountsCache().catch(() => {});

      const page = criteria?.page || 1;
      const limit = criteria?.pageSize || 20;

      const params: Record<string, unknown> = {
        page,
        limit,
      };

      if (criteria?.actionType && criteria.actionType !== 'ALL') {
        if (!criteria.actionType.includes('.') || criteria.actionType.endsWith('.')) {
          params.actionPrefix = criteria.actionType.endsWith('.')
            ? criteria.actionType.slice(0, -1)
            : criteria.actionType;
        } else {
          params.action = criteria.actionType;
        }
      } else if (criteria?.actionPrefix) {
        params.actionPrefix = criteria.actionPrefix;
      }

      if (criteria?.actorStaffId?.trim()) {
        params.actorId = criteria.actorStaffId.trim();
      }
      if (criteria?.entityType?.trim()) {
        params.entityType = criteria.entityType.trim();
      }
      if (criteria?.targetRecordId?.trim()) {
        params.entityId = criteria.targetRecordId.trim();
      }
      if (criteria?.from?.trim()) {
        params.from = criteria.from.trim();
      }
      if (criteria?.to?.trim()) {
        params.to = criteria.to.trim();
      }

      const trimmedSearch = criteria?.search?.trim();
      if (trimmedSearch) {
        // If search looks like a UUID, supply it as an entity or actor filter
        if (/^[0-9a-f-]{36}$/i.test(trimmedSearch)) {
          if (!params.actorId && !params.entityId) {
            params.entityId = trimmedSearch;
          }
        } else {
          // If search matches a known administrative staff name or email, filter by actorId
          const lower = trimmedSearch.toLowerCase();
          for (const [id, acc] of Object.entries(KNOWN_ADMIN_ACTORS)) {
            if (acc.name.toLowerCase().includes(lower) || acc.email.toLowerCase().includes(lower)) {
              params.actorId = id;
              break;
            }
          }
        }
      }

      const response = await httpClient.get('/admin/audit-logs', { params });
      const data = response.data;

      let items: unknown[] = [];
      let totalCount = 0;

      if (Array.isArray(data)) {
        items = data;
        totalCount = data.length;
      } else if (data && typeof data === 'object') {
        const record = data as Record<string, unknown>;
        if (Array.isArray(record.data)) items = record.data;
        else if (Array.isArray(record.items)) items = record.items;
        else if (Array.isArray(record.logs)) items = record.logs;

        const meta = record.meta as Record<string, unknown> | undefined;
        totalCount =
          typeof meta?.total === 'number'
            ? meta.total
            : typeof meta?.totalCount === 'number'
            ? meta.totalCount
            : typeof record.totalCount === 'number'
            ? record.totalCount
            : typeof record.total === 'number'
            ? record.total
            : items.length;
      }

      let mappedItems = items
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map(mapBackendAuditLogToItem);

      // Client-side text refinement for non-UUID searches
      if (trimmedSearch && !/^[0-9a-f-]{36}$/i.test(trimmedSearch)) {
        const q = trimmedSearch.toLowerCase();
        mappedItems = mappedItems.filter(
          (l) =>
            l.summary.toLowerCase().includes(q) ||
            l.targetRecordId.toLowerCase().includes(q) ||
            l.actorName.toLowerCase().includes(q) ||
            (l.actorEmail && l.actorEmail.toLowerCase().includes(q)) ||
            l.actorStaffId.toLowerCase().includes(q) ||
            l.id.toLowerCase().includes(q) ||
            l.actionType.toLowerCase().includes(q) ||
            (l.actionKey && l.actionKey.toLowerCase().includes(q)) ||
            (l.operationalRemarks && l.operationalRemarks.toLowerCase().includes(q))
        );
      }

      const totalPages = Math.max(1, Math.ceil(totalCount / limit));

      return {
        items: mappedItems,
        totalCount,
        page,
        pageSize: limit,
        totalPages,
      };
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getAuditLogById(id: string): Promise<AuditLogItem | null> {
    if (!id?.trim()) return null;
    try {
      const result = await this.getAuditLogs({ pageSize: 100 });
      return result.items.find((l) => l.id === id) || null;
    } catch (err: unknown) {
      throw mapHttpErrorToDomainError(err);
    }
  }
}

export { RealAuditRepository as AuditRepositoryImpl };

export function createAuditRepository(): IAuditRepository {
  if (env.VITE_USE_MOCK_AUTH) {
    return new MockAuditRepository();
  }
  return new RealAuditRepository();
}

export const auditRepository = createAuditRepository();
