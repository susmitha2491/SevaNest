export type VerificationCheckType =
  | 'IDENTITY'
  | 'ADDRESS'
  | 'EMERGENCY_CONTACT'
  | 'REFERENCE'
  | 'PREVIOUS_EMPLOYMENT'
  | 'POLICE_CLEARANCE'
  | 'POLICE_VERIFICATION'
  | 'SKILL_CERTIFICATE'
  | 'LICENSE';

export type VerificationCheckStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'RECHECK_DUE';

export type RejectionReasonCode =
  | 'BLURRY_IMAGE'
  | 'DOCUMENT_EXPIRED'
  | 'NAME_MISMATCH'
  | 'INCOMPLETE_DOCUMENT'
  | 'INVALID_DOCUMENT_TYPE'
  | 'SUSPECTED_TAMPERING'
  | 'UNVERIFIABLE_REFERENCE'
  | 'CRIMINAL_RECORD_DISQUALIFIED'
  | 'OTHER';

export type LegacyRejectionReasonCode =
  | 'TAMPERED_DOC'
  | 'EXPIRED_DOC'
  | 'REFERENCE_UNREACHABLE'
  | 'REFERENCE_NEGATIVE'
  | 'ADDRESS_UNVERIFIABLE';

export type RejectionReasonCategory = RejectionReasonCode | LegacyRejectionReasonCode;

export interface RejectionReasonOption {
  key: RejectionReasonCode;
  label: string;
  terminal?: boolean;
  description?: string;
}

export const REJECTION_CATEGORIES: RejectionReasonOption[] = [
  {
    key: 'BLURRY_IMAGE',
    label: 'Blurry / Unreadable Document Image',
    description: 'Document scan/photo is illegible or out of focus.',
  },
  {
    key: 'DOCUMENT_EXPIRED',
    label: 'Expired Document / Certificate',
    description: 'The validity date on the certificate or document has lapsed.',
  },
  {
    key: 'NAME_MISMATCH',
    label: 'Name or Details Mismatch on Document',
    description: 'Name or key particulars do not match the worker profile.',
  },
  {
    key: 'INCOMPLETE_DOCUMENT',
    label: 'Incomplete Document or Missing Pages',
    description: 'Document is missing back side, pages, or required sections.',
  },
  {
    key: 'INVALID_DOCUMENT_TYPE',
    label: 'Invalid Document Type Uploaded',
    description: 'Document uploaded does not satisfy the requirements of this check.',
  },
  {
    key: 'SUSPECTED_TAMPERING',
    label: 'Suspected Tampering / Inauthentic Document (Terminal)',
    terminal: true,
    description: 'Document shows signs of physical or digital manipulation.',
  },
  {
    key: 'UNVERIFIABLE_REFERENCE',
    label: 'Unverifiable Reference / Invalid Contact',
    description: 'Reference contact is invalid, unreachable, or untraceable.',
  },
  {
    key: 'CRIMINAL_RECORD_DISQUALIFIED',
    label: 'Criminal Record Disqualified (Terminal)',
    terminal: true,
    description: 'Worker is disqualified based on police verification or criminal record.',
  },
  {
    key: 'OTHER',
    label: 'Other Specific Operational Reason (Remarks Required)',
    description: 'Mandatory operational explanation must be entered in remarks.',
  },
];

export function isTerminalRejectionCode(code?: string | null): boolean {
  if (!code) return false;
  return code === 'CRIMINAL_RECORD_DISQUALIFIED' || code === 'SUSPECTED_TAMPERING' || code === 'TAMPERED_DOC';
}

export interface VerificationDocumentMetadata {
  id?: string;
  documentId?: string;
  docNumberMasked?: string;
  nameOnDoc?: string;
  issueDate?: string;
  expiryDate?: string;
  documentTypeName: string;
  contentType?: string;
  mimeType?: string;
  sizeBytes?: number;
  status?: string;
  availability?: string;
  available?: boolean;
  reviewable?: boolean;
  submitted?: boolean;
  checkType?: VerificationCheckType;
  checkTitle?: string;
  checkId?: string;
  createdAt?: string;
  submittedAt?: string;
}

export interface VerificationContactDetails {
  contactName: string;
  relationshipOrRole: string;
  phoneMasked: string;
  callNotes?: string;
}

export interface VerificationCheckEvent {
  action?: string;
  checkType?: string;
  fromStatus?: string | null;
  toStatus: string;
  rejectionCode?: string | null;
  actorUserId: string;
  actorName?: string;
  remarks?: string | null;
  createdAt: string;
}

export interface VerificationCheck {
  id?: string;
  checkId?: string;
  type: VerificationCheckType;
  title: string;
  status: VerificationCheckStatus;
  required?: boolean;
  evaluationMethod: 'DOCUMENT_INSPECTION' | 'TELEPHONIC_VETTING' | 'CERTIFICATE_TRACKING';
  documentMetadata?: VerificationDocumentMetadata;
  documents?: VerificationDocumentMetadata[];
  contactDetails?: VerificationContactDetails;
  mockDocumentUrl?: string;
  rejectionCategory?: RejectionReasonCategory;
  rejectionCode?: RejectionReasonCode | string;
  rejectionMessage?: string;
  terminal?: boolean;
  rejectionRemarks?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  recheckDueDate?: string;
  notes?: string[];
  referenceNumber?: string;
  expiresOn?: string;
  history?: VerificationCheckEvent[];
}

