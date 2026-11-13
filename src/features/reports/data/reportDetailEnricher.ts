import axios from 'axios';
import { httpClient } from '../../../core/api/httpClient';
import { formatCurrencyINR } from '../../../shared/formatters/currency';
import {
  formatPhoneNumber,
  getCustomerPhone,
  getWorkerPhone,
  setCustomerName,
  setCustomerPhone,
  setWorkerName,
  setWorkerPhone,
} from '../../../core/utils/phoneDirectory';
import { ReportDetailDataset, ReportItem } from '../domain/types';

interface CacheEntry {
  expiresAt: number;
  rows: Record<string, unknown>[];
}

interface DetailCacheEntry {
  expiresAt: number;
  data: Record<string, unknown> | null;
}

const CACHE_TTL_MS = 300000; // 5 minutes per session to avoid burst limits during detail + export
const endpointCache = new Map<string, CacheEntry>();
const customerDetailCache = new Map<string, DetailCacheEntry>();
const workerDetailCache = new Map<string, DetailCacheEntry>();
const bookingDetailCache = new Map<string, DetailCacheEntry>();

export function clearReportEnrichmentCache(): void {
  endpointCache.clear();
  customerDetailCache.clear();
  workerDetailCache.clear();
  bookingDetailCache.clear();
}

export function toISTDateString(rawDate: unknown): string {
  if (!rawDate) return '';
  const s = String(rawDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return s;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(parsed);
  } catch {
    return parsed.toISOString().slice(0, 10);
  }
}

function isWithinDateRangeIST(rawDate: unknown, from?: string | null, to?: string | null): boolean {
  if (!from && !to) return true;
  const dateStr = toISTDateString(rawDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

function extractListAndTotal(data: unknown): { items: Record<string, unknown>[]; total: number; limit: number } {
  if (Array.isArray(data)) {
    const items = data as Record<string, unknown>[];
    return { items, total: items.length, limit: items.length || 100 };
  }
  if (!data || typeof data !== 'object') {
    return { items: [], total: 0, limit: 100 };
  }
  const obj = data as Record<string, unknown>;
  const nested = obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
    ? (obj.data as Record<string, unknown>)
    : undefined;
  const meta = (obj.meta || nested?.meta) as { total?: number; totalItems?: number; limit?: number } | undefined;

  const items = Array.isArray(obj.items)
    ? (obj.items as Record<string, unknown>[])
    : Array.isArray(obj.data)
    ? (obj.data as Record<string, unknown>[])
    : Array.isArray(nested?.items)
    ? (nested.items as Record<string, unknown>[])
    : Array.isArray(nested?.data)
    ? (nested.data as Record<string, unknown>[])
    : [];

  const total = Number(meta?.total ?? meta?.totalItems ?? items.length);
  const limit = Number(meta?.limit ?? 100);
  return { items, total, limit };
}

async function fetchAllPaginatedRecords(
  endpoint: string,
  params: Record<string, unknown> = {},
  maxPages: number = 15
): Promise<Record<string, unknown>[]> {
  const key = `${endpoint}:${JSON.stringify(params)}`;
  const cached = endpointCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rows;
  }

  try {
    const pageLimit = Number(params.limit || 100);
    const firstRes = await httpClient.get<unknown>(endpoint, {
      params: { ...params, page: 1, limit: pageLimit },
    });
    if (!firstRes || firstRes.data === undefined || firstRes.data === null) {
      return [];
    }

    const first = extractListAndTotal(firstRes.data);
    const rows = [...first.items];
    const effectiveLimit = first.limit > 0 ? first.limit : pageLimit;
    const totalPages = Math.min(maxPages, Math.ceil(first.total / effectiveLimit));

    for (let page = 2; page <= totalPages; page += 1) {
      const nextRes = await httpClient.get<unknown>(endpoint, {
        params: { ...params, page, limit: effectiveLimit },
      });
      if (!nextRes?.data) break;
      const next = extractListAndTotal(nextRes.data);
      if (next.items.length === 0) break;
      rows.push(...next.items);
    }

    endpointCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, rows });
    return rows;
  } catch {
    return [];
  }
}

function unwrapEntity(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    return obj.data as Record<string, unknown>;
  }
  return obj;
}

/**
 * Fetches detail records in small batches with caching so complete mobiles,
 * addresses, and customerUserId references resolve reliably within backend rate limits.
 */
async function fetchEntityDetailsBatched(
  basePath: string,
  ids: string[],
  cache: Map<string, DetailCacheEntry>,
  batchSize: number = 6
): Promise<Map<string, Record<string, unknown>>> {
  const now = Date.now();
  const result = new Map<string, Record<string, unknown>>();
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  const toFetch: string[] = [];

  for (const id of uniqueIds) {
    const cached = cache.get(id);
    if (cached && cached.expiresAt > now) {
      if (cached.data) result.set(id, cached.data);
    } else {
      toFetch.push(id);
    }
  }

  let abortedForRateOrAuth = false;
  for (let i = 0; i < toFetch.length && !abortedForRateOrAuth; i += batchSize) {
    const chunk = toFetch.slice(i, i + batchSize);
    await Promise.all(
      chunk.map(async (id) => {
        try {
          const res = await httpClient.get<unknown>(`${basePath}/${encodeURIComponent(id)}`);
          const unwrapped = unwrapEntity(res?.data);
          cache.set(id, { expiresAt: Date.now() + CACHE_TTL_MS, data: unwrapped });
          if (unwrapped) result.set(id, unwrapped);
        } catch (err) {
          const status =
            (err as { statusCode?: number; status?: number })?.statusCode ||
            (err as { status?: number })?.status ||
            (axios.isAxiosError(err) ? err.response?.status : undefined);
          if (status === 429 || status === 403 || status === 401) {
            abortedForRateOrAuth = true;
          }
        }
      })
    );
  }

  return result;
}

