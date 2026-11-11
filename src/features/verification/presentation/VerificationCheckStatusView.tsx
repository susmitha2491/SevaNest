import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  ShieldCheck,
  CheckCircle2,
  Phone,
  Home,
  UserCheck,
  Briefcase,
  RefreshCw,
  Eye,
  Lock,
} from 'lucide-react';
import { verificationRepository } from '../data/verificationRepository';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { SearchInput } from '../../../components/common/SearchInput';

export interface VerificationCheckStatusViewProps {
  onSelectDossier: (dossierId: string) => void;
}

export const VerificationCheckStatusView: React.FC<VerificationCheckStatusViewProps> = ({
  onSelectDossier,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 400);

  const { data: queueData, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['verification', 'check-status-overview', debouncedSearchTerm],
    queryFn: () =>
      verificationRepository.getVerificationQueue({
        searchTerm: debouncedSearchTerm.trim() || undefined,
        page: 1,
        pageSize: 25,
      }),
    placeholderData: keepPreviousData,
  });

  const items = queueData?.items || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* 6-Point Verification Architecture Overview Cards */}
      <div>
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-navy)' }}>
            Configured 6-Point Verification Check Types
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            Authoritative verification workflow consisting of 1 automated onboarding pre-check + 5 operations trust checks.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          {/* 1. Mobile OTP Pre-Check */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              borderLeft: '4px solid var(--color-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
              <Phone size={16} color="var(--color-primary)" />
              <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                1. Mobile OTP Pre-Check
              </strong>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              <strong>Type:</strong> <code>MOBILE_OTP</code> • <strong>Source:</strong> Telecom SMS Gateway
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Automated pre-check completed during registration. Required for application submission.
            </div>
          </div>

          {/* 2. Identity Verification */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              borderLeft: '4px solid var(--color-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
              <UserCheck size={16} color="var(--color-primary)" />
              <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                2. Identity Verification
              </strong>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              <strong>Type:</strong> <code>IDENTITY</code> • <strong>Source:</strong> Aadhaar / Voter ID / Passport
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Visual document inspection. Masked ID (XXXX-XXXX-1234) with photo clarity match.
            </div>
          </div>

          {/* 3. Address Proof Verification */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              borderLeft: '4px solid var(--color-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
              <Home size={16} color="var(--color-primary)" />
              <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                3. Address Proof Check
              </strong>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              <strong>Type:</strong> <code>ADDRESS</code> • <strong>Source:</strong> Utility Bill / Rent Agreement
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Residential locality matching against declared operational service cluster.
            </div>
          </div>

          {/* 4. Emergency Contact Vetting */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              borderLeft: '4px solid var(--color-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
              <Phone size={16} color="var(--color-primary)" />
              <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                4. Emergency Contact Vetting
              </strong>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              <strong>Type:</strong> <code>EMERGENCY_CONTACT</code> • <strong>Source:</strong> Declared Family Kin
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Telephonic call vetting to confirm kin relationship and residential awareness.
            </div>
          </div>

          {/* 5. Employer Reference Vetting */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              borderLeft: '4px solid var(--color-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
              <Briefcase size={16} color="var(--color-primary)" />
              <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                5. Employer Reference Vetting
              </strong>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              <strong>Type:</strong> <code>REFERENCE</code> • <strong>Source:</strong> Prior Domestic Employer
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Telephonic reference vetting. Requires recording mandatory call notes before approval.
            </div>
          </div>

          {/* 6. Police Clearance Certificate */}
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              borderLeft: '4px solid var(--color-primary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
              <ShieldCheck size={16} color="var(--color-primary)" />
              <strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
                6. Police Clearance Certificate
              </strong>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              <strong>Type:</strong> <code>POLICE_CLEARANCE</code> • <strong>Source:</strong> Police Clearance Cert
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Official background certificate inspection with reference number & annual expiry tracking.
            </div>
          </div>
        </div>
      </div>

      {/* Backend D-90 Governance Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)',
          backgroundColor: 'var(--color-bg-subtle)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
        }}
      >
        <Lock size={18} color="var(--color-primary)" style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ color: 'var(--color-text-primary)' }}>Backend D-90 Authority:</strong> A worker is
          considered fully verified only when the backend confirms all configured required checks have been approved (
          <code>level = "VERIFIED"</code>). Verification Executives evaluate individual checks; final worker
          application sign-off and commercial activation are restricted to Operations Admin and Super Admin.
        </div>
      </div>

      {/* Check Status Matrix Search and Table */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <CheckCircle2 size={18} color="var(--color-primary)" />
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-navy)', margin: 0 }}>
              Discrete Check Status Matrix
            </h3>
          </div>
          <SearchInput
            value={searchTerm}
            onChange={(val) => setSearchTerm(val)}
            placeholder="Search check status by worker name or ID..."
            ariaLabel="Search check status"
            isLoading={isFetching && debouncedSearchTerm.trim().length > 0}
            containerStyle={{ flex: '1 1 240px', minWidth: 'min(100%, 200px)' }}
            maxWidth="320px"
          />
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: isFetching ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            <span>Refresh Status</span>
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: 'var(--space-8)' }}>
            <LoadingSpinner message="Loading verification check statuses..." />
          </div>
        ) : isError ? (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-error)' }}>
            Failed to load check statuses: {(error as Error)?.message || 'Service unavailable'}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            <CheckCircle2 size={36} color="var(--color-brand-600)" style={{ marginBottom: '8px' }} />
            <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>No verification check records found</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-xs)' }}>
              <thead style={{ backgroundColor: 'var(--color-bg-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                <tr>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Worker Application</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Overall Level</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Mobile OTP</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Identity</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Address</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Emergency Contact</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Employer Reference</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Police Clearance</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--color-text-secondary)', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const targetWorkerId = item.workerId || item.id;
                  const isPendingCheck = (type: string) =>
                    Array.isArray(item.pendingChecks) &&
                    item.pendingChecks.some((t: string) => t.toUpperCase().includes(type.toUpperCase()));

                  return (
                    <tr
                      key={item.id}
                      tabIndex={0}
                      role="button"
                      aria-label={`Inspect checks for ${item.workerName}`}
                      className="clickable-table-row"
                      onClick={(e) => {
                        const target = e.target as { closest?: (selector: string) => unknown };
                        if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                          return;
                        }
                        onSelectDossier(targetWorkerId);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          const target = e.target as { closest?: (selector: string) => unknown };
                          if (target?.closest && target.closest('button, a, input, select, textarea') && target !== e.currentTarget) {
                            return;
                          }
                          e.preventDefault();
                          onSelectDossier(targetWorkerId);
                        }
                      }}
                      style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{item.workerName}</div>
                        <div style={{ fontFamily: 'monospace', color: 'var(--color-brand-600)', fontSize: '11px' }}>
                          {item.workerId} • {item.category}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge status={item.status} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--color-status-success-bg, #ecfdf5)',
                            color: 'var(--color-status-success-text, #065f46)',
                            fontWeight: 600,
                            fontSize: '10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <CheckCircle2 size={10} />
                          <span>Passed</span>
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isPendingCheck('IDENTITY') || isPendingCheck('AADHAAR')
                              ? 'var(--color-warning-bg, #fef3c7)'
                              : 'var(--color-status-success-bg, #ecfdf5)',
                            color: isPendingCheck('IDENTITY') || isPendingCheck('AADHAAR')
                              ? 'var(--color-warning-text, #92400e)'
                              : 'var(--color-status-success-text, #065f46)',
                            fontWeight: 600,
                            fontSize: '10px',
                          }}
                        >
                          {isPendingCheck('IDENTITY') || isPendingCheck('AADHAAR') ? 'Pending Review' : 'Verified'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isPendingCheck('ADDRESS')
                              ? 'var(--color-warning-bg, #fef3c7)'
                              : 'var(--color-status-success-bg, #ecfdf5)',
                            color: isPendingCheck('ADDRESS')
                              ? 'var(--color-warning-text, #92400e)'
                              : 'var(--color-status-success-text, #065f46)',
                            fontWeight: 600,
                            fontSize: '10px',
                          }}
                        >
                          {isPendingCheck('ADDRESS') ? 'Pending Review' : 'Verified'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isPendingCheck('EMERGENCY')
                              ? 'var(--color-warning-bg, #fef3c7)'
                              : 'var(--color-status-success-bg, #ecfdf5)',
                            color: isPendingCheck('EMERGENCY')
                              ? 'var(--color-warning-text, #92400e)'
                              : 'var(--color-status-success-text, #065f46)',
                            fontWeight: 600,
                            fontSize: '10px',
                          }}
                        >
                          {isPendingCheck('EMERGENCY') ? 'Call Vetting Due' : 'Verified'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isPendingCheck('REFERENCE') || isPendingCheck('EMPLOY')
                              ? 'var(--color-warning-bg, #fef3c7)'
                              : 'var(--color-status-success-bg, #ecfdf5)',
                            color: isPendingCheck('REFERENCE') || isPendingCheck('EMPLOY')
                              ? 'var(--color-warning-text, #92400e)'
                              : 'var(--color-status-success-text, #065f46)',
                            fontWeight: 600,
                            fontSize: '10px',
                          }}
                        >
                          {isPendingCheck('REFERENCE') || isPendingCheck('EMPLOY') ? 'Call Vetting Due' : 'Verified'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isPendingCheck('POLICE')
                              ? 'var(--color-warning-bg, #fef3c7)'
                              : 'var(--color-status-success-bg, #ecfdf5)',
                            color: isPendingCheck('POLICE')
                              ? 'var(--color-warning-text, #92400e)'
                              : 'var(--color-status-success-text, #065f46)',
                            fontWeight: 600,
                            fontSize: '10px',
                          }}
                        >
                          {isPendingCheck('POLICE') ? 'Pending Clearance' : 'Clear'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => onSelectDossier(targetWorkerId)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-primary)',
                            backgroundColor: 'var(--color-primary-subtle)',
                            color: 'var(--color-primary)',
                            fontWeight: 600,
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Eye size={12} />
                          <span>Inspect Checks</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
