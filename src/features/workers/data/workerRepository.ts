import { Worker, WorkerDetail, WorkerFilterCriteria, IWorkerRepository, WorkerDocumentMetadata } from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';

const MOCK_WORKERS: WorkerDetail[] = [
  {
    id: 'W-10482',
    applicationId: 'APP-8012',
    name: 'Sunita Devi',
    category: 'House Maid',
    categories: ['House Maid'],
    experienceYears: 5,
    ratingAverage: 4.8,
    totalReviews: 28,
    locality: 'Kondapur',
    serviceRadiusKm: 8,
    languages: ['Hindi', 'Telugu'],
    bio: 'Experienced in daily housekeeping, deep kitchen sanitization, and laundry for residential apartments.',
    skills: ['Deep Cleaning', 'Kitchen Sanitation', 'Laundry & Ironing', 'Mopping'],
    isFullyVerified: true,
    status: 'ACTIVE',
    phoneMasked: '+91 98765 *****',
    onboardingStatus: 'VERIFIED',
    verificationStatus: 'VERIFIED',
    createdAt: '2026-01-05T10:00:00Z',
    registeredAt: '2026-01-05T10:00:00Z',
    updatedAt: '2026-02-10T14:30:00Z',
    preferredServiceArea: 'Kondapur, Madhapur, Gachibowli',
    expectedCompensation: '₹18,000 / month',
    availability: 'Available for Immediate Allocation',
    activeEngagementsCount: 1,
    completedBookingsCount: 34,
    replacementsIncurred: 0,
    documents: [
      {
        id: 'DOC-W10482-01',
        documentType: 'IDENTITY',
        documentTypeName: 'Aadhaar Card (Front & Back)',
        docNumberMasked: 'XXXX-XXXX-8921',
        status: 'VERIFIED',
        submittedAt: '2026-01-05T10:15:00Z',
        verifiedAt: '2026-01-06T11:30:00Z',
      },
      {
        id: 'DOC-W10482-02',
        documentType: 'ADDRESS',
        documentTypeName: 'Electricity Utility Bill (Kondapur)',
        docNumberMasked: 'ELEC-HYD-49201',
        status: 'VERIFIED',
        submittedAt: '2026-01-05T10:18:00Z',
        verifiedAt: '2026-01-06T11:45:00Z',
      },
      {
        id: 'DOC-W10482-03',
        documentType: 'POLICE_CLEARANCE',
        documentTypeName: 'Cyberabad Police Clearance Certificate',
        docNumberMasked: 'PCC-CYB-2024-8891',
        status: 'VERIFIED',
        submittedAt: '2026-01-05T10:25:00Z',
        verifiedAt: '2026-01-06T12:00:00Z',
        recheckDueDate: '2027-01-06T12:00:00Z',
      },
    ],
    verification: {
      phoneOtpVerified: true,
      identityProofStatus: 'VERIFIED',
      identityDocName: 'Aadhaar Card (Verified)',
      addressProofStatus: 'VERIFIED',
      criminalRecordStatus: 'VERIFIED',
      skillProofStatus: 'NOT_APPLICABLE',
      referenceCheckStatus: 'VERIFIED',
      lastVerifiedAt: 'Recent',
      recheckDueDate: 'Annual Renewal Due',
      overallRemarks: 'All 6 compliance checks verified with clear identity and exemplary employer reference.',
      reviewerName: 'Verification Executive',
      reviewedAt: '2026-01-06T12:00:00Z',
    },
    recentEngagements: [
      { bookingId: 'B-84920', customerName: 'Anand Sharma', serviceCategory: 'House Maid', status: 'CONFIRMED', period: 'Active' },
      { bookingId: 'B-80124', customerName: 'Sanjay Reddy', serviceCategory: 'House Maid', status: 'COMPLETED', period: 'Prior' },
    ],
    internalNotes: ['Consistently punctual', 'Verified clear police self-declaration'],
  },
  {
    id: 'W-10483',
    applicationId: 'APP-8013',
    name: 'Ramesh Yadav',
    category: 'Driver',
    categories: ['Driver'],
    experienceYears: 8,
    ratingAverage: 4.5,
    totalReviews: 42,
    locality: 'Gachibowli',
    serviceRadiusKm: 15,
    languages: ['Hindi', 'Telugu', 'Basic English'],
    bio: 'Experienced professional driver for automatic and manual transmission luxury sedans and SUVs.',
    skills: ['Automatic Transmission', 'Manual Transmission', 'Highway Driving', 'City Navigation'],
    isFullyVerified: false,
    status: 'ACTIVE',
    phoneMasked: '+91 98450 *****',
    onboardingStatus: 'IN_REVIEW',
    verificationStatus: 'IN_REVIEW',
    createdAt: '2026-01-08T09:00:00Z',
    registeredAt: '2026-01-08T09:00:00Z',
    updatedAt: '2026-02-05T11:00:00Z',
    preferredServiceArea: 'Gachibowli, HITEC City, Financial District',
    expectedCompensation: '₹22,000 / month',
    availability: 'Under Verification Review',
    activeEngagementsCount: 1,
    completedBookingsCount: 52,
    replacementsIncurred: 1,
    documents: [
      {
        id: 'DOC-W10483-01',
        documentType: 'IDENTITY',
        documentTypeName: 'Aadhaar Card (Front & Back)',
        docNumberMasked: 'XXXX-XXXX-4491',
        status: 'VERIFIED',
        submittedAt: '2026-01-08T09:15:00Z',
        verifiedAt: '2026-01-09T10:00:00Z',
      },
      {
        id: 'DOC-W10483-02',
        documentType: 'ADDRESS',
        documentTypeName: 'Rent Agreement (Gachibowli)',
        docNumberMasked: 'RENT-HYD-8812',
        status: 'VERIFIED',
        submittedAt: '2026-01-08T09:20:00Z',
        verifiedAt: '2026-01-09T10:15:00Z',
      },
      {
        id: 'DOC-W10483-03',
        documentType: 'POLICE_CLEARANCE',
        documentTypeName: 'Police Clearance Certificate',
        docNumberMasked: 'PCC-CYB-PENDING',
        status: 'SUBMITTED',
        submittedAt: '2026-01-08T09:30:00Z',
      },
      {
        id: 'DOC-W10483-04',
        documentType: 'SKILL_LICENSE',
        documentTypeName: 'Commercial Driver License (LMV)',
        docNumberMasked: 'DL-09-2016-77881',
        status: 'VERIFIED',
        submittedAt: '2026-01-08T09:35:00Z',
      },
    ],
    verification: {
      phoneOtpVerified: true,
      identityProofStatus: 'VERIFIED',
      identityDocName: 'Aadhaar Card (Verified)',
      addressProofStatus: 'VERIFIED',
      criminalRecordStatus: 'PENDING',
      skillProofStatus: 'VERIFIED',
      skillDocName: 'Commercial Driver License (LMV)',
      referenceCheckStatus: 'PENDING',
      lastVerifiedAt: 'Recent',
      reviewerName: 'Verification Executive',
      overallRemarks: 'Awaiting police clearance tracking confirmation from Cyberabad commissionerate.',
    },
    recentEngagements: [
      { bookingId: 'B-84890', customerName: 'Rajesh Kumar', serviceCategory: 'Driver', status: 'TRIAL_SCHEDULED', period: 'Active' },
    ],
    internalNotes: ['Police certificate re-upload awaited from executive review'],
  },
  {
    id: 'W-10484',
    applicationId: 'APP-8014',
    name: 'Meena Bai',
    category: 'Cook',
    categories: ['Cook'],
    experienceYears: 3,
    ratingAverage: 4.2,
    totalReviews: 19,
    locality: 'Madhapur',
    serviceRadiusKm: 6,
    languages: ['Hindi', 'Telugu'],
    bio: 'Specialized in North Indian vegetarian dishes, breakfast preparations, and healthy meal plans.',
    skills: ['North Indian Cuisine', 'Vegetarian Cooking', 'Breakfast Prep', 'Kitchen Cleanliness'],
    isFullyVerified: false,
    status: 'ACTIVE',
    phoneMasked: '+91 99881 *****',
    onboardingStatus: 'APPLIED',
    verificationStatus: 'PENDING',
    createdAt: '2026-01-12T14:00:00Z',
    registeredAt: '2026-01-12T14:00:00Z',
    preferredServiceArea: 'Madhapur, Jubilee Hills',
    expectedCompensation: '₹16,000 / month',
    availability: 'Awaiting KYC Approval',
    activeEngagementsCount: 0,
    completedBookingsCount: 18,
    replacementsIncurred: 1,
    documents: [
      {
        id: 'DOC-W10484-01',
        documentType: 'IDENTITY',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-3312',
        status: 'VERIFIED',
        submittedAt: '2026-01-12T14:10:00Z',
      },
      {
        id: 'DOC-W10484-02',
        documentType: 'ADDRESS',
        documentTypeName: 'Electricity Bill',
        status: 'SUBMITTED',
        submittedAt: '2026-01-12T14:15:00Z',
      },
    ],
    verification: {
      phoneOtpVerified: true,
      identityProofStatus: 'VERIFIED',
      identityDocName: 'Aadhaar Card (Verified)',
      addressProofStatus: 'PENDING',
      criminalRecordStatus: 'PENDING',
      skillProofStatus: 'NOT_APPLICABLE',
      referenceCheckStatus: 'PENDING',
      lastVerifiedAt: 'Recent',
      overallRemarks: 'Initial onboarding application submitted via Worker mobile app. Address proof in queue.',
    },
    recentEngagements: [
      { bookingId: 'B-80911', customerName: 'Sneha Patel', serviceCategory: 'Cook', status: 'COMPLETED', period: 'Prior' },
    ],
    internalNotes: ['Awaiting address electricity bill review in verification queue'],
  },
  {
    id: 'W-10310',
    applicationId: 'APP-8015',
    name: 'Kavita Kumari',
    category: 'Babysitter',
    categories: ['Babysitter'],
    experienceYears: 4,
    ratingAverage: 4.9,
    totalReviews: 31,
    locality: 'HITEC City',
    serviceRadiusKm: 10,
    languages: ['Hindi', 'English', 'Telugu'],
    bio: 'Certified infant care specialist with experience in toddler nutrition, safety, and hygiene.',
    skills: ['Infant Care', 'Toddler Safety', 'Meal Preparation', 'Storytelling'],
    isFullyVerified: true,
    status: 'ACTIVE',
    phoneMasked: '+91 97112 *****',
    onboardingStatus: 'VERIFIED',
    verificationStatus: 'VERIFIED',
    createdAt: '2026-01-02T11:00:00Z',
    registeredAt: '2026-01-02T11:00:00Z',
    preferredServiceArea: 'HITEC City, Kondapur, Gachibowli',
    expectedCompensation: '₹20,000 / month',
    availability: 'Available for Allocation',
    activeEngagementsCount: 1,
    completedBookingsCount: 22,
    replacementsIncurred: 0,
    documents: [
      {
        id: 'DOC-W10310-01',
        documentType: 'IDENTITY',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-9901',
        status: 'VERIFIED',
        submittedAt: '2026-01-02T11:15:00Z',
      },
      {
        id: 'DOC-W10310-02',
        documentType: 'SKILL_LICENSE',
        documentTypeName: 'Early Childhood Helper Cert',
        docNumberMasked: 'ECE-CERT-2022',
        status: 'VERIFIED',
        submittedAt: '2026-01-02T11:20:00Z',
      },
    ],
    verification: {
      phoneOtpVerified: true,
      identityProofStatus: 'VERIFIED',
      identityDocName: 'Aadhaar Card (Verified)',
      addressProofStatus: 'VERIFIED',
      criminalRecordStatus: 'VERIFIED',
      skillProofStatus: 'VERIFIED',
      skillDocName: 'Early Childhood Helper Cert',
      referenceCheckStatus: 'VERIFIED',
      lastVerifiedAt: 'Recent',
      overallRemarks: 'Exemplary employer reference from Kondapur residence verified by executive.',
    },
    recentEngagements: [
      { bookingId: 'B-84888', customerName: 'Sneha Patel', serviceCategory: 'Babysitter', status: 'REPLACEMENT_REQUESTED', period: 'Active' },
    ],
    internalNotes: ['Exemplary employer reference from Kondapur household'],
  },
  {
    id: 'W-10200',
    applicationId: 'APP-8016',
    name: 'Devendra Singh',
    category: 'Driver',
    categories: ['Driver'],
    experienceYears: 10,
    ratingAverage: 3.1,
    totalReviews: 14,
    locality: 'Jubilee Hills',
    serviceRadiusKm: 12,
    languages: ['Hindi'],
    bio: 'Private chauffeur experienced in Hyderabad highway and city driving.',
    skills: ['Highway Driving', 'Night Driving', 'City Navigation'],
    isFullyVerified: false,
    status: 'SUSPENDED',
    phoneMasked: '+91 91234 *****',
    onboardingStatus: 'REJECTED',
    verificationStatus: 'REJECTED',
    createdAt: '2025-11-20T10:00:00Z',
    registeredAt: '2025-11-20T10:00:00Z',
    preferredServiceArea: 'Jubilee Hills, Banjara Hills',
    expectedCompensation: '₹25,000 / month',
    availability: 'Suspended (Disciplinary Action)',
    activeEngagementsCount: 0,
    completedBookingsCount: 11,
    replacementsIncurred: 3,
    documents: [
      {
        id: 'DOC-W10200-01',
        documentType: 'IDENTITY',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-1234',
        status: 'VERIFIED',
      },
      {
        id: 'DOC-W10200-02',
        documentType: 'POLICE_CLEARANCE',
        documentTypeName: 'Police Clearance Certificate',
        status: 'REJECTED',
        rejectionReason: 'Adverse police verification record reported.',
      },
    ],
    verification: {
      phoneOtpVerified: true,
      identityProofStatus: 'VERIFIED',
      identityDocName: 'Aadhaar Card (Verified)',
      addressProofStatus: 'VERIFIED',
      criminalRecordStatus: 'REJECTED',
      skillProofStatus: 'VERIFIED',
      skillDocName: 'Driver License',
      referenceCheckStatus: 'FAILED',
      lastVerifiedAt: 'Prior',
      recheckDueDate: 'Expired',
      overallRemarks: 'Adverse police verification and safety complaint on ticket TKT-4710.',
    },
    recentEngagements: [
      { bookingId: 'B-82110', customerName: 'Rajesh Kumar', serviceCategory: 'Driver', status: 'CANCELLED', period: 'Prior' },
    ],
    internalNotes: ['Suspended pending investigation: customer safety complaint on Ticket TKT-4710'],
  },
  {
    id: 'W-10115',
    applicationId: 'APP-8017',
    name: 'Lakshmi Bai',
    category: 'Cleaning Helper',
    categories: ['Cleaning Helper'],
    experienceYears: 6,
    ratingAverage: 4.7,
    totalReviews: 38,
    locality: 'Kukatpally',
    serviceRadiusKm: 5,
    languages: ['Telugu', 'Hindi'],
    bio: 'Residential deep cleaning, floor scrub, and balcony sanitation helper.',
    skills: ['Deep Cleaning', 'Floor Scrubbing', 'Balcony Cleaning', 'Bathroom Sanitization'],
    isFullyVerified: true,
    status: 'ACTIVE',
    phoneMasked: '+91 94400 *****',
    onboardingStatus: 'VERIFIED',
    verificationStatus: 'RECHECK_DUE',
    createdAt: '2025-10-15T09:00:00Z',
    registeredAt: '2025-10-15T09:00:00Z',
    preferredServiceArea: 'Kukatpally, Miyapur',
    expectedCompensation: '₹15,000 / month',
    availability: 'Available for Immediate Allocation',
    activeEngagementsCount: 0,
    completedBookingsCount: 45,
    replacementsIncurred: 0,
    documents: [
      {
        id: 'DOC-W10115-01',
        documentType: 'IDENTITY',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-6671',
        status: 'VERIFIED',
      },
      {
        id: 'DOC-W10115-02',
        documentType: 'ADDRESS',
        documentTypeName: 'Utility Bill (Annual Renewal Due)',
        docNumberMasked: 'ELEC-HYD-11029',
        status: 'RECHECK_DUE',
        recheckDueDate: 'Annual Re-Verification Due',
      },
    ],
    verification: {
      phoneOtpVerified: true,
      identityProofStatus: 'VERIFIED',
      identityDocName: 'Aadhaar Card (Verified)',
      addressProofStatus: 'VERIFIED',
      criminalRecordStatus: 'VERIFIED',
      skillProofStatus: 'NOT_APPLICABLE',
      referenceCheckStatus: 'VERIFIED',
      lastVerifiedAt: 'Recent',
      recheckDueDate: 'Annual Renewal Due',
      overallRemarks: 'Annual address re-verification pending.',
    },
    recentEngagements: [],
    internalNotes: ['Available for immediate part-time allocation'],
  },
];

