/**
 * Date and Time Formatter for SevaNest Admin Portal.
 * Formats all timestamps in Indian Standard Time (IST - Asia/Kolkata / UTC+05:30).
 */

export function formatDateTimeIST(dateInput: string | number | Date | undefined | null): string {
  if (!dateInput) return '—';

  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return '—';
  }
}

export function formatDateIST(dateInput: string | number | Date | undefined | null): string {
  if (!dateInput) return '—';

  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return '—';
  }
}
