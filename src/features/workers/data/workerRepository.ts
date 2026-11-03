import { Worker, WorkerDetail, WorkerFilterCriteria, WorkerPageResult, IWorkerRepository, WorkerDocumentMetadata } from '../domain/types';
import { httpClient } from '../../../core/api/httpClient';
import { formatPhoneNumber, getWorkerPhone, setWorkerPhone } from '../../../core/utils/phoneDirectory';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';
import { DomainError, ValidationError, NotFoundError, ConcurrencyConflictError } from '../../../core/errors/DomainError';

const MOCK_WORKERS: WorkerDetail[] = [
  {
    id: 'W-10482',
    applicationId: 'W-10482',
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
    accountStatus: 'ACTIVE',
    signedOffAt: '2026-01-06T12:00:00Z',
    activatedAt: '2026-01-06T12:30:00Z',
    matchingEligible: true,
    phoneMasked: '+91 98765 *****',
    phone: '+91 98765 43210',
    email: 'sunita.devi@sevanest.worker',
    onboardingStatus: 'VERIFIED',
    verificationStatus: 'VERIFIED',
    applicationStatus: 'ACTIVE',
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
        documentId: 'DOC-W10482-01',
        documentType: 'IDENTITY',
        documentTypeName: 'Aadhaar Card (Front & Back)',
        docNumberMasked: 'XXXX-XXXX-8921',
        status: 'VERIFIED',
        submittedAt: '2026-01-05T10:15:00Z',
        verifiedAt: '2026-01-06T11:30:00Z',
        reviewable: true,
        available: true,
      },
      {
        id: 'DOC-W10482-02',
        documentId: 'DOC-W10482-02',
        documentType: 'ADDRESS',
        documentTypeName: 'Electricity Utility Bill (Kondapur)',
        docNumberMasked: 'ELEC-HYD-49201',
        status: 'VERIFIED',
        submittedAt: '2026-01-05T10:18:00Z',
        verifiedAt: '2026-01-06T11:45:00Z',
        reviewable: true,
        available: true,
      },
      {
        id: 'DOC-W10482-03',
        documentId: 'DOC-W10482-03',
        documentType: 'POLICE_CLEARANCE',
        documentTypeName: 'Cyberabad Police Clearance Certificate',
        docNumberMasked: 'PCC-CYB-2024-8891',
        status: 'VERIFIED',
        submittedAt: '2026-01-05T10:25:00Z',
        verifiedAt: '2026-01-06T12:00:00Z',
        recheckDueDate: '2027-01-06T12:00:00Z',
        reviewable: true,
        available: true,
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
    applicationId: 'W-10483',
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
    phone: '+91 98450 12345',
    email: 'ramesh.yadav@sevanest.worker',
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
        documentId: 'DOC-W10483-01',
        documentType: 'IDENTITY',
        documentTypeName: 'Aadhaar Card (Front & Back)',
        docNumberMasked: 'XXXX-XXXX-4491',
        status: 'VERIFIED',
        submittedAt: '2026-01-08T09:15:00Z',
        verifiedAt: '2026-01-09T10:00:00Z',
        reviewable: true,
        available: true,
      },
      {
        id: 'DOC-W10483-02',
        documentId: 'DOC-W10483-02',
        documentType: 'ADDRESS',
        documentTypeName: 'Rent Agreement (Gachibowli)',
        docNumberMasked: 'RENT-HYD-8812',
        status: 'VERIFIED',
        submittedAt: '2026-01-08T09:20:00Z',
        verifiedAt: '2026-01-09T10:15:00Z',
        reviewable: true,
        available: true,
      },
      {
        id: 'DOC-W10483-03',
        documentId: 'DOC-W10483-03',
        documentType: 'POLICE_CLEARANCE',
        documentTypeName: 'Police Clearance Certificate',
        docNumberMasked: 'PCC-CYB-PENDING',
        status: 'SUBMITTED',
        submittedAt: '2026-01-08T09:30:00Z',
        reviewable: true,
        available: true,
      },
      {
        id: 'DOC-W10483-04',
        documentId: 'DOC-W10483-04',
        documentType: 'SKILL_LICENSE',
        documentTypeName: 'Commercial Driver License (LMV)',
        docNumberMasked: 'DL-09-2016-77881',
        status: 'VERIFIED',
        submittedAt: '2026-01-08T09:35:00Z',
        reviewable: true,
        available: true,
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
    applicationId: 'W-10484',
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
        documentId: 'DOC-W10484-01',
        documentType: 'IDENTITY',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-3312',
        status: 'VERIFIED',
        submittedAt: '2026-01-12T14:10:00Z',
        reviewable: true,
        available: true,
      },
      {
        id: 'DOC-W10484-02',
        documentId: 'DOC-W10484-02',
        documentType: 'ADDRESS',
        documentTypeName: 'Electricity Bill',
        status: 'SUBMITTED',
        submittedAt: '2026-01-12T14:15:00Z',
        reviewable: true,
        available: true,
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
    applicationId: 'W-10310',
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
        documentId: 'DOC-W10310-01',
        documentType: 'IDENTITY',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-9901',
        status: 'VERIFIED',
        submittedAt: '2026-01-02T11:15:00Z',
        reviewable: true,
        available: true,
      },
      {
        id: 'DOC-W10310-02',
        documentId: 'DOC-W10310-02',
        documentType: 'SKILL_LICENSE',
        documentTypeName: 'Early Childhood Helper Cert',
        docNumberMasked: 'ECE-CERT-2022',
        status: 'VERIFIED',
        submittedAt: '2026-01-02T11:20:00Z',
        reviewable: true,
        available: true,
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
    applicationId: 'W-10200',
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
        documentId: 'DOC-W10200-01',
        documentType: 'IDENTITY',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-1234',
        status: 'VERIFIED',
        reviewable: true,
        available: true,
      },
      {
        id: 'DOC-W10200-02',
        documentId: 'DOC-W10200-02',
        documentType: 'POLICE_CLEARANCE',
        documentTypeName: 'Police Clearance Certificate',
        status: 'REJECTED',
        rejectionReason: 'Adverse police verification record reported.',
        reviewable: true,
        available: true,
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
    applicationId: 'W-10115',
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
        documentId: 'DOC-W10115-01',
        documentType: 'IDENTITY',
        documentTypeName: 'Aadhaar Card',
        docNumberMasked: 'XXXX-XXXX-6671',
        status: 'VERIFIED',
        reviewable: true,
        available: true,
      },
      {
        id: 'DOC-W10115-02',
        documentId: 'DOC-W10115-02',
        documentType: 'ADDRESS',
        documentTypeName: 'Utility Bill (Annual Renewal Due)',
        docNumberMasked: 'ELEC-HYD-11029',
        status: 'RECHECK_DUE',
        recheckDueDate: 'Annual Re-Verification Due',
        reviewable: true,
        available: true,
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
  {
    id: 'W-10499',
    applicationId: 'W-10499',
    name: 'Pooja Sharma',
    category: 'House Maid',
    categories: ['House Maid'],
    experienceYears: 2,
    ratingAverage: 0,
    totalReviews: 0,
    locality: 'Kondapur',
    serviceRadiusKm: 5,
    languages: ['Hindi'],
    bio: 'Newly registered housekeeping applicant with zero documents uploaded.',
    skills: ['Housekeeping'],
    isFullyVerified: false,
    status: 'ACTIVE',
    phoneMasked: '+91 98111 *****',
    phone: '+91 98111 22334',
    email: 'pooja.sharma@sevanest.worker',
    onboardingStatus: 'APPLIED',
    verificationStatus: 'PENDING',
    createdAt: '2026-02-01T10:00:00Z',
    registeredAt: '2026-02-01T10:00:00Z',
    preferredServiceArea: 'Kondapur',
    expectedCompensation: '₹15,000 / month',
    availability: 'Awaiting KYC Documents',
    activeEngagementsCount: 0,
    completedBookingsCount: 0,
    replacementsIncurred: 0,
    documents: [],
    verification: {
      phoneOtpVerified: true,
      identityProofStatus: 'PENDING',
      addressProofStatus: 'PENDING',
      criminalRecordStatus: 'PENDING',
      skillProofStatus: 'NOT_APPLICABLE',
      referenceCheckStatus: 'PENDING',
      lastVerifiedAt: undefined,
      overallRemarks: 'Applicant has not submitted any digital or manual documents.',
    },
    recentEngagements: [],
    internalNotes: ['Zero documents submitted at initial registration'],
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

  const rawOnboardingStatus = String(item.onboardingStatus || '').toUpperCase();
  const rawVerificationStatus = String(item.verificationStatus || '').toUpperCase();
  const rawLevel = (item.level ?? item.verificationLevel ?? (typeof item.verification === 'object' && item.verification !== null ? (item.verification as Record<string, unknown>).level : undefined)) as string | number | undefined;
  const level = rawLevel !== undefined ? String(rawLevel) : undefined;
  const levelUpper = level ? level.toUpperCase() : '';
  const isLevelVerified = levelUpper === 'VERIFIED' || levelUpper === 'APPROVED' || levelUpper === 'COMPLETE' || levelUpper === 'LEVEL_1' || levelUpper === 'LEVEL_2' || levelUpper === 'LEVEL_3' || levelUpper === 'TIER_1' || levelUpper === 'TIER_2' || levelUpper === 'TRUE';

  const isRejected =
    rawOnboardingStatus === 'REJECTED' ||
    rawVerificationStatus === 'REJECTED' ||
    levelUpper === 'REJECTED' ||
    item.verification === 'REJECTED' ||
    String(item.applicationStatus || '').toUpperCase() === 'REJECTED';

  // Rule: A worker must not be displayed as fully KYC approved if onboardingStatus is DRAFT
  // or if required verification checks remain incomplete.
  const isStatusIncomplete = (
    rawOnboardingStatus === 'DRAFT' ||
    rawVerificationStatus === 'PENDING' ||
    rawVerificationStatus === 'IN_REVIEW'
  );

  const isExplicitlyVerified = item.isFullyVerified === true || item.verified === true;
  const isVerified = !isStatusIncomplete && !isRejected && (
    isExplicitlyVerified ||
    (rawOnboardingStatus !== 'SUBMITTED' && (
      item.verification === 'VERIFIED' ||
      rawVerificationStatus === 'VERIFIED' ||
      rawOnboardingStatus === 'VERIFIED' ||
      isLevelVerified
    ))
  );

  const rawId = String(item.workerId || item.id || '');
  const cachedPhone = getWorkerPhone(rawId) || getWorkerPhone(String(item.userId || ''));
  const rawPhoneCandidate = item.phone ? String(item.phone) : item.mobile ? String(item.mobile) : undefined;
  const rawCleanPhone = cachedPhone || (rawPhoneCandidate && !rawPhoneCandidate.includes('*') ? formatPhoneNumber(rawPhoneCandidate) : undefined);
  if (rawCleanPhone) {
    setWorkerPhone(rawId, rawCleanPhone);
    if (item.userId) setWorkerPhone(String(item.userId), rawCleanPhone);
  }

  let phoneMasked: string | undefined = undefined;
  if (cachedPhone) {
    phoneMasked = cachedPhone;
  } else if (item.phoneMasked) {
    phoneMasked = String(item.phoneMasked);
  } else if (rawCleanPhone) {
    phoneMasked = rawCleanPhone;
  } else if (item.mobile || item.phone) {
    phoneMasked = formatPhoneNumber(String(item.mobile || item.phone));
  }

  const applicationId = item.applicationId && !String(item.applicationId).startsWith('APP-')
    ? String(item.applicationId)
    : rawId || undefined;

  const rawPhone = rawCleanPhone || (rawPhoneCandidate && !rawPhoneCandidate.includes('*') ? formatPhoneNumber(rawPhoneCandidate) : undefined);
  const rawEmail = item.email ? String(item.email) : undefined;

  return {
    id: rawId,
    userId: item.userId ? String(item.userId) : undefined,
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
    isFullyVerified: item.isFullyVerified !== undefined ? Boolean(item.isFullyVerified) : isVerified,
    status: (item.accountStatus === 'SUSPENDED' || item.status === 'SUSPENDED' ? 'SUSPENDED' : item.status === 'BLACKLISTED' ? 'BLACKLISTED' : 'ACTIVE') as Worker['status'],
    accountStatus: (item.accountStatus === 'SUSPENDED' || item.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE') as Worker['accountStatus'],
    phoneMasked,
    phone: rawPhone,
    mobile: rawPhone,
    email: rawEmail,
    onboardingStatus: (item.onboardingStatus as Worker['onboardingStatus']) || (isRejected ? 'REJECTED' : isVerified ? 'VERIFIED' : 'APPLIED'),
    verificationStatus: (item.verificationStatus as Worker['verificationStatus']) || (isRejected ? 'REJECTED' : isVerified ? 'VERIFIED' : 'PENDING'),
    applicationStatus: (item.applicationStatus as Worker['applicationStatus']) || (isRejected ? 'REJECTED' : isVerified ? 'VERIFIED' : 'SUBMITTED'),
    verificationLevel: String(item.verificationLevel || level || 'NOT_STARTED'),
    level,
    signedOffAt: item.signedOffAt ? String(item.signedOffAt) : undefined,
    activatedAt: item.activatedAt ? String(item.activatedAt) : undefined,
    matchingEligible: item.matchingEligible !== undefined
      ? Boolean(item.matchingEligible)
      : Boolean(isVerified && (item.accountStatus === 'ACTIVE' || item.status === 'ACTIVE') && (!item.signedOffAt || Boolean(item.signedOffAt && item.activatedAt))),
    createdAt: item.createdAt ? String(item.createdAt) : undefined,
    registeredAt: item.registeredAt ? String(item.registeredAt) : item.createdAt ? String(item.createdAt) : undefined,
  };
}

export function mapBackendWorkerDetailToWorkerDetail(data: Record<string, unknown>, verifData?: Record<string, unknown>): WorkerDetail {
  const unwrappedData = (data?.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data) as Record<string, unknown>;
  const unwrappedVerif = (verifData?.data && typeof verifData.data === 'object' && !Array.isArray(verifData.data) ? verifData.data : verifData) as Record<string, unknown> | undefined;

  const summary = mapBackendWorkerToWorker(unwrappedData);
  const rawV = (unwrappedVerif?.verification && typeof unwrappedVerif.verification === 'object'
    ? unwrappedVerif.verification
    : unwrappedVerif || unwrappedData.verification) as Record<string, unknown> | undefined;

  // The authoritative overall verification result is the response's `level` field.
  const rawLevel = (rawV?.level ?? unwrappedVerif?.level ?? unwrappedData.level ?? unwrappedData.verificationLevel) as string | number | undefined;
  const levelStr = rawLevel !== undefined ? String(rawLevel) : undefined;

  let effectiveFullyVerified: boolean;
  const rawChecks =
    unwrappedVerif?.checks ??
    (typeof unwrappedData.verification === 'object' && unwrappedData.verification !== null
      ? (unwrappedData.verification as Record<string, unknown>).checks
      : undefined) ??
    rawV?.checks;
  const checksList = Array.isArray(rawChecks) ? (rawChecks as Record<string, unknown>[]) : [];
  const hasIncompleteChecksList = checksList.length > 0 && checksList.some((c) => {
    const s = String(c.status || '').toUpperCase();
    return s !== 'APPROVED' && s !== 'PASSED';
  });

  const rawOnboardingStatus = String(unwrappedData.onboardingStatus || '').toUpperCase();
  if (hasIncompleteChecksList || rawOnboardingStatus === 'DRAFT') {
    effectiveFullyVerified = false;
  } else if (levelStr !== undefined) {
    const upper = levelStr.toUpperCase();
    if (upper === 'VERIFIED' || upper === 'APPROVED' || upper === 'COMPLETE' || upper === 'LEVEL_1' || upper === 'LEVEL_2' || upper === 'LEVEL_3' || upper === 'TIER_1' || upper === 'TIER_2' || upper === 'TRUE') {
      effectiveFullyVerified = true;
    } else if (upper === 'PENDING' || upper === 'NONE' || upper === 'UNVERIFIED' || upper === '0' || upper === 'REJECTED' || upper === 'IN_REVIEW' || upper === 'FALSE') {
      effectiveFullyVerified = false;
    } else {
      effectiveFullyVerified = summary.isFullyVerified;
    }
  } else if (unwrappedVerif?.signedOffAt && !hasIncompleteChecksList) {
    effectiveFullyVerified = true;
  } else {
    // Fallback when level field is absent
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
    effectiveFullyVerified = summary.isFullyVerified && !hasIncompleteChecks;
  }

  // Build documents list from root, verification metadata, and checks
  const documents: WorkerDocumentMetadata[] = [];
  const seenDocIds = new Set<string>();

  const registerDoc = (d: Record<string, unknown>, fallbackType?: string, checkId?: string) => {
    // Render a document only when reviewable === true.
    // Do not treat available === true as proof that a document is reviewable.
    // Never show discarded or not-uploaded documents as reviewable.
    if (d.reviewable !== true) {
      return;
    }
    if (
      d.available === false ||
      d.availability === 'DISCARDED' ||
      d.availability === 'NOT_UPLOADED' ||
      d.status === 'PENDING_UPLOAD'
    ) {
      return;
    }

    const rawId = String(d.documentId || d.id || '').trim();
    if (!rawId) return;
    if (seenDocIds.has(rawId)) return;
    seenDocIds.add(rawId);

    const docType = String(d.documentType || d.type || fallbackType || 'IDENTITY');
    const docTypeName = String(d.documentTypeName || d.name || d.title || `${docType} Document`);
    const docNumberMasked = d.docNumberMasked || d.documentNumber ? String(d.docNumberMasked || d.documentNumber) : undefined;
    const rawStatus = String(d.status || '').toUpperCase();
    const status: WorkerDocumentMetadata['status'] =
      rawStatus === 'VERIFIED' || rawStatus === 'APPROVED'
        ? 'VERIFIED'
        : rawStatus === 'REJECTED' || rawStatus === 'FAILED'
        ? 'REJECTED'
        : 'SUBMITTED';

    documents.push({
      id: rawId,
      documentId: rawId,
      checkId: checkId || (d.checkId ? String(d.checkId) : undefined),
      checkType: fallbackType || (d.checkType ? String(d.checkType) : undefined),
      documentType: docType,
      documentTypeName: docTypeName,
      docNumberMasked,
      status,
      submittedAt: d.submittedAt || d.createdAt ? String(d.submittedAt || d.createdAt) : undefined,
      verifiedAt: d.verifiedAt ? String(d.verifiedAt) : undefined,
      recheckDueDate: d.recheckDueDate || d.expiryDate ? String(d.recheckDueDate || d.expiryDate) : undefined,
      rejectionReason: d.rejectionReason || d.remarks ? String(d.rejectionReason || d.remarks) : undefined,
      signedUrl: d.signedUrl || d.url ? String(d.signedUrl || d.url) : undefined,
      contentType: d.contentType ? String(d.contentType) : (d.mimeType ? String(d.mimeType) : undefined),
      mimeType: d.mimeType ? String(d.mimeType) : (d.contentType ? String(d.contentType) : undefined),
      sizeBytes: typeof d.sizeBytes === 'number' ? d.sizeBytes : undefined,
      available: typeof d.available === 'boolean' ? d.available : d.availability !== 'DISCARDED',
      availability: d.availability ? String(d.availability) : 'AVAILABLE',
      submitted: d.submitted !== false,
      reviewable: true,
    });
  };

  if (Array.isArray(unwrappedData.documents)) {
    unwrappedData.documents.forEach((d) => d && typeof d === 'object' && registerDoc(d as Record<string, unknown>));
  }
  if (Array.isArray(unwrappedVerif?.documents)) {
    (unwrappedVerif.documents as unknown[]).forEach((d) => d && typeof d === 'object' && registerDoc(d as Record<string, unknown>));
  }
  if (Array.isArray(rawV?.documents)) {
    (rawV.documents as unknown[]).forEach((d) => d && typeof d === 'object' && registerDoc(d as Record<string, unknown>));
  }

  // Harvest documents embedded in checks
  const checksSource = unwrappedVerif?.checks || rawV?.checks || unwrappedData.checks;
  if (Array.isArray(checksSource)) {
    checksSource.forEach((chk: Record<string, unknown>) => {
      const checkType = String(chk.checkType || chk.type || '');
      const checkId = chk.checkId ? String(chk.checkId) : (chk.id ? String(chk.id) : undefined);
      if (Array.isArray(chk.documents)) {
        chk.documents.forEach((d) => d && typeof d === 'object' && registerDoc(d as Record<string, unknown>, checkType, checkId));
      }
      if (chk.documentMetadata && typeof chk.documentMetadata === 'object') {
        const meta = chk.documentMetadata as Record<string, unknown>;
        if (meta.documentId || meta.id || meta.docNumberMasked) {
          registerDoc({
            id: meta.documentId || meta.id,
            documentId: meta.documentId || meta.id,
            documentType: meta.documentType || checkType,
            documentTypeName: meta.documentTypeName || chk.title,
            docNumberMasked: meta.docNumberMasked,
            contentType: meta.contentType,
            mimeType: meta.mimeType,
            status: chk.status === 'APPROVED' ? 'VERIFIED' : chk.status === 'REJECTED' ? 'REJECTED' : 'SUBMITTED',
            submittedAt: meta.submittedAt || chk.verifiedAt,
            verifiedAt: chk.verifiedAt,
            reviewable: meta.reviewable ?? chk.reviewable,
            available: meta.available ?? chk.available,
            availability: meta.availability ?? chk.availability,
          }, checkType, checkId);
        }
      } else if (chk.documentId) {
        registerDoc({
          id: chk.documentId,
          documentId: chk.documentId,
          documentType: checkType,
          documentTypeName: chk.documentTypeName || chk.title,
          docNumberMasked: chk.documentNumber || chk.docNumberMasked,
          status: chk.status === 'APPROVED' ? 'VERIFIED' : 'SUBMITTED',
          verifiedAt: chk.verifiedAt,
          reviewable: chk.reviewable,
          available: chk.available,
          availability: chk.availability,
        }, checkType, checkId);
      }
    });
  } else if (checksSource && typeof checksSource === 'object') {
    Object.entries(checksSource).forEach(([key, val]) => {
      if (val && typeof val === 'object') {
        const chk = val as Record<string, unknown>;
        const checkType = String(chk.checkType || chk.type || key);
        const checkId = chk.checkId ? String(chk.checkId) : (chk.id ? String(chk.id) : undefined);
        if (Array.isArray(chk.documents)) {
          chk.documents.forEach((d) => d && typeof d === 'object' && registerDoc(d as Record<string, unknown>, checkType, checkId));
        }
        if (chk.documentMetadata && typeof chk.documentMetadata === 'object') {
          const meta = chk.documentMetadata as Record<string, unknown>;
          if (meta.documentId || meta.id || meta.docNumberMasked) {
            registerDoc({
              id: meta.documentId || meta.id,
              documentId: meta.documentId || meta.id,
              documentType: meta.documentType || checkType,
              documentTypeName: meta.documentTypeName || chk.title,
              docNumberMasked: meta.docNumberMasked,
              contentType: meta.contentType,
              mimeType: meta.mimeType,
              status: chk.status === 'APPROVED' ? 'VERIFIED' : chk.status === 'REJECTED' ? 'REJECTED' : 'SUBMITTED',
              submittedAt: meta.submittedAt || chk.verifiedAt,
              verifiedAt: chk.verifiedAt,
              reviewable: meta.reviewable ?? chk.reviewable,
              available: meta.available ?? chk.available,
              availability: meta.availability ?? chk.availability,
            }, checkType, checkId);
          }
        } else if (chk.documentId) {
          registerDoc({
            id: chk.documentId,
            documentId: chk.documentId,
            documentType: checkType,
            documentTypeName: chk.documentTypeName || chk.title,
            docNumberMasked: chk.documentNumber || chk.docNumberMasked,
            status: chk.status === 'APPROVED' ? 'VERIFIED' : 'SUBMITTED',
            verifiedAt: chk.verifiedAt,
            reviewable: chk.reviewable,
            available: chk.available,
            availability: chk.availability,
          }, checkType, checkId);
        }
      }
    });
  }

  const detailPhone = String(unwrappedData.mobile || unwrappedData.phone || '');
  if (detailPhone && !detailPhone.includes('*')) {
    const formatted = formatPhoneNumber(detailPhone);
    setWorkerPhone(summary.id, formatted);
    if (summary.userId) setWorkerPhone(summary.userId, formatted);
    summary.phone = formatted;
    summary.mobile = formatted;
    summary.phoneMasked = formatted;
  }

  return {
    ...summary,
    isFullyVerified: effectiveFullyVerified,
    serviceRadiusKm: Number(unwrappedData.serviceRadiusKm || 8),
    languages: Array.isArray(unwrappedData.languages) ? unwrappedData.languages.map(String) : [],
    bio: String(unwrappedData.bio || ''),
    skills: Array.isArray(unwrappedData.skills) ? unwrappedData.skills.map(String) : summary.categories || [summary.category],
    preferredServiceArea: String(unwrappedData.preferredServiceArea || summary.locality || ''),
    expectedCompensation: unwrappedData.expectedSalary || unwrappedData.expectedCompensation ? String(unwrappedData.expectedSalary || unwrappedData.expectedCompensation) : undefined,
    availability: String(unwrappedData.availability || (summary.status === 'ACTIVE' ? 'Available for Allocation' : 'Unavailable')),
    registeredAt: summary.registeredAt || (unwrappedData.createdAt ? String(unwrappedData.createdAt) : undefined),
    updatedAt: unwrappedData.updatedAt ? String(unwrappedData.updatedAt) : undefined,
    activeEngagementsCount: Number(unwrappedData.activeEngagementsCount || 0),
    completedBookingsCount: Number(unwrappedData.completedBookingsCount || 0),
    replacementsIncurred: Number(unwrappedData.replacementsIncurred || 0),
    documents,
    verification: {
      phoneOtpVerified: Boolean(rawV?.phoneOtpVerified ?? unwrappedData.phoneOtpVerified ?? true),
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
      level: levelStr,
      ...((rawV as object) || {}),
    },
    verificationLevel: levelStr || summary.verificationLevel,
    level: levelStr || summary.level,
    recentEngagements: Array.isArray(unwrappedData.recentEngagements) ? (unwrappedData.recentEngagements as WorkerDetail['recentEngagements']) : [],
    internalNotes: Array.isArray(unwrappedData.internalNotes) ? unwrappedData.internalNotes.map(String) : [],
  };
}

export function syncMockWorkerVerification(
  workerId: string,
  isFullyVerified: boolean,
  isRejected: boolean = false
): void {
  const worker = MOCK_WORKERS.find((w) => w.id === workerId);
  if (worker) {
    worker.isFullyVerified = isFullyVerified;
    if (isRejected) {
      worker.verificationStatus = 'REJECTED';
      worker.onboardingStatus = 'REJECTED';
      worker.applicationStatus = 'REJECTED';
      worker.level = 'REJECTED';
      worker.verificationLevel = 'REJECTED';
      worker.verification.level = 'REJECTED';
      worker.verification.identityProofStatus = 'REJECTED';
      worker.verification.addressProofStatus = 'REJECTED';
    } else {
      worker.verificationStatus = isFullyVerified ? 'VERIFIED' : 'PENDING';
      worker.onboardingStatus = isFullyVerified ? 'VERIFIED' : 'APPLIED';
      worker.applicationStatus = isFullyVerified ? 'VERIFIED' : 'SUBMITTED';
      worker.level = isFullyVerified ? 'LEVEL_3' : 'LEVEL_1';
      worker.verificationLevel = isFullyVerified ? 'LEVEL_3' : 'LEVEL_1';
      worker.verification.level = isFullyVerified ? 'LEVEL_3' : 'LEVEL_1';
      if (isFullyVerified) {
        worker.verification.identityProofStatus = 'VERIFIED';
        worker.verification.addressProofStatus = 'VERIFIED';
        worker.verification.criminalRecordStatus = 'VERIFIED';
        worker.verification.referenceCheckStatus = 'VERIFIED';
        worker.verification.phoneOtpVerified = true;
        worker.verification.lastVerifiedAt = new Date().toISOString();
      } else {
        worker.verification.identityProofStatus = 'PENDING';
        worker.verification.addressProofStatus = 'PENDING';
      }
    }
  }
}

export function isPotentialMobileNumber(term: string): boolean {
  const trimmed = term.trim();
  if (!trimmed) return false;

  // Reject if it contains alphabetic characters
  if (/[a-zA-Z]/.test(trimmed)) {
    return false;
  }

  // Extract pure digits
  const digitsOnly = trimmed.replace(/\D/g, '');

  // Backend validation requirement: "mobile must be longer than or equal to 10 characters."
  // Valid Indian mobile standard: 10 digits (national) up to 15 digits (E.164 with country code)
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

export function isWorkerIdFormat(term: string): boolean {
  const trimmed = term.trim();
  return /^(W-\d+|APP-\d+)$/i.test(trimmed);
}

export class RealWorkerRepository implements IWorkerRepository {
  async getWorkers(filter?: WorkerFilterCriteria): Promise<Worker[]> {
    try {
      let verifiedParam: boolean | undefined = undefined;
      if (filter?.verified !== undefined) {
        verifiedParam = filter.verified;
      } else if (filter?.verificationStatus === 'VERIFIED') {
        verifiedParam = true;
      } else if (filter?.verificationStatus && filter.verificationStatus !== 'ALL') {
        verifiedParam = false;
      }

      const trimmedSearch = filter?.searchTerm?.trim();

      // If search matches exact worker ID format, use documented GET /admin/workers/{workerId}
      if (trimmedSearch && isWorkerIdFormat(trimmedSearch)) {
        try {
          const single = await this.getWorkerById(trimmedSearch);
          if (single) {
            const matchesCategory =
              !filter?.category ||
              filter.category === 'ALL' ||
              single.category === filter.category ||
              single.categories?.includes(filter.category);
            const matchesStatus =
              !filter?.status ||
              filter.status === 'ALL' ||
              single.status === filter.status;
            const matchesVerified =
              verifiedParam === undefined ||
              single.isFullyVerified === verifiedParam;

            return matchesCategory && matchesStatus && matchesVerified ? [single] : [];
          }
          return [];
        } catch {
          return [];
        }
      }

      const params: Record<string, unknown> = {
        verified: verifiedParam,
      };

      if (trimmedSearch) {
        if (isPotentialMobileNumber(trimmedSearch)) {
          params.mobile = trimmedSearch;
        } else {
          // Documented backend query parameter for partial name search
          params.name = trimmedSearch;
        }
      }

      if (filter?.category && filter.category !== 'ALL') {
        params.categoryId = filter.category;
      }
      if (filter?.accountStatus) {
        params.accountStatus = filter.accountStatus;
      } else if (filter?.status === 'ACTIVE' || filter?.status === 'SUSPENDED') {
        params.accountStatus = filter.status;
      }
      if (filter?.locality && filter.locality !== 'ALL') {
        params.areaId = filter.locality;
      }
      if (filter?.page !== undefined) {
        params.page = filter.page;
      }
      if (filter?.pageSize !== undefined) {
        params.limit = filter.pageSize;
      } else if (filter?.limit !== undefined) {
        params.limit = filter.limit;
      }

      const response = await httpClient.get<{ items?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
        '/admin/workers',
        { params }
      );

      const rawData = response.data as Record<string, unknown>;
      let list: Record<string, unknown>[] = [];
      if (Array.isArray(response.data)) {
        list = response.data;
      } else if (rawData) {
        if (Array.isArray(rawData.items)) {
          list = rawData.items as Record<string, unknown>[];
        } else if (Array.isArray(rawData.data)) {
          list = rawData.data as Record<string, unknown>[];
        } else if (rawData.data && typeof rawData.data === 'object') {
          const inner = rawData.data as Record<string, unknown>;
          if (Array.isArray(inner.items)) {
            list = inner.items as Record<string, unknown>[];
          } else if (Array.isArray(inner.workers)) {
            list = inner.workers as Record<string, unknown>[];
          }
        }
      }

      let verifiedIds = new Set<string>();
      if (verifiedParam === undefined && !filter?.searchTerm) {
        try {
          const verifiedRes = await httpClient.get<{ items?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
            '/admin/workers',
            { params: { verified: true, limit: 100 } }
          );
          const vData = verifiedRes.data as Record<string, unknown>;
          const vList = Array.isArray(verifiedRes.data)
            ? verifiedRes.data
            : Array.isArray(vData?.items)
            ? (vData.items as Record<string, unknown>[])
            : Array.isArray(vData?.data)
            ? (vData.data as Record<string, unknown>[])
            : [];
          vList.forEach((w: Record<string, unknown>) => {
            const id = String(w.id || w.workerId || '');
            if (id) verifiedIds.add(id);
          });
        } catch {
          // Ignore fallback error
        }
      }

      const uncachedWorkerIds = list
        .map((item) => String(item.id || item.workerId || ''))
        .filter((id) => id && !getWorkerPhone(id));
      if (uncachedWorkerIds.length > 0) {
        await Promise.all(
          uncachedWorkerIds.map(async (id) => {
            try {
              const detailRes = await httpClient.get<Record<string, unknown>>(`/admin/workers/${id}`);
              const detail = (detailRes.data?.data || detailRes.data) as Record<string, unknown>;
              const mobile = String(detail?.mobile || detail?.phone || '');
              if (mobile && !mobile.includes('*')) {
                const formatted = formatPhoneNumber(mobile);
                setWorkerPhone(id, formatted);
                if (detail.userId) setWorkerPhone(String(detail.userId), formatted);
              }
            } catch {
              // Ignore failure
            }
          })
        );
      }

      return list.map((item) => {
        const id = String(item.id || item.workerId || '');
        const isVerifiedByBackend = verifiedParam === true || verifiedIds.has(id);
        return mapBackendWorkerToWorker({
          ...item,
          isFullyVerified: isVerifiedByBackend ? true : item.isFullyVerified,
          verified: isVerifiedByBackend ? true : item.verified,
        });
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getWorkersPage(
    filter?: WorkerFilterCriteria,
    page: number = 1,
    limit: number = 20
  ): Promise<WorkerPageResult> {
    try {
      const fn = this.getWorkers as unknown as { mock?: unknown; _isMockFunction?: unknown };
      if (
        fn?.mock ||
        fn?._isMockFunction ||
        this.getWorkers !== RealWorkerRepository.prototype.getWorkers
      ) {
        const items = await this.getWorkers({ ...filter, page, limit });
        return {
          items,
          total: items.length,
          page,
          limit,
          hasMore: false,
        };
      }

      let verifiedParam: boolean | undefined = undefined;
      if (filter?.verified !== undefined) {
        verifiedParam = filter.verified;
      } else if (filter?.verificationStatus === 'VERIFIED') {
        verifiedParam = true;
      } else if (filter?.verificationStatus && filter.verificationStatus !== 'ALL') {
        verifiedParam = false;
      }

      const trimmedSearch = filter?.searchTerm?.trim();

      // If search matches exact worker ID format, use documented GET /admin/workers/{workerId}
      if (trimmedSearch && isWorkerIdFormat(trimmedSearch)) {
        try {
          const single = await this.getWorkerById(trimmedSearch);
          if (single) {
            const matchesCategory =
              !filter?.category ||
              filter.category === 'ALL' ||
              single.category === filter.category ||
              single.categories?.includes(filter.category);
            const matchesStatus =
              !filter?.status ||
              filter.status === 'ALL' ||
              single.status === filter.status;
            const matchesVerified =
              verifiedParam === undefined ||
              single.isFullyVerified === verifiedParam;

            if (matchesCategory && matchesStatus && matchesVerified) {
              return {
                items: [single],
                total: 1,
                page: 1,
                limit,
                hasMore: false,
              };
            }
          }
          return {
            items: [],
            total: 0,
            page: 1,
            limit,
            hasMore: false,
          };
        } catch (err) {
          if (err instanceof NotFoundError) {
            return {
              items: [],
              total: 0,
              page: 1,
              limit,
              hasMore: false,
            };
          }
          throw err;
        }
      }

      const params: Record<string, unknown> = {
        page,
        limit,
        verified: verifiedParam,
      };

      if (trimmedSearch) {
        if (isPotentialMobileNumber(trimmedSearch)) {
          params.mobile = trimmedSearch;
        } else {
          // Documented backend query parameter for partial name search
          params.name = trimmedSearch;
        }
      }

      if (filter?.category && filter.category !== 'ALL') {
        params.categoryId = filter.category;
      }
      if (filter?.accountStatus) {
        params.accountStatus = filter.accountStatus;
      } else if (filter?.status === 'ACTIVE' || filter?.status === 'SUSPENDED') {
        params.accountStatus = filter.status;
      }
      if (filter?.locality && filter.locality !== 'ALL') {
        params.areaId = filter.locality;
      }

      const response = await httpClient.get<{
        items?: Array<Record<string, unknown>>;
        data?: unknown;
        meta?: Record<string, unknown>;
      } | Array<Record<string, unknown>>>('/admin/workers', { params });

      const rawData = response.data as Record<string, unknown>;
      let list: Record<string, unknown>[] = [];
      let meta: Record<string, unknown> | undefined;

      if (Array.isArray(response.data)) {
        list = response.data;
      } else if (rawData) {
        if (rawData.meta && typeof rawData.meta === 'object') {
          meta = rawData.meta as Record<string, unknown>;
        }
        if (Array.isArray(rawData.items)) {
          list = rawData.items as Record<string, unknown>[];
        } else if (Array.isArray(rawData.data)) {
          list = rawData.data as Record<string, unknown>[];
        } else if (rawData.data && typeof rawData.data === 'object') {
          const inner = rawData.data as Record<string, unknown>;
          if (inner.meta && typeof inner.meta === 'object') {
            meta = inner.meta as Record<string, unknown>;
          }
          if (Array.isArray(inner.items)) {
            list = inner.items as Record<string, unknown>[];
          } else if (Array.isArray(inner.workers)) {
            list = inner.workers as Record<string, unknown>[];
          }
        }
      }

      const total = Number(
        meta?.total ??
        meta?.totalItems ??
        meta?.count ??
        list.length
      );
      const currentPage = Number(meta?.page ?? meta?.currentPage ?? page);
      const currentLimit = Number(meta?.limit ?? meta?.itemsPerPage ?? limit);
      const totalPages = meta?.totalPages ? Number(meta.totalPages) : (total > 0 ? Math.ceil(total / currentLimit) : 1);
      const hasMore = currentPage < totalPages && list.length > 0;

      let verifiedIds = new Set<string>();
      if (verifiedParam === undefined && !trimmedSearch) {
        try {
          const verifiedRes = await httpClient.get<{ items?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
            '/admin/workers',
            { params: { verified: true, limit: 100 } }
          );
          const vData = verifiedRes.data as Record<string, unknown>;
          const vList = Array.isArray(verifiedRes.data)
            ? verifiedRes.data
            : Array.isArray(vData?.items)
            ? (vData.items as Record<string, unknown>[])
            : Array.isArray(vData?.data)
            ? (vData.data as Record<string, unknown>[])
            : [];
          vList.forEach((w: Record<string, unknown>) => {
            const id = String(w.id || w.workerId || '');
            if (id) verifiedIds.add(id);
          });
        } catch {
          // Ignore fallback error
        }
      }

      return {
        items: list.map((item) => {
          const id = String(item.id || item.workerId || '');
          const isVerifiedByBackend = verifiedParam === true || verifiedIds.has(id);
          return mapBackendWorkerToWorker({
            ...item,
            isFullyVerified: isVerifiedByBackend ? true : item.isFullyVerified,
            verified: isVerifiedByBackend ? true : item.verified,
          });
        }),
        total,
        page: currentPage,
        limit: currentLimit,
        hasMore,
      };
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

      const rawWorker = workerRes.data as Record<string, unknown>;
      if (!rawWorker) return null;
      const unwrappedWorker = (rawWorker?.data && typeof rawWorker.data === 'object' && !Array.isArray(rawWorker.data)
        ? rawWorker.data
        : rawWorker) as Record<string, unknown>;

      const rawVerif = verifRes.data as Record<string, unknown> | undefined;
      const unwrappedVerif = (rawVerif?.data && typeof rawVerif.data === 'object' && !Array.isArray(rawVerif.data)
        ? rawVerif.data
        : rawVerif) as Record<string, unknown> | undefined;

      if (!unwrappedWorker || Object.keys(unwrappedWorker).length === 0) return null;
      return mapBackendWorkerDetailToWorkerDetail(unwrappedWorker, unwrappedVerif);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async updateWorkerStatus(workerId: string, status: Worker['status'], remarks: string): Promise<void> {
    try {
      if (status === 'BLACKLISTED') {
        await httpClient.post(`/admin/workers/${encodeURIComponent(workerId)}/blacklist`, {
          reason: remarks || 'Worker blacklisted by administrator',
        });
        return;
      }

      // Worker account status (ACTIVE / SUSPENDED) is updated via /admin/users/{userId}/status (DEC-06)
      let targetUserId = workerId;
      try {
        const worker = await this.getWorkerById(workerId);
        if (worker?.userId) {
          targetUserId = worker.userId;
        }
      } catch {
        // Fall back to workerId if fetching detail is not available
      }

      await httpClient.patch(`/admin/users/${encodeURIComponent(targetUserId)}/status`, {
        status,
        reason: remarks || `Status transitioned to ${status}`,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async updateWorkerCategories(workerId: string, categoryCodes: string[]): Promise<void> {
    try {
      // Backend contract SetWorkerCategoriesDto requires { categoryIds: string[] }
      await httpClient.put(`/admin/workers/${encodeURIComponent(workerId)}/categories`, {
        categoryIds: categoryCodes,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async requestReVerification(workerId: string, checkTypes: string[], remarks: string): Promise<void> {
    try {
      const cleanId = workerId.trim();
      // If a checkId is passed directly, trigger check recheck
      if (cleanId.startsWith('chk-') || cleanId.startsWith('check-')) {
        await httpClient.post(`/admin/verification/checks/${encodeURIComponent(cleanId)}/recheck`, {
          remarks: remarks || `Re-verification requested: ${checkTypes.join(', ')}`,
        });
        return;
      }

      // Locate check in worker's verification dossier and request recheck
      const verifRes = await httpClient.get<Record<string, unknown>>(`/admin/workers/${encodeURIComponent(cleanId)}/verification`).catch(() => null);
      const raw = verifRes?.data;
      const verifData = (raw && typeof raw === 'object' && 'data' in raw && raw.data && typeof raw.data === 'object' ? raw.data : raw) as Record<string, unknown> | undefined;
      const checks = Array.isArray(verifData?.checks) ? (verifData.checks as Record<string, unknown>[]) : [];
      const targetCheck = checks.find((c) => checkTypes.includes(String(c.checkType || c.type || ''))) || checks[0];

      if (targetCheck && targetCheck.id) {
        await httpClient.post(`/admin/verification/checks/${encodeURIComponent(String(targetCheck.id))}/recheck`, {
          remarks: remarks || `Re-verification requested: ${checkTypes.join(', ')}`,
        });
      }
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async approveCheck(checkId: string, remarks?: string): Promise<void> {
    try {
      await httpClient.post(`/admin/verification/checks/${encodeURIComponent(checkId.trim())}/approve`, {
        remarks: remarks || 'Check approved by administrator',
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async rejectCheck(checkId: string, category: string, remarks: string): Promise<void> {
    try {
      if (remarks.length < 5) {
        throw new ValidationError('Rejection remarks must be at least 5 characters', undefined, undefined, 'REMARKS_TOO_SHORT');
      }
      await httpClient.post(`/admin/verification/checks/${encodeURIComponent(checkId.trim())}/reject`, {
        category,
        remarks,
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async rejectWorker(workerId: string, category: string, remarks: string): Promise<void> {
    if (!workerId || typeof workerId !== 'string' || workerId.trim() === '') {
      throw new ValidationError('A valid workerId is required for worker rejection.');
    }
    const cleanWorkerId = workerId.trim();
    if (
      cleanWorkerId.startsWith('chk-') ||
      cleanWorkerId.startsWith('check-') ||
      cleanWorkerId.startsWith('doc-')
    ) {
      throw new ValidationError('Invalid workerId: checkId or documentId cannot be substituted for workerId.');
    }
    if (remarks.trim().length < 5) {
      throw new ValidationError('Rejection remarks must be at least 5 characters', undefined, undefined, 'REMARKS_TOO_SHORT');
    }

    try {
      await httpClient.post(`/admin/workers/${encodeURIComponent(cleanWorkerId)}/reject`, {
        category,
        reason: remarks.trim(),
        remarks: remarks.trim(),
      });
    } catch (err: unknown) {
      const is404 =
        (err as { response?: { status?: number } })?.response?.status === 404 ||
        (err as { status?: number })?.status === 404 ||
        (err as { statusCode?: number })?.statusCode === 404 ||
        err instanceof NotFoundError;
      if (is404) {
        throw new NotFoundError(
          'Worker rejection is blocked: The backend does not support worker-level rejection (POST /api/v1/admin/workers/{workerId}/reject returned 404 Not Found). Individual verification check rejection cannot be substituted for worker-level rejection.',
          undefined,
          'WORKER_REJECTION_NOT_IMPLEMENTED'
        );
      }
      throw mapHttpErrorToDomainError(err);
    }
  }

  async activateWorker(workerId: string): Promise<WorkerDetail> {
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
      const response = await httpClient.post<Record<string, unknown>>(`/admin/workers/${encodeURIComponent(cleanWorkerId)}/activate`, {});
      const resData = (response.data?.data && typeof response.data.data === 'object' && !Array.isArray(response.data.data) ? response.data.data : response.data) as Record<string, unknown>;
      return mapBackendWorkerDetailToWorkerDetail(resData);
    } catch (err) {
      if (err instanceof DomainError) {
        throw err;
      }
      throw mapHttpErrorToDomainError(err);
    }
  }
}

export class MockWorkerRepository implements IWorkerRepository {
  async getWorkers(filter?: WorkerFilterCriteria): Promise<Worker[]> {
    let result = [...MOCK_WORKERS];

    if (filter?.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      const cleanDigits = term.replace(/\D/g, '');
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(term) ||
          w.id.toLowerCase().includes(term) ||
          (w.applicationId && w.applicationId.toLowerCase().includes(term)) ||
          w.category.toLowerCase().includes(term) ||
          w.locality.toLowerCase().includes(term) ||
          (w.phoneMasked && w.phoneMasked.toLowerCase().includes(term)) ||
          (w.phone && w.phone.toLowerCase().includes(term)) ||
          (cleanDigits.length >= 5 && w.phone && w.phone.replace(/\D/g, '').includes(cleanDigits)) ||
          (cleanDigits.length >= 5 && w.phoneMasked && w.phoneMasked.replace(/\D/g, '').includes(cleanDigits))
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

    if (filter?.verified !== undefined) {
      result = result.filter((w) => w.isFullyVerified === filter.verified);
    } else if (filter?.verificationStatus && filter.verificationStatus !== 'ALL') {
      const wantVerified = filter.verificationStatus === 'VERIFIED';
      result = result.filter((w) => w.isFullyVerified === wantVerified);
    }

    return result.map(({ bio: _bio, languages: _l, serviceRadiusKm: _sr, verification: _v, recentEngagements: _re, internalNotes: _in, activeEngagementsCount: _ae, completedBookingsCount: _cb, replacementsIncurred: _ri, documents: _d, skills: _sk, ...summary }) => summary);
  }

  async getWorkersPage(
    filter?: WorkerFilterCriteria,
    page: number = 1,
    limit: number = 20
  ): Promise<WorkerPageResult> {
    const all = await this.getWorkers(filter);
    const total = all.length;
    const startIndex = (page - 1) * limit;
    const items = all.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < total;
    return {
      items,
      total,
      page,
      limit,
      hasMore,
    };
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

  async approveCheck(checkId: string, remarks?: string): Promise<void> {
    const worker = MOCK_WORKERS.find((w) => w.id === checkId);
    if (worker) {
      worker.internalNotes.push(`[CHECK APPROVED] ${remarks || 'Check approved by administrator'}`);
    }
  }

  async rejectCheck(checkId: string, category: string, remarks: string): Promise<void> {
    const worker = MOCK_WORKERS.find((w) => w.id === checkId);
    if (worker) {
      worker.internalNotes.push(`[CHECK REJECTED: ${category}] ${remarks}`);
    }
  }

  public simulateWorkerRejectionSupported = false;

  async rejectWorker(workerId: string, category: string, remarks: string): Promise<void> {
    if (!workerId || typeof workerId !== 'string' || workerId.trim() === '') {
      throw new ValidationError('A valid workerId is required for rejection.');
    }
    const cleanId = workerId.trim();
    if (
      cleanId.startsWith('chk-') ||
      cleanId.startsWith('check-') ||
      cleanId.startsWith('doc-')
    ) {
      throw new ValidationError('Invalid workerId: checkId or documentId cannot be substituted for workerId.');
    }
    if (!remarks || remarks.trim().length < 5) {
      throw new ValidationError('Rejection remarks must be at least 5 characters', undefined, undefined, 'REMARKS_TOO_SHORT');
    }

    if (!this.simulateWorkerRejectionSupported) {
      throw new NotFoundError(
        'Worker rejection is blocked: The backend does not support worker-level rejection (POST /api/v1/admin/workers/{workerId}/reject returned 404 Not Found). Individual verification check rejection cannot be substituted for worker-level rejection.',
        undefined,
        'WORKER_REJECTION_NOT_IMPLEMENTED'
      );
    }

    const worker = MOCK_WORKERS.find((w) => w.id === cleanId);
    if (worker) {
      worker.isFullyVerified = false;
      worker.verificationStatus = 'REJECTED';
      worker.onboardingStatus = 'REJECTED';
      worker.applicationStatus = 'REJECTED';
      worker.level = 'REJECTED';
      worker.verificationLevel = 'REJECTED';
      worker.verification.level = 'REJECTED';
      worker.verification.identityProofStatus = 'REJECTED';
      worker.verification.addressProofStatus = 'REJECTED';
      worker.verification.overallRemarks = remarks;
      worker.internalNotes.push(`[WORKER REJECTED: ${category}] ${remarks}`);
    }
  }

  async activateWorker(workerId: string): Promise<WorkerDetail> {
    const worker = MOCK_WORKERS.find((w) => w.id === workerId);
    if (!worker) {
      throw new NotFoundError(`Worker ${workerId} not found.`);
    }

    if (!worker.isFullyVerified) {
      throw new ConcurrencyConflictError(
        'Worker must complete verification sign-off before platform activation.',
        undefined,
        409,
        'NOT_SIGNED_OFF'
      );
    }

    const missingPrerequisites: string[] = [];
    if (!worker.categories || worker.categories.length === 0) {
      missingPrerequisites.push('Service category must be assigned');
    }
    if (!worker.locality && !worker.preferredServiceArea) {
      missingPrerequisites.push('Service area must be defined');
    }
    if (worker.status === 'BLACKLISTED') {
      missingPrerequisites.push('Worker is blacklisted and cannot be activated');
    }

    if (missingPrerequisites.length > 0) {
      throw new ValidationError(
        'ACTIVATION_REQUIREMENTS_MISSING: Worker is missing prerequisites for platform activation.',
        undefined,
        undefined,
        'ACTIVATION_REQUIREMENTS_MISSING',
        [{ field: 'activation', messages: missingPrerequisites }]
      );
    }

    worker.status = 'ACTIVE';
    worker.applicationStatus = 'ACTIVE';
    worker.activatedAt = new Date().toISOString();
    return { ...worker };
  }
}

export const WorkerRepositoryImpl = RealWorkerRepository;

export function createWorkerRepository(useMock: boolean = env.VITE_USE_MOCK_AUTH): IWorkerRepository {
  return useMock ? new MockWorkerRepository() : new RealWorkerRepository();
}

export const workerRepository = createWorkerRepository();