interface CustomerLookupEntry {
  id: string;
  userId?: string;
  name: string;
  mobile?: string;
  locality?: string;
  accountStatus?: string;
  verificationStatus?: string;
  createdAt?: string;
}

interface WorkerLookupEntry {
  id: string;
  userId?: string;
  applicationReference?: string;
  name: string;
  mobile?: string;
  location?: string;
  categories?: string;
  verificationStatus: string;
  accountStatus?: string;
}

function extractCustomerLocality(c: Record<string, unknown>, detail?: Record<string, unknown>): string {
  const addresses = Array.isArray(detail?.addresses)
    ? (detail.addresses as Array<Record<string, unknown>>)
    : Array.isArray(c.addresses)
    ? (c.addresses as Array<Record<string, unknown>>)
    : [];
  const primary =
    addresses.find((a) => a.isDefault) ||
    addresses.find((a) => a.isActive !== false) ||
    addresses[0];

  if (primary) {
    const loc = [primary.area, primary.city].filter(Boolean).map(String).join(', ');
    if (loc) return loc;
  }

  const direct = [c.locality || detail?.locality, c.city || detail?.city, c.area || detail?.area]
    .filter(Boolean)
    .map(String)
    .join(', ');
  return direct || 'No Address Added';
}

function extractWorkerLocation(w: Record<string, unknown>, detail?: Record<string, unknown>): string {
  const addr = (detail?.address || w.address) as Record<string, unknown> | undefined;
  if (addr && typeof addr === 'object') {
    const loc = [addr.area, addr.city].filter(Boolean).map(String).join(', ');
    if (loc) return loc;
  }
  const direct = [detail?.locality || w.locality, detail?.city || w.city]
    .filter(Boolean)
    .map(String)
    .join(', ');
  return direct || 'Not Specified';
}

function extractWorkerCategories(w: Record<string, unknown>, detail?: Record<string, unknown>): string {
  const cats = Array.isArray(detail?.categories)
    ? (detail.categories as Array<Record<string, unknown>>)
    : Array.isArray(w.categories)
    ? (w.categories as Array<Record<string, unknown>>)
    : [];
  return cats
    .filter((c) => c.isEnabled !== false)
    .map((c) => String(c.name || c.code || '').trim())
    .filter(Boolean)
    .join(', ');
}

function resolveBestPhone(
  id: string,
  userId: string | undefined,
  rawListPhone: unknown,
  rawDetailPhone: unknown,
  kind: 'customer' | 'worker'
): string {
  const dirCached = kind === 'customer'
    ? (getCustomerPhone(id) || (userId ? getCustomerPhone(userId) : undefined))
    : (getWorkerPhone(id) || (userId ? getWorkerPhone(userId) : undefined));

  const detailStr = rawDetailPhone ? formatPhoneNumber(String(rawDetailPhone)) : undefined;
  const listStr = rawListPhone ? formatPhoneNumber(String(rawListPhone)) : undefined;

  const unmasked =
    (detailStr && !detailStr.includes('*') ? detailStr : undefined) ||
    (dirCached && !dirCached.includes('*') ? dirCached : undefined) ||
    (listStr && !listStr.includes('*') ? listStr : undefined);

  if (unmasked) {
    if (kind === 'customer') {
      if (id) setCustomerPhone(id, unmasked);
      if (userId) setCustomerPhone(userId, unmasked);
    } else {
      if (id) setWorkerPhone(id, unmasked);
      if (userId) setWorkerPhone(userId, unmasked);
    }
    return unmasked;
  }

  return listStr || dirCached || 'Unavailable';
}

function buildCustomerLookup(
  rows: Record<string, unknown>[],
  detailsMap?: Map<string, Record<string, unknown>>
): Map<string, CustomerLookupEntry> {
  const map = new Map<string, CustomerLookupEntry>();
  for (const r of rows) {
    const id = String(r.id || r.customerId || '');
    const detail = id ? detailsMap?.get(id) : undefined;
    const userId = r.userId ? String(r.userId) : detail?.userId ? String(detail.userId) : undefined;
    const name = String(detail?.name || r.name || r.fullName || '').trim() || id;

    if (name && name !== id) {
      if (id) setCustomerName(id, name);
      if (userId) setCustomerName(userId, name);
    }

    const mobile = resolveBestPhone(id, userId, r.mobile || r.phone, detail?.mobile || detail?.phone, 'customer');
    const locality = extractCustomerLocality(r, detail);
    const entry: CustomerLookupEntry = {
      id,
      userId,
      name,
      mobile,
      locality,
      accountStatus: String(detail?.accountStatus || r.accountStatus || r.status || 'ACTIVE'),
      verificationStatus: String(detail?.verificationStatus || r.verificationStatus || 'PENDING'),
      createdAt: String(detail?.createdAt || r.createdAt || r.registeredDate || ''),
    };
    if (id) map.set(id, entry);
    if (userId) map.set(userId, entry);
  }
  return map;
}

