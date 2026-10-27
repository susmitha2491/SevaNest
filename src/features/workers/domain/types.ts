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
  documentType: string;
  documentTypeName: string;
  docNumberMasked?: string;
  status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'EXPIRED' | 'RECHECK_DUE';
  submittedAt?: string;
  verifiedAt?: string;
  recheckDueDate?: string;
  rejectionReason?: string;
  signedUrl?: string;
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
  phoneMasked?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  onboardingStatus?: 'REGISTERED' | 'APPLIED' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED';
  verificationStatus?: 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | 'RECHECK_DUE';
  applicationStatus?: 'SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'ACTIVE' | 'REJECTED' | string;
  activatedAt?: string;
  signedOffAt?: string;
  verificationLevel?: string;
  level?: string;
  createdAt?: string;
  registeredAt?: string;
  completedChecksCount?: number;
  totalRequiredChecksCount?: number;
}

export interface WorkerDetail extends Worker {
  serviceRadiusKm: number;
  languages: string[];
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
  availability?: string;
  updatedAt?: string;
}

export interface WorkerFilterCriteria {
  searchTerm?: string;
  category?: string;
  locality?: string;
  verificationStatus?: 'ALL' | 'VERIFIED' | 'PENDING' | 'IN_REVIEW' | 'REJECTED';
  verified?: boolean;
  status?: 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'BLACKLISTED';
  page?: number;
  pageSize?: number;
  limit?: number;
}

export interface IWorkerRepository {
  getWorkers(filter?: WorkerFilterCriteria): Promise<Worker[]>;
  getWorkerById(id: string): Promise<WorkerDetail | null>;
  updateWorkerStatus(workerId: string, status: Worker['status'], remarks: string): Promise<void>;
  updateWorkerCategories(workerId: string, categoryCodes: string[]): Promise<void>;
  requestReVerification(workerId: string, checkTypes: string[], remarks: string): Promise<void>;
  activateWorker(workerId: string): Promise<WorkerDetail>;
}
