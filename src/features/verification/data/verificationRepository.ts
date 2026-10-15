import {
  VerificationDossier,
  VerificationFilterCriteria,
  PaginatedVerificationQueue,
  IVerificationRepository,
  VerificationCheck,
  VerificationCheckType,
  RejectionReasonCategory,
} from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';
import { ServerFailureError } from '../../../core/errors/DomainError';
import { syncMockWorkerVerification } from '../../workers/data/workerRepository';

export class MockVerificationRepository implements IVerificationRepository {
  private dossiers: VerificationDossier[] = [
    {
      id: 'VQ-101',
      applicationId: 'APP-2026-101',
      workerId: 'W-10482',
      workerName: 'Sunita Devi',
      category: 'House Maid',
      locality: 'Kondapur',
      experienceYears: 6,
      phoneMasked: '+91 98765 *****',
      submissionTime: '2026-10-15T07:15:00Z',
      status: 'PENDING_REVIEW',
      preCheckOtpVerified: true,
      checks: {
        IDENTITY: {
          type: 'IDENTITY',
          title: 'Identity Proof (Aadhaar)',
          status: 'PENDING',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            docNumberMasked: 'XXXX-XXXX-8921',
            nameOnDoc: 'Sunita Devi',
            documentTypeName: 'Aadhaar Card (Front & Back)',
          },
          mockDocumentUrl: 'mock-doc://identity/w-10482-aadhaar.pdf',
        },
        ADDRESS: {
          type: 'ADDRESS',
          title: 'Address Proof',
          status: 'PENDING',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            docNumberMasked: 'ELEC-HYD-49201',
            nameOnDoc: 'Sunita Devi',
            documentTypeName: 'Electricity Utility Bill (Kondapur)',
          },
          mockDocumentUrl: 'mock-doc://address/w-10482-utility.pdf',
        },
        EMERGENCY_CONTACT: {
          type: 'EMERGENCY_CONTACT',
          title: 'Emergency Contact Vetting',
          status: 'PENDING',
          evaluationMethod: 'TELEPHONIC_VETTING',
          contactDetails: {
            contactName: 'Rajesh Devi',
            relationshipOrRole: 'Spouse',
            phoneMasked: '+91 98450 *****',
            callNotes: 'Awaiting initial telephonic verification call',
          },
        },
        REFERENCE: {
          type: 'REFERENCE',
          title: 'Previous Employer Reference',
          status: 'PENDING',
          evaluationMethod: 'TELEPHONIC_VETTING',
          contactDetails: {
            contactName: 'Mrs. S. Sharma',
            relationshipOrRole: 'Prior Employer (Kondapur Residence)',
            phoneMasked: '+91 99881 *****',
            callNotes: 'Awaiting reference feedback call regarding punctuality and conduct',
          },
        },
        POLICE_CLEARANCE: {
          type: 'POLICE_CLEARANCE',
          title: 'Police Clearance Certificate',
          status: 'PENDING',
          evaluationMethod: 'CERTIFICATE_TRACKING',
          documentMetadata: {
            docNumberMasked: 'PCC-CYB-2024-8891',
            nameOnDoc: 'Sunita Devi',
            documentTypeName: 'Cyberabad Police Clearance Certificate',
          },
          mockDocumentUrl: 'mock-doc://police/w-10482-pcc.pdf',
        },
      },
    },
    {
      id: 'VQ-102',
      applicationId: 'APP-2026-102',
      workerId: 'W-10483',
      workerName: 'Ramesh Yadav',
      category: 'Driver',
      locality: 'Madhapur',
      experienceYears: 9,
      phoneMasked: '+91 98450 *****',
      submissionTime: '2026-10-15T08:00:00Z',
      status: 'IN_REVIEW',
      assignedReviewer: 'Verification Executive',
      preCheckOtpVerified: true,
      checks: {
        IDENTITY: {
          type: 'IDENTITY',
          title: 'Identity Proof (Aadhaar)',
          status: 'APPROVED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            docNumberMasked: 'XXXX-XXXX-4512',
            nameOnDoc: 'Ramesh Yadav',
            documentTypeName: 'Aadhaar Card',
          },
          verifiedAt: 'Recent',
          verifiedBy: 'Verification Executive',
        },
        ADDRESS: {
          type: 'ADDRESS',
          title: 'Address Proof',
          status: 'APPROVED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            docNumberMasked: 'GAS-HYD-99120',
            nameOnDoc: 'Ramesh Yadav',
            documentTypeName: 'LPG Gas Connection Bill',
          },
          verifiedAt: 'Recent',
          verifiedBy: 'Verification Executive',
        },
        EMERGENCY_CONTACT: {
          type: 'EMERGENCY_CONTACT',
          title: 'Emergency Contact Vetting',
          status: 'APPROVED',
          evaluationMethod: 'TELEPHONIC_VETTING',
          contactDetails: {
            contactName: 'Geeta Yadav',
            relationshipOrRole: 'Spouse',
            phoneMasked: '+91 97001 *****',
            callNotes: 'Confirmed residential address and marital relationship via phone interview',
          },
          verifiedAt: 'Recent',
          verifiedBy: 'Verification Executive',
        },
        REFERENCE: {
          type: 'REFERENCE',
          title: 'Previous Employer Reference',
          status: 'PENDING',
          evaluationMethod: 'TELEPHONIC_VETTING',
          contactDetails: {
            contactName: 'Mr. Vivek Kapoor',
            relationshipOrRole: 'Prior Employer (Madhapur)',
            phoneMasked: '+91 99490 *****',
            callNotes: 'Scheduled follow-up call for driver safety and route knowledge feedback',
          },
        },
        POLICE_CLEARANCE: {
          type: 'POLICE_CLEARANCE',
          title: 'Police Clearance Certificate',
          status: 'IN_REVIEW',
          evaluationMethod: 'CERTIFICATE_TRACKING',
          documentMetadata: {
            docNumberMasked: 'PCC-HYD-2024-1102',
            nameOnDoc: 'Ramesh Yadav',
            documentTypeName: 'Commercial Driver Police Clearance Certificate',
          },
          mockDocumentUrl: 'mock-doc://police/w-10483-pcc.pdf',
        },
      },
    },
    {
      id: 'VQ-103',
      applicationId: 'APP-2026-103',
      workerId: 'W-10484',
      workerName: 'Meena Bai',
      category: 'Cook',
      locality: 'Gachibowli',
      experienceYears: 4,
      phoneMasked: '+91 91234 *****',
      submissionTime: '2026-10-15T09:30:00Z',
      status: 'PENDING_REVIEW',
      preCheckOtpVerified: true,
      checks: {
        IDENTITY: {
          type: 'IDENTITY',
          title: 'Identity Proof (Aadhaar)',
          status: 'PENDING',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            docNumberMasked: 'XXXX-XXXX-6701',
            nameOnDoc: 'Meena Bai',
            documentTypeName: 'Aadhaar Card',
          },
        },
        ADDRESS: {
          type: 'ADDRESS',
          title: 'Address Proof',
          status: 'PENDING',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            docNumberMasked: 'RENT-AGR-HYD-55',
            nameOnDoc: 'Meena Bai',
            documentTypeName: 'Registered Rent Agreement',
          },
        },
        EMERGENCY_CONTACT: {
          type: 'EMERGENCY_CONTACT',
          title: 'Emergency Contact Vetting',
          status: 'PENDING',
          evaluationMethod: 'TELEPHONIC_VETTING',
          contactDetails: {
            contactName: 'Santosh Bai',
            relationshipOrRole: 'Brother',
            phoneMasked: '+91 98111 *****',
          },
        },
        REFERENCE: {
          type: 'REFERENCE',
          title: 'Previous Employer Reference',
          status: 'PENDING',
          evaluationMethod: 'TELEPHONIC_VETTING',
          contactDetails: {
            contactName: 'Mrs. Ananya V',
            relationshipOrRole: 'Prior Employer (Gachibowli)',
            phoneMasked: '+91 94401 *****',
          },
        },
        POLICE_CLEARANCE: {
          type: 'POLICE_CLEARANCE',
          title: 'Police Clearance Certificate',
          status: 'PENDING',
          evaluationMethod: 'CERTIFICATE_TRACKING',
          documentMetadata: {
            docNumberMasked: 'PCC-HYD-2024-9031',
            nameOnDoc: 'Meena Bai',
            documentTypeName: 'Hyderabad City Police Verification',
          },
        },
      },
    },
    {
      id: 'VQ-104',
      applicationId: 'APP-2026-104',
      workerId: 'W-10485',
      workerName: 'Lakshmi Devi',
      category: 'House Maid',
      locality: 'Hitec City',
      experienceYears: 7,
      phoneMasked: '+91 99887 *****',
      submissionTime: '2026-10-15T10:45:00Z',
      status: 'RECHECK_DUE',
      preCheckOtpVerified: true,
      checks: {
        IDENTITY: {
          type: 'IDENTITY',
          title: 'Identity Proof (Aadhaar)',
          status: 'APPROVED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            docNumberMasked: 'XXXX-XXXX-9900',
            nameOnDoc: 'Lakshmi Devi',
            documentTypeName: 'Aadhaar Card',
          },
        },
        ADDRESS: {
          type: 'ADDRESS',
          title: 'Address Proof',
          status: 'RECHECK_DUE',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            docNumberMasked: 'ELEC-HYD-11029',
            nameOnDoc: 'Lakshmi Devi',
            documentTypeName: 'Annual Address Re-verification',
          },
          recheckDueDate: 'Impending Annual Expiry',
        },
        EMERGENCY_CONTACT: {
          type: 'EMERGENCY_CONTACT',
          title: 'Emergency Contact Vetting',
          status: 'APPROVED',
          evaluationMethod: 'TELEPHONIC_VETTING',
          contactDetails: {
            contactName: 'Venkatesh D',
            relationshipOrRole: 'Spouse',
            phoneMasked: '+91 98499 *****',
          },
        },
        REFERENCE: {
          type: 'REFERENCE',
          title: 'Previous Employer Reference',
          status: 'APPROVED',
          evaluationMethod: 'TELEPHONIC_VETTING',
          contactDetails: {
            contactName: 'Mr. Arvind S',
            relationshipOrRole: 'Prior Employer',
            phoneMasked: '+91 99120 *****',
          },
        },
        POLICE_CLEARANCE: {
          type: 'POLICE_CLEARANCE',
          title: 'Police Clearance Certificate',
          status: 'APPROVED',
          evaluationMethod: 'CERTIFICATE_TRACKING',
          documentMetadata: {
            docNumberMasked: 'PCC-CYB-2023-4011',
            nameOnDoc: 'Lakshmi Devi',
            documentTypeName: 'Annual PCC Renewal Tracked',
          },
        },
      },
    },
    {
      id: 'VQ-105',
      workerId: 'W-10486',
      workerName: 'Anil Rao',
      category: 'Elderly Care Helper',
      locality: 'Banjara Hills',
      experienceYears: 5,
      phoneMasked: '+91 97112 *****',
      submissionTime: 'Recent Submission',
      status: 'REJECTED',
      preCheckOtpVerified: true,
      checks: {
        IDENTITY: {
          type: 'IDENTITY',
          title: 'Identity Proof (Aadhaar)',
          status: 'REJECTED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            docNumberMasked: 'XXXX-XXXX-1122',
            nameOnDoc: 'Anil Kumar',
            documentTypeName: 'Aadhaar Card',
          },
          rejectionCategory: 'NAME_MISMATCH',
          rejectionRemarks: 'Name on Aadhaar (Anil Kumar) does not match profile registration name (Anil Rao).',
        },
        ADDRESS: {
          type: 'ADDRESS',
          title: 'Address Proof',
          status: 'PENDING',
          evaluationMethod: 'DOCUMENT_INSPECTION',
        },
        EMERGENCY_CONTACT: {
          type: 'EMERGENCY_CONTACT',
          title: 'Emergency Contact Vetting',
          status: 'PENDING',
          evaluationMethod: 'TELEPHONIC_VETTING',
        },
        REFERENCE: {
          type: 'REFERENCE',
          title: 'Previous Employer Reference',
          status: 'PENDING',
          evaluationMethod: 'TELEPHONIC_VETTING',
        },
        POLICE_CLEARANCE: {
          type: 'POLICE_CLEARANCE',
          title: 'Police Clearance Certificate',
          status: 'PENDING',
          evaluationMethod: 'CERTIFICATE_TRACKING',
        },
      },
    },
    {
      id: 'VQ-106',
      workerId: 'W-10487',
      workerName: 'Suresh Kumar',
      category: 'General Housekeeper',
      locality: 'Jubilee Hills',
      experienceYears: 6,
      phoneMasked: '+91 98765 *****',
      submissionTime: 'Completed Verification',
      status: 'APPROVED',
      preCheckOtpVerified: true,
      checks: {
        IDENTITY: {
          type: 'IDENTITY',
          title: 'Identity Proof (Aadhaar)',
          status: 'APPROVED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          verifiedAt: '2026-10-14T10:00:00Z',
          verifiedBy: 'Verification Executive',
        },
        ADDRESS: {
          type: 'ADDRESS',
          title: 'Address Proof',
          status: 'APPROVED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          verifiedAt: '2026-10-14T10:05:00Z',
          verifiedBy: 'Verification Executive',
        },
        EMERGENCY_CONTACT: {
          type: 'EMERGENCY_CONTACT',
          title: 'Emergency Contact Vetting',
          status: 'APPROVED',
          evaluationMethod: 'TELEPHONIC_VETTING',
          verifiedAt: '2026-10-14T10:10:00Z',
          verifiedBy: 'Verification Executive',
        },
        REFERENCE: {
          type: 'REFERENCE',
          title: 'Previous Employer Reference',
          status: 'APPROVED',
          evaluationMethod: 'TELEPHONIC_VETTING',
          verifiedAt: '2026-10-14T10:15:00Z',
          verifiedBy: 'Verification Executive',
        },
        POLICE_CLEARANCE: {
          type: 'POLICE_CLEARANCE',
          title: 'Police Clearance Certificate',
          status: 'APPROVED',
          evaluationMethod: 'CERTIFICATE_TRACKING',
          verifiedAt: '2026-10-14T10:20:00Z',
          verifiedBy: 'Verification Executive',
        },
      },
    },
  ];

  async getVerificationQueue(filter?: VerificationFilterCriteria): Promise<PaginatedVerificationQueue> {
    let result = [...this.dossiers];

    if (filter?.status && filter.status !== 'ALL') {
      result = result.filter((item) => item.status === filter.status);
    }

    if (filter?.category && filter.category !== 'ALL') {
      result = result.filter((item) => item.category === filter.category);
    }

    if (filter?.searchTerm) {
      const q = filter.searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.workerName.toLowerCase().includes(q) ||
          item.workerId.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.locality.toLowerCase().includes(q)
      );
    }

    const page = filter?.page || 1;
    const pageSize = filter?.pageSize || 10;
    const totalCount = result.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const paginated = result.slice((page - 1) * pageSize, page * pageSize);

    return {
      items: paginated,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  }

  async getDossierById(dossierId: string): Promise<VerificationDossier | null> {
    const item = this.dossiers.find((d) => d.id === dossierId || d.workerId === dossierId);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async claimDossier(dossierId: string): Promise<void> {
    const item = this.dossiers.find((d) => d.id === dossierId || d.workerId === dossierId);
    if (item && item.status === 'PENDING_REVIEW') {
      item.status = 'IN_REVIEW';
      item.assignedReviewer = 'Verification Executive';
    }
  }

  async approveCheck(dossierId: string, checkType: VerificationCheckType, notes?: string): Promise<void> {
    const item = this.dossiers.find((d) => d.id === dossierId || d.workerId === dossierId);
    if (item && item.checks[checkType]) {
      item.checks[checkType].status = 'APPROVED';
      item.checks[checkType].verifiedAt = 'Recent';
      item.checks[checkType].verifiedBy = 'Verification Executive';
      if (notes && item.checks[checkType].contactDetails) {
        item.checks[checkType].contactDetails!.callNotes = notes;
      }

      // Check if all 5 checks are approved + pre-check is passed
      const allOpsApproved = (['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'REFERENCE', 'POLICE_CLEARANCE'] as VerificationCheckType[]).every(
        (t) => item.checks[t]?.status === 'APPROVED'
      );

      if (allOpsApproved && item.preCheckOtpVerified) {
        item.status = 'APPROVED';
        syncMockWorkerVerification(item.workerId, true);
      } else {
        item.status = 'IN_REVIEW';
      }
    }
  }

  async rejectCheck(
    dossierId: string,
    checkType: VerificationCheckType,
    category: RejectionReasonCategory,
    remarks: string
  ): Promise<void> {
    const item = this.dossiers.find((d) => d.id === dossierId || d.workerId === dossierId);
    if (item && item.checks[checkType]) {
      item.checks[checkType].status = 'REJECTED';
      item.checks[checkType].rejectionCategory = category;
      item.checks[checkType].rejectionRemarks = remarks;
      item.status = 'REJECTED';
      item.overallRemarks = remarks;
      syncMockWorkerVerification(item.workerId, false);
    }
  }

  async requestReVerification(
    dossierId: string,
    checkTypes: VerificationCheckType[],
    instructions: string
  ): Promise<void> {
    const item = this.dossiers.find((d) => d.id === dossierId || d.workerId === dossierId);
    if (item) {
      item.status = 'RECHECK_DUE';
      item.overallRemarks = instructions;
      checkTypes.forEach((t) => {
        if (item.checks[t]) {
          item.checks[t].status = 'RECHECK_DUE';
        }
      });
      syncMockWorkerVerification(item.workerId, false);
    }
  }

  async getSignedDocumentUrl(
    dossierId: string,
    checkType: VerificationCheckType,
    documentId?: string
  ): Promise<{ signedUrl: string; expiresAt: string }> {
    const targetId = documentId || dossierId;
    return {
      signedUrl: `https://storage.sevanest.internal/documents/vault/${targetId}/${checkType.toLowerCase()}?token=access_token_${Date.now()}`,
      expiresAt: '15-minute access token',
    };
  }

  async submitFinalDecision(
    dossierId: string,
    decision: 'APPROVED' | 'REJECTED' | 'CORRECTIONS_REQUESTED',
    remarks?: string
  ): Promise<void> {
    const item = this.dossiers.find((d) => d.id === dossierId || d.workerId === dossierId);
    if (item) {
      item.status = decision === 'APPROVED' ? 'APPROVED' : decision === 'REJECTED' ? 'REJECTED' : 'PENDING_REVIEW';
      item.overallRemarks = remarks;
      if (decision === 'APPROVED') {
        (Object.keys(item.checks) as VerificationCheckType[]).forEach((t) => {
          if (item.checks[t]) {
            item.checks[t].status = 'APPROVED';
          }
        });
        syncMockWorkerVerification(item.workerId, true);
      } else if (decision === 'REJECTED') {
        syncMockWorkerVerification(item.workerId, false);
      }
    }
  }
}

function defaultCheck(type: VerificationCheckType, title: string): VerificationCheck {
  return {
    type,
    title,
    status: 'PENDING',
    evaluationMethod: (type === 'EMERGENCY_CONTACT' || type === 'REFERENCE') ? 'TELEPHONIC_VETTING' : 'DOCUMENT_INSPECTION',
  };
}

function mapChecks(raw: unknown): Record<VerificationCheckType, VerificationCheck> {
  const result: Record<VerificationCheckType, VerificationCheck> = {
    IDENTITY: defaultCheck('IDENTITY', 'Identity Proof'),
    ADDRESS: defaultCheck('ADDRESS', 'Address Proof'),
    EMERGENCY_CONTACT: defaultCheck('EMERGENCY_CONTACT', 'Emergency Contact Vetting'),
    REFERENCE: defaultCheck('REFERENCE', 'Previous Employer Reference'),
    POLICE_CLEARANCE: defaultCheck('POLICE_CLEARANCE', 'Police Clearance Certificate'),
  };

  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      if (item && typeof item === 'object' && item.type && item.type in result) {
        const typeKey = item.type as VerificationCheckType;
        result[typeKey] = {
          id: String(item.id || item.checkId || ''),
          type: typeKey,
          title: String(item.title || result[typeKey].title),
          status: (item.status as VerificationCheck['status']) || 'PENDING',
          evaluationMethod: item.evaluationMethod || result[typeKey].evaluationMethod,
          documentMetadata: item.documentMetadata || (item.documentNumber ? { docNumberMasked: String(item.documentNumber), documentTypeName: String(item.documentType || 'Document') } : undefined),
          contactDetails: item.contactDetails,
          rejectionCategory: item.rejectionCategory,
          rejectionRemarks: item.rejectionRemarks || item.remarks,
          verifiedAt: item.verifiedAt ? String(item.verifiedAt) : undefined,
          verifiedBy: item.verifiedBy ? String(item.verifiedBy) : undefined,
          recheckDueDate: item.recheckDueDate ? String(item.recheckDueDate) : undefined,
        };
      }
    });
  } else if (raw && typeof raw === 'object') {
    const c = raw as Record<string, unknown>;
    (['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'REFERENCE', 'POLICE_CLEARANCE'] as VerificationCheckType[]).forEach((t) => {
      if (c[t]) {
        result[t] = c[t] as VerificationCheck;
      }
    });
  }

  return result;
}