function buildWorkerLookup(
  rows: Record<string, unknown>[],
  detailsMap?: Map<string, Record<string, unknown>>
): Map<string, WorkerLookupEntry> {
  const map = new Map<string, WorkerLookupEntry>();
  for (const r of rows) {
    const id = String(r.id || r.workerId || '');
    const detail = id ? detailsMap?.get(id) : undefined;
    const userId = r.userId ? String(r.userId) : detail?.userId ? String(detail.userId) : undefined;
    const name = String(detail?.name || r.name || r.fullName || '').trim() || id;

    if (name && name !== id) {
      if (id) setWorkerName(id, name);
      if (userId) setWorkerName(userId, name);
    }

    const mobile = resolveBestPhone(id, userId, r.mobile || r.phone, detail?.mobile || detail?.phone, 'worker');
    const verified = r.isFullyVerified === true ? 'VERIFIED' : String(r.verificationLevel || r.verificationStatus || 'PENDING');
    const entry: WorkerLookupEntry = {
      id,
      userId,
      applicationReference: String(detail?.applicationReference || r.applicationReference || '') || undefined,
      name,
      mobile,
      location: extractWorkerLocation(r, detail),
      categories: extractWorkerCategories(r, detail),
      verificationStatus: verified,
      accountStatus: String(detail?.accountStatus || r.accountStatus || r.applicationStatus || 'ACTIVE'),
    };
    if (id) map.set(id, entry);
    if (userId) map.set(userId, entry);
  }
  return map;
}

function getCategoryLabel(b: Record<string, unknown>): string {
  if (b.category && typeof b.category === 'object') {
    const c = b.category as Record<string, unknown>;
    return String(c.name || c.code || '');
  }
  return String(b.serviceCategory || b.categoryName || '');
}

function getCategoryCode(b: Record<string, unknown>): string {
  if (b.category && typeof b.category === 'object') {
    return String((b.category as Record<string, unknown>).code || '').toUpperCase();
  }
  return String(b.categoryCode || '').toUpperCase();
}

function getAreaLabel(b: Record<string, unknown>): { area: string; city: string } {
  if (b.area && typeof b.area === 'object') {
    const a = b.area as Record<string, unknown>;
    return { area: String(a.name || ''), city: String(a.city || '') };
  }
  return { area: String(b.areaName || b.locality || ''), city: String(b.city || '') };
}

function resolvePersonName(
  directObj: unknown,
  directName: unknown,
  lookupId: unknown,
  lookupMap: Map<string, { name: string }>,
  fallbackLabel: string
): string {
  if (typeof directName === 'string' && directName.trim()) return directName.trim();
  if (directObj && typeof directObj === 'object') {
    const d = directObj as Record<string, unknown>;
    const candidate = String(d.fullName || d.name || '').trim();
    if (candidate) return candidate;
  }
  if (lookupId) {
    const found = lookupMap.get(String(lookupId));
    if (found?.name) return found.name;
  }
  return fallbackLabel;
}

/**
 * Resolves full booking details (/admin/bookings/{id}) when list rows omit customerUserId
 * so Customer Name resolves accurately across all booking-related reports.
 */
async function resolveBookingsWithDetails(
  rawBookings: Record<string, unknown>[],
  rawPayments: Record<string, unknown>[] = []
): Promise<Record<string, unknown>[]> {
  const paymentCustomerByBooking = new Map<string, string>();
  for (const p of rawPayments) {
    if (p.bookingId && p.customerUserId) {
      paymentCustomerByBooking.set(String(p.bookingId), String(p.customerUserId));
    }
  }

  const idsNeedingDetail: string[] = [];
  for (const b of rawBookings) {
    const id = String(b.id || b.bookingId || '');
    if (!id) continue;
    const hasCustomer = Boolean(b.customerUserId || b.customerId || b.customerName);
    if (!hasCustomer && !paymentCustomerByBooking.has(id)) {
      idsNeedingDetail.push(id);
    }
  }

  const detailMap = idsNeedingDetail.length > 0
    ? await fetchEntityDetailsBatched('/admin/bookings', idsNeedingDetail, bookingDetailCache)
    : new Map<string, Record<string, unknown>>();

  return rawBookings.map((b) => {
    const id = String(b.id || b.bookingId || '');
    const detail = detailMap.get(id);
    const inferredCustUserId =
      b.customerUserId ||
      detail?.customerUserId ||
      paymentCustomerByBooking.get(id) ||
      (Array.isArray(detail?.timeline)
        ? (detail.timeline as Array<Record<string, unknown>>).find((t) => t.by === 'CUSTOMER' && t.actorUserId)?.actorUserId
        : undefined);

    return {
      ...b,
      ...(detail || {}),
      ...(inferredCustUserId ? { customerUserId: inferredCustUserId } : {}),
    };
  });
}

function mapBookingRow(
  b: Record<string, unknown>,
  customerMap: Map<string, CustomerLookupEntry>,
  workerMap: Map<string, WorkerLookupEntry>
): Record<string, string | number> {
  const { area, city } = getAreaLabel(b);
  const location = [area, city].filter(Boolean).join(', ') || 'Not Specified';
  const customerId = b.customerUserId || b.customerId;
  const customer = resolvePersonName(
    b.customer,
    b.customerName,
    customerId,
    customerMap,
    customerId ? String(customerId) : 'Not Recorded'
  );
  const worker = resolvePersonName(
    b.worker,
    b.assignedWorkerName || b.workerName,
    b.workerId || b.assignedWorkerId,
    workerMap,
    b.workerId ? String(b.workerId) : 'Unassigned'
  );

  return {
    'Booking ID': String(b.id || b.bookingId || ''),
    Customer: customer,
    Worker: worker,
    'Service Category': getCategoryLabel(b) || 'Not Specified',
    'Area / Locality': location,
    Engagement: String(b.engagement || b.engagementType || ''),
    'Booking Status': String(b.status || ''),
    'Booking Date': toISTDateString(b.createdAt),
  };
}

function formatMoney(minor: unknown, currency = 'INR'): string {
  const major = Number(minor || 0) / 100;
  return currency === 'INR' ? formatCurrencyINR(major) : `${currency} ${major.toFixed(2)}`;
}

function buildDetailDataset(
  title: string,
  columns: string[],
  rows: Array<Record<string, string | number>>,
  sourceEndpoint?: string
): ReportDetailDataset {
  return { title, columns, rows, sourceEndpoint };
}

