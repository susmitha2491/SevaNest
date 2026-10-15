import {
  SupportTicketDetail,
  SupportFilterCriteria,
  PaginatedSupportTickets,
  ISupportRepository,
  TicketCaseNote,
  DisputeCategory,
} from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';

export class MockSupportRepository implements ISupportRepository {
  private tickets: SupportTicketDetail[] = [
    {
      id: 'TKT-4921',
      complainantId: 'C-1092',
      complainantName: 'Anand Sharma',
      complainantType: 'CUSTOMER',
      complainantPhoneMasked: '+91 98765 *****',
      subjectWorkerId: 'W-10482',
      subjectWorkerName: 'Sunita Devi',
      serviceCategory: 'House Maid',
      disputeCategory: 'ATTENDANCE_BREACH',
      description: 'Worker did not arrive for scheduled morning cleaning shift (07:00 AM); customer phone calls went unanswered.',
      bookingRef: 'B-84920',
      priority: 'HIGH',
      slaStatus: 'AT_RISK',
      slaRemainingText: 'SLA Window: Impending Breach (<25% remaining)',
      assignedToStaffId: 'STAFF-SUPP-01',
      assignedToStaffName: 'Pooja (Support Exec)',
      status: 'INVESTIGATION_PENDING',
      createdAt: 'Recent Intake',
      caseNotes: [
        {
          id: 'NOTE-01',
          authorName: 'System / Customer App',
          authorRole: 'Automated Intake',
          timestamp: 'Recent Event',
          noteText: 'Customer submitted grievance ticket via mobile app. SLA timer initialized.',
          noteType: 'INTERNAL_NOTE',
        },
        {
          id: 'NOTE-02',
          authorName: 'Pooja (Support Exec)',
          authorRole: 'Support Executive',
          timestamp: 'Recent Event',
          noteText: 'Telephonic call to worker: Phone unreachable. Dialed emergency contact: Family member states worker has family medical emergency.',
          noteType: 'TELEPHONIC_LOG',
        },
      ],
    },
    {
      id: 'TKT-4919',
      complainantId: 'W-10484',
      complainantName: 'Meena Bai',
      complainantType: 'WORKER',
      complainantPhoneMasked: '+91 91234 *****',
      serviceCategory: 'Cook',
      disputeCategory: 'PAYMENT_QUERY',
      description: 'Worker requested clarification regarding monthly platform fee deduction and payout timeline.',
      priority: 'MEDIUM',
      slaStatus: 'NORMAL',
      slaRemainingText: 'SLA Window: Normal (>50% remaining)',
      status: 'CREATED',
      createdAt: 'Recent Intake',
      caseNotes: [
        {
          id: 'NOTE-03',
          authorName: 'System / Worker App',
          authorRole: 'Automated Intake',
          timestamp: 'Recent Event',
          noteText: 'Worker logged payout inquiry via worker mobile application.',
          noteType: 'INTERNAL_NOTE',
        },
      ],
    },
    {
      id: 'TKT-4902',
      complainantId: 'C-2091',
      complainantName: 'Priya Reddy',
      complainantType: 'CUSTOMER',
      complainantPhoneMasked: '+91 94401 *****',
      subjectWorkerId: 'W-10484',
      subjectWorkerName: 'Meena Bai',
      serviceCategory: 'Cook',
      disputeCategory: 'REPLACEMENT_REQUEST',
      description: 'Customer requested immediate cook rematch due to ongoing dietary preparation mismatches.',
      bookingRef: 'B-84912',
      priority: 'CRITICAL',
      slaStatus: 'BREACHED',
      slaRemainingText: 'SLA Window: Breached / Escalated',
      status: 'ESCALATED',
      createdAt: 'Escalated Case',
      caseNotes: [
        {
          id: 'NOTE-04',
          authorName: 'Amit (Support Exec)',
          authorRole: 'Support Executive',
          timestamp: 'Recent Event',
          noteText: 'Mediation concluded: Customer requests alternative verified cook under 30-day guarantee.',
          noteType: 'TELEPHONIC_LOG',
        },
        {
          id: 'NOTE-05',
          authorName: 'Amit (Support Exec)',
          authorRole: 'Support Executive',
          timestamp: 'Recent Event',
          noteText: 'Case escalated to Operations Admin for immediate candidate matching from verified pool.',
          noteType: 'ESCALATION_SUMMARY',
        },
      ],
    },
    {
      id: 'TKT-4890',
      complainantId: 'C-3081',
      complainantName: 'Rajesh Kumar',
      complainantType: 'CUSTOMER',
      complainantPhoneMasked: '+91 99881 *****',
      subjectWorkerId: 'W-10483',
      subjectWorkerName: 'Ramesh Yadav',
      serviceCategory: 'Driver',
      disputeCategory: 'SERVICE_QUALITY',
      description: 'Customer raised query regarding driver route knowledge for airport pickup route.',
      bookingRef: 'B-84890',
      priority: 'LOW',
      slaStatus: 'NORMAL',
      assignedToStaffId: 'STAFF-SUPP-01',
      assignedToStaffName: 'Pooja (Support Exec)',
      status: 'RESOLVED',
      createdAt: 'Case Closed',
      caseNotes: [
        {
          id: 'NOTE-06',
          authorName: 'Pooja (Support Exec)',
          authorRole: 'Support Executive',
          timestamp: 'Case Closed',
          noteText: 'Contacted driver: Provided GPS navigation guidelines. Customer confirmed issue resolved satisfactorily.',
          noteType: 'RESOLUTION_SUMMARY',
        },
      ],
    },
    {
      id: 'TKT-4877',
      complainantId: 'W-10485',
      complainantName: 'Lakshmi Devi',
      complainantType: 'WORKER',
      complainantPhoneMasked: '+91 99887 *****',
      serviceCategory: 'Babysitter',
      disputeCategory: 'BEHAVIORAL_DISPUTE',
      description: 'Worker reported unannounced late-evening overtime requirements without prior agreement.',
      bookingRef: 'B-84870',
      priority: 'MEDIUM',
      slaStatus: 'NORMAL',
      status: 'ASSIGNED',
      assignedToStaffId: 'STAFF-SUPP-02',
      assignedToStaffName: 'Vikram (Support Exec)',
      createdAt: 'Recent Assignment',
      caseNotes: [
        {
          id: 'NOTE-07',
          authorName: 'Vikram (Support Exec)',
          authorRole: 'Support Executive',
          timestamp: 'Recent Event',
          noteText: 'Claimed ticket. Initiating telephonic discussion with customer family regarding shift hours.',
          noteType: 'INTERNAL_NOTE',
        },
      ],
    },
  ];

