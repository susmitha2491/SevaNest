import {
  SupportTicketDetail,
  SupportFilterCriteria,
  PaginatedSupportTickets,
  ISupportRepository,
  TicketCaseNote,
  DisputeCategory,
  SupportMessage,
} from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import {
  getCustomerPhone,
  getWorkerPhone,
  preloadCustomerPhones,
  preloadWorkerPhones,
  formatPhoneNumber,
  getCustomerName,
  setCustomerName,
  getWorkerName,
  setWorkerName,
} from '../../../core/utils/phoneDirectory';
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

    if (filter?.assignedToUserId) {
      result = result.filter(
        (t) =>
          t.assignedToStaffId === filter.assignedToUserId ||
          t.assignedToStaffName?.toLowerCase().includes('support exec') ||
          t.assignedToStaffId?.startsWith('STAFF-SUPP-')
      );
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

    const slaAtRiskCount = this.tickets.filter(
      (t) => (t.slaStatus === 'AT_RISK' || t.slaStatus === 'BREACHED') && t.status !== 'RESOLVED' && t.status !== 'CLOSED'
    ).length;
    const unassignedCount = this.tickets.filter(
      (t) => (!t.assignedToStaffName || t.status === 'CREATED') && t.status !== 'RESOLVED' && t.status !== 'CLOSED'
    ).length;
    const escalatedCount = this.tickets.filter((t) => t.status === 'ESCALATED').length;
    const resolvedTodayCount = this.tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;

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
    if (!item) return null;
    const cloned = JSON.parse(JSON.stringify(item));
    cloned.etag = cloned.etag || '"mock-v1"';
    return cloned;
  }

  async claimTicket(
    ticketId: string,
    staffName?: string,
    _etag?: string,
    options?: { assigneeUserId?: string; note?: string }
  ): Promise<void> {
    const item = this.tickets.find((t) => t.id === ticketId);
    if (item) {
      item.assignedToStaffName = staffName || options?.assigneeUserId || 'Support Executive';
      item.status = 'ASSIGNED';
      item.etag = `"mock-v${Date.now()}"`;
      item.caseNotes.push({
        id: `NOTE-${Date.now()}`,
        authorName: item.assignedToStaffName,
        authorRole: 'Support Executive',
        timestamp: 'Recent Event',
        noteText: options?.note || `Ticket claimed by ${item.assignedToStaffName}. Status transitioned to Assigned.`,
        noteType: 'INTERNAL_NOTE',
      });
    }
  }

  async assignTicket(
    ticketId: string,
    options: { assigneeUserId?: string; note?: string; etag?: string }
  ): Promise<void> {
    return this.claimTicket(ticketId, options.assigneeUserId, options.etag, options);
  }

  async setPriority(ticketId: string, priority: 'LOW' | 'MEDIUM' | 'HIGH', _etag?: string): Promise<void> {
    const item = this.tickets.find((t) => t.id === ticketId);
    if (item) {
      item.priority = priority;
      item.etag = `"mock-v${Date.now()}"`;
      item.caseNotes.push({
        id: `NOTE-${Date.now()}`,
        authorName: 'Support Executive',
        authorRole: 'Support Executive',
        timestamp: 'Recent Event',
        noteText: `Priority updated to ${priority}.`,
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
      item.etag = `"mock-v${Date.now()}"`;
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

  async resolveTicket(ticketId: string, resolutionSummary: string, _etag?: string): Promise<void> {
    const item = this.tickets.find((t) => t.id === ticketId);
    if (item) {
      item.status = 'RESOLVED';
      item.etag = `"mock-v${Date.now()}"`;
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

  async escalateToOperations(ticketId: string, rationale: string, _etag?: string): Promise<void> {
    const item = this.tickets.find((t) => t.id === ticketId);
    if (item) {
      item.status = 'ESCALATED';
      item.etag = `"mock-v${Date.now()}"`;
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

  private messagesMap: Record<string, SupportMessage[]> = {
    'TKT-4921': [
      {
        id: 'msg-4921-1',
        ticketId: 'TKT-4921',
        from: 'ADMIN',
        body: 'Hello Anand, we have contacted Sunita Devi and are checking her emergency contact regarding the missed shift.',
        createdAt: '2026-11-06T11:50:00.000Z',
        authorUserId: 'STAFF-SUPP-01',
        internal: false,
      },
      {
        id: 'msg-4921-2',
        ticketId: 'TKT-4921',
        from: 'CUSTOMER',
        body: 'Thank you for following up so promptly. Please let me know as soon as you have an update.',
        createdAt: '2026-11-06T11:55:00.000Z',
        authorUserId: 'C-1092',
        internal: false,
      },
      {
        id: 'msg-4921-3',
        ticketId: 'TKT-4921',
        from: 'ADMIN',
        body: 'Spoke with emergency contact: family medical emergency confirmed. Proposing replacement candidate.',
        createdAt: '2026-11-06T12:05:00.000Z',
        authorUserId: 'STAFF-SUPP-01',
        internal: true,
      },
    ],
    'TKT-4919': [
      {
        id: 'msg-4919-1',
        ticketId: 'TKT-4919',
        from: 'ADMIN',
        body: 'Namaste Meena Bai, payouts for completed weekly engagements are credited every Tuesday by 6:00 PM IST.',
        createdAt: '2026-11-08T09:30:00.000Z',
        authorUserId: 'STAFF-SUPP-01',
        internal: false,
      },
    ],
  };

  async getTicketMessages(ticketId: string): Promise<SupportMessage[]> {
    if (!this.messagesMap[ticketId]) {
      this.messagesMap[ticketId] = [];
    }
    return [...this.messagesMap[ticketId]];
  }

  async sendTicketMessage(
    ticketId: string,
    body: string,
    isInternal: boolean = false
  ): Promise<SupportMessage> {
    const item = this.tickets.find((t) => t.id === ticketId);
    if (!item) {
      throw new Error(`Ticket ${ticketId} not found`);
    }
    if (item.status === 'CLOSED' || item.status === 'RESOLVED') {
      const err = new Error('Cannot send messages to a closed or resolved ticket.');
      (err as { statusCode?: number }).statusCode = 409;
      throw err;
    }

    const newMsg: SupportMessage = {
      id: `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ticketId,
      from: 'ADMIN',
      body,
      createdAt: new Date().toISOString(),
      authorUserId: 'STAFF-SUPP-01',
      internal: isInternal,
    };

    if (!this.messagesMap[ticketId]) {
      this.messagesMap[ticketId] = [];
    }
    this.messagesMap[ticketId].push(newMsg);

    if (isInternal) {
      item.caseNotes.push({
        id: `NOTE-${Date.now()}`,
        authorName: 'Support Executive',
        authorRole: 'Support Executive',
        timestamp: new Date().toISOString(),
        noteText: body,
        noteType: 'INTERNAL_NOTE',
      });
    }

    if (item.status === 'CREATED' || item.status === 'ASSIGNED') {
      item.status = 'IN_PROGRESS';
    }
    item.etag = `"mock-v${Date.now()}"`;

    return newMsg;
  }

  async initiateReplacementHandoff(ticketId: string, remarks: string, _etag?: string): Promise<void> {
    const item = this.tickets.find((t) => t.id === ticketId);
    if (item) {
      item.status = 'REPLACEMENT_INITIATED';
      item.etag = `"mock-v${Date.now()}"`;
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

function mapBackendSupportTicketToDomain(raw: Record<string, unknown>, etag?: string): SupportTicketDetail {
  const creator = raw.creator as Record<string, unknown> | undefined;
  const assignee = raw.assignee as Record<string, unknown> | undefined;
  const messages = Array.isArray(raw.messages) ? (raw.messages as Record<string, unknown>[]) : [];
  const historyEvents = Array.isArray(raw.history) ? (raw.history as Record<string, unknown>[]) : [];

  const categoryObj = typeof raw.category === 'object' && raw.category !== null ? (raw.category as Record<string, unknown>) : null;
  const categoryLabel = String(categoryObj?.label || categoryObj?.name || (typeof raw.category === 'string' ? raw.category : raw.serviceCategory || 'General Support'));

  let slaStatus: SupportTicketDetail['slaStatus'] = (raw.slaStatus as SupportTicketDetail['slaStatus']) || 'NORMAL';
  let slaRemainingText = String(raw.slaRemainingText || '');
  if (raw.slaBreachedAt) {
    slaStatus = 'BREACHED';
    slaRemainingText = 'SLA Target Breached';
  } else if (raw.dueAt) {
    const diffMs = new Date(String(raw.dueAt)).getTime() - Date.now();
    if (diffMs <= 0) {
      slaStatus = 'BREACHED';
      slaRemainingText = 'SLA Target Expired';
    } else if (diffMs < 4 * 60 * 60 * 1000) {
      slaStatus = 'AT_RISK';
      const hours = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
      slaRemainingText = `SLA Window: Impending Breach (~${hours}h remaining)`;
    } else {
      slaStatus = 'NORMAL';
      slaRemainingText = `Due by ${new Date(String(raw.dueAt)).toLocaleDateString()}`;
    }
  }
  if (!slaRemainingText) {
    slaRemainingText = 'Standard SLA Window';
  }

  const messageNotes: TicketCaseNote[] = messages.map((m: Record<string, unknown>) => {
    const sender = m.sender as Record<string, unknown> | undefined;
    return {
      id: String(m.id || `M-${Math.random()}`),
      authorName: String(sender?.name || (m.internal ? 'Staff' : 'User')),
      authorRole: m.internal ? 'Support Executive' : 'Complainant',
      timestamp: String(m.createdAt || 'Recent'),
      noteText: String(m.body || ''),
      noteType: (m.noteType as TicketCaseNote['noteType']) || 'INTERNAL_NOTE',
    };
  });

  const historyNotes: TicketCaseNote[] = historyEvents.map((h: Record<string, unknown>, idx: number) => ({
    id: `HIST-${idx}-${h.createdAt || Date.now()}`,
    authorName: String(h.actorUserId || 'Staff'),
    authorRole: 'Audit Timeline',
    timestamp: String(h.createdAt || 'Recent Event'),
    noteText: String(h.internalNote || `Event: ${h.type || 'STATUS_UPDATE'} (${h.fromStatus || 'START'} -> ${h.toStatus || 'END'})`),
    noteType: h.type === 'ESCALATED' ? 'ESCALATION_SUMMARY' : h.type === 'CLOSED' ? 'RESOLUTION_SUMMARY' : 'INTERNAL_NOTE',
  }));

  const allNotes = [...messageNotes, ...historyNotes];
  const mappedMessages: SupportMessage[] = messages.map((m: Record<string, unknown>) => ({
    id: String(m.id || `msg-${Math.random()}`),
    ticketId: String(raw.id || raw.ticketId || ''),
    from: (m.from as SupportMessage['from']) || (m.internal ? 'ADMIN' : 'CUSTOMER'),
    body: String(m.body || ''),
    createdAt: String(m.createdAt || new Date().toISOString()),
    authorUserId: String(m.authorUserId || ''),
    internal: Boolean(m.internal),
  }));
  const resolvedEtag = etag || (raw.etag as string | undefined) || (raw.version !== undefined ? `"${raw.version}"` : undefined);

    const compUserId = String(raw.creatorUserId || raw.complainantId || raw.customerUserId || raw.workerId || raw.creatorId || 'U-00');
    const compType: 'CUSTOMER' | 'WORKER' =
      (raw.creatorKind as SupportTicketDetail['complainantType']) ||
      (raw.complainantType as SupportTicketDetail['complainantType']) ||
      (raw.customerUserId ? 'CUSTOMER' : raw.workerId ? 'WORKER' : 'CUSTOMER');

    const creatorProfile = creator?.profile as Record<string, unknown> | undefined;
    const workerObj = raw.worker as Record<string, unknown> | undefined;
    const customerObj = raw.customer as Record<string, unknown> | undefined;

    const rawNameCandidate =
      (typeof raw.complainantName === 'string' && raw.complainantName.trim() && raw.complainantName !== 'Worker' && raw.complainantName !== 'Customer' ? raw.complainantName.trim() : undefined) ||
      (typeof raw.creatorName === 'string' && raw.creatorName.trim() ? raw.creatorName.trim() : undefined) ||
      (typeof creator?.fullName === 'string' && creator.fullName.trim() ? creator.fullName.trim() : undefined) ||
      (typeof creator?.name === 'string' && creator.name.trim() ? creator.name.trim() : undefined) ||
      (typeof creatorProfile?.fullName === 'string' ? (creatorProfile.fullName as string).trim() : undefined) ||
      (typeof creatorProfile?.name === 'string' ? (creatorProfile.name as string).trim() : undefined) ||
      (creator?.firstName ? `${creator.firstName} ${creator.lastName || ''}`.trim() : undefined) ||
      (compType === 'WORKER' && typeof workerObj?.fullName === 'string' ? (workerObj.fullName as string).trim() : undefined) ||
      (compType === 'WORKER' && typeof workerObj?.name === 'string' ? (workerObj.name as string).trim() : undefined) ||
      (compType === 'WORKER' && typeof raw.workerName === 'string' && raw.workerName.trim() ? raw.workerName.trim() : undefined) ||
      (compType === 'CUSTOMER' && typeof customerObj?.fullName === 'string' ? (customerObj.fullName as string).trim() : undefined) ||
      (compType === 'CUSTOMER' && typeof customerObj?.name === 'string' ? (customerObj.name as string).trim() : undefined) ||
      (compType === 'CUSTOMER' && typeof raw.customerName === 'string' && raw.customerName.trim() ? raw.customerName.trim() : undefined) ||
      (compType === 'WORKER' && typeof raw.subjectWorkerName === 'string' && raw.subjectWorkerName.trim() ? raw.subjectWorkerName.trim() : undefined);

    const dirName = compType === 'WORKER'
      ? (getWorkerName(compUserId) || (raw.workerId ? getWorkerName(String(raw.workerId)) : undefined) || (raw.creatorUserId ? getWorkerName(String(raw.creatorUserId)) : undefined))
      : (getCustomerName(compUserId) || (raw.customerId ? getCustomerName(String(raw.customerId)) : undefined) || (raw.customerUserId ? getCustomerName(String(raw.customerUserId)) : undefined));

    const resolvedComplainantName = rawNameCandidate || dirName || (compType === 'WORKER' ? 'Worker' : 'Customer');

    if (rawNameCandidate) {
      if (compType === 'WORKER') {
        setWorkerName(compUserId, rawNameCandidate);
        if (raw.workerId) setWorkerName(String(raw.workerId), rawNameCandidate);
      } else {
        setCustomerName(compUserId, rawNameCandidate);
        if (raw.customerId) setCustomerName(String(raw.customerId), rawNameCandidate);
      }
    }

    const compPhone = getCustomerPhone(compUserId) || getWorkerPhone(compUserId) || raw.complainantPhone || raw.phone || (raw.complainantPhoneMasked && !String(raw.complainantPhoneMasked).includes('*') ? raw.complainantPhoneMasked : undefined);
    const cleanCompPhone = compPhone ? formatPhoneNumber(String(compPhone)) : undefined;

    return {
      id: String(raw.id || raw.ticketId || ''),
      etag: resolvedEtag,
      complainantId: compUserId,
      complainantName: resolvedComplainantName,
      complainantType: compType,
      complainantPhoneMasked: String(cleanCompPhone || raw.complainantPhoneMasked || '+91 98765 43210'),
    subjectWorkerId: raw.subjectWorkerId ? String(raw.subjectWorkerId) : undefined,
    subjectWorkerName: raw.subjectWorkerName ? String(raw.subjectWorkerName) : undefined,
    serviceCategory: categoryLabel,
    disputeCategory: (raw.disputeCategory as DisputeCategory) || 'OTHER',
    description: String(raw.description || raw.subject || 'Support Ticket'),
    bookingRef: raw.bookingId ? String(raw.bookingId) : raw.bookingRef ? String(raw.bookingRef) : undefined,
    priority: (raw.priority as SupportTicketDetail['priority']) || 'MEDIUM',
    slaStatus,
    slaRemainingText,
    assignedToStaffId: (raw.assignedToStaffId || raw.assigneeUserId) ? String(raw.assignedToStaffId || raw.assigneeUserId) : undefined,
    assignedToStaffName: (raw.assignedToStaffName || assignee?.name) ? String(raw.assignedToStaffName || assignee?.name) : undefined,
    status: (raw.status as SupportTicketDetail['status']) || 'OPEN',
    createdAt: String(raw.createdAt || 'Recent Intake'),
    caseNotes: allNotes,
    messages: mappedMessages,
  };
}

export class RealSupportRepository implements ISupportRepository {
  async getTickets(filter?: SupportFilterCriteria): Promise<PaginatedSupportTickets> {
    try {
      preloadCustomerPhones().catch(() => {});
      preloadWorkerPhones().catch(() => {});
      const params: Record<string, unknown> = {
        page: filter?.page || 1,
        limit: filter?.pageSize || 10,
      };

      if (filter?.status && filter.status !== 'ALL') {
        if (filter.status === 'CREATED' || filter.status === 'UNASSIGNED') {
          params.unassigned = true;
        } else if (filter.status === 'INVESTIGATION_PENDING') {
          params.status = 'IN_PROGRESS';
        } else if (filter.status === 'RESOLVED') {
          params.status = 'CLOSED';
        } else {
          params.status = filter.status;
        }
      }
      if (filter?.priority && filter.priority !== 'ALL') {
        params.priority = filter.priority;
      }
      if (filter?.assignedToUserId) {
        params.assignedToUserId = filter.assignedToUserId;
      }
      if (filter?.complainantType && filter.complainantType !== 'ALL') {
        params.creatorKind = filter.complainantType;
      }

      const res = await httpClient.get<{
        success: boolean;
        data: Record<string, unknown>[];
        meta?: { totalItems?: number; currentPage?: number; itemsPerPage?: number; totalPages?: number; total?: number; page?: number; limit?: number };
      }>('/admin/support/tickets', { params });

      const payload = res.data;
      const items = Array.isArray(payload.data) ? payload.data : [];
      let mapped = items.map((item) => mapBackendSupportTicketToDomain(item));

      if (filter?.searchTerm) {
        const q = filter.searchTerm.toLowerCase();
        mapped = mapped.filter(
          (t) =>
            t.id.toLowerCase().includes(q) ||
            t.complainantName.toLowerCase().includes(q) ||
            (t.subjectWorkerName && t.subjectWorkerName.toLowerCase().includes(q)) ||
            (t.bookingRef && t.bookingRef.toLowerCase().includes(q)) ||
            t.description.toLowerCase().includes(q) ||
            t.serviceCategory.toLowerCase().includes(q)
        );
      }

      // Authoritative population-level KPIs: to align Support Queue with Dashboard,
      // calculate queue summary metrics across the full ticket population rather than an incomplete page slice.
      let allRawTickets: Record<string, unknown>[] = items;
      const isFilteredOrPaged =
        Boolean(filter?.status && filter.status !== 'ALL') ||
        Boolean(filter?.priority && filter.priority !== 'ALL') ||
        Boolean(filter?.complainantType && filter.complainantType !== 'ALL') ||
        Boolean(filter?.assignedToUserId) ||
        Boolean(filter?.searchTerm) ||
        (filter?.pageSize && filter.pageSize < 100);

      if (isFilteredOrPaged) {
        try {
          const summaryRes = await httpClient.get<{
            success: boolean;
            data: Record<string, unknown>[];
            meta?: { total?: number; totalItems?: number };
          }>('/admin/support/tickets', { params: { limit: 100 } });
          if (Array.isArray(summaryRes.data?.data)) {
            allRawTickets = summaryRes.data.data;
          }
        } catch {
          allRawTickets = items;
        }
      }

      const now = Date.now();
      const slaAtRiskCount = allRawTickets.filter((t) => {
        if (t.status === 'CLOSED' || t.status === 'RESOLVED') return false;
        if (Boolean(t.slaBreachedAt) || t.slaStatus === 'BREACHED') return true;
        if (t.slaStatus === 'AT_RISK') return true;
        if (t.dueAt) {
          const dueMs = new Date(String(t.dueAt)).getTime();
          return !isNaN(dueMs) && (dueMs - now <= 24 * 3600 * 1000);
        }
        return false;
      }).length;

      const unassignedCount = allRawTickets.filter(
        (t) => !t.assignedToUserId && !t.assignedToStaffId && !t.assigneeUserId && t.status !== 'CLOSED' && t.status !== 'RESOLVED'
      ).length;

      const escalatedCount = allRawTickets.filter(
        (t) => t.status === 'ESCALATED' || t.status === 'REPLACEMENT_INITIATED' || Boolean(t.escalatedAt)
      ).length;

      const resolvedTodayCount = allRawTickets.filter(
        (t) => t.status === 'CLOSED' || t.status === 'RESOLVED' || Boolean(t.closedAt)
      ).length;

      const totalCount = payload.meta?.total ?? payload.meta?.totalItems ?? items.length;
      const page = payload.meta?.page ?? payload.meta?.currentPage ?? filter?.page ?? 1;
      const pageSize = payload.meta?.limit ?? payload.meta?.itemsPerPage ?? filter?.pageSize ?? 10;
      const totalPages = payload.meta?.totalPages ?? (Math.ceil(totalCount / pageSize) || 1);

      return {
        items: mapped,
        totalCount,
        page,
        pageSize,
        totalPages,
        slaAtRiskCount,
        unassignedCount,
        escalatedCount,
        resolvedTodayCount,
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

      const etagHeader = (res.headers['etag'] || res.headers.etag) as string | undefined;

      // also fetch messages
      try {
        const msgRes = await httpClient.get<{ success: boolean; data: { data?: Record<string, unknown>[] } | Record<string, unknown>[] }>(
          `/admin/support/tickets/${id}/messages`
        );
        raw.messages = Array.isArray(msgRes.data.data) ? msgRes.data.data : (msgRes.data.data as { data?: Record<string, unknown>[] })?.data;
      } catch {
        // preserve existing if messages fetch errors
      }

      return mapBackendSupportTicketToDomain(raw, etagHeader);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async claimTicket(
    ticketId: string,
    staffName?: string,
    etag?: string,
    options?: { assigneeUserId?: string; note?: string }
  ): Promise<void> {
    await this.assignTicket(ticketId, {
      assigneeUserId: options?.assigneeUserId,
      note: options?.note || (staffName ? `Assigned to ${staffName}` : undefined),
      etag,
    });
  }

  async assignTicket(
    ticketId: string,
    options: { assigneeUserId?: string; note?: string; etag?: string }
  ): Promise<void> {
    try {
      const body: Record<string, unknown> = {};
      if (options.assigneeUserId) {
        body.assigneeUserId = options.assigneeUserId;
      }
      if (options.note) {
        body.note = options.note;
      }
      if (options.etag) {
        await httpClient.post(`/admin/support/tickets/${ticketId}/assign`, body, {
          headers: { 'If-Match': options.etag },
        });
      } else {
        await httpClient.post(`/admin/support/tickets/${ticketId}/assign`, body);
      }
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async setPriority(ticketId: string, priority: 'LOW' | 'MEDIUM' | 'HIGH', etag?: string): Promise<void> {
    try {
      if (etag) {
        await httpClient.post(
          `/admin/support/tickets/${ticketId}/priority`,
          { priority },
          { headers: { 'If-Match': etag } }
        );
      } else {
        await httpClient.post(`/admin/support/tickets/${ticketId}/priority`, { priority });
      }
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getTicketMessages(ticketId: string): Promise<SupportMessage[]> {
    try {
      const res = await httpClient.get<{
        success?: boolean;
        data?: Record<string, unknown>[] | { data?: Record<string, unknown>[] };
      }>(`/admin/support/tickets/${ticketId}/messages`);

      const rawData = res.data;
      const items: Record<string, unknown>[] = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.data)
        ? rawData.data
        : Array.isArray((rawData?.data as { data?: Record<string, unknown>[] })?.data)
        ? (rawData?.data as { data?: Record<string, unknown>[] }).data!
        : [];

      return items.map((m) => ({
        id: String(m.id || `msg-${Math.random()}`),
        ticketId,
        from: (m.from as SupportMessage['from']) || (m.internal ? 'ADMIN' : 'CUSTOMER'),
        body: String(m.body || ''),
        createdAt: String(m.createdAt || new Date().toISOString()),
        authorUserId: String(m.authorUserId || ''),
        internal: Boolean(m.internal),
      }));
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async sendTicketMessage(
    ticketId: string,
    body: string,
    isInternal: boolean = false
  ): Promise<SupportMessage> {
    try {
      const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idem_msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      const res = await httpClient.post<Record<string, unknown>>(
        `/admin/support/tickets/${ticketId}/messages`,
        {
          body,
          internal: isInternal,
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      const m = res.data && typeof res.data === 'object' && 'data' in res.data
        ? (res.data as { data: Record<string, unknown> }).data
        : (res.data as Record<string, unknown>);

      return {
        id: String(m?.id || `msg-${Date.now()}`),
        ticketId,
        from: (m?.from as SupportMessage['from']) || 'ADMIN',
        body: String(m?.body || body),
        createdAt: String(m?.createdAt || new Date().toISOString()),
        authorUserId: String(m?.authorUserId || 'staff-current'),
        internal: Boolean(m?.internal ?? isInternal),
      };
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
    await this.sendTicketMessage(ticketId, noteText, true);
  }

  async resolveTicket(ticketId: string, resolutionSummary: string, etag?: string): Promise<void> {
    try {
      if (etag) {
        await httpClient.post(
          `/admin/support/tickets/${ticketId}/close`,
          { resolution: resolutionSummary },
          { headers: { 'If-Match': etag } }
        );
      } else {
        await httpClient.post(`/admin/support/tickets/${ticketId}/close`, { resolution: resolutionSummary });
      }
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async escalateToOperations(ticketId: string, rationale: string, etag?: string): Promise<void> {
    try {
      if (etag) {
        await httpClient.post(
          `/admin/support/tickets/${ticketId}/escalate`,
          { reason: rationale },
          { headers: { 'If-Match': etag } }
        );
      } else {
        await httpClient.post(`/admin/support/tickets/${ticketId}/escalate`, { reason: rationale });
      }
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async initiateReplacementHandoff(ticketId: string, remarks: string, etag?: string): Promise<void> {
    try {
      if (etag) {
        await httpClient.post(
          `/admin/support/tickets/${ticketId}/escalate`,
          { reason: `Replacement handoff: ${remarks}` },
          { headers: { 'If-Match': etag } }
        );
      } else {
        await httpClient.post(`/admin/support/tickets/${ticketId}/escalate`, {
          reason: `Replacement handoff: ${remarks}`,
        });
      }
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