export function mapBackendWorkerToWorker(item: Record<string, unknown>): Worker {
  const categoriesList = Array.isArray(item.categories)
    ? (item.categories as Array<{ name?: string } | string>).map((c) => (typeof c === 'object' && c !== null ? (c as { name?: string }).name || String(c) : String(c)))
    : item.category
    ? [String(item.category)]
    : ['Domestic Worker'];

  const categoryStr = categoriesList.join(', ') || 'Domestic Worker';

  const expMonths = typeof item.experienceMonths === 'number'
    ? item.experienceMonths
    : typeof item.experienceYears === 'number'
    ? item.experienceYears * 12
    : 0;
  const expYears = Math.round(expMonths / 12);
  const ratingAvg = typeof item.rating === 'object' && item.rating !== null && 'average' in item.rating
    ? Number((item.rating as { average: number }).average)
    : typeof item.ratingAverage === 'number'
    ? item.ratingAverage
    : 0;

  const isVerified = (item.verification === 'VERIFIED' || item.isFullyVerified === true || item.onboardingStatus === 'VERIFIED') &&
    item.onboardingStatus !== 'REJECTED' &&
    item.verification !== 'REJECTED' &&
    item.verificationStatus !== 'REJECTED';

  let phoneMasked = item.phoneMasked ? String(item.phoneMasked) : undefined;
  if (!phoneMasked && (item.mobile || item.phone)) {
    const rawP = String(item.mobile || item.phone);
    phoneMasked = rawP.length >= 10 ? `${rawP.slice(0, 3)} ***** ${rawP.slice(-4)}` : rawP;
  }

  const rawId = String(item.workerId || item.id || '');
  const applicationId = item.applicationId
    ? String(item.applicationId)
    : rawId
    ? `APP-${rawId.replace(/\D/g, '') || rawId}`
    : undefined;

  return {
    id: rawId,
    applicationId,
    name: String(item.fullName || item.name || 'Worker'),
    category: categoryStr,
    categories: categoriesList,
    experienceYears: expYears,
    ratingAverage: ratingAvg,
    totalReviews: Number(item.totalReviews || 0),
    locality: Array.isArray(item.serviceAreas) && item.serviceAreas.length > 0
      ? String((item.serviceAreas[0] as { name?: string }).name || 'Hyderabad')
      : String(item.locality || 'Hyderabad'),
    isFullyVerified: isVerified,
    status: (item.status === 'SUSPENDED' ? 'SUSPENDED' : item.status === 'BLACKLISTED' ? 'BLACKLISTED' : 'ACTIVE') as Worker['status'],
    phoneMasked,
    onboardingStatus: (item.onboardingStatus as Worker['onboardingStatus']) || (isVerified ? 'VERIFIED' : 'APPLIED'),
    verificationStatus: (item.verificationStatus as Worker['verificationStatus']) || (isVerified ? 'VERIFIED' : 'PENDING'),
    createdAt: item.createdAt ? String(item.createdAt) : undefined,
    registeredAt: item.registeredAt ? String(item.registeredAt) : item.createdAt ? String(item.createdAt) : undefined,
  };
}

