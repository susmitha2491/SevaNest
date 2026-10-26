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

export interface VerificationCheckEvent {
  fromStatus?: string | null;
  toStatus: string;
  actorUserId: string;
  actorName?: string;
  remarks?: string | null;
  createdAt: string;
}

export interface VerificationCheck {
  id?: string;
  type: VerificationCheckType;
  title: string;
  status: VerificationCheckStatus;
  evaluationMethod: 'DOCUMENT_INSPECTION' | 'TELEPHONIC_VETTING' | 'CERTIFICATE_TRACKING';
  documentMetadata?: VerificationDocumentMetadata;
  documents?: VerificationDocumentMetadata[];
  contactDetails?: VerificationContactDetails;
  mockDocumentUrl?: string;
  rejectionCategory?: RejectionReasonCategory;
  rejectionRemarks?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  recheckDueDate?: string;
  history?: VerificationCheckEvent[];
}

export interface VerificationDossier {
  id: string;
  checkId?: string;
  applicationId?: string;
  workerId: string;
  workerName: string;
  category: string;
  locality: string;
  experienceYears: number;
  phoneMasked: string;
  submissionTime: string;
  applicationSubmittedAt?: string;
  status: 'PENDING_REVIEW' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'RECHECK_DUE';
  assignedReviewer?: string;
  reviewerUserId?: string;
  claimedAt?: string;
  level?: string;
  preCheckOtpVerified: boolean; // Automated pre-check
  checks: Record<VerificationCheckType, VerificationCheck>;
  overallRemarks?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    locality?: string;
  };
  languages?: string[];
  skills?: string[];
  availability?: string;
  expectedSalary?: number | string;
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phoneMasked?: string;
    phone?: string;
  };
  previousEmployer?: {
    name?: string;
    phoneMasked?: string;
    phone?: string;
    role?: string;
    period?: string;
    feedback?: string;
  };
  accountStatus?: 'ACTIVE' | 'SUSPENDED';
}

export interface VerificationFilterCriteria {
  searchTerm?: string;
  status?: 'ALL' | 'PENDING_REVIEW' | 'IN_REVIEW' | 'RECHECK_DUE' | 'APPROVED' | 'REJECTED';
  category?: string;
  categoryId?: string;
  assignedTo?: 'me';
  reviewerId?: string;
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
  getDossierById(workerId: string): Promise<VerificationDossier | null>;
  claimDossier(workerId: string, checkId?: string): Promise<void>;
  claimCheck(checkId: string): Promise<void>;
  approveCheck(checkId: string, checkType?: VerificationCheckType, notes?: string): Promise<void>;
  rejectCheck(
    checkId: string,
    checkType?: VerificationCheckType,
    category?: RejectionReasonCategory,
    remarks?: string
  ): Promise<void>;
  requestReVerification(
    checkId: string,
    checkTypes?: VerificationCheckType[],
    instructions?: string
  ): Promise<void>;
  getSignedDocumentUrl(
    workerId: string,
    checkType: VerificationCheckType,
    documentId?: string
  ): Promise<{ signedUrl: string; url?: string; expiresAt: string; expiresInSeconds?: number }>;
}