  async getTickets(filter?: SupportFilterCriteria): Promise<PaginatedSupportTickets> {
    let result = [...this.tickets];

    if (filter?.status && filter.status !== 'ALL') {
      result = result.filter((t) => t.status === filter.status);
    }

    if (filter?.slaStatus && filter.slaStatus !== 'ALL') {
      result = result.filter((t) => t.slaStatus === filter.slaStatus);
    }

    if (filter?.priority && filter.priority !== 'ALL') {
      result = result.filter((t) => t.priority === filter.priority);
    }

    if (filter?.complainantType && filter.complainantType !== 'ALL') {
      result = result.filter((t) => t.complainantType === filter.complainantType);
    }

    if (filter?.searchTerm) {
      const q = filter.searchTerm.toLowerCase();
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.complainantName.toLowerCase().includes(q) ||
          (t.subjectWorkerName && t.subjectWorkerName.toLowerCase().includes(q)) ||
          (t.bookingRef && t.bookingRef.toLowerCase().includes(q)) ||
          t.description.toLowerCase().includes(q) ||
          t.serviceCategory.toLowerCase().includes(q)
      );
    }

    const page = filter?.page || 1;
    const pageSize = filter?.pageSize || 10;
    const totalCount = result.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const paginated = result.slice((page - 1) * pageSize, page * pageSize);

    const slaAtRiskCount = this.tickets.filter((t) => t.slaStatus === 'AT_RISK' || t.slaStatus === 'BREACHED').length;
    const unassignedCount = this.tickets.filter((t) => !t.assignedToStaffName || t.status === 'CREATED').length;
    const escalatedCount = this.tickets.filter((t) => t.status === 'ESCALATED').length;
    const resolvedTodayCount = this.tickets.filter((t) => t.status === 'RESOLVED').length;

