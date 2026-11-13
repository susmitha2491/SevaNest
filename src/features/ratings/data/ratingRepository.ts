import { httpClient } from '../../../core/api/httpClient';
import { env } from '../../../core/config/env';
import { mapHttpErrorToDomainError } from '../../../core/errors/errorMapper';
import { formatDateIST } from '../../../shared/formatters/dateTime';
import {
  IRatingRepository,
  PaginatedRatingsResult,
  RatingRecord,
  RatingsFilterCriteria,
  RatingsOverviewCounts,
  WorkerRatingSummary,
} from '../domain/types';

const MOCK_RATINGS: RatingRecord[] = [
  {
    id: 'RAT-9001',
    bookingId: 'B-84920',
    workerId: 'W-10482',
    workerName: 'Sunita Devi',
    customerUserId: 'C-1092',
    customerName: 'Anand Sharma',
    score: 5,
    review: 'Punctual, thorough with kitchen cleaning, and polite with family.',
    tags: ['PUNCTUAL', 'HYGIENIC'],
    status: 'VISIBLE',
    moderatedByUserId: null,
    moderatedAt: null,
    moderationReason: null,
    createdAt: '2026-11-10T09:15:00.000Z',
  },
  {
    id: 'RAT-9002',
    bookingId: 'B-84890',
    workerId: 'W-10487',
    workerName: 'Radha Rani',
    customerUserId: 'C-2041',
    customerName: 'Priya Menon',
    score: 2,
    review: 'Arrived late on two mornings without prior notice.',
    tags: ['TIMING'],
    status: 'VISIBLE',
    moderatedByUserId: null,
    moderatedAt: null,
    moderationReason: null,
    createdAt: '2026-11-08T14:30:00.000Z',
  },
  {
    id: 'RAT-9003',
    bookingId: 'B-84810',
    workerId: 'W-10489',
    workerName: 'Basheer Khan',
    customerUserId: 'C-6002',
    customerName: 'Kavita Menon',
    score: 1,
    review: 'Included personal phone number in review text.',
    tags: [],
    status: 'HIDDEN',
    moderatedByUserId: 'ops-mgr-01',
    moderatedAt: '2026-11-09T11:00:00.000Z',
    moderationReason: 'Contains restricted personal phone contact details',
    createdAt: '2026-11-07T16:45:00.000Z',
  },
];

function buildOverview(
  allItems: RatingRecord[],
  total: number,
  visible: number,
  hidden: number
): RatingsOverviewCounts {
  const isCompleteDataset = allItems.length === total;
  const distMap = new Map<number, number>([
    [5, 0],
    [4, 0],
    [3, 0],
    [2, 0],
    [1, 0],
  ]);
  let sum = 0;
  let count = 0;
  for (const item of allItems) {
    if (typeof item.score === 'number' && !Number.isNaN(item.score)) {
      sum += item.score;
      count++;
      const rounded = Math.min(5, Math.max(1, Math.round(item.score)));
      distMap.set(rounded, (distMap.get(rounded) || 0) + 1);
    }
  }
  return {
    total,
    visible,
    hidden,
    averageScore: isCompleteDataset && count > 0 ? Number((sum / count).toFixed(2)) : null,
    isCompleteDataset,
    distribution: [5, 4, 3, 2, 1].map((s) => ({ score: s, count: distMap.get(s) || 0 })),
  };
}

