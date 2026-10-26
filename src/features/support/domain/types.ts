export type TicketStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'INVESTIGATION_PENDING'
  | 'ESCALATED'
  | 'REPLACEMENT_INITIATED'
  | 'RESOLVED'
  | 'CLOSED';

export type SLAStatus = 'NORMAL' | 'AT_RISK' | 'BREACHED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ComplainantRole = 'CUSTOMER' | 'WORKER';

export type DisputeCategory =
  | 'ATTENDANCE_BREACH'
  | 'SERVICE_QUALITY'
  | 'PAYMENT_QUERY'
  | 'BEHAVIORAL_DISPUTE'
  | 'REPLACEMENT_REQUEST'
  | 'OTHER';

export const DISPUTE_CATEGORIES: { key: DisputeCategory; label: string }[] = [
  { key: 'ATTENDANCE_BREACH', label: 'Worker Unannounced Absence / Attendance Breach' },
  { key: 'SERVICE_QUALITY', label: 'Service Quality / Cleaning / Cooking Discrepancy' },
  { key: 'PAYMENT_QUERY', label: 'Payment / Payout Clarification' },
  { key: 'BEHAVIORAL_DISPUTE', label: 'Behavioral / Conduct Dispute' },
  { key: 'REPLACEMENT_REQUEST', label: 'Replacement Request Escalation' },
  { key: 'OTHER', label: 'General Support Inquiry' },
];

export interface TicketCaseNote {
  id: string;
  authorName: string;
  authorRole: string;
  timestamp: string;
  noteText: string;
  noteType: 'INTERNAL_NOTE' | 'TELEPHONIC_LOG' | 'ESCALATION_SUMMARY' | 'RESOLUTION_SUMMARY';
}

export interface SupportTicketDetail {
  id: string;
  etag?: string;
  complainantId: string;
  complainantName: string;
  complainantType: ComplainantRole;
  complainantPhoneMasked: string;
  subjectWorkerId?: string;
  subjectWorkerName?: string;
  serviceCategory: string;
  disputeCategory: DisputeCategory;
  description: string;
  bookingRef?: string;
  priority: TicketPriority;
  slaStatus: SLAStatus;
  slaRemainingText?: string;
  assignedToStaffId?: string;
  assignedToStaffName?: string;
  status: TicketStatus;
  createdAt: string;
  caseNotes: TicketCaseNote[];
}

export interface SupportFilterCriteria {
  searchTerm?: string;
  status?: string;
  slaStatus?: string;
  priority?: string;
  complainantType?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'priority' | 'slaStatus';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedSupportTickets {
  items: SupportTicketDetail[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  slaAtRiskCount: number;
  unassignedCount: number;
  escalatedCount: number;
  resolvedTodayCount: number;
}

export interface ISupportRepository {
  getTickets(filter?: SupportFilterCriteria): Promise<PaginatedSupportTickets>;
  getTicketById(id: string): Promise<SupportTicketDetail | null>;
  claimTicket(ticketId: string, staffName?: string, etag?: string, options?: { assigneeUserId?: string; note?: string }): Promise<void>;
  assignTicket(ticketId: string, options: { assigneeUserId?: string; note?: string; etag?: string }): Promise<void>;
  setPriority(ticketId: string, priority: 'LOW' | 'MEDIUM' | 'HIGH', etag?: string): Promise<void>;
  addCaseNote(
    ticketId: string,
    noteText: string,
    noteType: TicketCaseNote['noteType'],
    authorName: string
  ): Promise<void>;
  resolveTicket(ticketId: string, resolutionSummary: string, etag?: string): Promise<void>;
  escalateToOperations(ticketId: string, rationale: string, etag?: string): Promise<void>;
  initiateReplacementHandoff(ticketId: string, remarks: string, etag?: string): Promise<void>;
}
