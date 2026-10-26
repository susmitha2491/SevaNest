import {
  VerificationDossier,
  VerificationFilterCriteria,
  PaginatedVerificationQueue,
  IVerificationRepository,
  VerificationCheck,
  VerificationCheckType,
  VerificationCheckStatus,
  RejectionReasonCategory,
} from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';
import { DomainError, ServerFailureError, ValidationError, ConcurrencyConflictError } from '../../../core/errors/DomainError';
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
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async claimCheck(checkId: string): Promise<void> {
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
      if (dossier.checkId === cleanCheckId) {
        targetDossier = dossier;
        break;
      }
      for (const check of Object.values(dossier.checks)) {
        if (check.id === cleanCheckId) {
          targetDossier = dossier;
          targetCheck = check;
          break;
        }
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

  async approveCheck(checkId: string, checkType?: VerificationCheckType, notes?: string): Promise<void> {
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
    for (const dossier of this.dossiers) {
      for (const check of Object.values(dossier.checks)) {
        if (check.id === cleanCheckId || (checkType && check.type === checkType && dossier.checkId === cleanCheckId)) {
          found = true;
          check.status = 'APPROVED';
          check.verifiedAt = new Date().toISOString();
          check.verifiedBy = 'Verification Executive';
          if (notes && check.contactDetails) {
            check.contactDetails.callNotes = notes;
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

    if (!found) {
      throw new ValidationError(`Verification check with ID '${checkId}' not found.`);
    }
  }

  async rejectCheck(
    checkId: string,
    checkType?: VerificationCheckType,
    category?: RejectionReasonCategory,
    remarks?: string
  ): Promise<void> {
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
    for (const dossier of this.dossiers) {
      for (const check of Object.values(dossier.checks)) {
        if (check.id === cleanCheckId || (checkType && check.type === checkType && dossier.checkId === cleanCheckId)) {
          found = true;
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

    if (!found) {
      throw new ValidationError(`Verification check with ID '${checkId}' not found.`);
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
  ): Promise<{ signedUrl: string; url?: string; expiresAt: string; expiresInSeconds?: number }> {
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
    const signedUrl = `https://storage.sevanest.internal/documents/vault/${cleanDocId}/${checkType.toLowerCase()}?token=access_token_${Date.now()}`;
    return {
      signedUrl,
      url: signedUrl,
      expiresAt,
      expiresInSeconds,
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
    default:
      // Unknown enum values (e.g. SKILL_CERTIFICATE, LICENSE) are handled explicitly and not silently mapped
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
    evaluationMethod: (type === 'EMERGENCY_CONTACT' || type === 'REFERENCE') ? 'TELEPHONIC_VETTING' : 'DOCUMENT_INSPECTION',
  };
}

export function mapChecks(raw: unknown): Record<VerificationCheckType, VerificationCheck> {
  const result: Record<VerificationCheckType, VerificationCheck> = {
    IDENTITY: defaultCheck('IDENTITY', 'Identity Proof'),
    ADDRESS: defaultCheck('ADDRESS', 'Address Proof'),
    EMERGENCY_CONTACT: defaultCheck('EMERGENCY_CONTACT', 'Emergency Contact Vetting'),
    REFERENCE: defaultCheck('REFERENCE', 'Previous Employer Reference'),
    POLICE_CLEARANCE: defaultCheck('POLICE_CLEARANCE', 'Police Clearance Certificate'),
  };

  const processItem = (item: Record<string, unknown>) => {
    const rawCheckType = item.checkType || item.type;
    const typeKey = normalizeCheckType(rawCheckType);
    if (!typeKey) {
      // Explicitly handle unknown enum values; do not assign to an unrelated check type
      return;
    }

    let rawDocId: string | undefined;
    let docNumberMasked: string | undefined;
    let nameOnDoc: string | undefined;
    let issueDate: string | undefined;
    let expiryDate: string | undefined;
    let documentTypeName = 'Document';

    // 1. Extract from backend document records: documents: [{ id: "..." }]
    if (Array.isArray(item.documents) && item.documents.length > 0 && item.documents[0] && typeof item.documents[0] === 'object') {
      const firstDoc = item.documents[0] as Record<string, unknown>;
      if (typeof firstDoc.id === 'string' && firstDoc.id.trim() !== '') {
        rawDocId = firstDoc.id.trim();
      } else if (typeof firstDoc.documentId === 'string' && firstDoc.documentId.trim() !== '') {
        rawDocId = firstDoc.documentId.trim();
      }
      if (firstDoc.documentNumber || firstDoc.docNumberMasked) {
        docNumberMasked = String(firstDoc.documentNumber || firstDoc.docNumberMasked);
      }
      if (firstDoc.nameOnDoc || firstDoc.name) {
        nameOnDoc = String(firstDoc.nameOnDoc || firstDoc.name);
      }
      if (firstDoc.issueDate) issueDate = String(firstDoc.issueDate);
      if (firstDoc.expiryDate) expiryDate = String(firstDoc.expiryDate);
      if (firstDoc.documentTypeName || firstDoc.documentType || firstDoc.type) {
        documentTypeName = String(firstDoc.documentTypeName || firstDoc.documentType || firstDoc.type);
      }
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
      docMeta = {
        documentId: rawDocId,
        docNumberMasked,
        nameOnDoc,
        issueDate,
        expiryDate,
        documentTypeName,
      };
    }

    const checkId = typeof item.id === 'string' && item.id.trim() !== ''
      ? item.id.trim()
      : typeof item.checkId === 'string' && item.checkId.trim() !== ''
      ? item.checkId.trim()
      : undefined;

    result[typeKey] = {
      id: checkId,
      type: typeKey,
      title: String(item.title || result[typeKey].title),
      status: mapCheckStatus(item.status),
      evaluationMethod: (item.evaluationMethod as VerificationCheck['evaluationMethod']) || result[typeKey].evaluationMethod,
      documentMetadata: docMeta,
      contactDetails: item.contactDetails as VerificationCheck['contactDetails'],
      rejectionCategory: item.rejectionCategory as VerificationCheck['rejectionCategory'],
      rejectionRemarks: (item.rejectionRemarks || item.remarks) ? String(item.rejectionRemarks || item.remarks) : undefined,
      verifiedAt: (item.verifiedAt || item.reviewedAt) ? String(item.verifiedAt || item.reviewedAt) : undefined,
      verifiedBy: (item.verifiedBy || item.reviewerUserId) ? String(item.verifiedBy || item.reviewerUserId) : undefined,
      recheckDueDate: (item.recheckDueDate || item.recheckAt) ? String(item.recheckDueDate || item.recheckAt) : undefined,
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
        params.status = filter.status === 'PENDING_REVIEW' ? 'SUBMITTED' : filter.status;
      }
      if (filter?.searchTerm) {
        params.search = filter.searchTerm;
      }
      if (filter?.categoryId) {
        params.categoryId = filter.categoryId;
      } else if (filter?.category && filter.category !== 'ALL') {
        params.category = filter.category;
      }

      // Do not send assignedTo and reviewerId together. The backend returns HTTP 400 if both are supplied.
      if (filter?.assignedTo === 'me') {
        params.assignedTo = 'me';
      } else if (filter?.reviewerId) {
        params.reviewerId = filter.reviewerId;
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

        // Real checkId from queue response if available
        const rawCheckId = raw.checkId || (raw.check as Record<string, unknown>)?.id;
        const checkId = rawCheckId ? String(rawCheckId) : undefined;

        // Real workerId as application identity - never substitute checkId or fabricate APP-...
        const rawWorkerId = raw.workerId || worker?.id || raw.userId;
        const workerId = rawWorkerId ? String(rawWorkerId) : '';

        // If raw.id is provided and distinct from checkId, keep it; otherwise default to workerId
        let id = String(raw.id || '');
        if (!id || id === checkId || id.startsWith('chk-') || id.startsWith('check-')) {
          id = workerId || (raw.id ? String(raw.id) : '');
        }
        const applicationId = workerId || id;

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
        const rawTimestamp = raw.applicationSubmittedAt || raw.submittedAt || raw.createdAt || raw.applicationDate || raw.submissionTime;
        const submissionTime = rawTimestamp ? String(rawTimestamp) : '';
        const applicationSubmittedAt = raw.applicationSubmittedAt ? String(raw.applicationSubmittedAt) : (rawTimestamp ? String(rawTimestamp) : undefined);

        // Reviewer and assignment metadata
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

        let status: VerificationDossier['status'] = 'PENDING_REVIEW';
        const upperStatus = String(raw.status || '').toUpperCase();
        if (upperStatus === 'APPROVED' || upperStatus === 'VERIFIED') status = 'APPROVED';
        else if (upperStatus === 'REJECTED') status = 'REJECTED';
        else if (upperStatus === 'IN_REVIEW' || upperStatus === 'IN_PROGRESS') status = 'IN_REVIEW';
        else if (upperStatus === 'RECHECK_DUE') status = 'RECHECK_DUE';
        else if (upperStatus === 'SUBMITTED' || upperStatus === 'PENDING_REVIEW' || upperStatus === 'PENDING') status = 'PENDING_REVIEW';
        else if (level) {
          const upperLevel = level.toUpperCase();
          if (upperLevel === 'APPROVED' || upperLevel === 'VERIFIED') status = 'APPROVED';
          else if (upperLevel === 'REJECTED') status = 'REJECTED';
          else if (upperLevel === 'IN_REVIEW' || upperLevel === 'IN_PROGRESS') status = 'IN_REVIEW';
          else if (upperLevel === 'RECHECK_DUE') status = 'RECHECK_DUE';
          else status = 'PENDING_REVIEW';
        }

        return {
          id,
          checkId,
          applicationId,
          workerId,
          workerName,
          category,
          locality,
          experienceYears,
          phoneMasked,
          submissionTime,
          applicationSubmittedAt,
          status,
          assignedReviewer,
          reviewerUserId,
          claimedAt,
          level,
          preCheckOtpVerified: Boolean(raw.preCheckOtpVerified ?? true),
          checks: mapChecks(raw.checks || (raw.checkType ? [raw] : undefined)),
        };
      });

      // Deduplicate applications by unique application reference/id to prevent duplicate rows
      const seenIds = new Set<string>();
      const deduped: VerificationDossier[] = [];
      for (const item of mapped) {
        const uniqueKey = item.workerId || item.id;
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

      let status: VerificationDossier['status'] = 'PENDING_REVIEW';
      const upperStatus = String(raw.status || '').toUpperCase();
      if (upperStatus === 'APPROVED' || upperStatus === 'VERIFIED') status = 'APPROVED';
      else if (upperStatus === 'REJECTED') status = 'REJECTED';
      else if (upperStatus === 'IN_REVIEW' || upperStatus === 'IN_PROGRESS') status = 'IN_REVIEW';
      else if (upperStatus === 'RECHECK_DUE') status = 'RECHECK_DUE';
      else if (upperStatus === 'SUBMITTED' || upperStatus === 'PENDING_REVIEW' || upperStatus === 'PENDING') status = 'PENDING_REVIEW';
      else if (level) {
        const upperLevel = level.toUpperCase();
        if (upperLevel === 'APPROVED' || upperLevel === 'VERIFIED') status = 'APPROVED';
        else if (upperLevel === 'REJECTED') status = 'REJECTED';
        else if (upperLevel === 'IN_REVIEW' || upperLevel === 'IN_PROGRESS') status = 'IN_REVIEW';
        else if (upperLevel === 'RECHECK_DUE') status = 'RECHECK_DUE';
        else status = 'PENDING_REVIEW';
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
        submissionTime,
        applicationSubmittedAt,
        status,
        assignedReviewer,
        reviewerUserId,
        claimedAt,
        level,
        preCheckOtpVerified: Boolean(raw.preCheckOtpVerified ?? true),
        checks: mapChecks(raw.checks),
        address,
        languages,
        skills,
        availability,
        expectedSalary,
        emergencyContact,
        previousEmployer,
        accountStatus: (workerData?.status as 'ACTIVE' | 'SUSPENDED') || 'ACTIVE',
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async claimCheck(checkId: string): Promise<void> {
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
      await httpClient.post(`/admin/verification/checks/${encodeURIComponent(checkId.trim())}/start-review`);
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

  async approveCheck(checkId: string, _checkType?: VerificationCheckType, notes?: string): Promise<void> {
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
      await httpClient.post(`/admin/verification/checks/${encodeURIComponent(cleanCheckId)}/approve`, {
        remarks: notes || 'Approved by admin',
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async rejectCheck(
    checkId: string,
    _checkType?: VerificationCheckType,
    _category?: RejectionReasonCategory,
    remarks?: string
  ): Promise<void> {
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
      await httpClient.post(`/admin/verification/checks/${encodeURIComponent(cleanCheckId)}/reject`, {
        remarks: remarks || 'Rejected by admin',
      });
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
  ): Promise<{ signedUrl: string; url?: string; expiresAt: string; expiresInSeconds?: number }> {
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
        data?: { url?: string; signedUrl?: string; expiresAt?: string; expiresInSeconds?: number };
        url?: string;
        signedUrl?: string;
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
}

export { RealVerificationRepository as VerificationRepositoryImpl, validateDocumentSignedUrl, isSafeDocumentUrl };

export const createVerificationRepository = (
  useMock: boolean = env.VITE_USE_MOCK_AUTH
): IVerificationRepository => {
  return useMock ? new MockVerificationRepository() : new RealVerificationRepository();
};

export const verificationRepository = createVerificationRepository();
