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
    metadata?: { referenceNumber?: string; expiresOn?: string; callNotes?: string; recheckAt?: string }
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
  updateDocumentDetails(checkId: string, details: { documentNumber?: string; expiresOn?: string }): Promise<AdminWorkerVerificationResponse | void>;
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
  message?: string;
  acceptedAt?: string;
  acceptedBy?: string;
}


