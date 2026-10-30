import {
  VerificationDossier,
  VerificationFilterCriteria,
  PaginatedVerificationQueue,
  IVerificationRepository,
  VerificationCheck,
  VerificationCheckType,
  VerificationCheckStatus,
  RejectionReasonCategory,
  FinalOnboardingResult,
  AdminWorkerVerificationResponse,
  AdminCheckView,
  VerificationDocumentMetadata,
} from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';
import { DomainError, ServerFailureError, ValidationError, ConcurrencyConflictError, NotFoundError } from '../../../core/errors/DomainError';
import { useAuthStore } from '../../../core/auth/authStore';
import { syncMockWorkerVerification } from '../../workers/data/workerRepository';
import { validateDocumentSignedUrl, isSafeDocumentUrl } from '../domain/documentUrlValidator';

export class MockVerificationRepository implements IVerificationRepository {
  private dossiers: VerificationDossier[] = [
    {
      id: 'VQ-101',
      checkId: 'chk-identity-101',
      applicationId: 'APP-10482',
      workerId: 'W-10482',
      workerName: 'Sunita Devi',
      category: 'House Maid',
      locality: 'Kondapur',
      experienceYears: 6,
      phoneMasked: '+91 98765 *****',
      phone: '+91 98765 43210',
      email: 'sunita.devi@sevanest.worker',
      submissionTime: '2026-10-15T07:15:00Z',
      status: 'PENDING_REVIEW',
      preCheckOtpVerified: true,
      address: {
        line1: 'Flat 302, Sai Residency',
        line2: 'Silpa Gram Craft Village Road',
        locality: 'Kondapur',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500084',
      },
      languages: ['Hindi', 'Telugu'],
      skills: ['Deep Cleaning', 'Kitchen Sanitation', 'Laundry & Ironing', 'Mopping'],
      availability: 'Available for Immediate Allocation',
      expectedSalary: '₹18,000 / month',
      emergencyContact: {
        name: 'Rajesh Devi',
        relationship: 'Spouse',
        phoneMasked: '+91 98450 *****',
        phone: '+91 98450 12345',
      },
      previousEmployer: {
        name: 'Mrs. S. Sharma',
        role: 'Prior Employer (Kondapur Residence)',
        phoneMasked: '+91 99881 *****',
        phone: '+91 99881 67890',
        period: '2 Years (2024-2026)',
        feedback: 'Exemplary conduct, trustworthy and punctual.',
      },
      accountStatus: 'ACTIVE',
      checks: {
        IDENTITY: {
          id: 'chk-identity-101',
          type: 'IDENTITY',
          title: 'Identity Proof (Aadhaar)',
          status: 'PENDING',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            documentId: 'doc-id-101',
            docNumberMasked: 'XXXX-XXXX-8921',
            nameOnDoc: 'Sunita Devi',
            documentTypeName: 'Aadhaar Card (Front & Back)',
          },
          mockDocumentUrl: 'mock-doc://identity/w-10482-aadhaar.pdf',
          history: [
            {
              fromStatus: null,
              toStatus: 'SUBMITTED',
              actorUserId: 'worker-app',
              actorName: 'Worker Mobile App',
              remarks: 'Initial identity proof upload via Aadhaar OCR',
              createdAt: '2026-10-15T07:15:00Z',
            },
          ],
        },
        ADDRESS: {
          id: 'chk-address-101',
          type: 'ADDRESS',
          title: 'Address Proof',
          status: 'PENDING',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            documentId: 'doc-addr-101',
            docNumberMasked: 'ELEC-HYD-49201',
            nameOnDoc: 'Sunita Devi',
            documentTypeName: 'Electricity Utility Bill (Kondapur)',
          },
          mockDocumentUrl: 'mock-doc://address/w-10482-utility.pdf',
        },
        EMERGENCY_CONTACT: {
          id: 'chk-emergency-101',
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
          id: 'chk-reference-101',
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
          id: 'chk-police-101',
          type: 'POLICE_CLEARANCE',
          title: 'Police Clearance Certificate',
          status: 'PENDING',
          evaluationMethod: 'CERTIFICATE_TRACKING',
          documentMetadata: {
            documentId: 'doc-pcc-101',
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
      checkId: 'chk-identity-102',
      applicationId: 'APP-10483',
      workerId: 'W-10483',
      workerName: 'Ramesh Yadav',
      category: 'Driver',
      locality: 'Madhapur',
      experienceYears: 9,
      phoneMasked: '+91 98450 *****',
      phone: '+91 98450 12345',
      email: 'ramesh.yadav@sevanest.worker',
      submissionTime: '2026-10-15T08:00:00Z',
      status: 'IN_REVIEW',
      reviewerUserId: 'adm-003',
      claimedAt: '2026-10-15T08:00:00Z',
      preCheckOtpVerified: true,
      address: {
        line1: 'House 14-B, Near Madhapur Metro',
        line2: 'Ayyappa Society Main Road',
        locality: 'Madhapur',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
      },
      languages: ['Hindi', 'Telugu', 'Basic English'],
      skills: ['Automatic Transmission', 'Manual Transmission', 'Highway Driving', 'City Navigation'],
      availability: 'Available for Allocation',
      expectedSalary: '₹22,000 / month',
      emergencyContact: {
        name: 'Geeta Yadav',
        relationship: 'Spouse',
        phoneMasked: '+91 97001 *****',
        phone: '+91 97001 54321',
      },
      previousEmployer: {
        name: 'Mr. Vivek Kapoor',
        role: 'Prior Employer (Madhapur)',
        phoneMasked: '+91 99490 *****',
        phone: '+91 99490 88211',
        period: '3 Years (2023-2026)',
        feedback: 'Cautious driver, excellent knowledge of Hyderabad routes.',
      },
      accountStatus: 'ACTIVE',
      checks: {
        IDENTITY: {
          id: 'chk-identity-102',
          type: 'IDENTITY',
          title: 'Identity Proof (Aadhaar)',
          status: 'APPROVED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            documentId: 'doc-id-102',
            docNumberMasked: 'XXXX-XXXX-4512',
            nameOnDoc: 'Ramesh Yadav',
            documentTypeName: 'Aadhaar Card',
          },
          verifiedAt: 'Recent',
          verifiedBy: 'adm-003',
          history: [
            {
              fromStatus: 'SUBMITTED',
              toStatus: 'IN_REVIEW',
              actorUserId: 'adm-003',
              actorName: 'Verification Executive',
              remarks: 'Claimed review and verified Aadhaar number match',
              createdAt: '2026-10-15T08:05:00Z',
            },
            {
              fromStatus: 'IN_REVIEW',
              toStatus: 'APPROVED',
              actorUserId: 'adm-003',
              actorName: 'Verification Executive',
              remarks: 'Identity document verified with UIDAI format',
              createdAt: '2026-10-15T08:15:00Z',
            },
          ],
        },
        ADDRESS: {
          id: 'chk-address-102',
          type: 'ADDRESS',
          title: 'Address Proof',
          status: 'APPROVED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            documentId: 'doc-addr-102',
            docNumberMasked: 'GAS-HYD-99120',
            nameOnDoc: 'Ramesh Yadav',
            documentTypeName: 'LPG Gas Connection Bill',
          },
          verifiedAt: 'Recent',
          verifiedBy: 'adm-003',
        },
        EMERGENCY_CONTACT: {
          id: 'chk-emergency-102',
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
          verifiedBy: 'adm-003',
        },
        REFERENCE: {
          id: 'chk-reference-102',
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
          id: 'chk-police-102',
          type: 'POLICE_CLEARANCE',
          title: 'Police Clearance Certificate',
          status: 'IN_REVIEW',
          evaluationMethod: 'CERTIFICATE_TRACKING',
          documentMetadata: {
            documentId: 'doc-pcc-102',
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
      checkId: 'chk-identity-103',
      applicationId: 'W-10484',
      workerId: 'W-10484',
      workerName: 'Meena Bai',
      category: 'Cook',
      locality: 'Gachibowli',
      experienceYears: 4,
      phoneMasked: '+91 91234 *****',
      phone: '+91 91234 56789',
      email: 'meena.bai@sevanest.worker',
      submissionTime: '2026-10-15T09:30:00Z',
      status: 'PENDING_REVIEW',
      reviewerUserId: 'adm-002',
      claimedAt: '2026-10-15T09:30:00Z',
      preCheckOtpVerified: true,
      checks: {
        IDENTITY: {
          id: 'chk-identity-103',
          type: 'IDENTITY',
          title: 'Identity Proof (Aadhaar)',
          status: 'PENDING',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            documentId: 'doc-id-103',
            docNumberMasked: 'XXXX-XXXX-6701',
            nameOnDoc: 'Meena Bai',
            documentTypeName: 'Aadhaar Card',
          },
        },
        ADDRESS: {
          id: 'chk-address-103',
          type: 'ADDRESS',
          title: 'Address Proof',
          status: 'PENDING',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            documentId: 'doc-addr-103',
            docNumberMasked: 'RENT-AGR-HYD-55',
            nameOnDoc: 'Meena Bai',
            documentTypeName: 'Registered Rent Agreement',
          },
        },
        EMERGENCY_CONTACT: {
          id: 'chk-emergency-103',
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
          id: 'chk-reference-103',
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
          id: 'chk-police-103',
          type: 'POLICE_CLEARANCE',
          title: 'Police Clearance Certificate',
          status: 'PENDING',
          evaluationMethod: 'CERTIFICATE_TRACKING',
          documentMetadata: {
            documentId: 'doc-pcc-103',
            docNumberMasked: 'PCC-HYD-2024-9031',
            nameOnDoc: 'Meena Bai',
            documentTypeName: 'Hyderabad City Police Verification',
          },
        },
      },
    },
    {
      id: 'VQ-104',
      checkId: 'chk-identity-104',
      applicationId: 'W-10485',
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
          id: 'chk-identity-104',
          type: 'IDENTITY',
          title: 'Identity Proof (Aadhaar)',
          status: 'APPROVED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            documentId: 'doc-id-104',
            docNumberMasked: 'XXXX-XXXX-9900',
            nameOnDoc: 'Lakshmi Devi',
            documentTypeName: 'Aadhaar Card',
          },
        },
        ADDRESS: {
          id: 'chk-address-104',
          type: 'ADDRESS',
          title: 'Address Proof',
          status: 'RECHECK_DUE',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            documentId: 'doc-addr-104',
            docNumberMasked: 'ELEC-HYD-11029',
            nameOnDoc: 'Lakshmi Devi',
            documentTypeName: 'Annual Address Re-verification',
          },
          recheckDueDate: 'Impending Annual Expiry',
        },
        EMERGENCY_CONTACT: {
          id: 'chk-emergency-104',
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
          id: 'chk-reference-104',
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
          id: 'chk-police-104',
          type: 'POLICE_CLEARANCE',
          title: 'Police Clearance Certificate',
          status: 'APPROVED',
          evaluationMethod: 'CERTIFICATE_TRACKING',
          documentMetadata: {
            documentId: 'doc-pcc-104',
            docNumberMasked: 'PCC-CYB-2023-4011',
            nameOnDoc: 'Lakshmi Devi',
            documentTypeName: 'Annual PCC Renewal Tracked',
          },
        },
      },
    },
    {
      id: 'VQ-105',
      checkId: 'chk-identity-105',
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
          id: 'chk-identity-105',
          type: 'IDENTITY',
          title: 'Identity Proof (Aadhaar)',
          status: 'REJECTED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          documentMetadata: {
            documentId: 'doc-id-105',
            docNumberMasked: 'XXXX-XXXX-1122',
            nameOnDoc: 'Anil Kumar',
            documentTypeName: 'Aadhaar Card',
          },
          rejectionCategory: 'NAME_MISMATCH',
          rejectionRemarks: 'Name on Aadhaar (Anil Kumar) does not match profile registration name (Anil Rao).',
        },
        ADDRESS: {
          id: 'chk-address-105',
          type: 'ADDRESS',
          title: 'Address Proof',
          status: 'PENDING',
          evaluationMethod: 'DOCUMENT_INSPECTION',
        },
        EMERGENCY_CONTACT: {
          id: 'chk-emergency-105',
          type: 'EMERGENCY_CONTACT',
          title: 'Emergency Contact Vetting',
          status: 'PENDING',
          evaluationMethod: 'TELEPHONIC_VETTING',
        },
        REFERENCE: {
          id: 'chk-reference-105',
          type: 'REFERENCE',
          title: 'Previous Employer Reference',
          status: 'PENDING',
          evaluationMethod: 'TELEPHONIC_VETTING',
        },
        POLICE_CLEARANCE: {
          id: 'chk-police-105',
          type: 'POLICE_CLEARANCE',
          title: 'Police Clearance Certificate',
          status: 'PENDING',
          evaluationMethod: 'CERTIFICATE_TRACKING',
        },
      },
    },
    {
      id: 'VQ-106',
      checkId: 'chk-identity-106',
      workerId: 'W-10487',
      workerName: 'Suresh Kumar',
      category: 'General Housekeeper',
      locality: 'Jubilee Hills',
      experienceYears: 6,
      phoneMasked: '+91 98765 *****',
      submissionTime: 'Completed Verification',
      status: 'APPROVED',
      reviewerUserId: 'adm-003',
      claimedAt: '2026-10-14T10:00:00Z',
      preCheckOtpVerified: true,
      checks: {
        IDENTITY: {
          id: 'chk-identity-106',
          type: 'IDENTITY',
          title: 'Identity Proof (Aadhaar)',
          status: 'APPROVED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          verifiedAt: '2026-10-14T10:00:00Z',
          verifiedBy: 'adm-003',
        },
        ADDRESS: {
          id: 'chk-address-106',
          type: 'ADDRESS',
          title: 'Address Proof',
          status: 'APPROVED',
          evaluationMethod: 'DOCUMENT_INSPECTION',
          verifiedAt: '2026-10-14T10:05:00Z',
          verifiedBy: 'adm-003',
        },
        EMERGENCY_CONTACT: {
          id: 'chk-emergency-106',
          type: 'EMERGENCY_CONTACT',
          title: 'Emergency Contact Vetting',
          status: 'APPROVED',
          evaluationMethod: 'TELEPHONIC_VETTING',
          verifiedAt: '2026-10-14T10:10:00Z',
          verifiedBy: 'adm-003',
        },
        REFERENCE: {
          id: 'chk-reference-106',
          type: 'REFERENCE',
          title: 'Previous Employer Reference',
          status: 'APPROVED',
          evaluationMethod: 'TELEPHONIC_VETTING',
          verifiedAt: '2026-10-14T10:15:00Z',
          verifiedBy: 'adm-003',
        },
        POLICE_CLEARANCE: {
          id: 'chk-police-106',
          type: 'POLICE_CLEARANCE',
          title: 'Police Clearance Certificate',
          status: 'APPROVED',
          evaluationMethod: 'CERTIFICATE_TRACKING',
          verifiedAt: '2026-10-14T10:20:00Z',
          verifiedBy: 'adm-003',
        },
      },
    },
  ];

  async getVerificationQueue(filter?: VerificationFilterCriteria): Promise<PaginatedVerificationQueue> {
    let result = [...this.dossiers];

    if (filter?.status && filter.status !== 'ALL') {
      result = result.filter((item) => item.status === filter.status);
    }

    if (filter?.categoryId) {
      result = result.filter((item) => item.category === filter.categoryId || item.category.toLowerCase().includes(filter.categoryId!.toLowerCase()));
    } else if (filter?.category && filter.category !== 'ALL') {
      result = result.filter((item) => item.category === filter.category);
    }

    if (filter?.assignedTo === 'me') {
      const currentUserId = useAuthStore.getState().user?.id || 'adm-003';
      result = result.filter((item) => item.reviewerUserId === currentUserId);
    } else if (filter?.reviewerId) {
      result = result.filter((item) => item.reviewerUserId === filter.reviewerId);
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

  async getDossierById(workerId: string): Promise<VerificationDossier | null> {
    if (!workerId || typeof workerId !== 'string' || workerId.trim() === '') {
      throw new ValidationError('A valid workerId is required to fetch verification dossier.');
    }
    const cleanWorkerId = workerId.trim();
    if (cleanWorkerId.startsWith('chk-') || cleanWorkerId.startsWith('check-')) {
      throw new ValidationError('Invalid workerId: checkId cannot be substituted for workerId.');
    }
    const item = this.dossiers.find((d) => d.workerId === cleanWorkerId || d.id === cleanWorkerId);
    if (!item) return null;
    const copy = JSON.parse(JSON.stringify(item)) as VerificationDossier;
    if (!copy.submittedDocuments || copy.submittedDocuments.length === 0) {
      copy.submittedDocuments = Object.values(copy.checks)
        .filter((c) => c.documentMetadata?.documentId)
        .map((c) => ({
          ...c.documentMetadata!,
          reviewable: true,
          available: true,
          availability: 'AVAILABLE',
          checkType: c.type,
          checkTitle: c.title,
          checkId: c.id,
        }));
    } else {
      copy.submittedDocuments = copy.submittedDocuments.map((d) => ({
        ...d,
        reviewable: d.reviewable !== false,
        available: d.available !== false,
      }));
    }
    Object.values(copy.checks).forEach((c) => {
      if (c.documentMetadata) {
        c.documentMetadata.reviewable = c.documentMetadata.reviewable !== false;
        c.documentMetadata.available = c.documentMetadata.available !== false;
      }
      if (Array.isArray(c.documents)) {
        c.documents.forEach((d) => {
          d.reviewable = d.reviewable !== false;
          d.available = d.available !== false;
        });
      }
    });
    return copy;
  }

  async claimCheck(checkId: string): Promise<AdminWorkerVerificationResponse> {
    if (
      !checkId ||
      typeof checkId !== 'string' ||
      checkId.trim() === '' ||
      checkId.startsWith('W-') ||
      checkId.startsWith('wrk-') ||
      checkId.startsWith('VQ-') ||
      checkId.startsWith('APP-') ||
      checkId.startsWith('usr-')
    ) {
      throw new ValidationError('A valid verification checkId is required to start review. Dossier or worker ID cannot be used.');
    }

    const cleanCheckId = checkId.trim();
    let targetDossier: VerificationDossier | undefined;
    let targetCheck: VerificationCheck | undefined;

    for (const dossier of this.dossiers) {
      for (const check of Object.values(dossier.checks)) {
        if (check.id === cleanCheckId) {
          targetDossier = dossier;
          targetCheck = check;
          break;
        }
      }
      if (!targetDossier && dossier.checkId === cleanCheckId) {
        targetDossier = dossier;
        targetCheck = Object.values(dossier.checks).find((c) => c.id === cleanCheckId) || dossier.checks.IDENTITY;
        break;
      }
      if (targetDossier) break;
    }

    if (!targetDossier) {
      throw new ValidationError(`Verification check with ID '${checkId}' not found.`);
    }

    const currentUserId = useAuthStore.getState().user?.id || 'adm-003';

    // If another reviewer owns the check, return 409 CHECK_ALREADY_ASSIGNED
    if (targetDossier.reviewerUserId && targetDossier.reviewerUserId !== currentUserId) {
      throw new ConcurrencyConflictError('Check is already assigned to another reviewer.');
    }

    // Harmless repeated claim by same reviewer
    targetDossier.status = 'IN_REVIEW';
    targetDossier.reviewerUserId = currentUserId;
    targetDossier.claimedAt = new Date().toISOString();
    delete targetDossier.assignedReviewer;
    if (targetCheck) {
      targetCheck.status = 'IN_REVIEW';
    }

    const checksArray: AdminCheckView[] = Object.values(targetDossier.checks).map((chk) => ({
      checkId: chk.id || '',
      checkType: chk.type,
      status: chk.status as AdminCheckView['status'],
      required: true,
      submittedAt: targetDossier!.submissionTime || null,
      reviewedAt: chk.verifiedAt || null,
      remarks: chk.rejectionRemarks || null,
      recheckAt: chk.recheckDueDate || null,
      reviewerUserId: targetDossier!.reviewerUserId || null,
      claimedAt: targetDossier!.claimedAt || null,
    }));

    return {
      workerId: targetDossier.workerId,
      level: targetDossier.level || 'IN_PROGRESS',
      requiredChecks: ['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'PREVIOUS_EMPLOYMENT', 'POLICE_VERIFICATION'],
      checks: checksArray,
    };
  }

  async claimDossier(_dossierId: string, checkId?: string): Promise<void> {
    if (
      !checkId ||
      typeof checkId !== 'string' ||
      checkId.trim() === '' ||
      checkId.startsWith('W-') ||
      checkId.startsWith('wrk-') ||
      checkId.startsWith('VQ-') ||
      checkId.startsWith('APP-') ||
      checkId.startsWith('usr-')
    ) {
      throw new ValidationError('Claiming requires a valid verification checkId from backend data. Dossier or worker IDs cannot be used.');
    }
    await this.claimCheck(checkId);
  }

  async approveCheck(
    checkId: string,
    checkType?: VerificationCheckType,
    notes?: string,
    metadata?: { referenceNumber?: string; expiresOn?: string; callNotes?: string; recheckAt?: string }
  ): Promise<AdminWorkerVerificationResponse> {
    if (!checkId || typeof checkId !== 'string' || checkId.trim() === '') {
      throw new ValidationError('A valid verification checkId is required for approval.');
    }
    const cleanCheckId = checkId.trim();
    if (
      cleanCheckId.startsWith('W-') ||
      cleanCheckId.startsWith('wrk-') ||
      cleanCheckId.startsWith('APP-') ||
      cleanCheckId.startsWith('usr-') ||
      cleanCheckId.startsWith('VQ-')
    ) {
      throw new ValidationError('Invalid checkId: worker ID or dossier ID cannot be substituted for checkId.');
    }

    let found = false;
    let targetDossier: VerificationDossier | undefined;
    for (const dossier of this.dossiers) {
      for (const check of Object.values(dossier.checks)) {
        if (check.id === cleanCheckId || (checkType && check.type === checkType && dossier.checkId === cleanCheckId)) {
          found = true;
          targetDossier = dossier;
          if (check.status === 'SUBMITTED') {
            check.status = 'IN_REVIEW';
          }
          check.status = 'APPROVED';
          check.verifiedAt = new Date().toISOString();
          check.verifiedBy = 'Verification Executive';
          if (metadata?.callNotes && check.contactDetails) {
            check.contactDetails.callNotes = metadata.callNotes;
          } else if (notes && check.contactDetails) {
            check.contactDetails.callNotes = notes;
          }
          if (check.documentMetadata) {
            if (metadata?.referenceNumber) {
              check.documentMetadata.docNumberMasked = metadata.referenceNumber;
            }
            if (metadata?.expiresOn) {
              check.documentMetadata.expiryDate = metadata.expiresOn;
            }
          }

          // Check if all 5 checks are approved + pre-check is passed
          const allOpsApproved = (['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'REFERENCE', 'POLICE_CLEARANCE'] as VerificationCheckType[]).every(
            (t) => dossier.checks[t]?.status === 'APPROVED'
          );

          if (allOpsApproved && dossier.preCheckOtpVerified) {
            dossier.status = 'APPROVED';
            dossier.level = 'LEVEL_3';
            syncMockWorkerVerification(dossier.workerId, true);
          } else {
            dossier.status = 'IN_REVIEW';
            dossier.level = 'LEVEL_1';
          }
          break;
        }
      }
      if (found) break;
    }

    if (!found || !targetDossier) {
      throw new ValidationError(`Verification check with ID '${checkId}' not found.`);
    }

    const checksArray: AdminCheckView[] = Object.values(targetDossier.checks).map((chk) => ({
      checkId: chk.id || '',
      checkType: chk.type,
      status: chk.status as AdminCheckView['status'],
      required: true,
      submittedAt: targetDossier!.submissionTime || null,
      reviewedAt: chk.verifiedAt || null,
      remarks: chk.rejectionRemarks || null,
      recheckAt: chk.recheckDueDate || null,
      reviewerUserId: targetDossier!.reviewerUserId || null,
      claimedAt: targetDossier!.claimedAt || null,
    }));

    return {
      workerId: targetDossier.workerId,
      level: targetDossier.status === 'APPROVED' ? 'VERIFIED' : 'IN_PROGRESS',
      requiredChecks: ['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'PREVIOUS_EMPLOYMENT', 'POLICE_VERIFICATION'],
      checks: checksArray,
    };
  }

  async rejectCheck(
    checkId: string,
    checkType?: VerificationCheckType,
    category?: RejectionReasonCategory,
    remarks?: string
  ): Promise<AdminWorkerVerificationResponse> {
    if (!checkId || typeof checkId !== 'string' || checkId.trim() === '') {
      throw new ValidationError('A valid verification checkId is required for rejection.');
    }
    const cleanCheckId = checkId.trim();
    if (
      cleanCheckId.startsWith('W-') ||
      cleanCheckId.startsWith('wrk-') ||
      cleanCheckId.startsWith('APP-') ||
      cleanCheckId.startsWith('usr-') ||
      cleanCheckId.startsWith('VQ-')
    ) {
      throw new ValidationError('Invalid checkId: worker ID or dossier ID cannot be substituted for checkId.');
    }

    let found = false;
    let targetDossier: VerificationDossier | undefined;
    for (const dossier of this.dossiers) {
      for (const check of Object.values(dossier.checks)) {
        if (check.id === cleanCheckId || (checkType && check.type === checkType && dossier.checkId === cleanCheckId)) {
          found = true;
          targetDossier = dossier;
          check.status = 'REJECTED';
          check.rejectionCategory = category || 'OTHER';
          check.rejectionRemarks = remarks || 'Rejected by executive';
          dossier.status = 'REJECTED';
          dossier.level = 'REJECTED';
          dossier.overallRemarks = remarks;
          syncMockWorkerVerification(dossier.workerId, false);
          break;
        }
      }
      if (found) break;
    }

    if (!found || !targetDossier) {
      throw new ValidationError(`Verification check with ID '${checkId}' not found.`);
    }

    const checksArray: AdminCheckView[] = Object.values(targetDossier.checks).map((chk) => ({
      checkId: chk.id || '',
      checkType: chk.type,
      status: chk.status as AdminCheckView['status'],
      required: true,
      submittedAt: targetDossier!.submissionTime || null,
      reviewedAt: chk.verifiedAt || null,
      remarks: chk.rejectionRemarks || null,
      recheckAt: chk.recheckDueDate || null,
      reviewerUserId: targetDossier!.reviewerUserId || null,
      claimedAt: targetDossier!.claimedAt || null,
    }));

    return {
      workerId: targetDossier.workerId,
      level: 'IN_PROGRESS',
      requiredChecks: ['IDENTITY', 'ADDRESS', 'EMERGENCY_CONTACT', 'PREVIOUS_EMPLOYMENT', 'POLICE_VERIFICATION'],
      checks: checksArray,
    };
  }

  async releaseReview(checkId: string): Promise<void> {
    for (const dossier of this.dossiers) {
      for (const check of Object.values(dossier.checks)) {
        if (check.id === checkId) {
          check.status = 'PENDING';
          return;
        }
      }
    }
  }

  async reassignReview(checkId: string, reviewerUserId: string, _reason?: string): Promise<void> {
    for (const dossier of this.dossiers) {
      for (const check of Object.values(dossier.checks)) {
        if (check.id === checkId) {
          dossier.reviewerUserId = reviewerUserId;
          return;
        }
      }
    }
  }

  async addCheckNote(checkId: string, note: string, _kind: 'CALL' | 'REVIEW' = 'REVIEW'): Promise<void> {
    for (const dossier of this.dossiers) {
      for (const check of Object.values(dossier.checks)) {
        if (check.id === checkId) {
          if (!check.notes) check.notes = [];
          check.notes.push(note);
          return;
        }
      }
    }
  }

  async updateDocumentDetails(checkId: string, details: { documentNumber?: string; expiresOn?: string }): Promise<void> {
    for (const dossier of this.dossiers) {
      for (const check of Object.values(dossier.checks)) {
        if (check.id === checkId) {
          if (details.documentNumber) check.referenceNumber = details.documentNumber;
          if (details.expiresOn) check.expiresOn = details.expiresOn;
          return;
        }
      }
    }
  }

  async requestReVerification(
    checkId: string,
    checkTypes?: VerificationCheckType[],
    instructions?: string
  ): Promise<void> {
    if (!checkId || typeof checkId !== 'string' || checkId.trim() === '') {
      throw new ValidationError('A valid verification checkId is required for re-verification.');
    }
    const cleanCheckId = checkId.trim();
    if (
      cleanCheckId.startsWith('W-') ||
      cleanCheckId.startsWith('wrk-') ||
      cleanCheckId.startsWith('APP-') ||
      cleanCheckId.startsWith('usr-') ||
      cleanCheckId.startsWith('VQ-')
    ) {
      throw new ValidationError('Invalid checkId: worker ID or dossier ID cannot be substituted for checkId.');
    }

    let found = false;
    for (const dossier of this.dossiers) {
      for (const [t, check] of Object.entries(dossier.checks) as [VerificationCheckType, VerificationCheck][]) {
        if (check.id === cleanCheckId || (checkTypes && checkTypes.includes(t) && dossier.checkId === cleanCheckId)) {
          found = true;
          check.status = 'RECHECK_DUE';
          dossier.status = 'RECHECK_DUE';
          dossier.overallRemarks = instructions;
          syncMockWorkerVerification(dossier.workerId, false);
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      throw new ValidationError(`Verification check with ID '${checkId}' not found.`);
    }
  }

  async getSignedDocumentUrl(
    workerId: string,
    checkType: VerificationCheckType,
    documentId?: string
  ): Promise<{ signedUrl: string; url?: string; mimeType?: string; expiresAt: string; expiresInSeconds?: number }> {
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      throw new ValidationError(
        'A valid, non-empty backend documentId is required to request a signed document URL. Substitution with dossierId or workerId is prohibited.'
      );
    }
    const cleanDocId = documentId.trim();
    if (workerId && cleanDocId === workerId.trim()) {
      throw new ValidationError(
        'Invalid documentId: documentId matches dossierId or workerId. Dossier ID substitution is prohibited.'
      );
    }
    if (cleanDocId.toUpperCase() === checkType) {
      throw new ValidationError(
        'Invalid documentId: checkType cannot be substituted for documentId.'
      );
    }
    if (
      cleanDocId.startsWith('VQ-') ||
      cleanDocId.startsWith('APP-') ||
      cleanDocId.startsWith('W-') ||
      cleanDocId.startsWith('wrk-')
    ) {
      throw new ValidationError(
        'Invalid documentId: dossier or application identifier cannot be substituted for documentId.'
      );
    }

    const expiresInSeconds = 900;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    const isPdf = checkType === 'POLICE_CLEARANCE' || checkType === 'POLICE_VERIFICATION';
    const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';
    const signedUrl = `https://storage.sevanest.internal/documents/vault/${cleanDocId}/${checkType.toLowerCase()}${isPdf ? '.pdf' : '.jpg'}?token=access_token_${Date.now()}`;
    return {
      signedUrl,
      url: signedUrl,
      mimeType,
      expiresAt,
      expiresInSeconds,
    };
  }

  async signOffVerification(
    workerId: string,
    remarks?: string
  ): Promise<AdminWorkerVerificationResponse> {
    if (!workerId || typeof workerId !== 'string' || workerId.trim() === '') {
      throw new ValidationError('A valid workerId is required for verification sign-off.');
    }
    const cleanWorkerId = workerId.trim();
    const dossier = this.dossiers.find((d) => d.workerId === cleanWorkerId || d.id === cleanWorkerId);
    if (!dossier) {
      throw new NotFoundError(`Verification dossier for worker '${workerId}' not found.`);
    }

    const hasRejected = Object.values(dossier.checks).some((c) => c.status === 'REJECTED');
    if (hasRejected) {
      throw new ConcurrencyConflictError(
        'Worker disqualified: application cannot be signed off due to a rejected check.',
        undefined,
        409,
        'WORKER_DISQUALIFIED'
      );
    }

    const allChecksApproved = Object.values(dossier.checks).every((c) => c.status === 'APPROVED');
    const otpPassed = dossier.preCheckOtpVerified ?? true;
    if (!allChecksApproved || !otpPassed) {
      throw new ConcurrencyConflictError(
        'Cannot sign off: all 5 mandatory KYC verification checks must be approved first.',
        undefined,
        409,
        'NOT_FULLY_VERIFIED'
      );
    }

    dossier.status = 'APPROVED';
    dossier.level = 'VERIFIED';
    dossier.overallRemarks = remarks || 'Verification signed off by supervisor';
    dossier.signedOffAt = new Date().toISOString();
    syncMockWorkerVerification(dossier.workerId, true);

    return {
      workerId: dossier.workerId,
      level: 'VERIFIED',
      requiredChecks: Object.keys(dossier.checks),
      checks: Object.values(dossier.checks).map((c) => ({
        checkId: c.id || `chk-${c.type.toLowerCase()}-${dossier.workerId}`,
        checkType: c.type,
        status: (c.status === 'APPROVED' ? 'APPROVED' : c.status === 'REJECTED' ? 'REJECTED' : c.status === 'RECHECK_DUE' ? 'RECHECK_DUE' : 'IN_REVIEW') as AdminCheckView['status'],
        required: true,
        reviewedAt: c.verifiedAt || new Date().toISOString(),
        remarks: c.contactDetails?.callNotes || dossier.overallRemarks,
      })),
      status: 'APPROVED',
      applicationStatus: 'VERIFIED',
      signedOffAt: dossier.signedOffAt,
    };
  }

  async activateWorker(
    workerId: string
  ): Promise<AdminWorkerVerificationResponse | FinalOnboardingResult> {
    if (!workerId || typeof workerId !== 'string' || workerId.trim() === '') {
      throw new ValidationError('A valid workerId is required for activation.');
    }
    const cleanWorkerId = workerId.trim();
    const dossier = this.dossiers.find((d) => d.workerId === cleanWorkerId || d.id === cleanWorkerId);
    if (!dossier) {
      throw new NotFoundError(`Verification dossier for worker '${workerId}' not found.`);
    }

    if (dossier.status !== 'APPROVED' && dossier.level !== 'VERIFIED') {
      throw new ConcurrencyConflictError(
        'Worker must complete verification sign-off before platform activation.',
        undefined,
        409,
        'NOT_SIGNED_OFF'
      );
    }

    dossier.accountStatus = 'ACTIVE';
    dossier.applicationStatus = 'ACTIVE';
    dossier.activatedAt = new Date().toISOString();

    return {
      workerId: dossier.workerId,
      level: 'VERIFIED',
      requiredChecks: Object.keys(dossier.checks),
      checks: Object.values(dossier.checks).map((c) => ({
        checkId: c.id || `chk-${c.type.toLowerCase()}-${dossier.workerId}`,
        checkType: c.type,
        status: (c.status === 'APPROVED' ? 'APPROVED' : c.status === 'REJECTED' ? 'REJECTED' : c.status === 'RECHECK_DUE' ? 'RECHECK_DUE' : 'IN_REVIEW') as AdminCheckView['status'],
        required: true,
      })),
      status: 'APPROVED',
      applicationStatus: 'ACTIVE',
      activatedAt: dossier.activatedAt,
    };
  }

  async approveApplicationAndOnboardWorker(
    workerId: string,
    notes?: string
  ): Promise<FinalOnboardingResult> {
    await this.signOffVerification(workerId, notes);
    await this.activateWorker(workerId);
    return {
      success: true,
      workerId,
      status: 'ACTIVE',
      message: 'Worker verification signed off and worker activated on platform roster.',
      acceptedAt: new Date().toISOString(),
      acceptedBy: 'CURRENT_SUPERVISOR',
    };
  }
}

export function normalizeCheckType(rawType: unknown): VerificationCheckType | null {
  if (typeof rawType !== 'string') return null;
  const upper = rawType.trim().toUpperCase();
  switch (upper) {
    case 'IDENTITY':
      return 'IDENTITY';
    case 'ADDRESS':
      return 'ADDRESS';
    case 'EMERGENCY_CONTACT':
      return 'EMERGENCY_CONTACT';
    case 'PREVIOUS_EMPLOYMENT':
    case 'REFERENCE':
      return 'REFERENCE';
    case 'POLICE_VERIFICATION':
    case 'POLICE_CLEARANCE':
      return 'POLICE_CLEARANCE';
    case 'SKILL_CERTIFICATE':
      return 'SKILL_CERTIFICATE';
    case 'LICENSE':
      return 'LICENSE';
    default:
      return null;
  }
}

export function mapCheckStatus(rawStatus: unknown): VerificationCheckStatus {
  if (typeof rawStatus !== 'string') return 'PENDING';
  const upper = rawStatus.trim().toUpperCase();
  switch (upper) {
    case 'APPROVED':
    case 'VERIFIED':
    case 'PASSED':
      return 'APPROVED';
    case 'REJECTED':
    case 'FAILED':
      return 'REJECTED';
    case 'IN_REVIEW':
    case 'IN_PROGRESS':
    case 'UNDER_REVIEW':
      return 'IN_REVIEW';
    case 'RECHECK_REQUESTED':
    case 'RECHECK_DUE':
    case 'NEEDS_RECHECK':
      return 'RECHECK_DUE';
    case 'SUBMITTED':
      return 'SUBMITTED';
    case 'PENDING':
    default:
      return 'PENDING';
  }
}

function defaultCheck(type: VerificationCheckType, title: string): VerificationCheck {
  return {
    type,
    title,
    status: 'PENDING',
    evaluationMethod:
      type === 'EMERGENCY_CONTACT' || type === 'REFERENCE' || type === 'PREVIOUS_EMPLOYMENT'
        ? 'TELEPHONIC_VETTING'
        : type === 'POLICE_CLEARANCE' || type === 'POLICE_VERIFICATION'
        ? 'CERTIFICATE_TRACKING'
        : 'DOCUMENT_INSPECTION',
  };
}

export function mapChecks(raw: unknown): Record<VerificationCheckType, VerificationCheck> {
  const result: Record<VerificationCheckType, VerificationCheck> = {
    IDENTITY: defaultCheck('IDENTITY', 'Identity Proof'),
    ADDRESS: defaultCheck('ADDRESS', 'Address Proof'),
    EMERGENCY_CONTACT: defaultCheck('EMERGENCY_CONTACT', 'Emergency Contact Vetting'),
    REFERENCE: defaultCheck('REFERENCE', 'Previous Employer Reference'),
    PREVIOUS_EMPLOYMENT: defaultCheck('PREVIOUS_EMPLOYMENT', 'Previous Employer Reference'),
    POLICE_CLEARANCE: defaultCheck('POLICE_CLEARANCE', 'Police Clearance Certificate'),
    POLICE_VERIFICATION: defaultCheck('POLICE_VERIFICATION', 'Police Clearance Certificate'),
    SKILL_CERTIFICATE: defaultCheck('SKILL_CERTIFICATE', 'Skill Certificate Verification'),
    LICENSE: defaultCheck('LICENSE', 'Commercial / Driving License Verification'),
  };

  const processItem = (item: Record<string, unknown>) => {
    const rawCheckType = item.checkType || item.type;
    const typeKey = normalizeCheckType(rawCheckType);
    if (!typeKey) {
      // Explicitly handle unknown enum values; do not assign to an unrelated check type
      return;
    }

    const checkId = typeof item.checkId === 'string' && item.checkId.trim() !== ''
      ? item.checkId.trim()
      : typeof item.id === 'string' && item.id.trim() !== ''
      ? item.id.trim()
      : undefined;

    let rawDocId: string | undefined;
    let docNumberMasked: string | undefined;
    let nameOnDoc: string | undefined;
    let issueDate: string | undefined;
    let expiryDate: string | undefined;
    let documentTypeName = 'Document';

    const checkDocs: VerificationDocumentMetadata[] = [];
    if (Array.isArray(item.documents)) {
      item.documents.forEach((docItem, idx) => {
        if (docItem && typeof docItem === 'object') {
          const docObj = docItem as Record<string, unknown>;
          const docId = String(docObj.documentId || docObj.id || '').trim();
          if (docId) {
            const isAvailable =
              docObj.available !== false &&
              docObj.availability !== 'DISCARDED' &&
              docObj.availability !== 'NOT_UPLOADED' &&
              docObj.status !== 'PENDING_UPLOAD';
            const isSubmitted = docObj.submitted !== false;
            const isReviewable = docObj.reviewable === true;

            checkDocs.push({
              id: docId,
              documentId: docId,
              docNumberMasked: String(item.maskedDocumentNumber || docObj.documentNumber || docObj.docNumberMasked || ''),
              nameOnDoc: String(docObj.nameOnDoc || docObj.name || ''),
              issueDate: docObj.issueDate ? String(docObj.issueDate) : undefined,
              expiryDate: item.documentExpiresOn ? String(item.documentExpiresOn) : (docObj.expiryDate ? String(docObj.expiryDate) : undefined),
              documentTypeName: String(docObj.documentTypeName || docObj.documentType || docObj.type || typeKey || `Document ${idx + 1}`),
              contentType: docObj.contentType ? String(docObj.contentType) : (docObj.mimeType ? String(docObj.mimeType) : undefined),
              mimeType: docObj.mimeType ? String(docObj.mimeType) : (docObj.contentType ? String(docObj.contentType) : undefined),
              sizeBytes: typeof docObj.sizeBytes === 'number' ? docObj.sizeBytes : undefined,
              status: docObj.status ? String(docObj.status) : undefined,
              availability: docObj.availability ? String(docObj.availability) : (isAvailable ? 'AVAILABLE' : undefined),
              available: isAvailable,
              reviewable: isReviewable,
              submitted: isSubmitted,
              checkType: typeKey,
              checkTitle: String(item.title || result[typeKey].title),
              checkId,
              submittedAt: docObj.createdAt ? String(docObj.createdAt) : undefined,
            });
          }
        }
      });
    }

    // 1. Extract from backend document records: documents: [{ id: "..." }]
    if (checkDocs.length > 0) {
      // Prioritize confirmed REVIEWABLE and available document over discarded draft attempts
      const activeDoc =
        checkDocs.find((d) => d.reviewable === true && d.available !== false && d.availability !== 'DISCARDED' && d.status !== 'PENDING_UPLOAD') ||
        checkDocs.find((d) => d.available !== false && d.availability !== 'DISCARDED' && d.status !== 'PENDING_UPLOAD') ||
        checkDocs[checkDocs.length - 1];
      rawDocId = activeDoc.documentId;
      if (activeDoc.docNumberMasked) docNumberMasked = activeDoc.docNumberMasked;
      if (activeDoc.nameOnDoc) nameOnDoc = activeDoc.nameOnDoc;
      if (activeDoc.issueDate) issueDate = activeDoc.issueDate;
      if (activeDoc.expiryDate) expiryDate = activeDoc.expiryDate;
      if (activeDoc.documentTypeName) documentTypeName = activeDoc.documentTypeName;
    }

    if (!docNumberMasked && item.maskedDocumentNumber) {
      docNumberMasked = String(item.maskedDocumentNumber);
    }
    if (!expiryDate && item.documentExpiresOn) {
      expiryDate = String(item.documentExpiresOn);
    }

    // 2. Extract from documentMetadata if present
    if (!rawDocId && item.documentMetadata && typeof item.documentMetadata === 'object') {
      const rawMeta = item.documentMetadata as Record<string, unknown>;
      if (typeof rawMeta.documentId === 'string' && rawMeta.documentId.trim() !== '') {
        rawDocId = rawMeta.documentId.trim();
      }
      if (rawMeta.docNumberMasked) docNumberMasked = String(rawMeta.docNumberMasked);
      if (rawMeta.nameOnDoc) nameOnDoc = String(rawMeta.nameOnDoc);
      if (rawMeta.issueDate) issueDate = String(rawMeta.issueDate);
      if (rawMeta.expiryDate) expiryDate = String(rawMeta.expiryDate);
      if (rawMeta.documentTypeName) documentTypeName = String(rawMeta.documentTypeName);
    }

    // 3. Fallback to direct check fields
    if (!rawDocId && typeof item.documentId === 'string' && item.documentId.trim() !== '') {
      rawDocId = item.documentId.trim();
    }
    if (!docNumberMasked && item.documentNumber) {
      docNumberMasked = String(item.documentNumber);
    }
    if (documentTypeName === 'Document' && (item.documentType || item.documentTypeName)) {
      documentTypeName = String(item.documentTypeName || item.documentType);
    }

    let docMeta: VerificationCheck['documentMetadata'] = undefined;
    if (rawDocId || docNumberMasked || nameOnDoc || issueDate || expiryDate || documentTypeName !== 'Document') {
      const activeDoc = checkDocs.find((d) => d.documentId === rawDocId);
      const isReviewable = activeDoc ? activeDoc.reviewable === true : (item.documentMetadata as Record<string, unknown>)?.reviewable === true;
      docMeta = {
        id: rawDocId,
        documentId: rawDocId,
        docNumberMasked,
        nameOnDoc,
        issueDate,
        expiryDate,
        documentTypeName,
        reviewable: isReviewable,
        available: activeDoc ? activeDoc.available : true,
        checkType: typeKey,
        checkId,
      };
    }

    result[typeKey] = {
      id: checkId,
      type: typeKey,
      title: String(item.title || result[typeKey].title),
      status: mapCheckStatus(item.status),
      evaluationMethod: (item.evaluationMethod as VerificationCheck['evaluationMethod']) || result[typeKey].evaluationMethod,
      documentMetadata: docMeta,
      documents: checkDocs.length > 0 ? checkDocs : (docMeta?.documentId ? [docMeta] : undefined),
      contactDetails: item.contactDetails as VerificationCheck['contactDetails'],
      rejectionCategory: item.rejectionCategory as VerificationCheck['rejectionCategory'],
      rejectionRemarks: (item.rejectionRemarks || item.remarks) ? String(item.rejectionRemarks || item.remarks) : undefined,
      verifiedAt: (item.verifiedAt || item.reviewedAt) ? String(item.verifiedAt || item.reviewedAt) : undefined,
      verifiedBy: (item.verifiedBy || item.reviewerUserId) ? String(item.verifiedBy || item.reviewerUserId) : undefined,
      recheckDueDate: (item.recheckDueDate || item.recheckAt) ? String(item.recheckDueDate || item.recheckAt) : undefined,
      referenceNumber: item.maskedDocumentNumber ? String(item.maskedDocumentNumber) : undefined,
      expiresOn: item.documentExpiresOn ? String(item.documentExpiresOn) : undefined,
      notes: Array.isArray(item.notes)
        ? item.notes.map((n) => typeof n === 'string' ? n : (n as { body?: string })?.body || JSON.stringify(n))
        : undefined,
      history: Array.isArray(item.history)
        ? (item.history as VerificationCheck['history'])
        : Array.isArray(item.events)
        ? (item.events as VerificationCheck['history'])
        : undefined,
    };
  };

  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      if (item && typeof item === 'object') {
        processItem(item as Record<string, unknown>);
      }
    });
  } else if (raw && typeof raw === 'object') {
    const c = raw as Record<string, unknown>;
    if (Array.isArray(c.checks)) {
      c.checks.forEach((item) => {
        if (item && typeof item === 'object') {
          processItem(item as Record<string, unknown>);
        }
      });
    } else {
      Object.entries(c).forEach(([key, val]) => {
        if (val && typeof val === 'object') {
          processItem({ checkType: key, ...(val as Record<string, unknown>) });
        }
      });
    }
  }

  return result;
}

interface WorkerEnrichmentInfo {
  category: string;
  phoneMasked?: string;
  locality?: string;
}

let cachedWorkerEnrichment: Map<string, WorkerEnrichmentInfo> | null = null;
let lastWorkerEnrichmentFetch = 0;

async function getWorkerEnrichmentMap(): Promise<Map<string, WorkerEnrichmentInfo>> {
  const now = Date.now();
  if (cachedWorkerEnrichment && now - lastWorkerEnrichmentFetch < 60000) {
    return cachedWorkerEnrichment;
  }
  try {
    const res = await httpClient.get<{
      data?: Array<{ id: string; name?: string; mobile?: string; categories?: Array<{ name?: string }>; locality?: string }>;
      items?: Array<{ id: string; name?: string; mobile?: string; categories?: Array<{ name?: string }>; locality?: string }>;
    }>('/admin/workers', { params: { limit: 100 } });

    const list = Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res?.data?.data)
      ? res.data.data
      : Array.isArray(res?.data?.items)
      ? res.data.items
      : [];

    const map = new Map<string, WorkerEnrichmentInfo>();
    for (const w of list) {
      if (w && w.id) {
        map.set(w.id, {
          category: w.categories?.[0]?.name || 'General Help',
          phoneMasked: w.mobile ? `${w.mobile.slice(0, 5)} *****` : undefined,
          locality: w.locality || 'Hyderabad',
        });
      }
    }
    cachedWorkerEnrichment = map;
    lastWorkerEnrichmentFetch = now;
    return map;
  } catch {
    return cachedWorkerEnrichment || new Map();
  }
}

export class RealVerificationRepository implements IVerificationRepository {
  async getVerificationQueue(
    filter?: VerificationFilterCriteria
  ): Promise<PaginatedVerificationQueue> {
    try {
      const page = filter?.page || 1;
      const pageSize = filter?.pageSize || 10;
      const baseParams: Record<string, unknown> = {
        sortBy: filter?.sortBy || 'submittedAt',
        sortOrder: filter?.sortOrder || 'asc',
      };
      if (filter?.searchTerm) {
        baseParams.search = filter.searchTerm;
      }
      if (filter?.categoryId) {
        baseParams.categoryId = filter.categoryId;
      } else if (filter?.category && filter.category !== 'ALL') {
        baseParams.category = filter.category;
      }

      // Do not send assignedTo and reviewerId together. The backend returns HTTP 400 if both are supplied.
      if (filter?.assignedTo === 'me') {
        baseParams.assignedTo = 'me';
      } else if (filter?.reviewerId) {
        baseParams.reviewerId = filter.reviewerId;
      }

      let rawItems: Record<string, unknown>[] = [];
      let serverReportedTotal: number | undefined = undefined;

      if (filter?.status === 'ALL') {
        // The backend /admin/verification/queue endpoint defaults to checks waiting for review (SUBMITTED & IN_REVIEW).
        // It excludes APPROVED, REJECTED, and NOT_SUBMITTED checks unless explicitly queried.
        // To display all worker applications across all applicable verification statuses,
        // query the authorized queue across valid status buckets in parallel.
        const fetchStatusQueue = async (st?: string) => {
          const statusParams: Record<string, unknown> = {
            ...baseParams,
            limit: 100,
            page: 1,
          };
          if (st) statusParams.status = st;

          try {
            const res = await httpClient.get<
              | {
                  success?: boolean;
                  data?: Record<string, unknown>[];
                  items?: Record<string, unknown>[];
                  meta?: { total?: number; totalItems?: number; currentPage?: number; itemsPerPage?: number; totalPages?: number };
                  totalCount?: number;
                }
              | Record<string, unknown>[]
            >('/admin/verification/queue', { params: statusParams });

            const payload = res?.data;
            const items: Record<string, unknown>[] = Array.isArray(payload)
              ? payload
              : Array.isArray(payload?.data)
              ? payload.data
              : Array.isArray(payload?.items)
              ? payload.items
              : [];

            const total = !Array.isArray(payload)
              ? (payload?.meta?.total ?? payload?.meta?.totalItems ?? payload?.totalCount)
              : undefined;

            if (typeof total === 'number' && total > 100) {
              const pages = Math.ceil(total / 100);
              for (let p = 2; p <= pages; p++) {
                const nextRes = await httpClient.get<{ data?: Record<string, unknown>[] } | Record<string, unknown>[]>(
                  '/admin/verification/queue',
                  { params: { ...statusParams, page: p } }
                ).catch(() => null);
                if (nextRes?.data) {
                  const more = Array.isArray(nextRes.data)
                    ? nextRes.data
                    : Array.isArray((nextRes.data as { data?: Record<string, unknown>[] }).data)
                    ? (nextRes.data as { data: Record<string, unknown>[] }).data
                    : [];
                  items.push(...more);
                }
              }
            }
            return items;
          } catch {
            return [];
          }
        };

        const [activeChecks, approvedChecks, rejectedChecks, notSubmittedChecks] = await Promise.all([
          fetchStatusQueue(undefined), // SUBMITTED & IN_REVIEW
          fetchStatusQueue('APPROVED'),
          fetchStatusQueue('REJECTED'),
          fetchStatusQueue('NOT_SUBMITTED'),
        ]);

        rawItems = [...activeChecks, ...approvedChecks, ...rejectedChecks, ...notSubmittedChecks];
      } else {
        const params: Record<string, unknown> = {
          ...baseParams,
          page,
          limit: pageSize,
        };

        if (filter?.status === 'PENDING_REVIEW') {
          params.status = 'SUBMITTED';
        } else if (filter?.status === 'RECHECK_DUE') {
          // Backend returns 400 for RECHECK_DUE; rechecked items transition to IN_REVIEW
          params.status = 'IN_REVIEW';
        } else if (filter?.status) {
          params.status = filter.status;
        }

        const res = await httpClient.get<
          | {
              success?: boolean;
              data?: Record<string, unknown>[];
              items?: Record<string, unknown>[];
              meta?: { total?: number; totalItems?: number; currentPage?: number; itemsPerPage?: number; totalPages?: number };
              totalCount?: number;
            }
          | Record<string, unknown>[]
        >('/admin/verification/queue', { params });

        const payload = res?.data;
        rawItems = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.items)
          ? payload.items
          : [];

        serverReportedTotal = !Array.isArray(payload)
          ? (payload?.meta?.total ?? payload?.meta?.totalItems ?? payload?.totalCount)
          : undefined;

        // If the backend has more checks and we are retrieving the queue for a status:
        // Retrieve remaining checks so grouping by workerId does not omit workers
        if (typeof serverReportedTotal === 'number' && serverReportedTotal > rawItems.length && page === 1 && pageSize <= 20) {
          try {
            const allRes = await httpClient.get<
              | { data?: Record<string, unknown>[]; meta?: { total?: number } }
              | Record<string, unknown>[]
            >('/admin/verification/queue', { params: { ...params, page: 1, limit: 100 } });
            if (allRes?.data) {
              const fullItems = Array.isArray(allRes.data)
                ? allRes.data
                : Array.isArray((allRes.data as { data?: Record<string, unknown>[] }).data)
                ? (allRes.data as { data: Record<string, unknown>[] }).data
                : [];
              if (fullItems.length > rawItems.length) {
                rawItems = fullItems;
              }
            }
          } catch {
            // Keep initial rawItems on error
          }
        }
      }

      // Optional worker category / phone enrichment from worker directory
      const workerEnrichment = await getWorkerEnrichmentMap().catch(() => new Map<string, WorkerEnrichmentInfo>());

      // Group checks by workerId to form consolidated application dossiers
      const workerGroups = new Map<string, {
        id: string;
        workerId: string;
        workerName: string;
        applicationId: string;
        category: string;
        locality: string;
        experienceYears: number;
        phoneMasked: string;
        applicationSubmittedAt?: string;
        submissionTime: string;
        reviewerUserId?: string;
        assignedReviewer?: string;
        claimedAt?: string;
        level?: string;
        checksMap: Record<string, VerificationCheck>;
        rawList: Record<string, unknown>[];
      }>();

      for (const raw of rawItems) {
        const worker = (raw.worker || raw.workerProfile || raw.applicant) as Record<string, unknown> | undefined;
        const reviewer = (raw.reviewer || raw.assignedTo || raw.assignedReviewer) as Record<string, unknown> | undefined;

        const rawWorkerId = raw.workerId || worker?.id || raw.userId;
        const workerId = rawWorkerId ? String(rawWorkerId) : (raw.id ? String(raw.id) : '');
        if (!workerId) continue;

        if (!workerGroups.has(workerId)) {
          const rawCheckId = raw.checkId || (raw.check as Record<string, unknown>)?.id;
          const checkId = rawCheckId ? String(rawCheckId) : undefined;
          let id = String(raw.id || '');
          if (!id || id === checkId || id.startsWith('chk-') || id.startsWith('check-')) {
            id = workerId;
          }
          const appRef = raw.applicationReference || (worker as Record<string, unknown>)?.applicationReference;
          const applicationId = appRef ? String(appRef) : (workerId || id);

          const enriched = workerEnrichment.get(workerId);

          const workerName = String(
            raw.workerName ||
            worker?.fullName ||
            worker?.name ||
            raw.fullName ||
            raw.applicantName ||
            ''
          ).trim() || 'Applicant Name Unavailable';

          const category = String(
            raw.category ||
            raw.serviceCategory ||
            raw.serviceType ||
            worker?.category ||
            worker?.primaryCategory ||
            enriched?.category ||
            'General'
          );

          const locality = String(
            raw.locality ||
            raw.area ||
            raw.city ||
            worker?.locality ||
            worker?.area ||
            worker?.city ||
            enriched?.locality ||
            'Hyderabad'
          );

          const experienceYears = Number(
            raw.experienceYears ??
            raw.experience ??
            worker?.experienceYears ??
            worker?.experience ??
            0
          );

          const phoneMasked = String(
            raw.phoneMasked ||
            worker?.phoneMasked ||
            enriched?.phoneMasked ||
            (worker?.phone ? `${String(worker.phone).slice(0, 5)} *****` : '+91 *****')
          );

          const rawTimestamp = raw.applicationSubmittedAt || raw.submittedAt || raw.createdAt || raw.applicationDate || raw.submissionTime;
          const submissionTime = rawTimestamp ? String(rawTimestamp) : '';
          const applicationSubmittedAt = raw.applicationSubmittedAt ? String(raw.applicationSubmittedAt) : (rawTimestamp ? String(rawTimestamp) : undefined);

          const reviewerUserId = (raw.reviewerUserId || raw.reviewerId || reviewer?.id || reviewer?.userId)
            ? String(raw.reviewerUserId || raw.reviewerId || reviewer?.id || reviewer?.userId)
            : undefined;
          const claimedAt = (raw.claimedAt || raw.claimedTime || reviewer?.claimedAt || reviewer?.assignedAt)
            ? String(raw.claimedAt || raw.claimedTime || reviewer?.claimedAt || reviewer?.assignedAt)
            : undefined;
          const assignedReviewer = reviewerUserId ? `Reviewer (${reviewerUserId})` : undefined;

          const rawLevel = (raw.level ?? (raw.verification as Record<string, unknown>)?.level) as string | undefined;
          const level = rawLevel !== undefined ? String(rawLevel) : undefined;

          workerGroups.set(workerId, {
            id,
            workerId,
            workerName,
            applicationId,
            category,
            locality,
            experienceYears,
            phoneMasked,
            applicationSubmittedAt,
            submissionTime,
            reviewerUserId,
            assignedReviewer,
            claimedAt,
            level,
            checksMap: {},
            rawList: [],
          });
        }

        const group = workerGroups.get(workerId)!;
        group.rawList.push(raw);

        if (raw.reviewerUserId && !group.reviewerUserId) {
          group.reviewerUserId = String(raw.reviewerUserId);
          group.assignedReviewer = `Reviewer (${group.reviewerUserId})`;
          if (raw.claimedAt) group.claimedAt = String(raw.claimedAt);
        }

        if (raw.checks && typeof raw.checks === 'object') {
          const mappedSubChecks = mapChecks(raw.checks);
          Object.assign(group.checksMap, mappedSubChecks);
        } else if (raw.checkType) {
          const singleMapped = mapChecks([raw]);
          Object.assign(group.checksMap, singleMapped);
        }
      }

      const deduped: VerificationDossier[] = Array.from(workerGroups.values()).map((g) => {
        const rawChecks = g.rawList;
        const chkMap = g.checksMap;

        const hasIdentityApproved = chkMap.IDENTITY?.status === 'APPROVED';
        const hasAddressApproved = chkMap.ADDRESS?.status === 'APPROVED';
        const hasEmergencyApproved = chkMap.EMERGENCY_CONTACT?.status === 'APPROVED';
        const hasReferenceApproved =
          chkMap.REFERENCE?.status === 'APPROVED' ||
          chkMap.PREVIOUS_EMPLOYMENT?.status === 'APPROVED';
        const hasPoliceApproved =
          chkMap.POLICE_CLEARANCE?.status === 'APPROVED' ||
          chkMap.POLICE_VERIFICATION?.status === 'APPROVED';
        const allFiveChecksApproved =
          hasIdentityApproved &&
          hasAddressApproved &&
          hasEmergencyApproved &&
          hasReferenceApproved &&
          hasPoliceApproved;

        const hasRejected = rawChecks.some(
          (c) => String(c.status || '').toUpperCase() === 'REJECTED'
        );
        const hasInReview = rawChecks.some((c) => {
          const s = String(c.status || '').toUpperCase();
          return s === 'IN_REVIEW' || s === 'IN_PROGRESS';
        });
        const hasRecheck = rawChecks.some(
          (c) => String(c.status || '').toUpperCase() === 'RECHECK_DUE'
        );

        let status: VerificationDossier['status'] = 'PENDING_REVIEW';
        let contractInconsistency: string | undefined = undefined;
        let hasContractInconsistency = false;

        const upperLevel = g.level ? g.level.toUpperCase() : '';
        const backendClaimsApproved =
          upperLevel === 'APPROVED' || upperLevel === 'VERIFIED';

        if (hasRejected || upperLevel === 'REJECTED') {
          status = 'REJECTED';
        } else if (hasInReview || upperLevel === 'IN_REVIEW') {
          status = 'IN_REVIEW';
        } else if (hasRecheck || upperLevel === 'RECHECK_DUE') {
          status = 'RECHECK_DUE';
        } else if (allFiveChecksApproved) {
          status = 'APPROVED';
        } else if (backendClaimsApproved && !allFiveChecksApproved) {
          hasContractInconsistency = true;
          contractInconsistency = `Contract Inconsistency: Backend reports verification level as ${g.level}, but required checks remain incomplete. Full KYC approval requires all mandatory checks to be approved.`;
          status = 'PENDING_REVIEW';
        } else {
          status = 'PENDING_REVIEW';
        }

        const actionableRaw =
          rawChecks.find((c) => {
            const s = String(c.status || '').toUpperCase();
            return s === 'SUBMITTED' || s === 'IN_REVIEW';
          }) || rawChecks[0];
        const rawCheckId = actionableRaw?.checkId || (actionableRaw?.check as Record<string, unknown>)?.id;
        const checkId = rawCheckId ? String(rawCheckId) : undefined;

        const queueSubmittedDocs: VerificationDocumentMetadata[] = [];
        const queueDocIds = new Set<string>();
        Object.values(g.checksMap).forEach((chk) => {
          if (Array.isArray(chk.documents)) {
            chk.documents.forEach((d) => {
              if (d.reviewable === true && d.available !== false && d.availability !== 'DISCARDED' && d.status !== 'PENDING_UPLOAD' && d.documentId && !queueDocIds.has(d.documentId)) {
                queueDocIds.add(d.documentId);
                queueSubmittedDocs.push({
                  ...d,
                  checkType: d.checkType || chk.type,
                  checkTitle: d.checkTitle || chk.title,
                  checkId: d.checkId || chk.id,
                });
              }
            });
          } else if (chk.documentMetadata?.documentId && chk.documentMetadata.reviewable === true && !queueDocIds.has(chk.documentMetadata.documentId)) {
            queueDocIds.add(chk.documentMetadata.documentId);
            queueSubmittedDocs.push({
              ...chk.documentMetadata,
              checkType: chk.type,
              checkTitle: chk.title,
              checkId: chk.id,
            });
          }
        });

        return {
          id: g.id,
          checkId,
          applicationId: g.applicationId,
          workerId: g.workerId,
          workerName: g.workerName,
          category: g.category,
          locality: g.locality,
          experienceYears: g.experienceYears,
          phoneMasked: g.phoneMasked,
          submissionTime: g.submissionTime,
          applicationSubmittedAt: g.applicationSubmittedAt,
          status,
          contractInconsistency,
          hasContractInconsistency,
          assignedReviewer: g.assignedReviewer,
          reviewerUserId: g.reviewerUserId,
          claimedAt: g.claimedAt,
          level: g.level,
          preCheckOtpVerified: true,
          checks: g.checksMap,
          submittedDocuments: queueSubmittedDocs,
        };
      });

      let filtered = deduped;

      // Filter by category if category was passed
      if (filter?.category && filter.category !== 'ALL') {
        const catLower = filter.category.toLowerCase();
        filtered = filtered.filter((item) => item.category.toLowerCase().includes(catLower));
      }

      // Filter by searchTerm if passed
      if (filter?.searchTerm) {
        const q = filter.searchTerm.toLowerCase();
        filtered = filtered.filter(
          (item) =>
            item.workerName.toLowerCase().includes(q) ||
            item.workerId.toLowerCase().includes(q) ||
            item.applicationId?.toLowerCase().includes(q) ||
            item.locality.toLowerCase().includes(q)
        );
      }

      // Confirm oldest-first ordering uses real submission timestamp
      filtered.sort((a, b) => {
        const timeA = a.submissionTime ? new Date(a.submissionTime).getTime() : Infinity;
        const timeB = b.submissionTime ? new Date(b.submissionTime).getTime() : Infinity;
        return timeA - timeB;
      });

      const totalCount = filtered.length;
      const totalPages = Math.ceil(totalCount / pageSize) || 1;
      const paginated = (filter?.status === 'ALL' || totalCount > pageSize)
        ? filtered.slice((page - 1) * pageSize, page * pageSize)
        : filtered;

      return {
        items: paginated,
        totalCount,
        page,
        pageSize,
        totalPages,
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getDossierById(workerId: string): Promise<VerificationDossier | null> {
    if (!workerId || typeof workerId !== 'string' || workerId.trim() === '') {
      throw new ValidationError('A valid workerId is required to fetch verification dossier.');
    }
    const cleanWorkerId = workerId.trim();
    if (cleanWorkerId.startsWith('chk-') || cleanWorkerId.startsWith('check-')) {
      throw new ValidationError('Invalid workerId: checkId cannot be substituted for workerId.');
    }
    try {
      const [verifRes, workerRes] = await Promise.all([
        httpClient.get<{ success?: boolean; data?: Record<string, unknown> } | Record<string, unknown>>(
          `/admin/workers/${encodeURIComponent(cleanWorkerId)}/verification`
        ),
        httpClient.get<{ success?: boolean; data?: Record<string, unknown> } | Record<string, unknown>>(
          `/admin/workers/${encodeURIComponent(cleanWorkerId)}`
        ).catch(() => ({ data: undefined })),
      ]);
      const raw = ((verifRes.data as Record<string, unknown>)?.data && typeof (verifRes.data as Record<string, unknown>).data === 'object'
        ? (verifRes.data as Record<string, unknown>).data
        : verifRes.data) as Record<string, unknown>;
      if (!raw || typeof raw !== 'object') return null;

      const workerData = ((workerRes.data as Record<string, unknown>)?.data && typeof (workerRes.data as Record<string, unknown>).data === 'object'
        ? (workerRes.data as Record<string, unknown>).data
        : workerRes.data) as Record<string, unknown> | undefined;

      const worker = (raw.worker || raw.workerProfile || raw.applicant || workerData) as Record<string, unknown> | undefined;
      const reviewer = (raw.reviewer || raw.assignedTo || raw.assignedReviewer) as Record<string, unknown> | undefined;

      // Genuine workerId as application identity
      const returnedWorkerId = String(raw.workerId || worker?.id || workerData?.id || cleanWorkerId);
      const applicationId = String(raw.applicationId || workerData?.applicationId || returnedWorkerId);

      const workerName = String(
        raw.workerName ||
        worker?.fullName ||
        worker?.name ||
        workerData?.fullName ||
        workerData?.name ||
        raw.fullName ||
        raw.applicantName ||
        ''
      ).trim() || 'Applicant Name Unavailable';

      const rawSubmission = raw.applicationSubmittedAt || raw.submittedAt || raw.createdAt || raw.applicationDate || raw.submissionTime || workerData?.createdAt || workerData?.registeredAt;
      const submissionTime = rawSubmission ? String(rawSubmission) : '';
      const applicationSubmittedAt = raw.applicationSubmittedAt ? String(raw.applicationSubmittedAt) : (rawSubmission ? String(rawSubmission) : undefined);

      const rawCheckId = raw.checkId || (raw.check as Record<string, unknown>)?.id;
      const checkId = rawCheckId ? String(rawCheckId) : undefined;

      const reviewerUserId = (raw.reviewerUserId || raw.reviewerId || reviewer?.id || reviewer?.userId)
        ? String(raw.reviewerUserId || raw.reviewerId || reviewer?.id || reviewer?.userId)
        : undefined;
      const claimedAt = (raw.claimedAt || raw.claimedTime || reviewer?.claimedAt || reviewer?.assignedAt)
        ? String(raw.claimedAt || raw.claimedTime || reviewer?.claimedAt || reviewer?.assignedAt)
        : undefined;
      // Never fabricate reviewer profile names
      const assignedReviewer = reviewerUserId
        ? `Reviewer (${reviewerUserId})`
        : undefined;

      // Overall verification result from level field
      const rawLevel = (raw.level ?? (raw.verification as Record<string, unknown>)?.level) as string | undefined;
      const level = rawLevel !== undefined ? String(rawLevel) : undefined;

      // Map checks first to verify individual check completeness
      const mappedChecks = mapChecks(raw.checks);

      const hasIdentityApproved = mappedChecks.IDENTITY?.status === 'APPROVED';
      const hasAddressApproved = mappedChecks.ADDRESS?.status === 'APPROVED';
      const hasEmergencyApproved = mappedChecks.EMERGENCY_CONTACT?.status === 'APPROVED';
      const hasReferenceApproved =
        mappedChecks.REFERENCE?.status === 'APPROVED' ||
        mappedChecks.PREVIOUS_EMPLOYMENT?.status === 'APPROVED';
      const hasPoliceApproved =
        mappedChecks.POLICE_CLEARANCE?.status === 'APPROVED' ||
        mappedChecks.POLICE_VERIFICATION?.status === 'APPROVED';
      const allFiveChecksApproved =
        hasIdentityApproved &&
        hasAddressApproved &&
        hasEmergencyApproved &&
        hasReferenceApproved &&
        hasPoliceApproved;

      const incompleteChecks: string[] = [];
      if (!hasIdentityApproved) incompleteChecks.push('Identity Proof');
      if (!hasAddressApproved) incompleteChecks.push('Address Proof');
      if (!hasEmergencyApproved) incompleteChecks.push('Emergency Contact');
      if (!hasReferenceApproved) incompleteChecks.push('Employer Reference');
      if (!hasPoliceApproved) incompleteChecks.push('Police Certificate');

      const checksList = Object.values(mappedChecks);
      const hasRejected = checksList.some((c) => c.status === 'REJECTED');
      const hasInReview = checksList.some((c) => c.status === 'IN_REVIEW');
      const hasRecheck = checksList.some((c) => c.status === 'RECHECK_DUE');

      let status: VerificationDossier['status'] = 'PENDING_REVIEW';
      let contractInconsistency: string | undefined = undefined;
      let hasContractInconsistency = false;

      const upperStatus = String(raw.status || '').toUpperCase();
      const upperLevel = level ? level.toUpperCase() : '';
      const backendClaimsApproved =
        upperStatus === 'APPROVED' ||
        upperStatus === 'VERIFIED' ||
        upperLevel === 'APPROVED' ||
        upperLevel === 'VERIFIED' ||
        upperLevel === 'LEVEL_3' ||
        Boolean(raw.signedOffAt);

      const rawChecksGiven = raw.checks !== undefined && raw.checks !== null &&
        (Array.isArray(raw.checks) ? raw.checks.length > 0 : Object.keys(raw.checks).length > 0);

      const workerOnboardingSubmitted =
        workerData?.onboardingStatus === 'SUBMITTED' ||
        workerData?.onboardingStatus === 'IN_REVIEW' ||
        workerData?.onboardingStatus === 'APPLIED';

      if (rawChecksGiven) {
        if (allFiveChecksApproved && backendClaimsApproved && !workerOnboardingSubmitted) {
          status = 'APPROVED';
        } else if (backendClaimsApproved && (!allFiveChecksApproved || workerOnboardingSubmitted)) {
          hasContractInconsistency = true;
          contractInconsistency = `Contract Inconsistency: Backend reports application as ${level || raw.applicationStatus || 'VERIFIED'} / signed-off, but required KYC checks (${incompleteChecks.join(', ')}) remain incomplete. In compliance with SevaNest verification rules, full approval is withheld until all required checks are verified.`;
          status = hasRejected ? 'REJECTED' : hasInReview ? 'IN_REVIEW' : hasRecheck ? 'RECHECK_DUE' : 'PENDING_REVIEW';
        } else if (hasRejected || upperStatus === 'REJECTED' || upperLevel === 'REJECTED') {
          status = 'REJECTED';
        } else if (hasInReview || upperStatus === 'IN_REVIEW' || upperStatus === 'IN_PROGRESS' || upperLevel === 'IN_REVIEW') {
          status = 'IN_REVIEW';
        } else if (hasRecheck || upperStatus === 'RECHECK_DUE' || upperLevel === 'RECHECK_DUE') {
          status = 'RECHECK_DUE';
        } else {
          status = 'PENDING_REVIEW';
        }
      } else {
        if (workerOnboardingSubmitted) {
          hasContractInconsistency = true;
          contractInconsistency = `Contract Inconsistency: Worker onboarding status is ${workerData?.onboardingStatus}, but verification level is reported as ${level}. Full approval requires completed onboarding and verification.`;
          status = 'PENDING_REVIEW';
        } else if (backendClaimsApproved) {
          status = 'APPROVED';
        } else if (hasRejected || upperStatus === 'REJECTED' || upperLevel === 'REJECTED') {
          status = 'REJECTED';
        } else if (hasInReview || upperStatus === 'IN_REVIEW' || upperStatus === 'IN_PROGRESS' || upperLevel === 'IN_REVIEW') {
          status = 'IN_REVIEW';
        } else if (hasRecheck || upperStatus === 'RECHECK_DUE' || upperLevel === 'RECHECK_DUE') {
          status = 'RECHECK_DUE';
        } else {
          status = 'PENDING_REVIEW';
        }
      }

      // Address mapping
      const rawAddress = (workerData?.address || raw.address) as Record<string, unknown> | undefined;
      const address = rawAddress ? {
        line1: rawAddress.line1 ? String(rawAddress.line1) : undefined,
        line2: rawAddress.line2 ? String(rawAddress.line2) : undefined,
        city: String(rawAddress.city || 'Hyderabad'),
        state: String(rawAddress.state || 'Telangana'),
        pincode: rawAddress.pincode ? String(rawAddress.pincode) : undefined,
        locality: String(rawAddress.locality || workerData?.locality || raw.locality || 'Hyderabad'),
      } : (workerData?.locality || raw.locality) ? {
        locality: String(workerData?.locality || raw.locality || 'Hyderabad'),
        city: 'Hyderabad',
        state: 'Telangana',
      } : undefined;

      const languages = Array.isArray(workerData?.languages)
        ? workerData.languages.map(String)
        : Array.isArray(raw.languages)
        ? (raw.languages as string[])
        : ['Hindi', 'Telugu'];

      const skills = Array.isArray(workerData?.skills)
        ? workerData.skills.map(String)
        : Array.isArray(raw.skills)
        ? (raw.skills as string[])
        : undefined;

      const availability = workerData?.availability ? String(workerData.availability) : raw.availability ? String(raw.availability) : undefined;
      const expectedSalary = workerData?.expectedSalary || workerData?.expectedCompensation ? String(workerData.expectedSalary || workerData.expectedCompensation) : raw.expectedSalary ? String(raw.expectedSalary) : undefined;

      const emergencyContact = (workerData?.emergencyContact || raw.emergencyContact) as VerificationDossier['emergencyContact'];
      const previousEmployer = (workerData?.previousEmployer || workerData?.employerReference || raw.previousEmployer) as VerificationDossier['previousEmployer'];

      // (mappedChecks already mapped above)

      // Collect all submitted documents across checks
      const submittedDocuments: VerificationDocumentMetadata[] = [];
      const seenDocIds = new Set<string>();

      // 1. Collect from mapped checks (only reviewable === true, never discarded or unuploaded)
      Object.values(mappedChecks).forEach((chk) => {
        if (Array.isArray(chk.documents)) {
          chk.documents.forEach((d) => {
            const isDiscarded =
              d.available === false ||
              d.availability === 'DISCARDED' ||
              d.availability === 'NOT_UPLOADED' ||
              d.status === 'PENDING_UPLOAD';
            if (d.reviewable === true && !isDiscarded && d.documentId && !seenDocIds.has(d.documentId)) {
              seenDocIds.add(d.documentId);
              submittedDocuments.push({
                ...d,
                checkType: d.checkType || chk.type,
                checkTitle: d.checkTitle || chk.title,
                checkId: d.checkId || chk.id,
              });
            }
          });
        } else if (chk.documentMetadata?.documentId && chk.documentMetadata.reviewable === true && !seenDocIds.has(chk.documentMetadata.documentId)) {
          seenDocIds.add(chk.documentMetadata.documentId);
          submittedDocuments.push({
            ...chk.documentMetadata,
            checkType: chk.type,
            checkTitle: chk.title,
            checkId: chk.id,
          });
        }
      });

      // 2. Also inspect raw.checks for any additional document types (e.g. SKILL_CERTIFICATE, LICENSE)
      const rawChecksList = Array.isArray(raw.checks)
        ? (raw.checks as Record<string, unknown>[])
        : Array.isArray((raw.verification as Record<string, unknown>)?.checks)
        ? ((raw.verification as Record<string, unknown>).checks as Record<string, unknown>[])
        : [];

      rawChecksList.forEach((rawChk) => {
        if (Array.isArray(rawChk.documents)) {
          rawChk.documents.forEach((docItem) => {
            if (docItem && typeof docItem === 'object') {
              const docObj = docItem as Record<string, unknown>;
              const docId = String(docObj.documentId || docObj.id || '').trim();
              const isDiscarded =
                docObj.available === false ||
                docObj.availability === 'DISCARDED' ||
                docObj.availability === 'NOT_UPLOADED' ||
                docObj.status === 'PENDING_UPLOAD';
              const isReviewable = docObj.reviewable === true;
              if (docId && isReviewable && !isDiscarded && !seenDocIds.has(docId)) {
                seenDocIds.add(docId);
                const rawType = String(rawChk.checkType || rawChk.type || docObj.documentType || 'DOCUMENT');
                submittedDocuments.push({
                  id: docId,
                  documentId: docId,
                  docNumberMasked: String(rawChk.maskedDocumentNumber || docObj.documentNumber || docObj.docNumberMasked || ''),
                  nameOnDoc: String(docObj.nameOnDoc || docObj.name || ''),
                  issueDate: docObj.issueDate ? String(docObj.issueDate) : undefined,
                  expiryDate: rawChk.documentExpiresOn ? String(rawChk.documentExpiresOn) : (docObj.expiryDate ? String(docObj.expiryDate) : undefined),
                  documentTypeName: String(docObj.documentTypeName || docObj.documentType || rawType),
                  contentType: docObj.contentType ? String(docObj.contentType) : (docObj.mimeType ? String(docObj.mimeType) : undefined),
                  mimeType: docObj.mimeType ? String(docObj.mimeType) : (docObj.contentType ? String(docObj.contentType) : undefined),
                  sizeBytes: typeof docObj.sizeBytes === 'number' ? docObj.sizeBytes : undefined,
                  status: docObj.status ? String(docObj.status) : undefined,
                  availability: docObj.availability ? String(docObj.availability) : undefined,
                  available: true,
                  reviewable: true,
                  checkType: normalizeCheckType(rawType) || undefined,
                  checkTitle: String(rawChk.title || rawType),
                  checkId: rawChk.checkId ? String(rawChk.checkId) : (rawChk.id ? String(rawChk.id) : undefined),
                  submittedAt: docObj.createdAt ? String(docObj.createdAt) : undefined,
                });
              }
            }
          });
        }
      });

      return {
        id: returnedWorkerId,
        checkId,
        applicationId,
        workerId: returnedWorkerId,
        workerName,
        category: String(raw.category || raw.serviceCategory || worker?.category || workerData?.category || 'General'),
        locality: String(raw.locality || raw.area || worker?.locality || workerData?.locality || 'Hyderabad'),
        experienceYears: Number(raw.experienceYears ?? raw.experience ?? worker?.experienceYears ?? workerData?.experienceYears ?? 0),
        phoneMasked: String(raw.phoneMasked || worker?.phoneMasked || workerData?.phoneMasked || '+91 *****'),
        phone: (workerData?.phone || raw.phone || worker?.phone || workerData?.mobile || raw.mobile || workerData?.mobileNumber || raw.mobileNumber)
          ? String(workerData?.phone || raw.phone || worker?.phone || workerData?.mobile || raw.mobile || workerData?.mobileNumber || raw.mobileNumber)
          : undefined,
        submissionTime,
        applicationSubmittedAt,
        status,
        contractInconsistency,
        hasContractInconsistency,
        assignedReviewer,
        reviewerUserId,
        claimedAt,
        level,
        preCheckOtpVerified: Boolean(raw.preCheckOtpVerified ?? true),
        checks: mappedChecks,
        submittedDocuments,
        address,
        languages,
        skills,
        availability,
        expectedSalary,
        emergencyContact,
        previousEmployer,
        accountStatus: (workerData?.status as 'ACTIVE' | 'SUSPENDED') || 'ACTIVE',
        applicationStatus: (raw.applicationStatus ? String(raw.applicationStatus) : undefined) as VerificationDossier['applicationStatus'],
        activatedAt: raw.activatedAt ? String(raw.activatedAt) : undefined,
        signedOffAt: raw.signedOffAt ? String(raw.signedOffAt) : undefined,
        signedOffBy: raw.signedOffBy ? String(raw.signedOffBy) : undefined,
        requiredChecks: Array.isArray(raw.requiredChecks) ? (raw.requiredChecks as string[]) : undefined,
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async claimCheck(checkId: string): Promise<AdminWorkerVerificationResponse> {
    if (
      !checkId ||
      typeof checkId !== 'string' ||
      checkId.trim() === '' ||
      checkId.startsWith('W-') ||
      checkId.startsWith('wrk-') ||
      checkId.startsWith('VQ-') ||
      checkId.startsWith('APP-') ||
      checkId.startsWith('usr-')
    ) {
      throw new ValidationError('A valid verification checkId is required to start review. Dossier or worker IDs cannot be used.');
    }
    try {
      const response = await httpClient.post<
        AdminWorkerVerificationResponse | { success?: boolean; data?: AdminWorkerVerificationResponse }
      >(`/admin/verification/checks/${encodeURIComponent(checkId.trim())}/start-review`);
      const resData = (response.data && 'data' in response.data && response.data.data
        ? response.data.data
        : response.data) as AdminWorkerVerificationResponse;
      return resData;
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async claimDossier(_dossierId: string, checkId?: string): Promise<void> {
    if (
      !checkId ||
      typeof checkId !== 'string' ||
      checkId.trim() === '' ||
      checkId.startsWith('W-') ||
      checkId.startsWith('wrk-') ||
      checkId.startsWith('VQ-') ||
      checkId.startsWith('APP-') ||
      checkId.startsWith('usr-')
    ) {
      throw new ValidationError('Claiming requires a valid verification checkId from backend data. Dossier or worker IDs cannot be used.');
    }
    await this.claimCheck(checkId);
  }

  async approveCheck(
    checkId: string,
    _checkType?: VerificationCheckType,
    notes?: string,
    metadata?: { referenceNumber?: string; expiresOn?: string; callNotes?: string; recheckAt?: string }
  ): Promise<AdminWorkerVerificationResponse> {
    if (!checkId || typeof checkId !== 'string' || checkId.trim() === '') {
      throw new ValidationError('A valid verification checkId is required for approval.');
    }
    const cleanCheckId = checkId.trim();
    if (
      cleanCheckId.startsWith('W-') ||
      cleanCheckId.startsWith('wrk-') ||
      cleanCheckId.startsWith('APP-') ||
      cleanCheckId.startsWith('usr-') ||
      cleanCheckId.startsWith('VQ-')
    ) {
      throw new ValidationError('Invalid checkId: worker ID or dossier ID cannot be substituted for checkId.');
    }
    try {
      // Build payload strictly adhering to ApproveCheckDto: { remarks?: string, recheckAt?: string }
      const trimmedNotes = typeof notes === 'string' && notes.trim() !== ''
        ? notes.trim().slice(0, 1000)
        : 'Verified and approved by Verification Executive';

      const payload: { remarks: string; recheckAt?: string } = {
        remarks: trimmedNotes,
      };

      // Handle recheck date if provided (format must be YYYY-MM-DD date string)
      const rawRecheck = metadata?.recheckAt || (metadata?.expiresOn && /^\d{4}-\d{2}-\d{2}$/.test(metadata.expiresOn) ? metadata.expiresOn : undefined);
      if (rawRecheck && typeof rawRecheck === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawRecheck.trim())) {
        payload.recheckAt = rawRecheck.trim();
      }

      const response = await httpClient.post<
        AdminWorkerVerificationResponse | { success?: boolean; data?: AdminWorkerVerificationResponse }
      >(
        `/admin/verification/checks/${encodeURIComponent(cleanCheckId)}/approve`,
        payload
      );

      const resData = (response.data && 'data' in response.data && response.data.data
        ? response.data.data
        : response.data) as AdminWorkerVerificationResponse;

      return resData;
    } catch (err) {
      if (err instanceof DomainError) {
        throw err;
      }
      throw mapHttpErrorToDomainError(err);
    }
  }

  async rejectCheck(
    checkId: string,
    _checkType?: VerificationCheckType,
    category?: RejectionReasonCategory,
    remarks?: string
  ): Promise<AdminWorkerVerificationResponse> {
    if (!checkId || typeof checkId !== 'string' || checkId.trim() === '') {
      throw new ValidationError('A valid verification checkId is required for rejection.');
    }
    const cleanCheckId = checkId.trim();
    if (
      cleanCheckId.startsWith('W-') ||
      cleanCheckId.startsWith('wrk-') ||
      cleanCheckId.startsWith('APP-') ||
      cleanCheckId.startsWith('usr-') ||
      cleanCheckId.startsWith('VQ-')
    ) {
      throw new ValidationError('Invalid checkId: worker ID or dossier ID cannot be substituted for checkId.');
    }
    try {
      const validBackendCodes = [
        'BLURRY_IMAGE',
        'DOCUMENT_EXPIRED',
        'NAME_MISMATCH',
        'INCOMPLETE_DOCUMENT',
        'INVALID_DOCUMENT_TYPE',
        'SUSPECTED_TAMPERING',
        'UNVERIFIABLE_REFERENCE',
        'CRIMINAL_RECORD_DISQUALIFIED',
        'OTHER',
      ];

      let reasonCode = 'OTHER';
      if (category) {
        if (validBackendCodes.includes(category)) {
          reasonCode = category;
        } else if (category === 'TAMPERED_DOC') {
          reasonCode = 'SUSPECTED_TAMPERING';
        } else if (category === 'EXPIRED_DOC') {
          reasonCode = 'DOCUMENT_EXPIRED';
        } else if (category === 'REFERENCE_UNREACHABLE' || category === 'REFERENCE_NEGATIVE') {
          reasonCode = 'UNVERIFIABLE_REFERENCE';
        } else if (category === 'ADDRESS_UNVERIFIABLE') {
          reasonCode = 'INCOMPLETE_DOCUMENT';
        }
      }

      const payload: { reasonCode: string; remarks?: string } = {
        reasonCode,
      };

      if (remarks && remarks.trim()) {
        payload.remarks = remarks.trim().slice(0, 1000);
      } else if (reasonCode === 'OTHER') {
        payload.remarks = 'Verification check rejected by administrative review';
      }

      const response = await httpClient.post<
        AdminWorkerVerificationResponse | { success?: boolean; data?: AdminWorkerVerificationResponse }
      >(`/admin/verification/checks/${encodeURIComponent(cleanCheckId)}/reject`, payload);
      const resData = (response.data && 'data' in response.data && response.data.data
        ? response.data.data
        : response.data) as AdminWorkerVerificationResponse;
      return resData;
    } catch (err) {
      if (err instanceof DomainError) {
        throw err;
      }
      throw mapHttpErrorToDomainError(err);
    }
  }

  async releaseReview(checkId: string): Promise<void> {
    if (!checkId || typeof checkId !== 'string' || checkId.trim() === '') {
      throw new ValidationError('A valid verification checkId is required to release review.');
    }
    const cleanCheckId = checkId.trim();
    try {
      await httpClient.post(`/admin/verification/checks/${encodeURIComponent(cleanCheckId)}/release-review`);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async reassignReview(checkId: string, reviewerUserId: string, reason?: string): Promise<void> {
    if (!checkId || typeof checkId !== 'string' || checkId.trim() === '') {
      throw new ValidationError('A valid verification checkId is required for reassignment.');
    }
    if (!reviewerUserId || typeof reviewerUserId !== 'string' || reviewerUserId.trim() === '') {
      throw new ValidationError('A valid reviewerUserId is required for reassignment.');
    }
    const cleanCheckId = checkId.trim();
    try {
      await httpClient.post(`/admin/verification/checks/${encodeURIComponent(cleanCheckId)}/reassign-review`, {
        reviewerUserId: reviewerUserId.trim(),
        ...(reason && reason.trim() ? { reason: reason.trim().slice(0, 500) } : {}),
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async addCheckNote(checkId: string, note: string, kind: 'CALL' | 'REVIEW' = 'REVIEW'): Promise<void> {
    if (!checkId || typeof checkId !== 'string' || checkId.trim() === '') {
      throw new ValidationError('A valid verification checkId is required to add notes.');
    }
    if (!note || typeof note !== 'string' || note.trim() === '') {
      throw new ValidationError('Note content cannot be empty.');
    }
    const cleanCheckId = checkId.trim();
    try {
      await httpClient.post(`/admin/verification/checks/${encodeURIComponent(cleanCheckId)}/notes`, {
        kind,
        body: note.trim().slice(0, 2000),
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async updateDocumentDetails(checkId: string, details: { documentNumber?: string; expiresOn?: string }): Promise<void> {
    if (!checkId || typeof checkId !== 'string' || checkId.trim() === '') {
      throw new ValidationError('A valid verification checkId is required to update document details.');
    }
    const cleanCheckId = checkId.trim();
    try {
      const payload: { documentNumber?: string; expiresOn?: string } = {};
      if (details.documentNumber) payload.documentNumber = details.documentNumber.trim();
      if (details.expiresOn) payload.expiresOn = details.expiresOn.trim();
      await httpClient.put(`/admin/verification/checks/${encodeURIComponent(cleanCheckId)}/document-details`, payload);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async requestReVerification(
    checkId: string,
    _checkTypes?: VerificationCheckType[],
    instructions?: string
  ): Promise<void> {
    if (!checkId || typeof checkId !== 'string' || checkId.trim() === '') {
      throw new ValidationError('A valid verification checkId is required for re-verification.');
    }
    const cleanCheckId = checkId.trim();
    if (
      cleanCheckId.startsWith('W-') ||
      cleanCheckId.startsWith('wrk-') ||
      cleanCheckId.startsWith('APP-') ||
      cleanCheckId.startsWith('usr-') ||
      cleanCheckId.startsWith('VQ-')
    ) {
      throw new ValidationError('Invalid checkId: worker ID or dossier ID cannot be substituted for checkId.');
    }
    try {
      await httpClient.post(`/admin/verification/checks/${encodeURIComponent(cleanCheckId)}/recheck`, {
        remarks: instructions || 'Re-verification requested by admin',
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getSignedDocumentUrl(
    workerId: string,
    checkType: VerificationCheckType,
    documentId?: string
  ): Promise<{ signedUrl: string; url?: string; mimeType?: string; expiresAt: string; expiresInSeconds?: number }> {
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      throw new ValidationError(
        'A valid, non-empty backend documentId is required to request a signed document URL. Substitution with dossierId or workerId is prohibited.'
      );
    }

    const cleanDocId = documentId.trim();

    // Guard against substitution of workerId, checkType, or queue IDs
    if (workerId && cleanDocId === workerId.trim()) {
      throw new ValidationError(
        'Invalid documentId: documentId matches dossierId or workerId. Dossier ID substitution is prohibited.'
      );
    }
    if (cleanDocId.toUpperCase() === checkType) {
      throw new ValidationError(
        'Invalid documentId: checkType cannot be substituted for documentId.'
      );
    }
    if (
      cleanDocId.startsWith('VQ-') ||
      cleanDocId.startsWith('APP-') ||
      cleanDocId.startsWith('W-') ||
      cleanDocId.startsWith('wrk-')
    ) {
      throw new ValidationError(
        'Invalid documentId: dossier or application identifier cannot be substituted for documentId.'
      );
    }

    try {
      const res = await httpClient.get<{
        success?: boolean;
        data?: { url?: string; signedUrl?: string; mimeType?: string; expiresAt?: string; expiresInSeconds?: number };
        url?: string;
        signedUrl?: string;
        mimeType?: string;
        expiresAt?: string;
        expiresInSeconds?: number;
      }>(
        `/admin/verification/documents/${encodeURIComponent(cleanDocId)}/link`
      );
      const payload = res.data?.data || res.data;
      const rawSignedUrl = payload?.url || payload?.signedUrl;
      if (!rawSignedUrl || typeof rawSignedUrl !== 'string' || rawSignedUrl.trim() === '') {
        throw new ServerFailureError(
          'Authorized signed document URL was not provided by the backend vault. Required contract: GET /api/v1/admin/verification/documents/{documentId}/link'
        );
      }

      const validatedUrl = validateDocumentSignedUrl(rawSignedUrl);

      const expiresInSeconds = typeof payload.expiresInSeconds === 'number'
        ? payload.expiresInSeconds
        : undefined;

      let expiresAt = typeof payload.expiresAt === 'string' && payload.expiresAt.trim() !== ''
        ? payload.expiresAt
        : undefined;

      if (!expiresAt && expiresInSeconds !== undefined) {
        expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
      }

      return {
        url: validatedUrl,
        signedUrl: validatedUrl,
        mimeType: payload.mimeType,
        expiresAt: expiresAt || '',
        expiresInSeconds,
      };
    } catch (err) {
      if (err instanceof DomainError) {
        throw err;
      }
      throw mapHttpErrorToDomainError(err);
    }
  }

  async signOffVerification(
    workerId: string,
    remarks?: string
  ): Promise<AdminWorkerVerificationResponse> {
    if (!workerId || typeof workerId !== 'string' || workerId.trim() === '') {
      throw new ValidationError('A valid workerId is required for verification sign-off.');
    }
    const cleanWorkerId = workerId.trim();
    if (
      cleanWorkerId.startsWith('chk-') ||
      cleanWorkerId.startsWith('check-') ||
      cleanWorkerId.startsWith('doc-')
    ) {
      throw new ValidationError('Invalid workerId: checkId or documentId cannot be substituted for workerId.');
    }

    try {
      const response = await httpClient.post<
        AdminWorkerVerificationResponse | { success?: boolean; data?: AdminWorkerVerificationResponse }
      >(`/admin/workers/${encodeURIComponent(cleanWorkerId)}/verification/sign-off`, {
        remarks: remarks || 'Verification sign-off completed by supervisor',
      });

      const resData = (response.data && 'data' in response.data && response.data.data
        ? response.data.data
        : response.data) as AdminWorkerVerificationResponse;

      return resData;
    } catch (err) {
      if (err instanceof DomainError) {
        throw err;
      }
      throw mapHttpErrorToDomainError(err);
    }
  }

  async activateWorker(
    workerId: string
  ): Promise<AdminWorkerVerificationResponse | FinalOnboardingResult> {
    if (!workerId || typeof workerId !== 'string' || workerId.trim() === '') {
      throw new ValidationError('A valid workerId is required for activation.');
    }
    const cleanWorkerId = workerId.trim();
    if (
      cleanWorkerId.startsWith('chk-') ||
      cleanWorkerId.startsWith('check-') ||
      cleanWorkerId.startsWith('doc-')
    ) {
      throw new ValidationError('Invalid workerId: checkId or documentId cannot be substituted for workerId.');
    }

    try {
      const response = await httpClient.post<
        AdminWorkerVerificationResponse | { success?: boolean; data?: AdminWorkerVerificationResponse }
      >(`/admin/workers/${encodeURIComponent(cleanWorkerId)}/activate`, {});

      const resData = (response.data && 'data' in response.data && response.data.data
        ? response.data.data
        : response.data) as AdminWorkerVerificationResponse;

      return resData;
    } catch (err) {
      if (err instanceof DomainError) {
        throw err;
      }
      throw mapHttpErrorToDomainError(err);
    }
  }

  async approveApplicationAndOnboardWorker(
    workerId: string,
    notes?: string
  ): Promise<FinalOnboardingResult> {
    const signOffRes = await this.signOffVerification(workerId, notes);
    await this.activateWorker(workerId);
    return {
      success: true,
      workerId: signOffRes.workerId || workerId,
      status: 'ACTIVE',
      message: 'Worker verification signed off and worker activated on platform roster.',
      acceptedAt: new Date().toISOString(),
    };
  }
}

export { RealVerificationRepository as VerificationRepositoryImpl, validateDocumentSignedUrl, isSafeDocumentUrl };

export const createVerificationRepository = (
  useMock: boolean = env.VITE_USE_MOCK_AUTH
): IVerificationRepository => {
  return useMock ? new MockVerificationRepository() : new RealVerificationRepository();
};

export const verificationRepository = createVerificationRepository();