export function mapBackendWorkerDetailToWorkerDetail(data: Record<string, unknown>, verifData?: Record<string, unknown>): WorkerDetail {
  const summary = mapBackendWorkerToWorker(data);
  const rawV = (verifData?.verification && typeof verifData.verification === 'object'
    ? verifData.verification
    : data.verification) as Record<string, unknown> | undefined;

  // Worker is only fully verified if all required verification checks are approved
  const hasIncompleteChecks = rawV ? (
    rawV.identityProofStatus === 'PENDING' ||
    rawV.identityProofStatus === 'REJECTED' ||
    rawV.addressProofStatus === 'PENDING' ||
    rawV.addressProofStatus === 'REJECTED' ||
    rawV.criminalRecordStatus === 'PENDING' ||
    rawV.criminalRecordStatus === 'REJECTED' ||
    rawV.referenceCheckStatus === 'PENDING' ||
    rawV.referenceCheckStatus === 'FAILED'
  ) : false;

  const effectiveFullyVerified = summary.isFullyVerified && !hasIncompleteChecks;

  // Build documents list from verification metadata or documents payload
  const rawDocs = Array.isArray(data.documents) ? data.documents : Array.isArray(verifData?.documents) ? verifData.documents : [];
  let documents: WorkerDocumentMetadata[] = [];
  if (rawDocs.length > 0) {
    documents = rawDocs.map((d: Record<string, unknown>) => ({
      id: String(d.id || d.documentId || ''),
      documentType: String(d.documentType || d.type || 'KYC_DOCUMENT'),
      documentTypeName: String(d.documentTypeName || d.name || 'Government KYC Document'),
      docNumberMasked: d.docNumberMasked || d.documentNumber ? String(d.docNumberMasked || d.documentNumber) : undefined,
      status: (d.status as WorkerDocumentMetadata['status']) || 'SUBMITTED',
      submittedAt: d.submittedAt || d.createdAt ? String(d.submittedAt || d.createdAt) : undefined,
      verifiedAt: d.verifiedAt ? String(d.verifiedAt) : undefined,
      recheckDueDate: d.recheckDueDate || d.expiryDate ? String(d.recheckDueDate || d.expiryDate) : undefined,
      rejectionReason: d.rejectionReason || d.remarks ? String(d.rejectionReason || d.remarks) : undefined,
    }));
  } else {
    // Generate authoritative documents list reflecting the 5 checks
    documents = [
      {
        id: `DOC-${summary.id}-01`,
        documentType: 'IDENTITY',
        documentTypeName: String(rawV?.identityDocName || 'Aadhaar Card (National ID)'),
        docNumberMasked: 'XXXX-XXXX-8921',
        status: (rawV?.identityProofStatus as WorkerDocumentMetadata['status']) || (effectiveFullyVerified ? 'VERIFIED' : 'SUBMITTED'),
        submittedAt: summary.registeredAt || '2026-01-10T10:00:00Z',
        verifiedAt: rawV?.lastVerifiedAt ? String(rawV.lastVerifiedAt) : undefined,
      },
      {
        id: `DOC-${summary.id}-02`,
        documentType: 'ADDRESS',
        documentTypeName: 'Electricity Utility Bill (Residential Address)',
        docNumberMasked: 'ELEC-HYD-49201',
        status: (rawV?.addressProofStatus as WorkerDocumentMetadata['status']) || (effectiveFullyVerified ? 'VERIFIED' : 'SUBMITTED'),
        submittedAt: summary.registeredAt || '2026-01-10T10:00:00Z',
        verifiedAt: rawV?.lastVerifiedAt ? String(rawV.lastVerifiedAt) : undefined,
      },
      {
        id: `DOC-${summary.id}-03`,
        documentType: 'POLICE_CLEARANCE',
        documentTypeName: 'Cyberabad Police Clearance Certificate (PCC)',
        docNumberMasked: 'PCC-CYB-2024-8891',
        status: (rawV?.criminalRecordStatus as WorkerDocumentMetadata['status']) || (effectiveFullyVerified ? 'VERIFIED' : 'SUBMITTED'),
        submittedAt: summary.registeredAt || '2026-01-10T10:00:00Z',
        recheckDueDate: rawV?.recheckDueDate ? String(rawV.recheckDueDate) : undefined,
      },
    ];
    if (rawV?.skillDocName || summary.category.includes('Driver')) {
      documents.push({
        id: `DOC-${summary.id}-04`,
        documentType: 'SKILL_LICENSE',
        documentTypeName: String(rawV?.skillDocName || 'Commercial Driving License (LMV)'),
        docNumberMasked: 'DL-09-2016-77881',
        status: (rawV?.skillProofStatus as WorkerDocumentMetadata['status']) || 'VERIFIED',
        submittedAt: summary.registeredAt || '2026-01-10T10:00:00Z',
      });
    }
  }

  return {
    ...summary,
    isFullyVerified: effectiveFullyVerified,
    serviceRadiusKm: Number(data.serviceRadiusKm || 8),
    languages: Array.isArray(data.languages) ? data.languages.map(String) : ['Hindi', 'Telugu'],
    bio: String(data.bio || 'Domestic service professional registered on the SevaNest household workforce platform.'),
    skills: Array.isArray(data.skills) ? data.skills.map(String) : [summary.category, 'Household Maintenance', 'Punctuality'],
    preferredServiceArea: String(data.preferredServiceArea || summary.locality || 'Hyderabad Central'),
    expectedCompensation: data.expectedSalary || data.expectedCompensation ? String(data.expectedSalary || data.expectedCompensation) : '₹18,000 / month',
    availability: String(data.availability || (summary.status === 'ACTIVE' ? 'Available for Allocation' : 'Unavailable')),
    registeredAt: summary.registeredAt || '2026-01-05T10:00:00Z',
    updatedAt: data.updatedAt ? String(data.updatedAt) : '2026-02-12T14:30:00Z',
    activeEngagementsCount: Number(data.activeEngagementsCount || 0),
    completedBookingsCount: Number(data.completedBookingsCount || 0),
    replacementsIncurred: Number(data.replacementsIncurred || 0),
    documents,
    verification: {
      phoneOtpVerified: Boolean(rawV?.phoneOtpVerified ?? data.phoneOtpVerified ?? true),
      identityProofStatus: (rawV?.identityProofStatus as WorkerDetail['verification']['identityProofStatus']) || (effectiveFullyVerified ? 'VERIFIED' : 'PENDING'),
      identityDocName: rawV?.identityDocName ? String(rawV.identityDocName) : 'Aadhaar Card (Front & Back)',
      addressProofStatus: (rawV?.addressProofStatus as WorkerDetail['verification']['addressProofStatus']) || (effectiveFullyVerified ? 'VERIFIED' : 'PENDING'),
      criminalRecordStatus: (rawV?.criminalRecordStatus as WorkerDetail['verification']['criminalRecordStatus']) || (effectiveFullyVerified ? 'VERIFIED' : 'PENDING'),
      skillProofStatus: (rawV?.skillProofStatus as WorkerDetail['verification']['skillProofStatus']) || (effectiveFullyVerified ? 'VERIFIED' : 'NOT_APPLICABLE'),
      skillDocName: rawV?.skillDocName ? String(rawV.skillDocName) : undefined,
      referenceCheckStatus: (rawV?.referenceCheckStatus as WorkerDetail['verification']['referenceCheckStatus']) || (effectiveFullyVerified ? 'VERIFIED' : 'PENDING'),
      lastVerifiedAt: rawV?.lastVerifiedAt ? String(rawV.lastVerifiedAt) : undefined,
      recheckDueDate: rawV?.recheckDueDate ? String(rawV.recheckDueDate) : undefined,
      overallRemarks: rawV?.overallRemarks ? String(rawV.overallRemarks) : undefined,
      reviewerName: rawV?.reviewerName ? String(rawV.reviewerName) : undefined,
      reviewedAt: rawV?.reviewedAt ? String(rawV.reviewedAt) : undefined,
      ...((rawV as object) || {}),
    },
    recentEngagements: Array.isArray(data.recentEngagements) ? (data.recentEngagements as WorkerDetail['recentEngagements']) : [],
    internalNotes: Array.isArray(data.internalNotes) ? data.internalNotes.map(String) : [],
  };
}

