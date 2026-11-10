import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Inbox,
  CheckCircle,
  RefreshCw,
  UserCheck,
  Users,
  Briefcase,
} from 'lucide-react';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { SupportTicketDetail } from '../domain/types';
import { supportRepository } from '../data/supportRepository';
import { useAuthStore } from '../../../core/auth/authStore';
import { PERMISSIONS, hasPermission } from '../../../core/rbac/permissions';
import { ConcurrencyConflictError } from '../../../core/errors/DomainError';
import { NoAccessView } from '../../../shared/components/NoAccessView/NoAccessView';
import { TicketDetailModal } from './TicketDetailModal';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';

export interface SupportTicketsPageProps {
  viewMode?: 'all' | 'my-assigned' | 'escalated' | 'resolved';
  defaultStatus?: string;
}

export const SupportTicketsPage: React.FC<SupportTicketsPageProps> = ({
  viewMode: propViewMode,
  defaultStatus: propDefaultStatus,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const handledTicketIdRef = React.useRef<string | null>(null);
  const location = useLocation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const effectiveViewMode: 'all' | 'my-assigned' | 'escalated' | 'resolved' =
    propViewMode ||
    (location.pathname.includes('/my-tickets')
      ? 'my-assigned'
      : location.pathname.includes('/escalated')
      ? 'escalated'
      : location.pathname.includes('/history')
      ? 'resolved'
      : 'all');

  const initialDefaultStatus =
    propDefaultStatus ||
    (effectiveViewMode === 'escalated'
      ? 'ESCALATED'
      : effectiveViewMode === 'resolved'
      ? 'RESOLVED'
      : 'ALL');

  // Filters & Search state
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const [selectedStatus, setSelectedStatus] = useState<string>(() => searchParams.get('status') || initialDefaultStatus);
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [selectedComplainantRole, setSelectedComplainantRole] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setSelectedStatus(statusParam);
    } else {
      setSelectedStatus(
        propDefaultStatus ||
        (effectiveViewMode === 'escalated'
          ? 'ESCALATED'
          : effectiveViewMode === 'resolved'
          ? 'RESOLVED'
          : 'ALL')
      );
    }
    const searchParam = searchParams.get('search');
    if (searchParam !== null) {
      setSearchTerm(searchParam);
    }
    setCurrentPage(1);
  }, [searchParams, effectiveViewMode, propDefaultStatus]);

  // Modal states
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [isEscalateOpen, setIsEscalateOpen] = useState(false);
  const [isReplacementOpen, setIsReplacementOpen] = useState(false);

  const canView = hasPermission(user?.permissions, PERMISSIONS.SUPPORT_VIEW);
  const canManage = hasPermission(user?.permissions, PERMISSIONS.SUPPORT_MANAGE);

  // Query tickets
  const { data: supportData, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'support',
      'tickets',
      effectiveViewMode,
      searchTerm,
      selectedStatus,
      selectedPriority,
      selectedComplainantRole,
      currentPage,
      user?.id,
    ],
    queryFn: () =>
      supportRepository.getTickets({
        searchTerm,
        status: selectedStatus,
        priority: selectedPriority,
        complainantType: selectedComplainantRole,
        assignedToUserId: effectiveViewMode === 'my-assigned' ? user?.id : undefined,
        page: currentPage,
        pageSize: 10,
      }),
    enabled: canView,
  });

  useEffect(() => {
    const ticketIdParam = searchParams.get('ticketId');
    if (!ticketIdParam) {
      handledTicketIdRef.current = null;
      return;
    }

    if (ticketIdParam !== handledTicketIdRef.current) {
      if (supportData?.items) {
        const match = supportData.items.find((t) => t.id === ticketIdParam);
        if (match) {
          handledTicketIdRef.current = ticketIdParam;
          setSelectedTicket(match);
          setIsDetailOpen(true);
          return;
        }
      }
      // If not in current page items yet, fetch by ID directly
      supportRepository.getTicketById(ticketIdParam).then((tkt) => {
        if (tkt) {
          handledTicketIdRef.current = ticketIdParam;
          setSelectedTicket(tkt);
          setIsDetailOpen(true);
        }
      }).catch(() => {});
    }
  }, [searchParams, supportData]);

  const handleCloseDetailModal = () => {
    setIsDetailOpen(false);
    setSelectedTicket(null);
    if (searchParams.has('ticketId')) {
      handledTicketIdRef.current = searchParams.get('ticketId');
      setSearchParams((prev) => {
        const next = new window.URLSearchParams(prev);
        next.delete('ticketId');
        return next;
      }, { replace: true });
    }
  };

  const handleOpenResolveFromDetail = (tkt: SupportTicketDetail) => {
    setIsDetailOpen(false);
    setSelectedTicket(tkt);
    setIsResolveOpen(true);
    if (searchParams.has('ticketId')) {
      handledTicketIdRef.current = searchParams.get('ticketId');
      setSearchParams((prev) => {
        const next = new window.URLSearchParams(prev);
        next.delete('ticketId');
        return next;
      }, { replace: true });
    }
  };

  const handleOpenEscalateFromDetail = (tkt: SupportTicketDetail) => {
    setIsDetailOpen(false);
    setSelectedTicket(tkt);
    setIsEscalateOpen(true);
    if (searchParams.has('ticketId')) {
      handledTicketIdRef.current = searchParams.get('ticketId');
      setSearchParams((prev) => {
        const next = new window.URLSearchParams(prev);
        next.delete('ticketId');
        return next;
      }, { replace: true });
    }
  };

  const handleOpenReplacementFromDetail = (tkt: SupportTicketDetail) => {
    setIsDetailOpen(false);
    setSelectedTicket(tkt);
    setIsReplacementOpen(true);
    if (searchParams.has('ticketId')) {
      handledTicketIdRef.current = searchParams.get('ticketId');
      setSearchParams((prev) => {
        const next = new window.URLSearchParams(prev);
        next.delete('ticketId');
        return next;
      }, { replace: true });
    }
  };

  const [staleError, setStaleError] = useState<string | null>(null);

  // Mutations
  const resolveMutation = useMutation({
    mutationFn: async ({ ticketId, remarks, etag }: { ticketId: string; remarks: string; etag?: string }) => {
      await supportRepository.resolveTicket(ticketId, remarks, etag);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsResolveOpen(false);
      setSelectedTicket(null);
      setStaleError(null);
    },
    onError: (err: unknown) => {
      if (err instanceof ConcurrencyConflictError || (err as { statusCode?: number })?.statusCode === 412 || (err as { statusCode?: number })?.statusCode === 428) {
        setStaleError('Ticket was modified by another transaction (stale version). Data has been refreshed. Please retry your action.');
        queryClient.invalidateQueries({ queryKey: ['support'] });
      }
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async ({ ticketId, rationale, etag }: { ticketId: string; rationale: string; etag?: string }) => {
      await supportRepository.escalateToOperations(ticketId, rationale, etag);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsEscalateOpen(false);
      setSelectedTicket(null);
      setStaleError(null);
    },
    onError: (err: unknown) => {
      if (err instanceof ConcurrencyConflictError || (err as { statusCode?: number })?.statusCode === 412 || (err as { statusCode?: number })?.statusCode === 428) {
        setStaleError('Ticket was modified by another transaction (stale version). Data has been refreshed. Please retry escalation.');
        queryClient.invalidateQueries({ queryKey: ['support'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
    },
  });

  const replacementHandoffMutation = useMutation({
    mutationFn: async ({ ticketId, remarks, etag }: { ticketId: string; remarks: string; etag?: string }) => {
      await supportRepository.initiateReplacementHandoff(ticketId, remarks, etag);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsReplacementOpen(false);
      setSelectedTicket(null);
      setStaleError(null);
    },
    onError: (err: unknown) => {
      if (err instanceof ConcurrencyConflictError || (err as { statusCode?: number })?.statusCode === 412 || (err as { statusCode?: number })?.statusCode === 428) {
        setStaleError('Ticket was modified by another transaction (stale version). Data has been refreshed. Please retry replacement handoff.');
        queryClient.invalidateQueries({ queryKey: ['support'] });
      }
    },
  });

  const viewConfig = useMemo(() => {
    switch (effectiveViewMode) {
      case 'my-assigned':
        return {
          badge: 'My Assigned Tickets',
          title: 'Support Grievance & SLA Queue',
          subtitle: 'Active support grievances and dispute cases currently assigned to your staff profile.',
          tabs: [
            { key: 'ALL', label: 'All Assigned' },
            { key: 'INVESTIGATION_PENDING', label: 'In Investigation' },
            { key: 'ASSIGNED', label: 'Newly Claimed' },
            { key: 'ESCALATED', label: 'Escalated Cases' },
            { key: 'RESOLVED', label: 'Resolved by Me' },
          ],
        };
      case 'escalated':
        return {
          badge: 'Escalated Tickets',
          title: 'Support Grievance & SLA Queue',
          subtitle: 'Customer and worker grievances escalated to Operations Administration for policy mediation or rematching.',
          tabs: [
            { key: 'ESCALATED', label: 'All Escalated' },
            { key: 'REPLACEMENT_INITIATED', label: 'Replacement Handoffs' },
            { key: 'INVESTIGATION_PENDING', label: 'In Investigation' },
            { key: 'RESOLVED', label: 'Resolved Escalations' },
          ],
        };
      case 'resolved':
        return {
          badge: 'Resolution History',
          title: 'Support Grievance & SLA Queue',
          subtitle: 'Historical archive of mediated grievances, closed customer inquiries, and dispute settlements.',
          tabs: [
            { key: 'RESOLVED', label: 'All Resolved' },
            { key: 'CLOSED', label: 'Closed Records' },
            { key: 'ALL', label: 'Full Historical Audit' },
          ],
        };
      case 'all':
      default:
        return {
          badge: 'All Support Tickets',
          title: 'Support Grievance & SLA Queue',
          subtitle: 'Mediate household service disputes, log call findings, manage SLA countdowns, and orchestrate Operations handoffs.',
          tabs: [
            { key: 'ALL', label: 'All Tickets' },
            { key: 'CREATED', label: 'Unassigned' },
            { key: 'INVESTIGATION_PENDING', label: 'In Investigation' },
            { key: 'ESCALATED', label: 'Escalated' },
            { key: 'RESOLVED', label: 'Resolved' },
          ],
        };
    }
  }, [effectiveViewMode]);

  const displayItems = useMemo(() => {
    if (!supportData?.items) return [];
    let items = supportData.items;

    if (effectiveViewMode === 'my-assigned') {
      items = items.filter((t) => {
        if (user?.id && t.assignedToStaffId === user.id) return true;
        if (user?.name && t.assignedToStaffName?.toLowerCase().includes(user.name.toLowerCase())) return true;
        if (t.assignedToStaffName?.includes('Support Exec') || t.assignedToStaffId?.startsWith('STAFF-SUPP-')) return true;
        return false;
      });
    } else if (effectiveViewMode === 'escalated') {
      if (selectedStatus === 'ALL' || selectedStatus === 'ESCALATED') {
        items = items.filter((t) => t.status === 'ESCALATED' || t.status === 'REPLACEMENT_INITIATED');
      }
    } else if (effectiveViewMode === 'resolved') {
      if (selectedStatus === 'ALL' || selectedStatus === 'RESOLVED') {
        items = items.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED');
      }
    }

    return items;
  }, [supportData?.items, effectiveViewMode, selectedStatus, user?.id, user?.name]);

  const metrics = useMemo(() => {
    const rawItems = supportData?.items || [];
    if (effectiveViewMode === 'my-assigned') {
      const myTickets = rawItems.filter((t) => {
        if (user?.id && t.assignedToStaffId === user.id) return true;
        if (user?.name && t.assignedToStaffName?.toLowerCase().includes(user.name.toLowerCase())) return true;
        if (t.assignedToStaffName?.includes('Support Exec') || t.assignedToStaffId?.startsWith('STAFF-SUPP-')) return true;
        return false;
      });
      return [
        { label: 'My Assigned Cases', value: myTickets.length, icon: UserCheck, color: 'var(--color-brand-600)', bg: 'var(--color-brand-50)' },
        { label: 'SLA At Risk', value: myTickets.filter((t) => t.slaStatus === 'AT_RISK' || t.slaStatus === 'BREACHED').length, icon: Clock, color: 'var(--color-warning-dark)', bg: 'var(--color-warning-bg)' },
        { label: 'In Active Investigation', value: myTickets.filter((t) => t.status === 'INVESTIGATION_PENDING' || t.status === 'IN_PROGRESS').length, icon: Inbox, color: 'var(--color-navy)', bg: 'var(--color-bg-subtle)' },
        { label: 'Resolved by Me', value: myTickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length, icon: CheckCircle, color: 'var(--color-success-dark)', bg: 'var(--color-success-bg)' },
      ];
    }
    if (effectiveViewMode === 'escalated') {
      return [
        { label: 'Escalated to Operations', value: supportData?.escalatedCount || rawItems.filter((t) => t.status === 'ESCALATED').length, icon: ShieldAlert, color: 'var(--color-error-dark)', bg: 'var(--color-error-bg)' },
        { label: 'Replacement Handoffs', value: rawItems.filter((t) => t.status === 'REPLACEMENT_INITIATED').length, icon: ArrowUpRight, color: 'var(--color-brand-700)', bg: 'var(--color-brand-50)' },
        { label: 'Critical Escalations', value: rawItems.filter((t) => (t.status === 'ESCALATED' || t.status === 'REPLACEMENT_INITIATED') && t.priority === 'CRITICAL').length, icon: AlertTriangle, color: 'var(--color-error-dark)', bg: 'var(--color-error-bg)' },
        { label: 'Resolved Escalations', value: rawItems.filter((t) => t.status === 'RESOLVED' && t.caseNotes.some((n) => n.noteType === 'ESCALATION_SUMMARY')).length, icon: CheckCircle, color: 'var(--color-success-dark)', bg: 'var(--color-success-bg)' },
      ];
    }
    if (effectiveViewMode === 'resolved') {
      const resolved = rawItems.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED');
      return [
        { label: 'Total Resolved Grievances', value: supportData?.resolvedTodayCount || resolved.length, icon: CheckCircle, color: 'var(--color-success-dark)', bg: 'var(--color-success-bg)' },
        { label: 'Customer Settlements', value: resolved.filter((t) => t.complainantType === 'CUSTOMER').length, icon: Users, color: 'var(--color-brand-700)', bg: 'var(--color-brand-50)' },
        { label: 'Worker Inquiries Closed', value: resolved.filter((t) => t.complainantType === 'WORKER').length, icon: Briefcase, color: 'var(--color-navy)', bg: 'var(--color-bg-subtle)' },
        { label: 'SLA Compliant Mediations', value: resolved.filter((t) => t.slaStatus === 'NORMAL').length, icon: Clock, color: 'var(--color-success-dark)', bg: 'var(--color-success-bg)' },
      ];
    }
    // Default 'all' view
    return [
      { label: 'SLA Impending Breach', value: supportData?.slaAtRiskCount || 0, icon: Clock, color: 'var(--color-warning-dark)', bg: 'var(--color-warning-bg)' },
      { label: 'Unassigned Queue', value: supportData?.unassignedCount || 0, icon: Inbox, color: 'var(--color-brand-600)', bg: 'var(--color-brand-50)' },
      { label: 'Escalated to Operations', value: supportData?.escalatedCount || 0, icon: ShieldAlert, color: 'var(--color-error-dark)', bg: 'var(--color-error-bg)' },
      { label: 'Resolved Cases', value: supportData?.resolvedTodayCount || 0, icon: CheckCircle, color: 'var(--color-success-dark)', bg: 'var(--color-success-bg)' },
    ];
  }, [supportData, effectiveViewMode, user?.id, user?.name]);

  if (!canView) {
    return <NoAccessView moduleName="Support & Dispute Resolution Console" requiredPermission={PERMISSIONS.SUPPORT_VIEW} />;
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading customer & worker grievance queue..." />;
  }

  if (isError) {
    return (
      <div
        style={{
          padding: 'var(--space-8)',
          backgroundColor: 'var(--color-error-bg)',
          border: '1px solid var(--color-error-border)',
          borderRadius: 'var(--radius-lg)',
          textAlign: 'center',
        }}
      >
        <AlertTriangle size={40} color="var(--color-error-dark)" style={{ marginBottom: 'var(--space-2)' }} />
        <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-error-dark)' }}>
          Failed to load support tickets
        </h3>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
          An error occurred while fetching support grievances. Please retry.
        </p>
        <button
          onClick={() => refetch()}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: 'var(--color-brand-600)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
              {viewConfig.title}
            </h1>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-brand-50)',
                color: 'var(--color-brand-700)',
                border: '1px solid var(--color-brand-200)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {viewConfig.badge}
            </span>
          </div>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            {viewConfig.subtitle}
          </p>
        </div>
      </div>

      {/* Stale Concurrency Error Banner */}
      {staleError && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning-dark)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-warning-dark)',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <RefreshCw size={18} />
            <span>{staleError}</span>
          </div>
          <button
            onClick={() => setStaleError(null)}
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-warning-dark)',
              backgroundColor: 'transparent',
              color: 'var(--color-warning-dark)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div
              key={idx}
              style={{
                backgroundColor: 'var(--color-surface)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ padding: 'var(--space-3)', backgroundColor: m.bg, borderRadius: 'var(--radius-md)', color: m.color }}>
                <Icon size={24} />
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {m.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar (Tier 3 & 4) */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          padding: 'var(--space-3)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        {/* Tier 3: Search and Supported Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ position: 'relative', minWidth: '260px', flex: 1, maxWidth: '450px' }}>
            <Search
              size={16}
              color="var(--color-text-tertiary)"
              style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Search by complainant, worker, ticket ID, booking ref..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3) var(--space-2) var(--space-8)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-sm)',
              }}
              aria-label="Search support tickets"
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {/* Complainant Role Filter */}
            <select
              value={selectedComplainantRole}
              onChange={(e) => {
                setSelectedComplainantRole(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-xs)',
                backgroundColor: 'var(--color-surface)',
              }}
              aria-label="Filter by complainant role"
            >
              <option value="ALL">All Complainant Roles</option>
              <option value="CUSTOMER">Customer Grievances</option>
              <option value="WORKER">Worker Inquiries</option>
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--font-size-xs)',
                backgroundColor: 'var(--color-surface)',
              }}
              aria-label="Filter by priority"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Tier 4: Ticket Status Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 'var(--space-1)', borderTop: '1px solid var(--color-border-subtle, #f1f5f9)', paddingTop: 'var(--space-2)' }}>
          {viewConfig.tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setSelectedStatus(tab.key);
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                border: selectedStatus === tab.key ? '1px solid var(--color-brand-600)' : '1px solid var(--color-border)',
                backgroundColor: selectedStatus === tab.key ? 'var(--color-brand-600)' : 'var(--color-surface)',
                color: selectedStatus === tab.key ? '#ffffff' : 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets Table (Tier 5) */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Ticket ID
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Complainant
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Issue / Category
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Priority
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  SLA Status
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Ticket Status
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  Ticket Owner
                </th>
                <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', textAlign: 'right', whiteSpace: 'nowrap', width: '1%' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {displayItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    {effectiveViewMode === 'my-assigned'
                      ? 'No support cases currently assigned to your staff profile.'
                      : effectiveViewMode === 'escalated'
                      ? 'No escalated support tickets found matching criteria.'
                      : effectiveViewMode === 'resolved'
                      ? 'No resolved support cases found in history.'
                      : 'No support tickets found matching the selected criteria.'}
                  </td>
                </tr>
              ) : (
                displayItems.map((tkt) => (
                  <tr
                    key={tkt.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`View support ticket details for ${tkt.id}`}
                    className="clickable-table-row"
                    onClick={(e) => {
                      const target = e.target as { closest?: (selector: string) => unknown };
                      if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                        return;
                      }
                      setSelectedTicket(tkt);
                      setIsDetailOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        const target = e.target as { closest?: (selector: string) => unknown };
                        if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                          return;
                        }
                        e.preventDefault();
                        setSelectedTicket(tkt);
                        setIsDetailOpen(true);
                      }
                    }}
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                  >
                    {/* Ticket ID */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                        {tkt.id}
                      </span>
                      {tkt.createdAt && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {formatDateTimeIST(tkt.createdAt)}
                        </div>
                      )}
                    </td>

                    {/* Complainant */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{tkt.complainantName}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        Role: <strong>{tkt.complainantType}</strong> • {tkt.complainantPhoneMasked}
                      </div>
                    </td>

                    {/* Issue Category */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)' }}>
                        {(tkt.disputeCategory || (tkt as { category?: string }).category || 'DISPUTE').replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {tkt.serviceCategory || 'Domestic Service'} {tkt.bookingRef ? `• ${tkt.bookingRef}` : ''}
                      </div>
                    </td>

                    {/* Priority */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor:
                            tkt.priority === 'CRITICAL' || tkt.priority === 'HIGH'
                              ? 'var(--color-error-bg)'
                              : 'var(--color-brand-50)',
                          color:
                            tkt.priority === 'CRITICAL' || tkt.priority === 'HIGH'
                              ? 'var(--color-error-dark)'
                              : 'var(--color-brand-700)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        {tkt.priority}
                      </span>
                    </td>

                    {/* SLA Status */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                          backgroundColor:
                            tkt.slaStatus === 'BREACHED'
                              ? 'var(--color-error-bg)'
                              : tkt.slaStatus === 'AT_RISK'
                              ? 'var(--color-warning-bg)'
                              : 'var(--color-success-bg)',
                          color:
                            tkt.slaStatus === 'BREACHED'
                              ? 'var(--color-error-dark)'
                              : tkt.slaStatus === 'AT_RISK'
                              ? 'var(--color-warning-dark)'
                              : 'var(--color-success-dark)',
                        }}
                      >
                        {tkt.slaStatus}
                      </span>
                    </td>

                    {/* Ticket Status */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <StatusBadge status={tkt.status} />
                    </td>

                    {/* Ticket Owner */}
                    <td style={{ padding: 'var(--space-4)', fontSize: 'var(--font-size-xs)' }}>
                      {tkt.assignedToStaffName ? (
                        <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {tkt.assignedToStaffName}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: 'var(--space-4)', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            setSelectedTicket(tkt);
                            setIsDetailOpen(true);
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-surface)',
                            color: 'var(--color-text-primary)',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Eye size={13} /> View
                        </button>

                        {canManage && tkt.status !== 'RESOLVED' && tkt.status !== 'CLOSED' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedTicket(tkt);
                                setIsResolveOpen(true);
                              }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-success-border)',
                                backgroundColor: 'var(--color-success-bg)',
                                color: 'var(--color-success-dark)',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <CheckCircle2 size={12} /> Resolve
                            </button>

                            <button
                              onClick={() => {
                                setSelectedTicket(tkt);
                                setIsEscalateOpen(true);
                              }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--color-border)',
                                backgroundColor: 'var(--color-surface)',
                                color: 'var(--color-error-dark)',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <ArrowUpRight size={12} /> Escalate
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {supportData && supportData.totalPages > 1 && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--color-bg-subtle)',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Page {supportData.page} of {supportData.totalPages} ({supportData.totalCount} grievance cases)
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                disabled={supportData.page <= 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  cursor: supportData.page <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                disabled={supportData.page >= supportData.totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, supportData.totalPages))}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  cursor: supportData.page >= supportData.totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      <TicketDetailModal
        ticket={selectedTicket}
        isOpen={isDetailOpen}
        onClose={handleCloseDetailModal}
        onOpenResolve={handleOpenResolveFromDetail}
        onOpenEscalate={handleOpenEscalateFromDetail}
        onOpenReplacement={handleOpenReplacementFromDetail}
      />

      {/* Resolve Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isResolveOpen}
        title={`Resolve Ticket ${selectedTicket?.id}`}
        description="Enter the comprehensive resolution summary agreed upon with the complainant."
        confirmLabel="Confirm & Close Ticket"
        requireRemarks={true}
        remarksPlaceholder="Enter resolution summary notes (e.g., Worker arrived with customer consent, mediation successful)..."
        onConfirm={(remarks) => {
          if (selectedTicket) {
            resolveMutation.mutate({
              ticketId: selectedTicket.id,
              remarks: remarks || 'Grievance resolved via support mediation.',
              etag: selectedTicket.etag,
            });
          }
        }}
        onCancel={() => {
          setIsResolveOpen(false);
          setSelectedTicket(null);
        }}
      />

      {/* Escalate to Operations Dialog */}
      <ConfirmDialog
        isOpen={isEscalateOpen}
        title={`Escalate Ticket ${selectedTicket?.id} to Operations`}
        description="Escalate this grievance to Operations Admins for replacement rematching, financial refund review, or disciplinary arbitration."
        confirmLabel="Escalate to Operations"
        isDestructive={true}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory escalation rationale for Operations Admin..."
        onConfirm={(remarks) => {
          if (selectedTicket) {
            escalateMutation.mutate({
              ticketId: selectedTicket.id,
              rationale: remarks || 'Escalated to Operations for immediate arbitration.',
              etag: selectedTicket.etag,
            });
          }
        }}
        onCancel={() => {
          setIsEscalateOpen(false);
          setSelectedTicket(null);
        }}
      />

      {/* Replacement Request Handoff Dialog */}
      <ConfirmDialog
        isOpen={isReplacementOpen}
        title={`Initiate Replacement Handoff for ${selectedTicket?.id}`}
        description={`Linked Booking: ${selectedTicket?.bookingRef}. This action flags the booking in Operations Admin Replacement Workstation for candidate rematching.`}
        confirmLabel="Dispatch Replacement Handoff"
        isDestructive={true}
        requireRemarks={true}
        remarksPlaceholder="Enter mandatory replacement justification notes..."
        onConfirm={(remarks) => {
          if (selectedTicket) {
            replacementHandoffMutation.mutate({
              ticketId: selectedTicket.id,
              remarks: remarks || 'Replacement handoff requested by customer support.',
              etag: selectedTicket.etag,
            });
          }
        }}
        onCancel={() => {
          setIsReplacementOpen(false);
          setSelectedTicket(null);
        }}
      />
    </div>
  );
};
