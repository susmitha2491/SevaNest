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

export function mapBackendAuditLogToItem(raw: Record<string, unknown>): AuditLogItem {
  const id = String(raw.id || raw.auditId || 'AUD-0');
  const actorStaffId = String(raw.actorId || raw.actorStaffId || raw.actor || 'STAFF');
  const actorName = String(raw.actorName || raw.actorEmail || 'System Operator');
  const actorRole = String(raw.actorRole || 'System');
  const actionType = String(raw.action || raw.actionType || 'SYSTEM_ACTION') as Exclude<AuditActionType, 'ALL'>;
  const targetRecordId = String(raw.entityId || raw.targetRecordId || 'N/A');
  const targetEntityType = String(raw.entityType || raw.targetEntityType || 'CONFIGURATION');
  const summary = String(raw.summary || raw.description || raw.message || 'Audit action logged');
  const ipAddress = String(raw.ipAddress || raw.ip || '10.0.0.1');
  const timestamp = String(raw.createdAt || raw.timestamp || new Date().toISOString());
  const preMutationState = (raw.preMutationState || raw.before || undefined) as Record<string, unknown> | undefined;
  const postMutationState = (raw.postMutationState || raw.after || undefined) as Record<string, unknown> | undefined;
  const operationalRemarks = String(
    raw.operationalRemarks || raw.remarks || raw.reason || 'Recorded in immutable audit trail.'
  );

  return {
    id,
    actorStaffId,
    actorName,
    actorRole,
    actionType,
    targetRecordId,
    targetEntityType,
    summary,
    ipAddress,
    timestamp,
    preMutationState,
    postMutationState,
    operationalRemarks,
  };
}