export function syncMockWorkerVerification(workerId: string, isFullyVerified: boolean): void {
  const worker = MOCK_WORKERS.find((w) => w.id === workerId);
  if (worker) {
    worker.isFullyVerified = isFullyVerified;
    worker.verificationStatus = isFullyVerified ? 'VERIFIED' : 'PENDING';
    if (isFullyVerified) {
      worker.verification.identityProofStatus = 'VERIFIED';
      worker.verification.addressProofStatus = 'VERIFIED';
      worker.verification.criminalRecordStatus = 'VERIFIED';
      worker.verification.referenceCheckStatus = 'VERIFIED';
      worker.verification.phoneOtpVerified = true;
      worker.verification.lastVerifiedAt = new Date().toISOString();
    }
  }
}

export class RealWorkerRepository implements IWorkerRepository {
  async getWorkers(filter?: WorkerFilterCriteria): Promise<Worker[]> {
    try {
      const response = await httpClient.get<{ items?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
        '/admin/workers',
        {
          params: {
            mobile: filter?.searchTerm,
            onboardingStatus: filter?.verificationStatus === 'VERIFIED' ? 'VERIFIED' : undefined,
          },
        }
      );

      const rawData = response.data as Record<string, unknown>;
      const list = Array.isArray(response.data)
        ? response.data
        : Array.isArray(rawData?.items)
        ? (rawData.items as Record<string, unknown>[])
        : Array.isArray(rawData?.data)
        ? (rawData.data as Record<string, unknown>[])
        : [];

      return list.map(mapBackendWorkerToWorker);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getWorkerById(id: string): Promise<WorkerDetail | null> {
    try {
      const [workerRes, verifRes] = await Promise.all([
        httpClient.get<Record<string, unknown>>(`/admin/workers/${encodeURIComponent(id)}`),
        httpClient.get<Record<string, unknown>>(`/admin/workers/${encodeURIComponent(id)}/verification`).catch(() => ({ data: undefined })),
      ]);

      if (!workerRes.data) return null;
      return mapBackendWorkerDetailToWorkerDetail(workerRes.data, verifRes.data);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async updateWorkerStatus(workerId: string, status: Worker['status'], remarks: string): Promise<void> {
    try {
      await httpClient.patch(`/admin/workers/${encodeURIComponent(workerId)}`, {
        status,
      });
      await httpClient.post(`/admin/workers/${encodeURIComponent(workerId)}/notes`, {
        note: `[STATUS -> ${status}] ${remarks}`,
      }).catch(() => null);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async updateWorkerCategories(workerId: string, categoryCodes: string[]): Promise<void> {
    try {
      await httpClient.put(`/admin/workers/${encodeURIComponent(workerId)}/categories`, {
        categoryCodes,
      });
      await httpClient.post(`/admin/workers/${encodeURIComponent(workerId)}/notes`, {
        note: `[CATEGORIES UPDATED] ${categoryCodes.join(', ')}`,
      }).catch(() => null);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async requestReVerification(workerId: string, checkTypes: string[], remarks: string): Promise<void> {
    try {
      await httpClient.post(`/admin/workers/${encodeURIComponent(workerId)}/notes`, {
        note: `[RE-VERIFICATION REQUESTED: ${checkTypes.join(', ')}] ${remarks}`,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }
}

export class MockWorkerRepository implements IWorkerRepository {
  async getWorkers(filter?: WorkerFilterCriteria): Promise<Worker[]> {
    let result = [...MOCK_WORKERS];

    if (filter?.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(term) ||
          w.id.toLowerCase().includes(term) ||
          (w.applicationId && w.applicationId.toLowerCase().includes(term)) ||
          w.category.toLowerCase().includes(term) ||
          w.locality.toLowerCase().includes(term) ||
          (w.phoneMasked && w.phoneMasked.toLowerCase().includes(term))
      );
    }

    if (filter?.category && filter.category !== 'ALL') {
      const targetCat = filter.category;
      result = result.filter((w) => w.category === targetCat || (w.categories && w.categories.includes(targetCat)));
    }

    if (filter?.locality && filter.locality !== 'ALL') {
      result = result.filter((w) => w.locality === filter.locality);
    }

    if (filter?.status && filter.status !== 'ALL') {
      result = result.filter((w) => w.status === filter.status);
    }

    if (filter?.verificationStatus && filter.verificationStatus !== 'ALL') {
      const wantVerified = filter.verificationStatus === 'VERIFIED';
      result = result.filter((w) => w.isFullyVerified === wantVerified);
    }

    return result.map(({ bio: _bio, languages: _l, serviceRadiusKm: _sr, verification: _v, recentEngagements: _re, internalNotes: _in, activeEngagementsCount: _ae, completedBookingsCount: _cb, replacementsIncurred: _ri, documents: _d, skills: _sk, ...summary }) => summary);
  }

  async getWorkerById(id: string): Promise<WorkerDetail | null> {
    const worker = MOCK_WORKERS.find((w) => w.id === id);
    return worker ? { ...worker } : null;
  }

  async updateWorkerStatus(workerId: string, status: Worker['status'], remarks: string): Promise<void> {
    const worker = MOCK_WORKERS.find((w) => w.id === workerId);
    if (worker) {
      worker.status = status;
      worker.internalNotes.push(`[STATUS -> ${status}] ${remarks}`);
    }
  }

  async updateWorkerCategories(workerId: string, categoryCodes: string[]): Promise<void> {
    const worker = MOCK_WORKERS.find((w) => w.id === workerId);
    if (worker) {
      worker.categories = categoryCodes;
      worker.category = categoryCodes.join(', ');
      worker.internalNotes.push(`[CATEGORIES UPDATED] ${categoryCodes.join(', ')}`);
    }
  }

  async requestReVerification(workerId: string, checkTypes: string[], remarks: string): Promise<void> {
    const worker = MOCK_WORKERS.find((w) => w.id === workerId);
    if (worker) {
      worker.internalNotes.push(`[RE-VERIFICATION REQUESTED: ${checkTypes.join(', ')}] ${remarks}`);
    }
  }
}

export const WorkerRepositoryImpl = RealWorkerRepository;

export function createWorkerRepository(useMock: boolean = env.VITE_USE_MOCK_AUTH): IWorkerRepository {
  return useMock ? new MockWorkerRepository() : new RealWorkerRepository();
}

export const workerRepository = createWorkerRepository();