    return {
      items: paginated,
      totalCount,
      page,
      pageSize,
      totalPages,
      slaAtRiskCount,
      unassignedCount,
      escalatedCount,
      resolvedTodayCount,
    };
  }

  async getTicketById(id: string): Promise<SupportTicketDetail | null> {
    const item = this.tickets.find((t) => t.id === id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async claimTicket(ticketId: string, staffName: string): Promise<void> {
    const item = this.tickets.find((t) => t.id === ticketId);
    if (item) {
      item.assignedToStaffName = staffName;
      item.status = 'ASSIGNED';
      item.caseNotes.push({
        id: `NOTE-${Date.now()}`,
        authorName: staffName,
        authorRole: 'Support Executive',
        timestamp: 'Recent Event',
        noteText: `Ticket claimed by ${staffName}. Status transitioned to Assigned.`,
        noteType: 'INTERNAL_NOTE',
      });
    }
  }

  async addCaseNote(
    ticketId: string,
    noteText: string,
    noteType: TicketCaseNote['noteType'],
    authorName: string
  ): Promise<void> {
    const item = this.tickets.find((t) => t.id === ticketId);
    if (item) {
      item.caseNotes.push({
        id: `NOTE-${Date.now()}`,
        authorName,
        authorRole: 'Support Staff',
        timestamp: 'Recent Event',
        noteText,
        noteType,
      });
      if (item.status === 'ASSIGNED') {
        item.status = 'IN_PROGRESS';
      }
    }
  }

  async resolveTicket(ticketId: string, resolutionSummary: string): Promise<void> {
    const item = this.tickets.find((t) => t.id === ticketId);
    if (item) {
      item.status = 'RESOLVED';
      item.caseNotes.push({
        id: `NOTE-${Date.now()}`,
        authorName: 'Support Executive',
        authorRole: 'Support Executive',
        timestamp: 'Recent Event',
        noteText: `Case Resolved: ${resolutionSummary}`,
        noteType: 'RESOLUTION_SUMMARY',
      });
    }
  }

  async escalateToOperations(ticketId: string, rationale: string): Promise<void> {
    const item = this.tickets.find((t) => t.id === ticketId);
    if (item) {
      item.status = 'ESCALATED';
      item.caseNotes.push({
        id: `NOTE-${Date.now()}`,
        authorName: 'Support Executive',
        authorRole: 'Support Executive',
        timestamp: 'Recent Event',
        noteText: `Escalated to Operations Admin: ${rationale}`,
        noteType: 'ESCALATION_SUMMARY',
      });
    }
  }

  async initiateReplacementHandoff(ticketId: string, remarks: string): Promise<void> {
    const item = this.tickets.find((t) => t.id === ticketId);
    if (item) {
      item.status = 'REPLACEMENT_INITIATED';
      item.caseNotes.push({
        id: `NOTE-${Date.now()}`,
        authorName: 'Support Executive',
        authorRole: 'Support Executive',
        timestamp: 'Recent Event',
        noteText: `Replacement Handoff Triggered: ${remarks}. Case linked to Operations Replacement Queue.`,
        noteType: 'ESCALATION_SUMMARY',
      });
    }
  }
}

function mapBackendSupportTicketToDomain(raw: Record<string, unknown>): SupportTicketDetail {
  const creator = raw.creator as Record<string, unknown> | undefined;
  const assignee = raw.assignee as Record<string, unknown> | undefined;
  const messages = Array.isArray(raw.messages) ? (raw.messages as Record<string, unknown>[]) : [];

  return {
    id: String(raw.id || raw.ticketId || ''),
    complainantId: String(raw.complainantId || raw.customerUserId || raw.workerId || raw.creatorId || 'U-00'),
    complainantName: String(raw.complainantName || creator?.fullName || 'User'),
    complainantType: (raw.complainantType as SupportTicketDetail['complainantType']) || (raw.customerUserId ? 'CUSTOMER' : 'WORKER'),
    complainantPhoneMasked: String(raw.complainantPhoneMasked || '+91 *****'),
    subjectWorkerId: raw.subjectWorkerId ? String(raw.subjectWorkerId) : undefined,
    subjectWorkerName: raw.subjectWorkerName ? String(raw.subjectWorkerName) : undefined,
    serviceCategory: String(raw.category || raw.serviceCategory || 'General'),
    disputeCategory: (raw.disputeCategory as DisputeCategory) || 'OTHER',
    description: String(raw.description || raw.subject || 'Support Ticket'),
    bookingRef: raw.bookingId ? String(raw.bookingId) : raw.bookingRef ? String(raw.bookingRef) : undefined,
    priority: (raw.priority as SupportTicketDetail['priority']) || 'MEDIUM',
    slaStatus: (raw.slaStatus as SupportTicketDetail['slaStatus']) || 'NORMAL',
    slaRemainingText: String(raw.slaRemainingText || 'Standard SLA Window'),
    assignedToStaffId: (raw.assignedToStaffId || raw.assigneeUserId) ? String(raw.assignedToStaffId || raw.assigneeUserId) : undefined,
    assignedToStaffName: (raw.assignedToStaffName || assignee?.name) ? String(raw.assignedToStaffName || assignee?.name) : undefined,
    status: (raw.status as SupportTicketDetail['status']) || 'OPEN',
    createdAt: String(raw.createdAt || 'Recent Intake'),
    caseNotes: messages.map((m: Record<string, unknown>) => {
      const sender = m.sender as Record<string, unknown> | undefined;
      return {
        id: String(m.id || `M-${Math.random()}`),
        authorName: String(sender?.name || (m.internal ? 'Staff' : 'User')),
        authorRole: m.internal ? 'Support Executive' : 'Complainant',
        timestamp: String(m.createdAt || 'Recent'),
        noteText: String(m.body || ''),
        noteType: (m.noteType as TicketCaseNote['noteType']) || 'INTERNAL_NOTE',
      };
    }),
  };
}

export class RealSupportRepository implements ISupportRepository {
  async getTickets(filter?: SupportFilterCriteria): Promise<PaginatedSupportTickets> {
    try {
      const params: Record<string, unknown> = {
        page: filter?.page || 1,
        limit: filter?.pageSize || 10,
      };
      if (filter?.status && filter.status !== 'ALL') {
        params.status = filter.status;
      }
      if (filter?.priority && filter.priority !== 'ALL') {
        params.priority = filter.priority;
      }

      const res = await httpClient.get<{
        success: boolean;
        data: Record<string, unknown>[];
        meta?: { totalItems?: number; currentPage?: number; itemsPerPage?: number; totalPages?: number };
      }>('/admin/support/tickets', { params });

      const payload = res.data;
      const items = Array.isArray(payload.data) ? payload.data : [];
      const mapped = items.map(mapBackendSupportTicketToDomain);

      return {
        items: mapped,
        totalCount: payload.meta?.totalItems ?? items.length,
        page: payload.meta?.currentPage ?? filter?.page ?? 1,
        pageSize: payload.meta?.itemsPerPage ?? filter?.pageSize ?? 10,
        totalPages: payload.meta?.totalPages ?? (Math.ceil((payload.meta?.totalItems || items.length) / (filter?.pageSize || 10)) || 1),
        slaAtRiskCount: mapped.filter((t) => t.slaStatus === 'AT_RISK' || t.slaStatus === 'BREACHED').length,
        unassignedCount: mapped.filter((t) => !t.assignedToStaffId).length,
        escalatedCount: mapped.filter((t) => t.status === 'ESCALATED').length,
        resolvedTodayCount: mapped.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getTicketById(id: string): Promise<SupportTicketDetail | null> {
    try {
      const res = await httpClient.get<{ success: boolean; data: Record<string, unknown> }>(`/admin/support/tickets/${id}`);
      const raw = res.data.data;
      if (!raw) return null;

      // also fetch messages
      try {
        const msgRes = await httpClient.get<{ success: boolean; data: { data?: Record<string, unknown>[] } | Record<string, unknown>[] }>(
          `/admin/support/tickets/${id}/messages`
        );
        raw.messages = Array.isArray(msgRes.data.data) ? msgRes.data.data : (msgRes.data.data as { data?: Record<string, unknown>[] })?.data;
      } catch {
        // preserve existing if messages fetch errors
      }

      return mapBackendSupportTicketToDomain(raw);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async claimTicket(ticketId: string, staffName: string): Promise<void> {
    try {
      await httpClient.post(`/admin/support/tickets/${ticketId}/assign`, {
        note: `Assigned to ${staffName}`,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async addCaseNote(
    ticketId: string,
    noteText: string,
    _noteType: TicketCaseNote['noteType'],
    _authorName: string
  ): Promise<void> {
    try {
      await httpClient.post(`/admin/support/tickets/${ticketId}/messages`, {
        body: noteText,
        internal: true,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async resolveTicket(ticketId: string, resolutionSummary: string): Promise<void> {
    try {
      await httpClient.post(`/admin/support/tickets/${ticketId}/close`, {
        resolution: resolutionSummary,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async escalateToOperations(ticketId: string, rationale: string): Promise<void> {
    try {
      await httpClient.post(`/admin/support/tickets/${ticketId}/escalate`, {
        reason: rationale,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async initiateReplacementHandoff(ticketId: string, remarks: string): Promise<void> {
    try {
      await httpClient.post(`/admin/support/tickets/${ticketId}/escalate`, {
        reason: `Replacement handoff: ${remarks}`,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }
}

export { RealSupportRepository as SupportRepositoryImpl };

export const createSupportRepository = (
  useMock: boolean = env.VITE_USE_MOCK_AUTH
): ISupportRepository => {
  return useMock ? new MockSupportRepository() : new RealSupportRepository();
};

export const supportRepository = createSupportRepository();
