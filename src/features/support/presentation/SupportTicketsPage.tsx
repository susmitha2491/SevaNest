import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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

export const SupportTicketsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Filters & Search state
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const [selectedStatus, setSelectedStatus] = useState<string>(() => searchParams.get('status') || 'ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [selectedComplainantRole, setSelectedComplainantRole] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setSelectedStatus(statusParam);
    }
    const searchParam = searchParams.get('search');
    if (searchParam !== null) {
      setSearchTerm(searchParam);
    }
  }, [searchParams]);

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
    queryKey: ['support', 'tickets', searchTerm, selectedStatus, selectedPriority, selectedComplainantRole, currentPage],
    queryFn: () =>
      supportRepository.getTickets({
        searchTerm,
        status: selectedStatus,
        priority: selectedPriority,
        complainantType: selectedComplainantRole,
        page: currentPage,
        pageSize: 6,
      }),
    enabled: canView,
  });

  useEffect(() => {
    const ticketIdParam = searchParams.get('ticketId');
    if (ticketIdParam && supportData?.items && !isDetailOpen) {
      const match = supportData.items.find((t) => t.id === ticketIdParam);
      if (match) {
        setSelectedTicket(match);
        setIsDetailOpen(true);
      }
    }
  }, [searchParams, supportData, isDetailOpen]);

  const [staleError, setStaleError] = useState<string | null>(null);

  // Mutations
  const resolveMutation = useMutation({
    mutationFn: async ({ ticketId, remarks, etag }: { ticketId: string; remarks: string; etag?: string }) => {
      await supportRepository.resolveTicket(ticketId, remarks, etag);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support'] });
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
      setIsEscalateOpen(false);
      setSelectedTicket(null);
      setStaleError(null);
    },
    onError: (err: unknown) => {
      if (err instanceof ConcurrencyConflictError || (err as { statusCode?: number })?.statusCode === 412 || (err as { statusCode?: number })?.statusCode === 428) {
        setStaleError('Ticket was modified by another transaction (stale version). Data has been refreshed. Please retry escalation.');
        queryClient.invalidateQueries({ queryKey: ['support'] });
      }
    },
  });

  const replacementHandoffMutation = useMutation({
    mutationFn: async ({ ticketId, remarks, etag }: { ticketId: string; remarks: string; etag?: string }) => {
      await supportRepository.initiateReplacementHandoff(ticketId, remarks, etag);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support'] });
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Support Grievance & SLA Queue
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
            Mediate household service disputes, log call findings, manage SLA countdowns, and orchestrate Operations handoffs.
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

      {/* Top SLA Indicator Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
        <div
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
          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-warning-bg)', borderRadius: 'var(--radius-md)', color: 'var(--color-warning-dark)' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              SLA Impending Breach
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-warning-dark)' }}>
              {supportData?.slaAtRiskCount || 0}
            </div>
          </div>
        </div>

        <div
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
          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-brand-50)', borderRadius: 'var(--radius-md)', color: 'var(--color-brand-600)' }}>
            <Inbox size={24} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Unassigned Queue
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {supportData?.unassignedCount || 0}
            </div>
          </div>
        </div>

        <div
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
          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-error-bg)', borderRadius: 'var(--radius-md)', color: 'var(--color-error-dark)' }}>
            <ShieldAlert size={24} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Escalated to Operations
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-error-dark)' }}>
              {supportData?.escalatedCount || 0}
            </div>
          </div>
        </div>

        <div
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
          <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-success-bg)', borderRadius: 'var(--radius-md)', color: 'var(--color-success-dark)' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              Resolved Cases
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-success-dark)' }}>
              {supportData?.resolvedTodayCount || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        {/* Status Quick-Filter Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 'var(--space-1)' }}>
          {[
            { key: 'ALL', label: 'All Tickets' },
            { key: 'CREATED', label: 'Unassigned' },
            { key: 'INVESTIGATION_PENDING', label: 'In Investigation' },
            { key: 'ESCALATED', label: 'Escalated' },
            { key: 'RESOLVED', label: 'Resolved' },
          ].map((tab) => (
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

        {/* Search and Secondary Dropdowns */}
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
      </div>

      {/* Tickets Table */}
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
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Ticket ID
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Complainant
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Issue / Category
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Priority
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  SLA Status
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Ticket Status
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  Assigned Staff
                </th>
                <th style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {supportData?.items.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    No support tickets found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                supportData?.items.map((tkt) => (
                  <tr key={tkt.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {/* Ticket ID */}
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-brand-600)', fontFamily: 'monospace' }}>
                        {tkt.id}
                      </span>
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
                        {tkt.disputeCategory.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {tkt.serviceCategory} {tkt.bookingRef ? `• ${tkt.bookingRef}` : ''}
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

                    {/* Assigned Executive */}
                    <td style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                      {tkt.assignedToStaffName || <span style={{ fontStyle: 'italic', color: 'var(--color-warning-dark)' }}>Unassigned Queue</span>}
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
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedTicket(null);
        }}
        onOpenResolve={(tkt) => {
          setIsDetailOpen(false);
          setSelectedTicket(tkt);
          setIsResolveOpen(true);
        }}
        onOpenEscalate={(tkt) => {
          setIsDetailOpen(false);
          setSelectedTicket(tkt);
          setIsEscalateOpen(true);
        }}
        onOpenReplacement={(tkt) => {
          setIsDetailOpen(false);
          setSelectedTicket(tkt);
          setIsReplacementOpen(true);
        }}
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
