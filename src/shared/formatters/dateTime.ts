/**
 * Date and Time Formatter for SevaNest Admin Portal.
 * Formats all timestamps in Indian Standard Time (IST - Asia/Kolkata / UTC+05:30).
 */

export function formatDateTimeIST(dateInput: string | number | Date | undefined | null): string {
  if (!dateInput) return '—';

  try {
    let date: Date;
    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'number') {
      date = new Date(dateInput < 10000000000 ? dateInput * 1000 : dateInput);
    } else if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (!trimmed) return '—';
      if (/^\d+$/.test(trimmed)) {
        const num = Number(trimmed);
        date = new Date(num < 10000000000 ? num * 1000 : num);
      } else {
        date = new Date(trimmed);
      }
    } else {
      date = new Date(dateInput);
    }

    if (isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    })
      .format(date)
      .replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
  } catch {
    return '—';
  }
}

/**
 * Formats a registration date or timestamp to IST date and time.
 * If the input is a non-date text string (such as 'Recent' or 'Prior' from test fixtures),
 * it returns that string as-is.
 */
export function formatRegistrationDateIST(dateInput: string | number | Date | undefined | null): string {
  if (dateInput === undefined || dateInput === null || dateInput === '') return '—';

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return '—';
    const parsed = Date.parse(trimmed);
    if (isNaN(parsed)) {
      return trimmed;
    }
    return formatDateTimeIST(parsed);
  }

  return formatDateTimeIST(dateInput);
}

export function formatDateIST(dateInput: string | number | Date | undefined | null): string {
  if (!dateInput) return '—';

  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      return '—';
    }

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
