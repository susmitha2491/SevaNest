export type AuditActionType =
  | 'ALL'
  | 'VERIF_APPROVE_DOC'
  | 'VERIF_REJECT_DOC'
  | 'CONFIG_PUBLISH_FEES'
  | 'CONFIG_UPDATE_ROLE'
  | 'REFUND_PROCESSED'
  | 'WORKER_SUSPEND'
  | 'WORKER_STATUS_UPDATE'
  | 'CUSTOMER_SUSPEND'
  | 'PII_REVEAL_CONTACT'
  | 'BOOKING_CANCEL'
  | 'DISPUTE_ESCALATE'
  | string;

export interface AuditLogItem {
  id: string;
  actorStaffId: string;
  actorName: string;
  actorEmail?: string;
  actorRole: string;
  actorType?: 'ADMIN' | 'CUSTOMER' | 'WORKER' | 'SYSTEM' | 'UNKNOWN' | string;
  actionType: Exclude<AuditActionType, 'ALL'>;
  actionKey?: string;
  targetRecordId: string;
  targetEntityType: 'WORKER' | 'CUSTOMER' | 'BOOKING' | 'TRANSACTION' | 'SUPPORT_TICKET' | 'CONFIGURATION' | 'USER' | string;
  targetEntityDisplay?: string;

  summary: string;
  ipAddress?: string;
  timestamp: string;
  recordedAtUtc?: string;
  preMutationState?: Record<string, unknown>;
  postMutationState?: Record<string, unknown>;
  operationalRemarks?: string;
  outcome?: 'SUCCESS' | 'DENIED' | 'BLOCKED' | 'REJECTED' | 'APPROVED' | 'RECORDED' | 'MUTATED' | 'QUERY' | string;
  requestId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  changedFields?: string[];
}

export interface AuditFilterCriteria {
  actorStaffId?: string;
  actionType?: AuditActionType;
  actionPrefix?: string;
  entityType?: string;
  targetRecordId?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedAuditLogs {
  items: AuditLogItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IAuditRepository {
  getAuditLogs(criteria?: AuditFilterCriteria): Promise<PaginatedAuditLogs>;
  getAuditLogById(id: string): Promise<AuditLogItem | null>;
}
