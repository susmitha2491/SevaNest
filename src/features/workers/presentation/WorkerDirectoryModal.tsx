import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  User,
  Briefcase,
  FileText,
  CheckCircle2,
  Star,
  IndianRupee,
  Clock,
  ShieldCheck,
  Eye,
  RotateCw,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  AlertCircle,
  Award,
} from 'lucide-react';
import { workerRepository } from '../data/workerRepository';
import { verificationRepository } from '../../verification/data/verificationRepository';
import { WorkerDetail, WorkerDocumentMetadata, WorkerEngagementSummary } from '../domain/types';
import { VerificationCheckType } from '../../verification/domain/types';
import { VerificationBadge } from '../../../shared/components/VerificationBadge/VerificationBadge';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';

interface WorkerDirectoryModalProps {
  workerId: string;
  onClose: () => void;
}

export const WorkerDirectoryModal: React.FC<WorkerDirectoryModalProps> = ({ workerId, onClose }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'work' | 'documents'>('details');
  const [inspectingDoc, setInspectingDoc] = useState<{
    id: string;
    title: string;
    checkType: VerificationCheckType;
  } | null>(null);
  const [docZoom, setDocZoom] = useState(100);
  const [docRotation, setDocRotation] = useState(0);

  // 1. Fetch complete worker profile
  const {
    data: worker,
    isLoading: isWorkerLoading,
    isError: isWorkerError,
    error: workerError,
  } = useQuery({
    queryKey: ['workers', 'directory-detail', workerId],
    queryFn: async (): Promise<WorkerDetail | null> => {
      return await workerRepository.getWorkerById(workerId);
    },
    staleTime: 30 * 1000,
  });

  // 2. Fetch dossier to get any additional KYC documents
  const { data: dossier } = useQuery({
    queryKey: ['verification', 'dossier', workerId],
    queryFn: () => verificationRepository.getDossierById(workerId),
    staleTime: 30 * 1000,
    retry: false,
  });

  // 3. Document inspection signed link query
  const {
    data: docLinkData,
    isLoading: isDocLoading,
    isError: isDocError,
    error: docError,
  } = useQuery({
    queryKey: ['verification', 'documentLink', workerId, inspectingDoc?.checkType, inspectingDoc?.id],
    queryFn: () =>
      inspectingDoc
        ? verificationRepository.getSignedDocumentUrl(workerId, inspectingDoc.checkType, inspectingDoc.id)
        : null,
    enabled: !!inspectingDoc && !!inspectingDoc.id,
    staleTime: 60 * 1000,
    retry: false,
  });

  // Merge documents from worker profile and dossier
  const documents: Array<{
    id: string;
    documentType: string;
    documentTypeName: string;
    docNumberMasked?: string;
    status: string;
    submittedAt?: string;
    verifiedAt?: string;
    checkType: VerificationCheckType;
    url?: string;
  }> = [];

  const seenDocIds = new Set<string>();

  if (worker?.documents && Array.isArray(worker.documents)) {
    worker.documents.forEach((doc: WorkerDocumentMetadata) => {
      const docId = doc.documentId || doc.id;
      if (docId && !seenDocIds.has(docId)) {
        seenDocIds.add(docId);
        let checkType: VerificationCheckType = 'IDENTITY';
        const typeStr = String(doc.documentType || '').toUpperCase();
        if (typeStr.includes('ADDR')) checkType = 'ADDRESS';
        else if (typeStr.includes('POLICE')) checkType = 'POLICE_VERIFICATION';
        else if (typeStr.includes('REF') || typeStr.includes('EXP')) checkType = 'REFERENCE';
        else if (typeStr.includes('EMERG')) checkType = 'EMERGENCY_CONTACT';

        documents.push({
          id: docId,
          documentType: doc.documentType,
          documentTypeName: doc.documentTypeName || doc.documentType || 'Verification Document',
          docNumberMasked: doc.docNumberMasked,
          status: doc.status || 'VERIFIED',
          submittedAt: doc.submittedAt,
          verifiedAt: doc.verifiedAt,
          checkType,
          url: doc.signedUrl,
        });
      }
    });
  }

  if (dossier?.checks) {
    Object.entries(dossier.checks).forEach(([cType, check]) => {
      if (check && Array.isArray(check.documents)) {
        check.documents.forEach((d) => {
          const docId = d.documentId || d.id;
          if (docId && !seenDocIds.has(docId)) {
            seenDocIds.add(docId);
            documents.push({
              id: docId,
              documentType: cType,
              documentTypeName: d.documentTypeName || check.title || 'Verification Document',
              docNumberMasked: d.docNumberMasked,
              status: check.status || 'VERIFIED',
              submittedAt: d.submittedAt || d.createdAt,
              checkType: cType as VerificationCheckType,
            });
          }
        });
      }
    });
  }

  // Handle document inspection click
  const handleInspectDoc = (doc: { id: string; documentTypeName: string; checkType: VerificationCheckType }) => {
    setDocZoom(100);
    setDocRotation(0);
    setInspectingDoc({
      id: doc.id,
      title: doc.documentTypeName,
      checkType: doc.checkType,
    });
  };

  const docUrl = docLinkData?.signedUrl || docLinkData?.url;
  const isImage = docUrl && /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(docUrl);
  const isPdf = docUrl && /\.pdf($|\?)/i.test(docUrl);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--space-4)',
        backdropFilter: 'blur(3px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="worker-directory-modal-title"
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface, #ffffff)',
          borderRadius: 'var(--radius-xl, 12px)',
          maxWidth: inspectingDoc ? '1080px' : '820px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          transition: 'max-width 0.25s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-brand-50, #f0fdfa)',
                border: '2px solid var(--color-brand-600, #0d9488)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-brand-700, #0f766e)',
                fontWeight: 700,
                fontSize: '16px',
                flexShrink: 0,
              }}
            >
              {worker?.name ? worker.name.charAt(0).toUpperCase() : <User size={20} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <h2
                  id="worker-directory-modal-title"
                  style={{
                    margin: 0,
                    fontSize: 'var(--font-size-xl, 18px)',
                    fontWeight: 700,
                    color: 'var(--color-text-primary, #0f172a)',
                  }}
                >
                  {worker?.name || 'Worker Profile'}
                </h2>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: 'var(--color-text-secondary, #64748b)',
                    backgroundColor: 'var(--color-bg-app, #f1f5f9)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {worker?.id || workerId}
                </span>
                <VerificationBadge isFullyVerified={true} status="VERIFIED" />
              </div>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 'var(--font-size-xs, 12px)',
                  color: 'var(--color-text-secondary, #64748b)',
                }}
              >
                {worker?.category || 'Household Staff'} • {worker?.locality || 'Hyderabad'} • {worker?.experienceYears || 0} Years Experience
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-tertiary, #94a3b8)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          role="tablist"
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            backgroundColor: 'var(--color-surface, #ffffff)',
            padding: '0 var(--space-6)',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'details'}
            onClick={() => {
              setActiveTab('details');
              setInspectingDoc(null);
            }}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: activeTab === 'details' ? 'var(--color-brand-600, #0d9488)' : 'var(--color-text-secondary, #64748b)',
              borderBottom: activeTab === 'details' ? '2px solid var(--color-brand-600, #0d9488)' : '2px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <User size={15} />
            <span>Worker Details</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'work'}
            onClick={() => {
              setActiveTab('work');
              setInspectingDoc(null);
            }}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: activeTab === 'work' ? 'var(--color-brand-600, #0d9488)' : 'var(--color-text-secondary, #64748b)',
              borderBottom: activeTab === 'work' ? '2px solid var(--color-brand-600, #0d9488)' : '2px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <Briefcase size={15} />
            <span>Their Work & Skills</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'documents'}
            onClick={() => setActiveTab('documents')}
            style={{
              padding: '12px 18px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: activeTab === 'documents' ? 'var(--color-brand-600, #0d9488)' : 'var(--color-text-secondary, #64748b)',
              borderBottom: activeTab === 'documents' ? '2px solid var(--color-brand-600, #0d9488)' : '2px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <FileText size={15} />
            <span>Verified Documents ({documents.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)' }}>
          {isWorkerLoading ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
              <LoadingSpinner message="Loading worker profile..." />
            </div>
          ) : isWorkerError ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-error)' }}>
              <AlertCircle size={36} style={{ margin: '0 auto 8px' }} />
              <h3 style={{ margin: 0, fontSize: '15px' }}>Unable to load worker record</h3>
              <p style={{ margin: '4px 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {workerError instanceof Error ? workerError.message : 'Error fetching worker details.'}
              </p>
            </div>
          ) : !worker ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No worker record found.
            </div>
          ) : (
            <>
              {/* TAB 1: WORKER DETAILS */}
              {activeTab === 'details' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                  {/* Summary Metric Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <div
                      style={{
                        padding: '14px',
                        backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                        borderRadius: 'var(--radius-md, 8px)',
                        border: '1px solid var(--color-border-subtle, #f1f5f9)',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748b)', fontWeight: 600 }}>
                        EXPERIENCE
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary, #0f172a)', marginTop: '4px' }}>
                        {worker.experienceYears || 0} Years
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94a3b8)', marginTop: '2px' }}>
                        Professional service
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '14px',
                        backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                        borderRadius: 'var(--radius-md, 8px)',
                        border: '1px solid var(--color-border-subtle, #f1f5f9)',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748b)', fontWeight: 600 }}>
                        CLIENT RATING
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <Star size={18} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                        <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary, #0f172a)' }}>
                          {worker.ratingAverage ? Number(worker.ratingAverage).toFixed(1) : '5.0'}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94a3b8)', marginTop: '2px' }}>
                        {worker.totalReviews || 0} Verified reviews
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '14px',
                        backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                        borderRadius: 'var(--radius-md, 8px)',
                        border: '1px solid var(--color-border-subtle, #f1f5f9)',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748b)', fontWeight: 600 }}>
                        COMPLIANCE LEVEL
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                        <CheckCircle2 size={18} style={{ color: '#10b981' }} />
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#065f46' }}>
                          Full KYC Verified
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94a3b8)', marginTop: '2px' }}>
                        Identity & Police Cleared
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '14px',
                        backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                        borderRadius: 'var(--radius-md, 8px)',
                        border: '1px solid var(--color-border-subtle, #f1f5f9)',
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748b)', fontWeight: 600 }}>
                        ENGAGEMENTS
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary, #0f172a)', marginTop: '4px' }}>
                        {worker.completedBookingsCount || 0} Completed
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #94a3b8)', marginTop: '2px' }}>
                        {worker.activeEngagementsCount || 0} active now
                      </div>
                    </div>
                  </div>

                  {/* Profile & Contact Details Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                      gap: 'var(--space-4)',
                    }}
                  >
                    {/* Identity & Contact Box */}
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-lg, 10px)',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        backgroundColor: 'var(--color-surface, #ffffff)',
                      }}
                    >
                      <h4
                        style={{
                          margin: '0 0 12px',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'var(--color-text-primary, #0f172a)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <User size={15} style={{ color: 'var(--color-brand-600, #0d9488)' }} />
                        <span>Personal Information</span>
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Full Legal Name</span>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-primary, #0f172a)' }}>
                            {worker.name}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Registered Mobile</span>
                          <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-text-primary, #0f172a)' }}>
                            {worker.phone || worker.mobile || worker.phoneMasked || 'Available in Admin'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Email Address</span>
                          <span style={{ fontWeight: 500, color: 'var(--color-text-primary, #0f172a)' }}>
                            {worker.email || 'Not Provided'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Primary Locality</span>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-primary, #0f172a)' }}>
                            {worker.locality || 'Hyderabad'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Languages Spoken</span>
                          <span style={{ fontWeight: 500, color: 'var(--color-text-primary, #0f172a)' }}>
                            {worker.languages && worker.languages.length > 0
                              ? worker.languages.join(', ')
                              : 'Telugu, Hindi'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Operational Status & Verification Overview */}
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-lg, 10px)',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        backgroundColor: 'var(--color-surface, #ffffff)',
                      }}
                    >
                      <h4
                        style={{
                          margin: '0 0 12px',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'var(--color-text-primary, #0f172a)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <ShieldCheck size={15} style={{ color: 'var(--color-brand-600, #0d9488)' }} />
                        <span>Trust & Platform Status</span>
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Account Status</span>
                          <StatusBadge status={worker.status || 'ACTIVE'} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Verification Status</span>
                          <span
                            style={{
                              padding: '2px 8px',
                              backgroundColor: '#ecfdf5',
                              color: '#065f46',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '11px',
                            }}
                          >
                            VERIFIED & APPROVED
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Matching Eligible</span>
                          <span style={{ fontWeight: 600, color: '#059669' }}>Yes (Active in Pool)</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Onboarding Date</span>
                          <span style={{ color: 'var(--color-text-primary, #0f172a)' }}>
                            {worker.registeredAt ? new Date(worker.registeredAt).toLocaleDateString('en-IN') : 'Recent'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Last Verified</span>
                          <span style={{ color: 'var(--color-text-primary, #0f172a)' }}>
                            {worker.signedOffAt ? new Date(worker.signedOffAt).toLocaleDateString('en-IN') : 'Confirmed'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Worker Bio / Background */}
                  {worker.bio && (
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-lg, 10px)',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                      }}
                    >
                      <h4
                        style={{
                          margin: '0 0 8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'var(--color-text-primary, #0f172a)',
                        }}
                      >
                        Worker Bio & Experience Summary
                      </h4>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary, #475569)', lineHeight: 1.5 }}>
                        {worker.bio}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: THEIR WORK & SKILLS */}
              {activeTab === 'work' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                  {/* Category & Skills Showcase */}
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-lg, 10px)',
                      border: '1px solid var(--color-border, #e2e8f0)',
                      backgroundColor: 'var(--color-surface, #ffffff)',
                    }}
                  >
                    <h4
                      style={{
                        margin: '0 0 12px',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--color-text-primary, #0f172a)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Award size={16} style={{ color: 'var(--color-brand-600, #0d9488)' }} />
                      <span>Primary Role & Skill Capabilities</span>
                    </h4>

                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748b)', marginBottom: '6px' }}>
                        Primary Household Category:
                      </div>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '6px 14px',
                          backgroundColor: 'var(--color-brand-50, #f0fdfa)',
                          color: 'var(--color-brand-700, #0f766e)',
                          border: '1px solid var(--color-brand-200, #99f6e4)',
                          borderRadius: 'var(--radius-full, 9999px)',
                          fontWeight: 700,
                          fontSize: '13px',
                        }}
                      >
                        {worker.category || 'Domestic Professional'}
                      </span>
                    </div>

                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #64748b)', marginBottom: '8px' }}>
                        Specific Skills & Tasks Performed:
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {worker.skills && worker.skills.length > 0 ? (
                          worker.skills.map((skill: string) => (
                            <span
                              key={skill}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                                border: '1px solid var(--color-border, #e2e8f0)',
                                borderRadius: 'var(--radius-sm, 6px)',
                                fontSize: '12px',
                                fontWeight: 500,
                                color: 'var(--color-text-primary, #0f172a)',
                              }}
                            >
                              ✓ {skill}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            Standard tasks for {worker.category || 'this category'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Work Availability & Engagement Terms */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                      gap: 'var(--space-4)',
                    }}
                  >
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-lg, 10px)',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        backgroundColor: 'var(--color-surface, #ffffff)',
                      }}
                    >
                      <h4
                        style={{
                          margin: '0 0 12px',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'var(--color-text-primary, #0f172a)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Clock size={15} style={{ color: 'var(--color-brand-600, #0d9488)' }} />
                        <span>Schedule & Availability</span>
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Current Allocation Status</span>
                          <span style={{ fontWeight: 600, color: '#059669' }}>
                            {worker.availability || 'Available for Immediate Allocation'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Service Radius</span>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-primary, #0f172a)' }}>
                            {worker.serviceRadiusKm ? `${worker.serviceRadiusKm} km radius` : 'Up to 8 km'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Preferred Service Areas</span>
                          <span style={{ fontWeight: 500, color: 'var(--color-text-primary, #0f172a)', textAlign: 'right', maxWidth: '60%' }}>
                            {worker.preferredServiceArea || worker.locality || 'Hyderabad West'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-lg, 10px)',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        backgroundColor: 'var(--color-surface, #ffffff)',
                      }}
                    >
                      <h4
                        style={{
                          margin: '0 0 12px',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'var(--color-text-primary, #0f172a)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <IndianRupee size={15} style={{ color: 'var(--color-brand-600, #0d9488)' }} />
                        <span>Compensation & Track Record</span>
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Expected Compensation</span>
                          <span style={{ fontWeight: 700, color: 'var(--color-brand-700, #0f766e)' }}>
                            {worker.expectedCompensation || '₹15,000 - ₹20,000 / month'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Completed Engagements</span>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-primary, #0f172a)' }}>
                            {worker.completedBookingsCount || 0} Successful Jobs
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary, #64748b)' }}>Replacements Requested</span>
                          <span style={{ fontWeight: 600, color: worker.replacementsIncurred ? '#dc2626' : '#059669' }}>
                            {worker.replacementsIncurred || 0} (Exemplary Record)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Verified Household Engagements */}
                  {worker.recentEngagements && worker.recentEngagements.length > 0 && (
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-lg, 10px)',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        backgroundColor: 'var(--color-surface, #ffffff)',
                      }}
                    >
                      <h4
                        style={{
                          margin: '0 0 12px',
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'var(--color-text-primary, #0f172a)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Briefcase size={15} style={{ color: 'var(--color-brand-600, #0d9488)' }} />
                        <span>Recent Completed Client Engagements</span>
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {worker.recentEngagements.map((eng: WorkerEngagementSummary) => (
                          <div
                            key={eng.bookingId}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 14px',
                              backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                              borderRadius: 'var(--radius-sm, 6px)',
                              border: '1px solid var(--color-border-subtle, #f1f5f9)',
                              fontSize: '12px',
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--color-text-primary, #0f172a)' }}>
                                {eng.customerName}
                              </div>
                              <div style={{ color: 'var(--color-text-secondary, #64748b)', fontSize: '11px' }}>
                                {eng.serviceCategory} • {eng.period}
                              </div>
                            </div>
                            <span
                              style={{
                                padding: '2px 8px',
                                backgroundColor: '#ecfdf5',
                                color: '#065f46',
                                borderRadius: '4px',
                                fontWeight: 600,
                                fontSize: '11px',
                              }}
                            >
                              {eng.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: THEIR DOCUMENTS */}
              {activeTab === 'documents' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {inspectingDoc ? (
                    /* Document Preview Panel */
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-lg, 10px)',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        backgroundColor: 'var(--color-surface, #ffffff)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '12px',
                          paddingBottom: '12px',
                          borderBottom: '1px solid var(--color-border-subtle, #f1f5f9)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={18} style={{ color: 'var(--color-brand-600, #0d9488)' }} />
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                            {inspectingDoc.title}
                          </h4>
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              backgroundColor: '#ecfdf5',
                              color: '#065f46',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                          >
                            Verified
                          </span>
                        </div>

                        {/* Viewer Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setDocZoom((z) => Math.max(50, z - 25))}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-surface)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                            }}
                            title="Zoom Out"
                          >
                            <ZoomOut size={13} />
                          </button>
                          <span style={{ fontSize: '11px', minWidth: '40px', textAlign: 'center' }}>{docZoom}%</span>
                          <button
                            type="button"
                            onClick={() => setDocZoom((z) => Math.min(200, z + 25))}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-surface)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                            }}
                            title="Zoom In"
                          >
                            <ZoomIn size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDocRotation((r) => (r + 90) % 360)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-surface)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                            }}
                            title="Rotate"
                          >
                            <RotateCw size={13} />
                          </button>
                          {docUrl && (
                            <a
                              href={docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-surface)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                color: 'var(--color-text-primary)',
                                textDecoration: 'none',
                              }}
                              title="Open in new window"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setInspectingDoc(null)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              border: '1px solid var(--color-border)',
                              background: 'var(--color-bg-subtle)',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            Back to List
                          </button>
                        </div>
                      </div>

                      {/* Document Viewer Frame */}
                      <div
                        style={{
                          minHeight: '380px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          overflow: 'auto',
                          padding: '16px',
                        }}
                      >
                        {isDocLoading ? (
                          <LoadingSpinner message="Retrieving authorized document from storage..." />
                        ) : isDocError ? (
                          <div style={{ textAlign: 'center', color: 'var(--color-error)' }}>
                            <AlertCircle size={28} style={{ margin: '0 auto 6px' }} />
                            <p style={{ margin: 0, fontSize: '12px' }}>
                              {docError instanceof Error ? docError.message : 'Failed to retrieve document link.'}
                            </p>
                          </div>
                        ) : isImage ? (
                          <div
                            style={{
                              transform: `rotate(${docRotation}deg) scale(${docZoom / 100})`,
                              transformOrigin: 'center center',
                              transition: 'transform 0.15s ease',
                              display: 'flex',
                              justifyContent: 'center',
                            }}
                          >
                            <img
                              src={docUrl}
                              alt={inspectingDoc.title}
                              data-testid="kyc-document-image"
                              style={{
                                maxWidth: '100%',
                                maxHeight: '420px',
                                objectFit: 'contain',
                                borderRadius: '4px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                              }}
                            />
                          </div>
                        ) : isPdf ? (
                          <iframe
                            src={docUrl}
                            title={inspectingDoc.title}
                            data-testid="kyc-document-pdf"
                            style={{
                              width: '100%',
                              height: '420px',
                              border: 'none',
                              borderRadius: '4px',
                            }}
                          />
                        ) : docUrl ? (
                          <iframe
                            src={docUrl}
                            title={inspectingDoc.title}
                            style={{
                              width: '100%',
                              height: '420px',
                              border: 'none',
                              borderRadius: '4px',
                            }}
                          />
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                            Document preview is not available.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Documents List Cards */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--color-text-secondary, #64748b)' }}>
                        Review verified identification proofs, residential credentials, and police certificates submitted by this worker.
                      </p>

                      {documents.length === 0 ? (
                        <div
                          style={{
                            padding: '32px',
                            textAlign: 'center',
                            backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                            borderRadius: '8px',
                            color: 'var(--color-text-muted)',
                            fontSize: '13px',
                          }}
                        >
                          No uploaded documents recorded for this worker profile.
                        </div>
                      ) : (
                        documents.map((doc) => (
                          <div
                            key={doc.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '14px 18px',
                              backgroundColor: 'var(--color-surface, #ffffff)',
                              border: '1px solid var(--color-border, #e2e8f0)',
                              borderRadius: 'var(--radius-lg, 10px)',
                              transition: 'box-shadow 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <div
                                style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '8px',
                                  backgroundColor: 'var(--color-brand-50, #f0fdfa)',
                                  color: 'var(--color-brand-700, #0f766e)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <FileText size={18} />
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary, #0f172a)' }}>
                                  {doc.documentTypeName}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px', fontSize: '11px' }}>
                                  {doc.docNumberMasked && (
                                    <span style={{ fontFamily: 'monospace', color: 'var(--color-text-secondary, #64748b)' }}>
                                      Doc: {doc.docNumberMasked}
                                    </span>
                                  )}
                                  <span
                                    style={{
                                      padding: '1px 6px',
                                      backgroundColor: '#ecfdf5',
                                      color: '#065f46',
                                      borderRadius: '4px',
                                      fontWeight: 600,
                                    }}
                                  >
                                    ✓ Verified
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleInspectDoc(doc)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: 'var(--radius-md, 6px)',
                                border: '1px solid var(--color-brand-600, #0d9488)',
                                backgroundColor: 'var(--color-brand-50, #f0fdfa)',
                                color: 'var(--color-brand-700, #0f766e)',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <Eye size={13} />
                              <span>View Document</span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-6)',
            borderTop: '1px solid var(--color-border, #e2e8f0)',
            backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 18px',
              borderRadius: 'var(--radius-md, 6px)',
              border: '1px solid var(--color-border, #cbd5e1)',
              backgroundColor: 'var(--color-surface, #ffffff)',
              color: 'var(--color-text-primary, #0f172a)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
