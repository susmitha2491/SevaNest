export interface WorkerVerificationDetail {
  phoneOtpVerified: boolean;
  identityProofStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
  identityDocName?: string;
  addressProofStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
  criminalRecordStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
  skillProofStatus: 'VERIFIED' | 'PENDING' | 'NOT_APPLICABLE';
  skillDocName?: string;
  referenceCheckStatus: 'VERIFIED' | 'PENDING' | 'FAILED';
  lastVerifiedAt?: string;
  recheckDueDate?: string;
  overallRemarks?: string;
  reviewerName?: string;
  reviewedAt?: string;
  level?: string;
}

export interface WorkerDocumentMetadata {
  id?: string;
  documentId?: string;
  checkId?: string;
  checkType?: string;
  documentType: string;
  documentTypeName: string;
  docNumberMasked?: string;
  status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'EXPIRED' | 'RECHECK_DUE';
  submittedAt?: string;
  verifiedAt?: string;
  recheckDueDate?: string;
  rejectionReason?: string;
  signedUrl?: string;
  contentType?: string;
  mimeType?: string;
  sizeBytes?: number;
  available?: boolean;
  reviewable?: boolean;
  availability?: string;
  submitted?: boolean;
}

export interface WorkerEngagementSummary {
  bookingId: string;
  customerName: string;
  serviceCategory: string;
  status: string;
  period: string;
}

export interface Worker {
  id: string;
  userId?: string;
  applicationId?: string;
  name: string;
  category: string;
  categories?: string[];
  experienceYears: number;
  ratingAverage: number;
  totalReviews: number;
  locality: string;
  isFullyVerified: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED';
  photoUrl?: string;
  photo?: { url: string; expiresAt?: string } | string;
  phoneMasked?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  onboardingStatus?: 'REGISTERED' | 'APPLIED' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | 'DRAFT' | 'SUBMITTED';
  verificationStatus?: 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | 'RECHECK_DUE';
  applicationStatus?: 'SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'ACTIVE' | 'REJECTED' | string;
  activatedAt?: string;
  signedOffAt?: string;
  verificationLevel?: string;
  level?: string;
  matchingEligible?: boolean;
  accountStatus?: 'ACTIVE' | 'SUSPENDED';
  createdAt?: string;
  registeredAt?: string;
  completedChecksCount?: number;
  totalRequiredChecksCount?: number;
}

export interface WorkerAddress {
  line: string;
  area: string;
  city: string;
  pincode: string;
}

export interface WorkerPreviousEmployer {
  name: string;
  mobile: string;
}

export interface WorkerCriminalDeclaration {
  hasCriminalRecord: boolean;
  details: string | null;
  acceptedAt: string;
}

export interface WorkerReferenceItem {
  id: string;
  name: string;
  mobile: string;
  relationship?: string | null;
}

export interface WorkerAvailabilitySchedule {
  engagementPreference?: string | null;
  areas: Array<{ id: string; name: string; city: string; isEnabled?: boolean }>;
  timeWindows: Array<{ start: string; end: string }>;
}

export interface WorkerBlacklistInfo {
  at: string;
  reason: string;
  byUserId?: string | null;
}

export interface WorkerDetail extends Worker {
  serviceRadiusKm: number;
  languages: string[];
  preferredLanguage?: string | null;
  bio: string;
  skills?: string[];
  verification: WorkerVerificationDetail;
  activeEngagementsCount: number;
  completedBookingsCount: number;
  replacementsIncurred: number;
  recentEngagements: WorkerEngagementSummary[];
  internalNotes: string[];
  documents?: WorkerDocumentMetadata[];
  preferredServiceArea?: string;
  expectedCompensation?: string;
  expectedSalary?: number | null;
  experienceMonths?: number | null;
  availability?: string;
  updatedAt?: string;
  applicationReference?: string | null;
  submittedAt?: string | null;
  hasProfilePhoto?: boolean;
  hasEmergencyContact?: boolean;
  emergencyContact?: { name: string; mobile: string; relationship?: string | null } | null;
  address?: WorkerAddress | null;
  previousEmployer?: WorkerPreviousEmployer | null;
  criminalDeclaration?: WorkerCriminalDeclaration | null;
  references?: WorkerReferenceItem[];
  availabilitySchedule?: WorkerAvailabilitySchedule | null;
  missingForSubmission?: string[];
  blacklistInfo?: WorkerBlacklistInfo | null;
}

export interface WorkerFilterCriteria {
  searchTerm?: string;
  category?: string;
  locality?: string;
  verificationStatus?: 'ALL' | 'VERIFIED' | 'PENDING' | 'IN_REVIEW' | 'REJECTED';
  verified?: boolean;
  activated?: boolean;
  accountStatus?: 'ACTIVE' | 'SUSPENDED';
  status?: 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED';
  page?: number;
  pageSize?: number;
  limit?: number;
}

export interface WorkerPageResult {
  items: Worker[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface IWorkerRepository {
  getWorkers(filter?: WorkerFilterCriteria): Promise<Worker[]>;
  getWorkersPage(filter?: WorkerFilterCriteria, page?: number, limit?: number): Promise<WorkerPageResult>;
  getWorkerById(id: string): Promise<WorkerDetail | null>;
  updateWorkerStatus(workerId: string, status: Worker['status'], remarks: string): Promise<void>;
  updateWorkerCategories(workerId: string, categoryCodes: string[]): Promise<void>;
  requestReVerification(workerId: string, checkTypes: string[], remarks: string): Promise<void>;
  activateWorker(workerId: string): Promise<WorkerDetail>;
  approveCheck(checkId: string, remarks?: string): Promise<void>;
  rejectCheck(checkId: string, category: string, remarks: string): Promise<void>;
  rejectWorker(workerId: string, category: string, remarks: string): Promise<void>;
  revealEmergencyContact?(workerId: string, reason: string): Promise<{ name: string; mobile: string }>;
}

