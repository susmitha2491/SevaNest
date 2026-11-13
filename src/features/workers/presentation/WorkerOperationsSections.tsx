import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Edit3, Eye, EyeOff, Save, Star, X } from 'lucide-react';
import { workerRepository } from '../data/workerRepository';
import { AdminWorkerRatingItem, UpdateWorkerAvailabilityPayload, WorkerDetail } from '../domain/types';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog/ConfirmDialog';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { LoadingSpinner } from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { formatDateTimeIST } from '../../../shared/formatters/dateTime';

const ENGAGEMENT_OPTIONS: Array<{ value: NonNullable<UpdateWorkerAvailabilityPayload['engagementPreference']>; label: string }> = [
  { value: 'FULL_TIME', label: 'Full-Time' },
  { value: 'PART_TIME', label: 'Part-Time' },
  { value: 'LIVE_IN', label: 'Live-In' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'HOURLY', label: 'Hourly' },
  { value: 'SHIFT', label: 'Shift' },
  { value: 'ONE_TIME', label: 'One-Time' },
];

interface WorkerAvailabilityCategoriesEditorProps {
  worker: WorkerDetail;
  canManageWorker: boolean;
  onUpdated: () => Promise<void> | void;
}

export const WorkerAvailabilityCategoriesEditor: React.FC<WorkerAvailabilityCategoriesEditorProps> = ({
  worker,
  canManageWorker,
  onUpdated,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [engagementPreference, setEngagementPreference] = useState<string>(
    worker.availabilitySchedule?.engagementPreference || 'FULL_TIME'
  );
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [windowStart, setWindowStart] = useState('08:00');
  const [windowEnd, setWindowEnd] = useState('18:00');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const { data: categoriesCatalog = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ['workers', 'catalog', 'categories'],
    queryFn: () => workerRepository.getServiceCategoriesCatalog?.() ?? Promise.resolve([]),
    enabled: canManageWorker && isEditing,
    staleTime: 5 * 60 * 1000,
  });

  const { data: areasCatalog = [], isLoading: isLoadingAreas } = useQuery({
    queryKey: ['workers', 'catalog', 'areas'],
    queryFn: () => workerRepository.getServiceAreasCatalog?.() ?? Promise.resolve([]),
    enabled: canManageWorker && isEditing,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setEngagementPreference(worker.availabilitySchedule?.engagementPreference || 'FULL_TIME');
    setSelectedAreaIds((worker.availabilitySchedule?.areas || []).map((a) => a.id).filter(Boolean));
    const firstWindow = worker.availabilitySchedule?.timeWindows?.[0];
    setWindowStart(firstWindow?.start || '08:00');
    setWindowEnd(firstWindow?.end || '18:00');
  }, [worker]);

  useEffect(() => {
    if (!categoriesCatalog.length) return;
    const workerCatNames = new Set(
      (worker.categories && worker.categories.length > 0 ? worker.categories : [worker.category])
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
    );
    const matchedIds = categoriesCatalog
      .filter((c) => workerCatNames.has(c.code.toUpperCase()) || workerCatNames.has(c.name.toUpperCase()))
      .map((c) => c.id);
    setSelectedCategoryIds(matchedIds);
  }, [categoriesCatalog, worker.categories, worker.category]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaveError(null);
      setSaveSuccess(null);

      if (workerRepository.updateWorkerAvailability) {
        await workerRepository.updateWorkerAvailability(worker.id, {
          engagementPreference: engagementPreference as UpdateWorkerAvailabilityPayload['engagementPreference'],
          areaIds: selectedAreaIds.length > 0 ? selectedAreaIds : undefined,
          timeWindows: windowStart && windowEnd ? [{ start: windowStart, end: windowEnd }] : undefined,
        });
      }

      if (selectedCategoryIds.length > 0) {
        await workerRepository.updateWorkerCategories(worker.id, selectedCategoryIds);
      }
    },
    onSuccess: async () => {
      setIsEditing(false);
      setSaveSuccess('Worker availability, areas, and categories updated.');
      await onUpdated();
    },
    onError: (err: unknown) => {
      setSaveError(err instanceof Error ? err.message : 'Failed to update worker availability or categories.');
    },
  });

  if (!canManageWorker) return null;

  const toggleItem = (list: string[], id: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  return (
    <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
          Operations Controls: Service Areas, Schedule &amp; Categories
        </span>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => {
              setSaveError(null);
              setSaveSuccess(null);
              setIsEditing(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Edit3 size={13} />
            <span>Edit Availability &amp; Categories</span>
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setSaveError(null);
              }}
              disabled={saveMutation.isPending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <X size={13} />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 12px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                cursor: saveMutation.isPending ? 'not-allowed' : 'pointer',
              }}
            >
              <Save size={13} />
              <span>{saveMutation.isPending ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        )}
      </div>

      {saveSuccess && !isEditing && (
        <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--color-status-success-text)', fontWeight: 600 }}>
          {saveSuccess}
        </div>
      )}

      {isEditing && (
        <div
          style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-subtle)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          {saveError && (
            <div
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-status-danger-bg)',
                color: 'var(--color-status-danger-text)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
              }}
            >
              {saveError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                Engagement Preference
              </label>
              <select
                aria-label="Engagement Preference"
                value={engagementPreference}
                onChange={(e) => setEngagementPreference(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                {ENGAGEMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                Available From
              </label>
              <input
                type="time"
                aria-label="Available From"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: 'var(--font-size-xs)',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                Available To
              </label>
              <input
                type="time"
                aria-label="Available To"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: 'var(--font-size-xs)',
                }}
              />
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
              Assigned Service Categories
            </div>
            {isLoadingCategories ? (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Loading categories...</span>
            ) : categoriesCatalog.length === 0 ? (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>No service categories available.</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {categoriesCatalog.map((cat) => {
                  const checked = selectedCategoryIds.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        backgroundColor: checked ? 'var(--color-status-info-bg)' : 'var(--color-surface)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItem(selectedCategoryIds, cat.id, setSelectedCategoryIds)}
                      />
                      <span>{cat.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
              Service Areas
            </div>
            {isLoadingAreas ? (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Loading areas...</span>
            ) : areasCatalog.length === 0 ? (
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>No service areas available.</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {areasCatalog.map((area) => {
                  const checked = selectedAreaIds.includes(area.id);
                  return (
                    <label
                      key={area.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        backgroundColor: checked ? 'var(--color-status-info-bg)' : 'var(--color-surface)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItem(selectedAreaIds, area.id, setSelectedAreaIds)}
                      />
                      <span>{area.name}{area.city ? ` (${area.city})` : ''}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface WorkerRatingsModerationCardProps {
  workerId: string;
  canViewRatings: boolean;
  canModerateRatings: boolean;
}

export const WorkerRatingsModerationCard: React.FC<WorkerRatingsModerationCardProps> = ({
  workerId,
  canViewRatings,
  canModerateRatings,
}) => {
  const [targetRating, setTargetRating] = useState<{ item: AdminWorkerRatingItem; action: 'hide' | 'unhide' } | null>(null);
  const [modError, setModError] = useState<string | null>(null);

  const {
    data: ratings = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['workers', 'ratings', workerId],
    queryFn: () => workerRepository.getWorkerRatings?.(workerId) ?? Promise.resolve([]),
    enabled: Boolean(workerId) && canViewRatings,
  });

  const moderateMutation = useMutation({
    mutationFn: async ({ ratingId, action, reason }: { ratingId: string; action: 'hide' | 'unhide'; reason: string }) => {
      if (!workerRepository.moderateRating) return;
      await workerRepository.moderateRating(ratingId, action, reason);
    },
    onSuccess: async () => {
      setTargetRating(null);
      setModError(null);
      await refetch();
    },
    onError: (err: unknown) => {
      setModError(err instanceof Error ? err.message : 'Failed to moderate rating.');
    },
  });

  if (!canViewRatings) return null;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Star size={16} color="var(--color-primary)" />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--color-text-primary)',
            }}
          >
            Customer Ratings &amp; Review Moderation
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
          {ratings.length} {ratings.length === 1 ? 'review' : 'reviews'}
        </span>
      </div>

      {isLoading ? (
        <div style={{ padding: 'var(--space-3)' }}>
          <LoadingSpinner message="Loading worker ratings..." />
        </div>
      ) : isError ? (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-status-danger-text)' }}>
          Unable to load worker ratings.
        </div>
      ) : ratings.length === 0 ? (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          No customer ratings recorded for this worker yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {ratings.map((item) => {
            const isHidden = item.status === 'HIDDEN';
            return (
              <div
                key={item.id}
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-navy)' }}>
                      {item.score} / 5 ★
                    </span>
                    <StatusBadge status={item.status} />
                    {item.createdAt && (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {formatDateTimeIST(item.createdAt)}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                    {item.review || 'No written review provided.'}
                  </p>
                  {item.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {item.tags.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.moderationReason && (
                    <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      Moderation note: {item.moderationReason}
                    </div>
                  )}
                </div>

                {canModerateRatings && (
                  <button
                    type="button"
                    onClick={() => {
                      setModError(null);
                      setTargetRating({ item, action: isHidden ? 'unhide' : 'hide' });
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isHidden ? 'var(--color-status-success-border)' : 'var(--color-status-warning-border)'}`,
                      backgroundColor: isHidden ? 'var(--color-status-success-bg)' : 'var(--color-status-warning-bg)',
                      color: isHidden ? 'var(--color-status-success-text)' : 'var(--color-status-warning-text)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                    <span>{isHidden ? 'Unhide Review' : 'Hide Review'}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(targetRating)}
        title={targetRating?.action === 'hide' ? 'Hide Customer Rating' : 'Unhide Customer Rating'}
        description={
          targetRating?.action === 'hide'
            ? 'Hide this rating/review from public worker profiles. A moderation reason is required for audit logs.'
            : 'Restore visibility of this customer rating on worker profiles.'
        }
        confirmLabel={
          moderateMutation.isPending
            ? 'Submitting...'
            : targetRating?.action === 'hide'
            ? 'Hide Review'
            : 'Unhide Review'
        }
        isDestructive={targetRating?.action === 'hide'}
        requireRemarks={true}
        remarksPlaceholder="Enter moderation reason (minimum 3 characters)..."
        isLoading={moderateMutation.isPending}
        errorMessage={modError}
        onConfirm={(remarks) => {
          if (targetRating && remarks) {
            moderateMutation.mutate({
              ratingId: targetRating.item.id,
              action: targetRating.action,
              reason: remarks,
            });
          }
        }}
        onCancel={() => {
          setTargetRating(null);
          setModError(null);
        }}
      />
    </div>
  );
};