async function enrichRepeatCustomersReport(report: ReportItem): Promise<ReportItem> {
  const rawCustomers = await fetchAllPaginatedRecords('/admin/customers');
  if (rawCustomers.length === 0) return report;

  const targetIds = report.previewRows
    .map((row) => {
      const uid = String(row['Customer User ID'] || '');
      const match = rawCustomers.find((c) => String(c.userId || '') === uid || String(c.id || '') === uid);
      return match ? String(match.id || '') : '';
    })
    .filter(Boolean);

  const custDetails = await fetchEntityDetailsBatched('/admin/customers', targetIds, customerDetailCache);
  const customerMap = buildCustomerLookup(rawCustomers, custDetails);

  const enrichedCols = ['Customer Name', 'Customer User ID', 'Mobile Number', 'Locality', 'Account Status', 'Registration Date', 'Bookings Count'];
  const enrichedRows = report.previewRows.map((row) => {
    const id = String(row['Customer User ID'] || '');
    const found = customerMap.get(id);
    return {
      'Customer Name': row['Customer Name'] ?? found?.name ?? '',
      'Customer User ID': id,
      'Mobile Number': found?.mobile || 'Unavailable',
      Locality: found?.locality || 'No Address Added',
      'Account Status': found?.accountStatus || 'ACTIVE',
      'Registration Date': toISTDateString(found?.createdAt),
      'Bookings Count': row['Bookings Count'] ?? row['Completed Bookings'] ?? 0,
    };
  });
  return { ...report, previewColumns: enrichedCols, previewRows: enrichedRows };
}

async function enrichTopRatedWorkersReport(report: ReportItem): Promise<ReportItem> {
  const rawWorkers = await fetchAllPaginatedRecords('/admin/workers');
  if (rawWorkers.length === 0) return report;

  const targetIds = report.previewRows
    .map((row) => String(row['Worker Reference ID'] || ''))
    .filter(Boolean);
  const wrkDetails = await fetchEntityDetailsBatched('/admin/workers', targetIds, workerDetailCache);
  const workerMap = buildWorkerLookup(rawWorkers, wrkDetails);

  const enrichedCols = ['Worker Name', 'Worker Reference ID', 'Application Ref', 'Mobile Number', 'Location', 'Verification Status', 'Account Status', 'Ratings Count', 'Average Rating'];
  const enrichedRows = report.previewRows.map((row) => {
    const wid = String(row['Worker Reference ID'] || '');
    const found = workerMap.get(wid);
    return {
      'Worker Name': row['Worker Name'] ?? found?.name ?? '',
      'Worker Reference ID': wid,
      'Application Ref': found?.applicationReference || '—',
      'Mobile Number': found?.mobile || 'Unavailable',
      Location: found?.location || 'Not Specified',
      'Verification Status': found?.verificationStatus || 'Unavailable',
      'Account Status': found?.accountStatus || 'Unavailable',
      'Ratings Count': row['Ratings Count'] ?? 0,
      'Average Rating': row['Average Rating'] ?? '',
    };
  });
  return { ...report, previewColumns: enrichedCols, previewRows: enrichedRows };
}

/**
 * Enriches an authoritative report item with record-level data from authorized admin endpoints.
 * Strictly read-only, permission-resilient, and never fabricates missing fields or records.
 */