export class RealVerificationRepository implements IVerificationRepository {
  async getVerificationQueue(
    filter?: VerificationFilterCriteria
  ): Promise<PaginatedVerificationQueue> {
    try {
      const page = filter?.page || 1;
      const pageSize = filter?.pageSize || 10;
      const params: Record<string, unknown> = {
        page,
        limit: pageSize,
        sortBy: filter?.sortBy || 'submittedAt',
        sortOrder: filter?.sortOrder || 'asc',
      };
      if (filter?.status && filter.status !== 'ALL') {
        params.status = filter.status;
      }
      if (filter?.searchTerm) {
        params.search = filter.searchTerm;
      }
      if (filter?.category && filter.category !== 'ALL') {
        params.category = filter.category;
      }

      const res = await httpClient.get<
        | {
            success?: boolean;
            data?: Record<string, unknown>[];
            items?: Record<string, unknown>[];
            meta?: { totalItems?: number; currentPage?: number; itemsPerPage?: number; totalPages?: number };
            totalCount?: number;
          }
        | Record<string, unknown>[]
      >('/admin/verification/queue', { params });

      const payload = res.data;
      const rawItems = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.items)
        ? payload.items
        : [];

      const mapped: VerificationDossier[] = rawItems.map((raw: Record<string, unknown>) => {
        const worker = (raw.worker || raw.workerProfile || raw.applicant) as Record<string, unknown> | undefined;
        const reviewer = (raw.reviewer || raw.assignedTo || raw.assignedReviewer) as Record<string, unknown> | undefined;

        // Legitimate application ID or reference number
        // Do not substitute UUIDs for readable labels when a legitimate application ID exists.
        const rawAppRef = raw.applicationNumber || raw.applicationId || raw.referenceNumber || raw.applicationCode || raw.dossierNumber;
        const rawId = raw.id || raw.checkId || raw.dossierId || '';
        const id = String(rawId);
        const applicationId = rawAppRef ? String(rawAppRef) : undefined;

        // Real worker name - Never invent worker names or applicant details
        const workerName = String(
          raw.workerName ||
          worker?.fullName ||
          worker?.name ||
          raw.fullName ||
          raw.applicantName ||
          ''
        ).trim() || 'Applicant Name Unavailable';

        // Service category
        const category = String(
          raw.category ||
          raw.serviceCategory ||
          raw.serviceType ||
          worker?.category ||
          worker?.primaryCategory ||
          'General'
        );

        // Locality
        const locality = String(
          raw.locality ||
          raw.area ||
          raw.city ||
          worker?.locality ||
          worker?.area ||
          worker?.city ||
          'Hyderabad'
        );

        // Experience
        const experienceYears = Number(
          raw.experienceYears ??
          raw.experience ??
          worker?.experienceYears ??
          worker?.experience ??
          0
        );

        // Masked phone
        const phoneMasked = String(
          raw.phoneMasked ||
          worker?.phoneMasked ||
          (worker?.phone ? `${String(worker.phone).slice(0, 5)} *****` : '+91 *****')
        );

        // Genuine submission timestamp
        const rawTimestamp = raw.submittedAt || raw.createdAt || raw.applicationDate || raw.submissionTime;
        const submissionTime = rawTimestamp ? String(rawTimestamp) : '';

        // Status
        const status = (raw.status as VerificationDossier['status']) || 'PENDING_REVIEW';

        // Reviewer
        const assignedReviewer = (raw.assignedReviewer || reviewer?.name || reviewer?.fullName)
          ? String(raw.assignedReviewer || reviewer?.name || reviewer?.fullName)
          : undefined;

        return {
          id,
          applicationId,
          workerId: String(raw.workerId || worker?.id || raw.userId || id),
          workerName,
          category,
          locality,
          experienceYears,
          phoneMasked,
          submissionTime,
          status,
          assignedReviewer,
          preCheckOtpVerified: Boolean(raw.preCheckOtpVerified ?? true),
          checks: mapChecks(raw.checks),
        };
      });

      // Deduplicate applications by unique application reference/id to prevent duplicate rows
      const seenIds = new Set<string>();
      const deduped: VerificationDossier[] = [];
      for (const item of mapped) {
        const uniqueKey = item.applicationId || item.id;
        if (!seenIds.has(uniqueKey)) {
          seenIds.add(uniqueKey);
          deduped.push(item);
        }
      }

      // Confirm oldest-first ordering uses real submission timestamp
      deduped.sort((a, b) => {
        const timeA = a.submissionTime ? new Date(a.submissionTime).getTime() : Infinity;
        const timeB = b.submissionTime ? new Date(b.submissionTime).getTime() : Infinity;
        return timeA - timeB;
      });

      const serverTotal = !Array.isArray(payload) ? (payload.meta?.totalItems ?? payload.totalCount) : undefined;
      const totalCount = typeof serverTotal === 'number' ? serverTotal : deduped.length;
      const serverTotalPages = !Array.isArray(payload) ? payload.meta?.totalPages : undefined;
      const totalPages = typeof serverTotalPages === 'number' ? serverTotalPages : (Math.ceil(totalCount / pageSize) || 1);
      return {
        items: deduped,
        totalCount,
        page,
        pageSize,
        totalPages,
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getDossierById(dossierId: string): Promise<VerificationDossier | null> {
    try {
      const res = await httpClient.get<{ success: boolean; data: Record<string, unknown> }>(
        `/admin/workers/${dossierId}/verification`
      );
      const raw = res.data.data;
      if (!raw) return null;

      const worker = (raw.worker || raw.workerProfile || raw.applicant) as Record<string, unknown> | undefined;
      const rawAppRef = raw.applicationNumber || raw.applicationId || raw.referenceNumber || raw.applicationCode || raw.dossierNumber;
      const applicationId = rawAppRef ? String(rawAppRef) : undefined;
      const workerName = String(
        raw.workerName ||
        worker?.fullName ||
        worker?.name ||
        raw.fullName ||
        raw.applicantName ||
        ''
      ).trim() || 'Applicant Name Unavailable';

      return {
        id: String(raw.id || dossierId),
        applicationId,
        workerId: String(raw.workerId || worker?.id || dossierId),
        workerName,
        category: String(raw.category || raw.serviceCategory || worker?.category || 'General'),
        locality: String(raw.locality || raw.area || worker?.locality || 'Hyderabad'),
        experienceYears: Number(raw.experienceYears ?? raw.experience ?? worker?.experienceYears ?? 0),
        phoneMasked: String(raw.phoneMasked || worker?.phoneMasked || '+91 *****'),
        submissionTime: String(raw.submittedAt || raw.createdAt || raw.applicationDate || ''),
        status: (raw.status as VerificationDossier['status']) || 'PENDING_REVIEW',
        assignedReviewer: (raw.assignedReviewer || raw.reviewer) ? String(raw.assignedReviewer || raw.reviewer) : undefined,
        preCheckOtpVerified: Boolean(raw.preCheckOtpVerified ?? true),
        checks: mapChecks(raw.checks),
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async claimDossier(dossierId: string): Promise<void> {
    try {
      await httpClient.post(`/admin/verification/checks/${dossierId}/start-review`);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async approveCheck(dossierId: string, _checkType: VerificationCheckType, notes?: string): Promise<void> {
    try {
      await httpClient.post(`/admin/verification/checks/${dossierId}/approve`, {
        remarks: notes || 'Approved by admin',
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async rejectCheck(
    dossierId: string,
    _checkType: VerificationCheckType,
    _category: RejectionReasonCategory,
    remarks: string
  ): Promise<void> {
    try {
      await httpClient.post(`/admin/verification/checks/${dossierId}/reject`, {
        remarks: remarks || 'Rejected by admin',
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async requestReVerification(
    dossierId: string,
    _checkTypes: VerificationCheckType[],
    instructions: string
  ): Promise<void> {
    try {
      await httpClient.post(`/admin/verification/checks/${dossierId}/recheck`, {
        remarks: instructions || 'Re-verification requested by admin',
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getSignedDocumentUrl(
    dossierId: string,
    checkType: VerificationCheckType,
    documentId?: string
  ): Promise<{ signedUrl: string; expiresAt: string }> {
    try {
      const targetId = documentId || dossierId;
      const res = await httpClient.get<{
        success?: boolean;
        data?: { url?: string; signedUrl?: string; expiresAt?: string };
        url?: string;
        signedUrl?: string;
        expiresAt?: string;
      }>(
        `/admin/verification/documents/${targetId}/link`,
        { params: { checkType } }
      );
      const payload = res.data?.data || res.data;
      const signedUrl = payload?.url || payload?.signedUrl;
      if (!signedUrl || typeof signedUrl !== 'string' || signedUrl.trim() === '') {
        throw new ServerFailureError(
          'Authorized signed document URL was not provided by the backend vault. Required contract: GET /api/v1/admin/verification/documents/{documentId}/link'
        );
      }
      return {
        signedUrl,
        expiresAt: payload?.expiresAt || 'Temporary short-lived token',
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async submitFinalDecision(
    dossierId: string,
    decision: 'APPROVED' | 'REJECTED' | 'CORRECTIONS_REQUESTED',
    remarks?: string
  ): Promise<void> {
    try {
      await httpClient.post(`/admin/verification/checks/${dossierId}/decision`, {
        decision,
        remarks: remarks || `Final verification decision: ${decision}`,
      }).catch(async (err) => {
        if (err?.response?.status === 404) {
          await httpClient.post(`/admin/workers/${dossierId}/verification/decision`, {
            decision,
            remarks: remarks || `Final verification decision: ${decision}`,
          });
        } else {
          throw err;
        }
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }
}

export { RealVerificationRepository as VerificationRepositoryImpl };

export const createVerificationRepository = (
  useMock: boolean = env.VITE_USE_MOCK_AUTH
): IVerificationRepository => {
  return useMock ? new MockVerificationRepository() : new RealVerificationRepository();
};

export const verificationRepository = createVerificationRepository();
