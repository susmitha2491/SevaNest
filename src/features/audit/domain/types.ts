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
  actorRole: string;
  actionType: Exclude<AuditActionType, 'ALL'>;
  targetRecordId: string;
  targetEntityType: 'WORKER' | 'CUSTOMER' | 'BOOKING' | 'TRANSACTION' | 'SUPPORT_TICKET' | 'CONFIGURATION' | 'USER' | string;

  summary: string;
  ipAddress: string;
  timestamp: string;
  preMutationState?: Record<string, unknown>;
  postMutationState?: Record<string, unknown>;
  operationalRemarks: string;
}

export interface AuditFilterCriteria {
  actorStaffId?: string;
  actionType?: AuditActionType;
  targetRecordId?: string;
  search?: string;
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