export interface VerificationDossier {
  id: string;
  checkId?: string;
  applicationId?: string;
  workerId: string;
  workerName: string;
  hasProfilePhoto?: boolean;
  photoUrl?: string;
  photo?: { url: string; expiresAt?: string } | string;
  category: string;
  locality: string;
  experienceYears: number;
  phoneMasked: string;
  phone?: string;
  email?: string;
  submissionTime: string;
  applicationSubmittedAt?: string;
  status: 'PENDING_REVIEW' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'RECHECK_DUE';
  assignedReviewer?: string;
  reviewerUserId?: string;
  claimedAt?: string;
  level?: string;
  preCheckOtpVerified: boolean; // Automated pre-check
  checks: Record<string, VerificationCheck>;
  submittedDocuments?: VerificationDocumentMetadata[];
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
  applicationStatus?: 'SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'ACTIVE' | 'REJECTED' | string;
  activatedAt?: string;
  signedOffAt?: string;
  signedOffBy?: string;
  requiredChecks?: string[];
  pendingChecks?: string[];
  contractInconsistency?: string;
  hasContractInconsistency?: boolean;
  rejectionHistory?: {
    rejectedAt: string;
    rejectedBy?: string;
    reasonCode?: string;
    remarks?: string;
    terminal?: boolean;
  }[];
  reconsiderationHistory?: {
    reconsideredAt: string;
    reconsideredBy?: string;
    remarks: string;
  }[];
  approvalHistory?: {
    approvedAt: string;
    approvedBy?: string;
    remarks?: string;
  }[];
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

export interface AdminCheckView {
  checkId: string;
  checkType: 'IDENTITY' | 'ADDRESS' | 'EMERGENCY_CONTACT' | 'PREVIOUS_EMPLOYMENT' | 'POLICE_VERIFICATION' | 'SKILL_CERTIFICATE' | 'LICENSE' | string;
  status: 'NOT_SUBMITTED' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'RECHECK_DUE';
  required: boolean;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  remarks?: string | null;
  recheckAt?: string | null;
  documents?: Array<{
    documentId: string;
    documentType: string;
    status: string;
    reviewable?: boolean;
    available?: boolean;
    availability?: string;
    mimeType?: string;
    fileName?: string;
    fileUrl?: string;
    uploadedAt?: string;
  }>;
  reviewerUserId?: string | null;
  claimedAt?: string | null;
  history?: Array<Record<string, unknown>>;
  rejectionCode?: string;
  rejectionMessage?: string;
}

export interface AdminWorkerVerificationResponse {
  workerId: string;
  level: 'VERIFIED' | 'IN_PROGRESS' | 'NOT_STARTED' | string;
  requiredChecks: string[];
  checks: AdminCheckView[];
  status?: string;
  applicationStatus?: string;
  activatedAt?: string;
  signedOffAt?: string;
  signedOffBy?: string;
}

export interface IVerificationRepository {
  getVerificationQueue(filter?: VerificationFilterCriteria): Promise<PaginatedVerificationQueue>;
  getDossierById(workerId: string): Promise<VerificationDossier | null>;
  claimDossier(workerId: string, checkId?: string): Promise<void>;
  claimCheck(checkId: string): Promise<AdminWorkerVerificationResponse | void>;
  approveCheck(
    checkId: string,
    checkType?: VerificationCheckType,
    notes?: string,
    metadata?: { referenceNumber?: string; documentNumber?: string; expiresOn?: string; callNotes?: string; recheckAt?: string }
  ): Promise<AdminWorkerVerificationResponse | void>;
  rejectCheck(
    checkId: string,
    checkType?: VerificationCheckType,
    category?: RejectionReasonCategory,
    remarks?: string
  ): Promise<AdminWorkerVerificationResponse | void>;
  releaseReview(checkId: string): Promise<void>;
  reassignReview(checkId: string, reviewerUserId: string, reason?: string): Promise<void>;
  addCheckNote(checkId: string, note: string, kind?: 'CALL' | 'REVIEW'): Promise<void>;
  updateDocumentDetails(checkId: string, details: { documentNumber?: string; referenceNumber?: string; expiresOn?: string }): Promise<AdminWorkerVerificationResponse | void>;
  requestReVerification(
    checkId: string,
    checkTypes?: VerificationCheckType[],
    instructions?: string
  ): Promise<void>;
  getSignedDocumentUrl(
    workerId: string,
    checkType: VerificationCheckType,
    documentId?: string
  ): Promise<{ signedUrl: string; url?: string; mimeType?: string; expiresAt: string; expiresInSeconds?: number }>;
  signOffVerification(
    workerId: string,
    remarks?: string
  ): Promise<AdminWorkerVerificationResponse | void>;
  rejectWorker(
    workerId: string,
    category: RejectionReasonCategory | string,
    remarks: string
  ): Promise<AdminWorkerVerificationResponse | void>;
  reconsiderApplication(
    workerId: string,
    remarks: string
  ): Promise<AdminWorkerVerificationResponse | void>;
  activateWorker(
    workerId: string
  ): Promise<AdminWorkerVerificationResponse | FinalOnboardingResult>;
  approveApplicationAndOnboardWorker(
    workerId: string,
    notes?: string
  ): Promise<FinalOnboardingResult>;
}

export interface FinalOnboardingResult {
  success: boolean;
  workerId: string;
  applicationId?: string;
  status: string;
  applicationStatus?: string;
  activated?: boolean;
  signedOff?: boolean;
  activationError?: string;
  message?: string;
  acceptedAt?: string;
  acceptedBy?: string;
}


