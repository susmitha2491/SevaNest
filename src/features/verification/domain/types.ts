export type VerificationCheckType =
  | 'IDENTITY'
  | 'ADDRESS'
  | 'EMERGENCY_CONTACT'
  | 'REFERENCE'
  | 'POLICE_CLEARANCE';

export type VerificationCheckStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'RECHECK_DUE';

export type RejectionReasonCategory =
  | 'BLURRY_IMAGE'
  | 'NAME_MISMATCH'
  | 'TAMPERED_DOC'
  | 'EXPIRED_DOC'
  | 'REFERENCE_UNREACHABLE'
  | 'REFERENCE_NEGATIVE'
  | 'ADDRESS_UNVERIFIABLE'
  | 'OTHER';

export const REJECTION_CATEGORIES: { key: RejectionReasonCategory; label: string }[] = [
  { key: 'BLURRY_IMAGE', label: 'Blurry / Unreadable Document Image' },
  { key: 'NAME_MISMATCH', label: 'Name or Details Mismatch on Document' },
  { key: 'TAMPERED_DOC', label: 'Suspected Tampering / Inauthentic Document' },
  { key: 'EXPIRED_DOC', label: 'Expired Document / Certificate' },
  { key: 'REFERENCE_UNREACHABLE', label: 'Reference Contact Unreachable / Invalid Contact' },
  { key: 'REFERENCE_NEGATIVE', label: 'Negative Reference / Employer Misconduct Feedback' },
  { key: 'ADDRESS_UNVERIFIABLE', label: 'Address Proof Incomplete or Unverifiable' },
  { key: 'OTHER', label: 'Other Specific Operational Reason' },
];

export interface VerificationDocumentMetadata {
  documentId?: string;
  docNumberMasked?: string;
  nameOnDoc?: string;
  issueDate?: string;
  expiryDate?: string;
  documentTypeName: string;
}

export interface VerificationContactDetails {
  contactName: string;
  relationshipOrRole: string;
  phoneMasked: string;
  callNotes?: string;
}

export interface VerificationCheck {
  id?: string;
  type: VerificationCheckType;
  title: string;
  status: VerificationCheckStatus;
  evaluationMethod: 'DOCUMENT_INSPECTION' | 'TELEPHONIC_VETTING' | 'CERTIFICATE_TRACKING';
  documentMetadata?: VerificationDocumentMetadata;
  contactDetails?: VerificationContactDetails;
  mockDocumentUrl?: string;
  rejectionCategory?: RejectionReasonCategory;
  rejectionRemarks?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  recheckDueDate?: string;
}

export interface VerificationDossier {
  id: string;
  applicationId?: string;
  workerId: string;
  workerName: string;
  category: string;
  locality: string;
  experienceYears: number;
  phoneMasked: string;
  submissionTime: string;
  status: 'PENDING_REVIEW' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'RECHECK_DUE';
  assignedReviewer?: string;
  preCheckOtpVerified: boolean; // Automated pre-check
  checks: Record<VerificationCheckType, VerificationCheck>;
  overallRemarks?: string;
}

export interface VerificationFilterCriteria {
  searchTerm?: string;
  status?: 'ALL' | 'PENDING_REVIEW' | 'IN_REVIEW' | 'RECHECK_DUE' | 'APPROVED' | 'REJECTED';
  category?: string;
  sortBy?: 'submissionTime' | 'workerName' | 'category';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface PaginatedVerificationQueue {
  items: VerificationDossier[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IVerificationRepository {
  getVerificationQueue(filter?: VerificationFilterCriteria): Promise<PaginatedVerificationQueue>;
  getDossierById(dossierId: string): Promise<VerificationDossier | null>;
  claimDossier(dossierId: string): Promise<void>;
  approveCheck(dossierId: string, checkType: VerificationCheckType, notes?: string): Promise<void>;
  rejectCheck(
    dossierId: string,
    checkType: VerificationCheckType,
    category: RejectionReasonCategory,
    remarks: string
  ): Promise<void>;
  requestReVerification(
    dossierId: string,
    checkTypes: VerificationCheckType[],
    instructions: string
  ): Promise<void>;
  getSignedDocumentUrl(
    dossierId: string,
    checkType: VerificationCheckType,
    documentId?: string
  ): Promise<{ signedUrl: string; expiresAt: string }>;
  submitFinalDecision(
    dossierId: string,
    decision: 'APPROVED' | 'REJECTED' | 'CORRECTIONS_REQUESTED',
    remarks?: string
  ): Promise<void>;
}
