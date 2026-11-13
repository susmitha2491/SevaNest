export type RatingModerationStatus = 'VISIBLE' | 'HIDDEN';

export interface RatingRecord {
  id: string;
  bookingId: string;
  workerId: string;
  workerName?: string | null;
  customerUserId?: string;
  customerName?: string | null;
  score: number;
  review?: string | null;
  tags: string[];
  status: RatingModerationStatus | string;
  moderatedByUserId?: string | null;
  moderatedAt?: string | null;
  moderationReason?: string | null;
  createdAt: string;
}

export interface WorkerRatingSummary {
  count: number;
  average: number | null;
  scaleMax: number;
}

export interface RatingsFilterCriteria {
  status?: 'ALL' | 'VISIBLE' | 'HIDDEN';
  score?: number | 'ALL';
  searchTerm?: string;
  from?: string;
  to?: string;
  workerId?: string;
  bookingId?: string;
  page?: number;
  limit?: number;
}

export interface RatingsOverviewCounts {
  total: number;
  visible: number;
  hidden: number;
  averageScore: number | null;
  isCompleteDataset: boolean;
  distribution: Array<{ score: number; count: number }>;
}

export interface PaginatedRatingsResult {
  items: RatingRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  overview: RatingsOverviewCounts;
}

export interface IRatingRepository {
  getRatings(filter?: RatingsFilterCriteria): Promise<PaginatedRatingsResult>;
  getRatingById(ratingId: string): Promise<RatingRecord | null>;
  getWorkerRatingSummary(workerId: string): Promise<WorkerRatingSummary | null>;
  moderateRating(ratingId: string, action: 'hide' | 'unhide', reason: string): Promise<void>;
}