export class MockAuditRepository implements IAuditRepository {
  private auditLogs: AuditLogItem[] = [
    {
      id: 'AUD-901',
      actorStaffId: 'STAFF-VE-01',
      actorName: 'Pooja (Verif Exec)',
      actorRole: 'Verification Executive',
      actionType: 'VERIF_APPROVE_DOC',
      targetRecordId: 'W-10482',
      targetEntityType: 'WORKER',
      summary: 'Approved Aadhaar Identity & Address Proof',
      ipAddress: '10.0.4.12',
      timestamp: 'Recent Event',
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
      operationalRemarks: 'Aadhaar QR verified against UIDAI offline XML standard. Photograph and address match residential inspection.',
    },
    {
      id: 'AUD-902',
      actorStaffId: 'STAFF-SUPER-01',
      actorName: 'Rajesh (Super Admin)',
      actorRole: 'Super Admin',
      actionType: 'CONFIG_PUBLISH_FEES',
      targetRecordId: 'CFG-FEES-V2',
      targetEntityType: 'CONFIGURATION',
      summary: 'Updated Commercial Maid Booking Fee from ₹399 to ₹499',
      ipAddress: '10.0.1.2',
      timestamp: 'Recent Event',
      preMutationState: {
        maidBookingFeeINR: 399,
        version: 'V1.4',
      },
      postMutationState: {
        maidBookingFeeINR: 499,
        version: 'V2.0',
      },
      operationalRemarks: 'Q3 operational price revision approved by commercial management committee.',
    },
    {
      id: 'AUD-903',
      actorStaffId: 'STAFF-OPS-01',
      actorName: 'Vikram (Ops Admin)',
      actorRole: 'Operations Admin',
      actionType: 'REFUND_PROCESSED',
      targetRecordId: 'TXN-892104',
      targetEntityType: 'TRANSACTION',
      summary: 'Authorized 100% Refund (₹499.00) for Unsatisfactory Trial',
      ipAddress: '10.0.2.18',
      timestamp: 'Recent Event',
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
      operationalRemarks: 'Customer reported punctuality mismatch in scheduled cook trial; replacement declined. Refund approved under 100% money-back policy.',
    },
    {
      id: 'AUD-904',
      actorStaffId: 'STAFF-OPS-01',
      actorName: 'Vikram (Ops Admin)',
      actorRole: 'Operations Admin',
      actionType: 'WORKER_SUSPEND',
      targetRecordId: 'W-3819',
      targetEntityType: 'WORKER',
      summary: 'Suspended Worker: Unannounced absence and dispute escalation',
      ipAddress: '10.0.2.18',
      timestamp: 'Recent Event',
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
      operationalRemarks: 'Worker logged 3 consecutive unannounced absences without notice; pending disciplinary review by Operations.',
    },
    {
      id: 'AUD-905',
      actorStaffId: 'STAFF-SUPP-01',
      actorName: 'Kavita (Support Exec)',
      actorRole: 'Support Executive',
      actionType: 'PII_REVEAL_CONTACT',
      targetRecordId: 'C-1092',
      targetEntityType: 'CUSTOMER',
      summary: 'Revealed Customer Phone Number for Mediation in Ticket TKT-4921',
      ipAddress: '10.0.3.45',
      timestamp: 'Recent Event',
      preMutationState: {
        maskedPhone: '+91 98765 *****',
      },
      postMutationState: {
        revealedSessionDurationSec: 300,
      },
      operationalRemarks: 'Customer requested direct callback regarding urgent morning maid schedule dispute.',
    },
    {
      id: 'AUD-906',
      actorStaffId: 'STAFF-OPS-01',
      actorName: 'Vikram (Ops Admin)',
      actorRole: 'Operations Admin',
      actionType: 'BOOKING_CANCEL',
      targetRecordId: 'B-84920',
      targetEntityType: 'BOOKING',
      summary: 'Cancelled Booking B-84920 upon Customer Relocation',
      ipAddress: '10.0.2.18',
      timestamp: 'Recent Event',
      preMutationState: {
        bookingId: 'B-84920',
        status: 'INTERVIEW_SCHEDULED',
      },
      postMutationState: {
        bookingId: 'B-84920',
        status: 'CANCELLED',
      },
      operationalRemarks: 'Customer relocated outside Hyderabad operating zone; slot released to workforce roster.',
    },
    {
      id: 'AUD-907',
      actorStaffId: 'STAFF-SUPER-01',
      actorName: 'Rajesh (Super Admin)',
      actorRole: 'Super Admin',
      actionType: 'CONFIG_UPDATE_ROLE',
      targetRecordId: 'ROLE-OPERATIONS_ADMIN',
      targetEntityType: 'CONFIGURATION',
      summary: 'Delegated refunds.manage privilege to Operations Admin role',
      ipAddress: '10.0.1.2',
      timestamp: 'Recent Event',
      preMutationState: {
        role: 'OPERATIONS_ADMIN',
        permissionsCount: 15,
      },
      postMutationState: {
        role: 'OPERATIONS_ADMIN',
        permissionsCount: 16,
      },
      operationalRemarks: 'Empowered Operations Admins to directly arbitrate customer trial refund requests without Super Admin escalation.',
    },
    {
      id: 'AUD-908',
      actorStaffId: 'STAFF-SUPP-01',
      actorName: 'Kavita (Support Exec)',
      actorRole: 'Support Executive',
      actionType: 'DISPUTE_ESCALATE',
      targetRecordId: 'TKT-4902',
      targetEntityType: 'SUPPORT_TICKET',
      summary: 'Escalated Grievance TKT-4902 to Operations for Replacement Rematch',
      ipAddress: '10.0.3.45',
      timestamp: 'Recent Event',
      preMutationState: {
        ticketId: 'TKT-4902',
        status: 'INVESTIGATION_PENDING',
      },
      postMutationState: {
        ticketId: 'TKT-4902',
        status: 'ESCALATED',
      },
      operationalRemarks: 'Mediation failed: Customer requests immediate replacement under 30-day guarantee.',
    },
  ];

  async getAuditLogs(criteria?: AuditFilterCriteria): Promise<PaginatedAuditLogs> {
    let filtered = this.auditLogs;

    if (criteria?.actionType && criteria.actionType !== 'ALL') {
      filtered = filtered.filter((l) => l.actionType === criteria.actionType);
    }

    if (criteria?.actorStaffId && criteria.actorStaffId.trim()) {
      const q = criteria.actorStaffId.toLowerCase();
      filtered = filtered.filter((l) => l.actorStaffId.toLowerCase().includes(q) || l.actorName.toLowerCase().includes(q));
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
          l.actorStaffId.toLowerCase().includes(q) ||
          l.id.toLowerCase().includes(q)
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
      const page = criteria?.page || 1;
      const limit = criteria?.pageSize || 20;

      const params: Record<string, unknown> = {
        page,
        limit,
      };

      if (criteria?.actionType && criteria.actionType !== 'ALL') {
        params.action = criteria.actionType;
      }
      if (criteria?.actorStaffId?.trim()) {
        params.actorId = criteria.actorStaffId.trim();
      }
      if (criteria?.targetRecordId?.trim()) {
        params.entityId = criteria.targetRecordId.trim();
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
        if (Array.isArray(record.items)) items = record.items;
        else if (Array.isArray(record.logs)) items = record.logs;
        else if (Array.isArray(record.data)) items = record.data;

        totalCount =
          typeof record.totalCount === 'number'
            ? record.totalCount
            : typeof record.total === 'number'
            ? record.total
            : items.length;
      }

      const mappedItems = items
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map(mapBackendAuditLogToItem);

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