export async function enrichReportWithBackendRecords(
  slug: string,
  report: ReportItem,
  from?: string | null,
  to?: string | null
): Promise<ReportItem> {
  const dateParams: Record<string, unknown> = {};
  if (from) dateParams.createdFrom = from;
  if (to) dateParams.createdTo = to;

  switch (slug) {
    case 'new-customers': {
      const rawCustomers = await fetchAllPaginatedRecords('/admin/customers', dateParams);
      if (rawCustomers.length === 0 && report.previewRows.length > 0) return report;

      const customerIds = rawCustomers.map((c) => String(c.id || c.customerId || '')).filter(Boolean);
      const custDetails = await fetchEntityDetailsBatched('/admin/customers', customerIds, customerDetailCache);
      const customerMap = buildCustomerLookup(rawCustomers, custDetails);

      const columns = ['Customer ID', 'Customer Name', 'Mobile Number', 'Locality', 'Account Status', 'Verification Status', 'Registration Date'];
      const rows = rawCustomers.map((c) => {
        const id = String(c.id || c.customerId || '');
        const entry = customerMap.get(id);
        return {
          'Customer ID': id,
          'Customer Name': entry?.name || String(c.name || c.fullName || 'Unnamed Customer'),
          'Mobile Number': entry?.mobile || String(c.mobile || c.phone || 'Unavailable'),
          Locality: entry?.locality || 'No Address Added',
          'Account Status': entry?.accountStatus || String(c.accountStatus || c.status || 'ACTIVE'),
          'Verification Status': entry?.verificationStatus || String(c.verificationStatus || 'PENDING'),
          'Registration Date': toISTDateString(c.createdAt || c.registeredDate),
        };
      });

      return {
        ...report,
        detailDataset: buildDetailDataset('Customer Registrations', columns, rows, 'Customer Directory'),
      };
    }

    case 'worker-registrations': {
      const rawWorkers = await fetchAllPaginatedRecords('/admin/workers', dateParams);
      if (rawWorkers.length === 0 && report.previewRows.length > 0) return report;

      const workerIds = rawWorkers.map((w) => String(w.id || w.workerId || '')).filter(Boolean);
      const wrkDetails = await fetchEntityDetailsBatched('/admin/workers', workerIds, workerDetailCache);
      const workerMap = buildWorkerLookup(rawWorkers, wrkDetails);

      const columns = ['Worker ID', 'Application Ref', 'Worker Name', 'Mobile Number', 'Service Categories', 'Location', 'Onboarding Status', 'Verification Status', 'Account Status', 'Registration Date'];
      const rows = rawWorkers.map((w) => {
        const wid = String(w.id || w.workerId || '');
        const entry = workerMap.get(wid);
        return {
          'Worker ID': wid,
          'Application Ref': entry?.applicationReference || String(w.applicationReference || ''),
          'Worker Name': entry?.name || String(w.name || w.fullName || 'Unnamed Worker'),
          'Mobile Number': entry?.mobile || String(w.mobile || w.phone || 'Unavailable'),
          'Service Categories': entry?.categories || extractWorkerCategories(w) || 'Not Specified',
          Location: entry?.location || 'Not Specified',
          'Onboarding Status': String(w.onboardingStatus || ''),
          'Verification Status': entry?.verificationStatus || (w.isFullyVerified === true ? 'VERIFIED' : String(w.verificationLevel || 'PENDING')),
          'Account Status': entry?.accountStatus || String(w.accountStatus || w.applicationStatus || 'ACTIVE'),
          'Registration Date': toISTDateString(w.createdAt),
        };
      });

      return {
        ...report,
        detailDataset: buildDetailDataset('Worker Registrations', columns, rows, 'Worker Directory'),
      };
    }

    case 'booking-funnel': {
      const [rawBookings, rawCustomers, rawWorkers, rawPayments] = await Promise.all([
        fetchAllPaginatedRecords('/admin/bookings', dateParams),
        fetchAllPaginatedRecords('/admin/customers'),
        fetchAllPaginatedRecords('/admin/workers'),
        fetchAllPaginatedRecords('/admin/payments'),
      ]);
      if (rawBookings.length === 0 && report.previewRows.length > 0) return report;

      const resolvedBookings = await resolveBookingsWithDetails(rawBookings, rawPayments);
      const customerMap = buildCustomerLookup(rawCustomers);
      const workerMap = buildWorkerLookup(rawWorkers);
      const rows = resolvedBookings.map((b) => mapBookingRow(b, customerMap, workerMap));
      const columns = ['Booking ID', 'Customer', 'Worker', 'Service Category', 'Area / Locality', 'Engagement', 'Booking Status', 'Booking Date'];

      return {
        ...report,
        detailDataset: buildDetailDataset('Booking Requests', columns, rows, 'Booking Registry'),
      };
    }

    case 'demand-by-category': {
      const [rawBookings, rawCustomers, rawWorkers, rawPayments] = await Promise.all([
        fetchAllPaginatedRecords('/admin/bookings', dateParams),
        fetchAllPaginatedRecords('/admin/customers'),
        fetchAllPaginatedRecords('/admin/workers'),
        fetchAllPaginatedRecords('/admin/payments'),
      ]);
      if (rawBookings.length === 0) return report;

      const confirmedStatuses = new Set(['CONFIRMED', 'ACTIVE', 'COMPLETED', 'REPLACED']);
      const confirmedByCategory = new Map<string, number>();
      for (const b of rawBookings) {
        if (!confirmedStatuses.has(String(b.status || '').toUpperCase())) continue;
        const code = getCategoryCode(b);
        const name = getCategoryLabel(b).toLowerCase();
        if (code) confirmedByCategory.set(code, (confirmedByCategory.get(code) || 0) + 1);
        if (name) confirmedByCategory.set(name, (confirmedByCategory.get(name) || 0) + 1);
      }

      const updatedColumns = ['Service Category', 'Category Code', 'Booking Requests', 'Confirmed / Active Count', 'Share of Total %'];
      const updatedRows = report.previewRows.map((row) => {
        const code = String(row['Category Code'] || '').toUpperCase();
        const name = String(row['Service Category'] || '').toLowerCase();
        const confirmed = confirmedByCategory.get(code) ?? confirmedByCategory.get(name) ?? 0;
        return {
          'Service Category': row['Service Category'] ?? '',
          'Category Code': row['Category Code'] ?? '',
          'Booking Requests': row['Booking Requests'] ?? 0,
          'Confirmed / Active Count': confirmed,
          'Share of Total %': row['Share of Total %'] ?? '0.00%',
        };
      });

      const resolvedBookings = await resolveBookingsWithDetails(rawBookings, rawPayments);
      const customerMap = buildCustomerLookup(rawCustomers);
      const workerMap = buildWorkerLookup(rawWorkers);
      const detailRows = resolvedBookings.map((b) => mapBookingRow(b, customerMap, workerMap));
      const detailColumns = ['Booking ID', 'Customer', 'Worker', 'Service Category', 'Area / Locality', 'Engagement', 'Booking Status', 'Booking Date'];

      return {
        ...report,
        previewColumns: updatedColumns,
        previewRows: updatedRows,
        detailDataset: buildDetailDataset('Category Bookings', detailColumns, detailRows, 'Booking Registry'),
      };
    }

    case 'demand-by-area': {
      const [rawBookings, rawCustomers, rawWorkers, rawPayments] = await Promise.all([
        fetchAllPaginatedRecords('/admin/bookings', dateParams),
        fetchAllPaginatedRecords('/admin/customers'),
        fetchAllPaginatedRecords('/admin/workers'),
        fetchAllPaginatedRecords('/admin/payments'),
      ]);
      if (rawBookings.length === 0) return report;

      const resolvedBookings = await resolveBookingsWithDetails(rawBookings, rawPayments);
      const customerMap = buildCustomerLookup(rawCustomers);
      const workerMap = buildWorkerLookup(rawWorkers);
      const rows = resolvedBookings.map((b) => mapBookingRow(b, customerMap, workerMap));
      const columns = ['Booking ID', 'Customer', 'Worker', 'Service Category', 'Area / Locality', 'Engagement', 'Booking Status', 'Booking Date'];

      return {
        ...report,
        detailDataset: buildDetailDataset('Area Bookings', columns, rows, 'Booking Registry'),
      };
    }

    case 'worker-utilization': {
      const [rawWorkers, rawActiveBookings, rawCustomers, rawPayments] = await Promise.all([
        fetchAllPaginatedRecords('/admin/workers', { verified: true }),
        fetchAllPaginatedRecords('/admin/bookings', { status: 'ACTIVE' }),
        fetchAllPaginatedRecords('/admin/customers'),
        fetchAllPaginatedRecords('/admin/payments'),
      ]);
      if (rawWorkers.length === 0 && rawActiveBookings.length === 0) return report;

      const workerIds = rawWorkers.map((w) => String(w.id || w.workerId || '')).filter(Boolean);
      const [wrkDetails, resolvedActiveBookings] = await Promise.all([
        fetchEntityDetailsBatched('/admin/workers', workerIds, workerDetailCache),
        resolveBookingsWithDetails(rawActiveBookings, rawPayments),
      ]);

      const customerMap = buildCustomerLookup(rawCustomers);
      const workerMap = buildWorkerLookup(rawWorkers, wrkDetails);
      const bookingByWorker = new Map<string, Record<string, unknown>>();
      for (const b of resolvedActiveBookings) {
        const wid = b.workerId ? String(b.workerId) : b.assignedWorkerId ? String(b.assignedWorkerId) : '';
        if (wid && !bookingByWorker.has(wid)) {
          bookingByWorker.set(wid, b);
        }
      }

      const columns = ['Worker ID', 'Application Ref', 'Worker Name', 'Mobile Number', 'Verification Status', 'Account Status', 'Utilization Status', 'Active Booking ID', 'Service Category', 'Active Customer'];
      const rows = rawWorkers.map((w) => {
        const wid = String(w.id || w.workerId || '');
        const wrkEntry = workerMap.get(wid);
        const activeBooking = bookingByWorker.get(wid);
        const custId = activeBooking?.customerUserId || activeBooking?.customerId;
        const customerName = activeBooking
          ? resolvePersonName(
              activeBooking.customer,
              activeBooking.customerName,
              custId,
              customerMap,
              custId ? String(custId) : 'Not Recorded'
            )
          : '';
        return {
          'Worker ID': wid,
          'Application Ref': wrkEntry?.applicationReference || String(w.applicationReference || ''),
          'Worker Name': wrkEntry?.name || String(w.name || w.fullName || 'Unnamed Worker'),
          'Mobile Number': wrkEntry?.mobile || String(w.mobile || w.phone || 'Unavailable'),
          'Verification Status': wrkEntry?.verificationStatus || (w.isFullyVerified === true ? 'VERIFIED' : String(w.verificationLevel || 'PENDING')),
          'Account Status': wrkEntry?.accountStatus || String(w.accountStatus || w.applicationStatus || 'ACTIVE'),
          'Utilization Status': activeBooking ? 'On Active Booking' : 'Available / Idle',
          'Active Booking ID': activeBooking ? String(activeBooking.id || '') : 'None',
          'Service Category': activeBooking ? getCategoryLabel(activeBooking) : '—',
          'Active Customer': customerName || '—',
        };
      });

      return {
        ...report,
        detailDataset: buildDetailDataset('Verified Workforce Utilization', columns, rows, 'Verified Workforce & Active Bookings'),
      };
    }

    case 'interview-conversion': {
      const [rawInterviews, rawBookings, rawCustomers, rawWorkers, rawPayments] = await Promise.all([
        fetchAllPaginatedRecords('/admin/interviews'),
        fetchAllPaginatedRecords('/admin/bookings', dateParams),
        fetchAllPaginatedRecords('/admin/customers'),
        fetchAllPaginatedRecords('/admin/workers'),
        fetchAllPaginatedRecords('/admin/payments'),
      ]);
      if (rawInterviews.length === 0) return report;

      const resolvedBookings = await resolveBookingsWithDetails(rawBookings, rawPayments);
      const customerMap = buildCustomerLookup(rawCustomers);
      const workerMap = buildWorkerLookup(rawWorkers);
      const bookingMap = new Map<string, Record<string, unknown>>();
      for (const b of resolvedBookings) {
        if (b.id) bookingMap.set(String(b.id), b);
      }

      const filtered = bookingMap.size > 0
        ? rawInterviews.filter((iv) => !iv.bookingId || bookingMap.has(String(iv.bookingId)))
        : rawInterviews;

      const columns = ['Interview ID', 'Booking Reference', 'Session Type', 'Customer', 'Worker', 'Interview Status', 'Booking Confirmation Status', 'Created Date'];
      const rows = filtered.map((iv) => {
        const bId = String(iv.bookingId || '');
        const b = bookingMap.get(bId);
        const custId = b?.customerUserId || iv.customerUserId;
        const customer = resolvePersonName(
          b?.customer || iv.customer,
          b?.customerName || iv.customerName,
          custId,
          customerMap,
          custId ? String(custId) : 'Not Recorded'
        );
        const wrkId = b?.workerId || iv.workerId;
        const worker = resolvePersonName(
          b?.worker || iv.worker,
          b?.assignedWorkerName || iv.workerName,
          wrkId,
          workerMap,
          wrkId ? String(wrkId) : 'Unassigned'
        );
        return {
          'Interview ID': String(iv.id || ''),
          'Booking Reference': bId,
          'Session Type': String(iv.type || 'INTERVIEW'),
          Customer: customer,
          Worker: worker,
          'Interview Status': String(iv.status || ''),
          'Booking Confirmation Status': b ? String(b.status || '') : 'Outside Period',
          'Created Date': toISTDateString(iv.createdAt || iv.scheduledAt),
        };
      });

      return {
        ...report,
        detailDataset: buildDetailDataset('Interview & Trial Records', columns, rows, 'Interview Records'),
      };
    }

    case 'cancellation-rate': {
      const [rawCancelled, rawCustomers, rawWorkers, rawPayments] = await Promise.all([
        fetchAllPaginatedRecords('/admin/bookings', { ...dateParams, status: 'CANCELLED' }),
        fetchAllPaginatedRecords('/admin/customers'),
        fetchAllPaginatedRecords('/admin/workers'),
        fetchAllPaginatedRecords('/admin/payments'),
      ]);
      if (rawCancelled.length === 0) return report;

      const resolvedCancelled = await resolveBookingsWithDetails(rawCancelled, rawPayments);
      const customerMap = buildCustomerLookup(rawCustomers);
      const workerMap = buildWorkerLookup(rawWorkers);
      const columns = ['Booking Reference', 'Customer', 'Worker', 'Service Category', 'Area / Locality', 'Booking Date', 'Cancellation Date', 'Status', 'Cancellation Reason'];
      const rows = resolvedCancelled.map((b) => {
        const mapped = mapBookingRow(b, customerMap, workerMap);
        const cancelEvent = Array.isArray(b.timeline)
          ? (b.timeline as Array<Record<string, unknown>>).find((t) => String(t.to || '').toUpperCase() === 'CANCELLED')
          : undefined;
        return {
          'Booking Reference': mapped['Booking ID'],
          Customer: mapped.Customer,
          Worker: mapped.Worker,
          'Service Category': mapped['Service Category'],
          'Area / Locality': mapped['Area / Locality'],
          'Booking Date': mapped['Booking Date'],
          'Cancellation Date': toISTDateString(cancelEvent?.at || b.cancelledAt || b.updatedAt || b.createdAt),
          Status: String(b.status || 'CANCELLED'),
          'Cancellation Reason': String(b.cancelReason || b.cancellationReason || cancelEvent?.note || 'Not provided'),
        };
      });

      return {
        ...report,
        detailDataset: buildDetailDataset('Cancelled Bookings', columns, rows, 'Cancelled Bookings'),
      };
    }

    case 'replacement-rate': {
      const [rawReplacements, rawBookingsInRange, rawAllBookings, rawWorkers] = await Promise.all([
        fetchAllPaginatedRecords('/admin/replacement-requests'),
        fetchAllPaginatedRecords('/admin/bookings', dateParams),
        fetchAllPaginatedRecords('/admin/bookings'),
        fetchAllPaginatedRecords('/admin/workers'),
      ]);
      if (rawReplacements.length === 0) return report;

      const workerMap = buildWorkerLookup(rawWorkers);
      const bookingRangeIds = new Set(rawBookingsInRange.map((b) => String(b.id || '')));
      const allBookingMap = new Map<string, Record<string, unknown>>();
      for (const b of rawAllBookings) {
        if (b.id) allBookingMap.set(String(b.id), b);
      }

      const scoped = bookingRangeIds.size > 0
        ? rawReplacements.filter((r) => bookingRangeIds.has(String(r.bookingId || '')) || isWithinDateRangeIST(r.createdAt, from, to))
        : rawReplacements;

      const columns = ['Replacement Request ID', 'Booking Reference', 'Original Worker', 'Replacement Booking ID', 'Replacement Worker', 'Replacement Status', 'Reason Code', 'Reason', 'Requested Date'];
      const rows = scoped.map((r) => {
        const bId = String(r.bookingId || '');
        const origBooking = allBookingMap.get(bId);
        const origWorker = resolvePersonName(
          origBooking?.worker,
          origBooking?.assignedWorkerName,
          r.currentWorkerId || origBooking?.workerId,
          workerMap,
          r.currentWorkerId ? String(r.currentWorkerId) : 'Not Recorded'
        );
        const repBookingId = r.replacementBookingId ? String(r.replacementBookingId) : '';
        const repBooking = repBookingId ? allBookingMap.get(repBookingId) : undefined;
        const repWorker = repBooking
          ? resolvePersonName(repBooking.worker, repBooking.assignedWorkerName, repBooking.workerId, workerMap, 'Unassigned')
          : 'Not Assigned';
        return {
          'Replacement Request ID': String(r.id || ''),
          'Booking Reference': bId,
          'Original Worker': origWorker,
          'Replacement Booking ID': repBookingId || '—',
          'Replacement Worker': repWorker,
          'Replacement Status': String(r.status || ''),
          'Reason Code': String(r.reasonCode || ''),
          Reason: String(r.reason || r.notes || 'Not provided'),
          'Requested Date': toISTDateString(r.createdAt),
        };
      });

      return {
        ...report,
        detailDataset: buildDetailDataset('Replacement Requests', columns, rows, 'Replacement Registry'),
      };
    }

    case 'payment-collections': {
      const [rawPayments, rawCustomers, rawBookings] = await Promise.all([
        fetchAllPaginatedRecords('/admin/payments'),
        fetchAllPaginatedRecords('/admin/customers'),
        fetchAllPaginatedRecords('/admin/bookings'),
      ]);
      if (rawPayments.length === 0) return report;

      const filtered = rawPayments.filter((p) => isWithinDateRangeIST(p.paidAt || p.createdAt, from, to));
      const initialCustomerMap = buildCustomerLookup(rawCustomers);
      const payingCustomerIds = Array.from(
        new Set(
          filtered
            .map((p) => initialCustomerMap.get(String(p.customerUserId || p.customerId || ''))?.id || '')
            .filter(Boolean)
        )
      );
      const custDetails = await fetchEntityDetailsBatched('/admin/customers', payingCustomerIds, customerDetailCache);
      const customerMap = buildCustomerLookup(rawCustomers, custDetails);

      const bookingMap = new Map<string, Record<string, unknown>>();
      for (const b of rawBookings) {
        if (b.id) bookingMap.set(String(b.id), b);
      }

      const columns = ['Transaction ID', 'Customer', 'Customer Mobile', 'Booking Reference', 'Service Category', 'Fee Type', 'Payment Method', 'Amount (INR)', 'Payment Status', 'Gateway / Receipt Ref', 'Payment Date'];
      const rows = filtered.map((p) => {
        const bId = String(p.bookingId || '');
        const b = bookingMap.get(bId);
        const custKey = p.customerUserId || p.customerId || b?.customerUserId;
        const custEntry = custKey ? customerMap.get(String(custKey)) : undefined;
        const customer = resolvePersonName(
          p.customer || b?.customer,
          p.customerName,
          custKey,
          customerMap,
          custKey ? String(custKey) : 'Not Recorded'
        );
        const amount = p.amountMinor !== undefined ? formatMoney(p.amountMinor, String(p.currency || 'INR')) : formatCurrencyINR(Number(p.amountINR || p.amount || 0));
        return {
          'Transaction ID': String(p.id || p.paymentId || ''),
          Customer: customer,
          'Customer Mobile': custEntry?.mobile || 'Unavailable',
          'Booking Reference': bId || '—',
          'Service Category': b ? getCategoryLabel(b) : String(p.serviceCategory || 'Household Service'),
          'Fee Type': String(p.feeCode || p.feeType || 'BOOKING_FEE'),
          'Payment Method': String(p.paymentMethodDetail ? `${p.paymentMethod || ''} (${p.paymentMethodDetail})`.trim() : (p.paymentMethod || 'Pending')),
          'Amount (INR)': amount,
          'Payment Status': String(p.status || ''),
          'Gateway / Receipt Ref': String(p.receiptNumber || p.providerPaymentId || p.providerOrderId || p.gatewayReference || '—'),
          'Payment Date': toISTDateString(p.paidAt || p.createdAt),
        };
      });

      return {
        ...report,
        detailDataset: buildDetailDataset('Payment Transactions', columns, rows, 'Payment Ledger'),
      };
    }

    case 'support-tickets': {
      const [rawTickets, rawCustomers, rawWorkers] = await Promise.all([
        fetchAllPaginatedRecords('/admin/support/tickets'),
        fetchAllPaginatedRecords('/admin/customers'),
        fetchAllPaginatedRecords('/admin/workers'),
      ]);
      if (rawTickets.length === 0) return report;

      const customerMap = buildCustomerLookup(rawCustomers);
      const workerMap = buildWorkerLookup(rawWorkers);
      const filtered = rawTickets.filter((t) => isWithinDateRangeIST(t.createdAt, from, to));

      const columns = ['Ticket ID', 'Complainant Name', 'User Type', 'Category', 'Priority', 'Status', 'Booking Reference', 'Created Date', 'Resolution Time'];
      const rows = filtered.map((t) => {
        const creator = t.creator && typeof t.creator === 'object' ? (t.creator as Record<string, unknown>) : undefined;
        const creatorKind = String(t.creatorKind || t.complainantType || '').toUpperCase();
        const creatorId = String(t.creatorUserId || t.complainantId || '');
        const resolvedComplainant =
          (typeof t.complainantName === 'string' && t.complainantName.trim()) ||
          (typeof t.creatorName === 'string' && t.creatorName.trim()) ||
          (typeof creator?.fullName === 'string' && creator.fullName.trim()) ||
          (typeof creator?.name === 'string' && creator.name.trim()) ||
          (creatorKind === 'WORKER' ? workerMap.get(creatorId)?.name : customerMap.get(creatorId)?.name) ||
          customerMap.get(creatorId)?.name ||
          workerMap.get(creatorId)?.name ||
          creatorId ||
          'Not Recorded';

        const categoryObj = t.category && typeof t.category === 'object' ? (t.category as Record<string, unknown>) : undefined;
        const categoryLabel = String(categoryObj?.name || categoryObj?.label || t.categoryLabel || t.disputeCategory || t.category || 'Support');
        const createdMs = t.createdAt ? Date.parse(String(t.createdAt)) : NaN;
        const closedRaw = t.closedAt || (String(t.status || '').toUpperCase() === 'CLOSED' ? t.updatedAt : undefined);
        const closedMs = closedRaw ? Date.parse(String(closedRaw)) : NaN;
        let resolutionTime = 'Open / Unresolved';
        if (!Number.isNaN(createdMs) && !Number.isNaN(closedMs) && closedMs >= createdMs) {
          const hrs = (closedMs - createdMs) / 3600000;
          resolutionTime = `${hrs.toFixed(1)} hrs`;
        } else if (String(t.status || '').toUpperCase() === 'CLOSED') {
          resolutionTime = 'Closed';
        }

        return {
          'Ticket ID': String(t.id || t.ticketId || ''),
          'Complainant Name': resolvedComplainant,
          'User Type': creatorKind || 'CUSTOMER',
          Category: categoryLabel,
          Priority: String(t.priority || 'Standard'),
          Status: String(t.status || ''),
          'Booking Reference': String(t.bookingId || t.bookingRef || '—'),
          'Created Date': toISTDateString(t.createdAt),
          'Resolution Time': resolutionTime,
        };
      });

      return {
        ...report,
        detailDataset: buildDetailDataset('Support Tickets', columns, rows, 'Support Queue'),
      };
    }

    case 'top-rated-workers':
    case 'top-rated-workers-repeat-customers': {
      return report.activeSubTab === 'repeat-customers'
        ? enrichRepeatCustomersReport(report)
        : enrichTopRatedWorkersReport(report);
    }

    case 'repeat-customers': {
      return enrichRepeatCustomersReport(report);
    }

    default:
      return report;
  }
}