function getIsoDateIST(isoStr?: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function mapRawRating(
  raw: Record<string, unknown>,
  workerNames: Map<string, string>,
  customerNames: Map<string, string>
): RatingRecord {
  const workerId = String(raw.workerId || '');
  const customerUserId = raw.customerUserId ? String(raw.customerUserId) : undefined;
  return {
    id: String(raw.id || ''),
    bookingId: String(raw.bookingId || ''),
    workerId,
    workerName: raw.workerName
      ? String(raw.workerName)
      : workerNames.get(workerId) || null,
    customerUserId,
    customerName: raw.customerName
      ? String(raw.customerName)
      : (customerUserId ? customerNames.get(customerUserId) : undefined) || null,
    score: Number(raw.score ?? 0),
    review: raw.review !== undefined && raw.review !== null ? String(raw.review) : null,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    status: String(raw.status || 'VISIBLE'),
    moderatedByUserId: raw.moderatedByUserId ? String(raw.moderatedByUserId) : null,
    moderatedAt: raw.moderatedAt ? String(raw.moderatedAt) : null,
    moderationReason: raw.moderationReason ? String(raw.moderationReason) : null,
    createdAt: String(raw.createdAt || ''),
  };
}

export class RealRatingRepository implements IRatingRepository {
  private workerNameCache = new Map<string, string>();
  private customerNameCache = new Map<string, string>();
  private registryLoadedAt = 0;

  private async ensureNameRegistries(): Promise<void> {
    const now = Date.now();
    if (now - this.registryLoadedAt < 60_000 && this.workerNameCache.size > 0) {
      return;
    }
    const [workersRes, customersRes] = await Promise.all([
      httpClient
        .get<{ data?: Array<Record<string, unknown>> }>('/admin/workers', { params: { limit: 100 } })
        .catch(() => null),
      httpClient
        .get<{ data?: Array<Record<string, unknown>> }>('/admin/customers', { params: { limit: 100 } })
        .catch(() => null),
    ]);
    const wList = Array.isArray(workersRes?.data?.data) ? workersRes.data.data : [];
    for (const w of wList) {
      const id = String(w.id || w.workerId || '');
      const name = String(w.fullName || w.name || '').trim();
      if (id && name) this.workerNameCache.set(id, name);
    }
    const cList = Array.isArray(customersRes?.data?.data) ? customersRes.data.data : [];
    for (const c of cList) {
      const id = String(c.id || '');
      const userId = String(c.userId || '');
      const name = String(c.fullName || c.name || '').trim();
      if (name) {
        if (id) this.customerNameCache.set(id, name);
        if (userId) this.customerNameCache.set(userId, name);
      }
    }
    this.registryLoadedAt = now;
  }

  private async fetchAllRawRatings(params: Record<string, unknown>): Promise<{
    rows: Array<Record<string, unknown>>;
    total: number;
  }> {
    const first = await httpClient.get<{
      data?: Array<Record<string, unknown>>;
      meta?: { page?: number; limit?: number; total?: number };
    }>('/admin/ratings', { params: { ...params, page: 1, limit: 100 } });
    const rows = Array.isArray(first.data?.data) ? [...first.data.data] : [];
    const total = Number(first.data?.meta?.total ?? rows.length);
    const totalPages = Math.ceil(total / 100);
    for (let p = 2; p <= Math.min(totalPages, 10); p++) {
      const next = await httpClient.get<{ data?: Array<Record<string, unknown>> }>('/admin/ratings', {
        params: { ...params, page: p, limit: 100 },
      });
      if (Array.isArray(next.data?.data)) {
        rows.push(...next.data.data);
      }
    }
    return { rows, total };
  }

  async getRatings(filter?: RatingsFilterCriteria): Promise<PaginatedRatingsResult> {
    try {
      const serverParams: Record<string, unknown> = {};
      if (filter?.status && filter.status !== 'ALL') serverParams.status = filter.status;
      if (filter?.workerId) serverParams.workerId = filter.workerId;
      if (filter?.bookingId) serverParams.bookingId = filter.bookingId;

      const [allForOverviewRes, filteredRawRes, visibleMetaRes, hiddenMetaRes] = await Promise.all([
        this.fetchAllRawRatings({}),
        Object.keys(serverParams).length > 0 ? this.fetchAllRawRatings(serverParams) : Promise.resolve(null),
        httpClient
          .get<{ meta?: { total?: number } }>('/admin/ratings', { params: { status: 'VISIBLE', limit: 1 } })
          .catch(() => null),
        httpClient
          .get<{ meta?: { total?: number } }>('/admin/ratings', { params: { status: 'HIDDEN', limit: 1 } })
          .catch(() => null),
        this.ensureNameRegistries(),
      ]);

      const sourceRaw = filteredRawRes ? filteredRawRes.rows : allForOverviewRes.rows;
      let items = sourceRaw.map((raw) => mapRawRating(raw, this.workerNameCache, this.customerNameCache));
      const allOverviewItems = allForOverviewRes.rows.map((raw) =>
        mapRawRating(raw, this.workerNameCache, this.customerNameCache)
      );

      // Apply exact secondary filters on the complete dataset when supported filters aren't on backend
      if (filter?.score && filter.score !== 'ALL') {
        items = items.filter((r) => Math.round(r.score) === Number(filter.score));
      }
      if (filter?.from) {
        items = items.filter((r) => getIsoDateIST(r.createdAt) >= filter.from!);
      }
      if (filter?.to) {
        items = items.filter((r) => {
          const d = getIsoDateIST(r.createdAt);
          return d && d <= filter.to!;
        });
      }
      if (filter?.searchTerm?.trim()) {
        const q = filter.searchTerm.trim().toLowerCase();
        items = items.filter(
          (r) =>
            r.id.toLowerCase().includes(q) ||
            r.bookingId.toLowerCase().includes(q) ||
            r.workerId.toLowerCase().includes(q) ||
            (r.workerName && r.workerName.toLowerCase().includes(q)) ||
            (r.customerName && r.customerName.toLowerCase().includes(q)) ||
            (r.review && r.review.toLowerCase().includes(q)) ||
            formatDateIST(r.createdAt).toLowerCase().includes(q)
        );
      }

      const page = filter?.page || 1;
      const limit = filter?.limit || 15;
      const filteredTotal = items.length;
      const totalPages = Math.max(1, Math.ceil(filteredTotal / limit));
      const paginated = items.slice((page - 1) * limit, page * limit);

      const totalCount = allForOverviewRes.total;
      const visibleCount = Number(
        visibleMetaRes?.data?.meta?.total ?? allOverviewItems.filter((r) => r.status === 'VISIBLE').length
      );
      const hiddenCount = Number(
        hiddenMetaRes?.data?.meta?.total ?? allOverviewItems.filter((r) => r.status === 'HIDDEN').length
      );

      return {
        items: paginated,
        total: filteredTotal,
        page,
        limit,
        totalPages,
        overview: buildOverview(allOverviewItems, totalCount, visibleCount, hiddenCount),
      };
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getRatingById(ratingId: string): Promise<RatingRecord | null> {
    try {
      const [res] = await Promise.all([
        httpClient.get<Record<string, unknown>>(`/admin/ratings/${encodeURIComponent(ratingId)}`),
        this.ensureNameRegistries(),
      ]);
      const raw =
        res.data?.data && typeof res.data.data === 'object'
          ? (res.data.data as Record<string, unknown>)
          : res.data;
      if (!raw || typeof raw !== 'object') return null;
      return mapRawRating(raw, this.workerNameCache, this.customerNameCache);
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }

  async getWorkerRatingSummary(workerId: string): Promise<WorkerRatingSummary | null> {
    try {
      const res = await httpClient.get<Record<string, unknown>>(
        `/admin/ratings/workers/${encodeURIComponent(workerId)}/summary`
      );
      const raw =
        res.data?.data && typeof res.data.data === 'object'
          ? (res.data.data as Record<string, unknown>)
          : res.data;
      if (!raw || typeof raw !== 'object') return null;
      return {
        count: Number(raw.count ?? 0),
        average: raw.average !== undefined && raw.average !== null ? Number(raw.average) : null,
        scaleMax: Number(raw.scaleMax ?? 5),
      };
    } catch {
      return null;
    }
  }

  async moderateRating(ratingId: string, action: 'hide' | 'unhide', reason: string): Promise<void> {
    try {
      await httpClient.post(`/admin/ratings/${encodeURIComponent(ratingId)}/${action}`, {
        reason: reason.trim(),
      });
    } catch (err) {
      throw mapHttpErrorToDomainError(err);
    }
  }
}

export class MockRatingRepository implements IRatingRepository {
  async getRatings(filter?: RatingsFilterCriteria): Promise<PaginatedRatingsResult> {
    let items = [...MOCK_RATINGS];
    const visibleCount = MOCK_RATINGS.filter((r) => r.status === 'VISIBLE').length;
    const hiddenCount = MOCK_RATINGS.filter((r) => r.status === 'HIDDEN').length;

    if (filter?.status && filter.status !== 'ALL') {
      items = items.filter((r) => r.status === filter.status);
    }
    if (filter?.score && filter.score !== 'ALL') {
      items = items.filter((r) => Math.round(r.score) === Number(filter.score));
    }
    if (filter?.from) {
      items = items.filter((r) => getIsoDateIST(r.createdAt) >= filter.from!);
    }
    if (filter?.to) {
      items = items.filter((r) => getIsoDateIST(r.createdAt) <= filter.to!);
    }
    if (filter?.searchTerm?.trim()) {
      const q = filter.searchTerm.trim().toLowerCase();
      items = items.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.bookingId.toLowerCase().includes(q) ||
          (r.workerName && r.workerName.toLowerCase().includes(q)) ||
          (r.customerName && r.customerName.toLowerCase().includes(q)) ||
          (r.review && r.review.toLowerCase().includes(q))
      );
    }

    const page = filter?.page || 1;
    const limit = filter?.limit || 15;
    return {
      items: items.slice((page - 1) * limit, page * limit),
      total: items.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(items.length / limit)),
      overview: buildOverview(MOCK_RATINGS, MOCK_RATINGS.length, visibleCount, hiddenCount),
    };
  }

  async getRatingById(ratingId: string): Promise<RatingRecord | null> {
    return MOCK_RATINGS.find((r) => r.id === ratingId) || null;
  }

  async getWorkerRatingSummary(workerId: string): Promise<WorkerRatingSummary | null> {
    const visible = MOCK_RATINGS.filter((r) => r.workerId === workerId && r.status === 'VISIBLE');
    if (visible.length === 0) return { count: 0, average: null, scaleMax: 5 };
    const avg = visible.reduce((sum, r) => sum + r.score, 0) / visible.length;
    return { count: visible.length, average: Number(avg.toFixed(2)), scaleMax: 5 };
  }

  async moderateRating(ratingId: string, action: 'hide' | 'unhide', reason: string): Promise<void> {
    const target = MOCK_RATINGS.find((r) => r.id === ratingId);
    if (target) {
      target.status = action === 'hide' ? 'HIDDEN' : 'VISIBLE';
      target.moderationReason = reason;
      target.moderatedAt = new Date().toISOString();
    }
  }
}

export const createRatingRepository = (useMock: boolean = env.VITE_USE_MOCK_AUTH): IRatingRepository =>
  useMock ? new MockRatingRepository() : new RealRatingRepository();

export const ratingRepository = createRatingRepository();

