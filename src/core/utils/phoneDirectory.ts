import { httpClient } from '../api/httpClient';

const customerPhoneMap = new Map<string, string>();
const workerPhoneMap = new Map<string, string>();
const workerLocalityMap = new Map<string, string>();
const customerEmailMap = new Map<string, string>();
const customerNameMap = new Map<string, string>();
const workerNameMap = new Map<string, string>();

let isCustomerLoading = false;
let isWorkerLoading = false;

/**
 * Format a phone number cleanly into standard Indian mobile format (+91 XXXXX XXXXX)
 * without masking or asterisks.
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.trim();
  if (cleaned.includes('*')) return cleaned;
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return cleaned;
}

/**
 * Normalizes a user's mobile search query into digits for matching.
 * Supports partial numbers ('8341', '35477', '83418') and full numbers
 * ('8341835477', '+91 83418 35477', '+91-83418-35477', '08341835477').
 *
 * Rejects inputs containing letters (names or alphanumeric IDs like W-10482).
 */
export function extractSearchMobileDigits(term?: string | null): string | null {
  if (!term) return null;
  const trimmed = term.trim();
  if (!trimmed || /[a-zA-Z]/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (!digits.length) return null;
  if ((trimmed.startsWith('+91') || trimmed.startsWith('91')) && digits.startsWith('91') && digits.length > 2) {
    return digits.slice(2);
  }
  if (trimmed.startsWith('0') && digits.startsWith('0') && digits.length > 1) {
    return digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * Extracts a canonical 10-digit Indian national mobile number
 * when a user enters 10 or more digits. Returns null for partial queries (< 10 digits)
 * so that backend endpoints requiring >= 10 digits are not called with invalid params.
 */
export function extractCanonicalMobileDigits(term?: string | null): string | null {
  const digits = extractSearchMobileDigits(term);
  if (!digits || digits.length !== 10) return null;
  return digits;
}

/**
 * Substring matching for phone numbers against query digits.
 * Supports numbers stored with country code (+91), spaces, hyphens, leading zero,
 * or raw digit strings.
 */
export function matchesPhoneDigits(phone?: string | null, searchDigits?: string | null): boolean {
  if (!phone || !searchDigits) return false;
  const pDigits = phone.replace(/\D/g, '');
  const sDigits = searchDigits.replace(/\D/g, '');
  if (!sDigits || !pDigits) return false;

  // Direct substring match
  if (pDigits.includes(sDigits)) return true;

  // Check national 10-digit number if phone has 91 country code prefix
  if (pDigits.startsWith('91') && pDigits.length >= 10) {
    const national = pDigits.slice(2);
    if (national.includes(sDigits)) return true;
  }

  // Check national digits if searchDigits had 91 prefix
  if (sDigits.startsWith('91') && sDigits.length >= 10) {
    const nationalS = sDigits.slice(2);
    if (pDigits.includes(nationalS)) return true;
  }

  return false;
}


export function setCustomerPhone(idOrUserId: string, phone: string): void {
  if (!idOrUserId || !phone) return;
  const formatted = formatPhoneNumber(phone);
  // Do not overwrite an unmasked phone with a masked one
  if (formatted.includes('*') && customerPhoneMap.has(idOrUserId) && !customerPhoneMap.get(idOrUserId)?.includes('*')) {
    return;
  }
  customerPhoneMap.set(idOrUserId, formatted);
}

export function getCustomerPhone(idOrUserId?: string): string | undefined {
  if (!idOrUserId) return undefined;
  return customerPhoneMap.get(idOrUserId);
}

const inFlightCustomerFetches = new Map<string, Promise<string | undefined>>();
const inFlightWorkerFetches = new Map<string, Promise<string | undefined>>();

export async function fetchCustomerUnmaskedPhone(idOrUserId: string): Promise<string | undefined> {
  if (!idOrUserId || idOrUserId === 'C-NA') return undefined;
  const existing = customerPhoneMap.get(idOrUserId);
  if (existing && !existing.includes('*')) {
    return existing;
  }
  if (inFlightCustomerFetches.has(idOrUserId)) {
    return inFlightCustomerFetches.get(idOrUserId)!;
  }

  const fetchPromise = (async (): Promise<string | undefined> => {
    try {
      const detailRes = await httpClient.get<Record<string, unknown>>(`/admin/customers/${encodeURIComponent(idOrUserId)}`);
      const raw = (detailRes.data || {}) as Record<string, unknown>;
      const target = (raw.customer || (raw.data && typeof raw.data === 'object' && (raw.data as Record<string, unknown>).customer) || raw.data || raw) as Record<string, unknown>;
      const userObj = (target.user && typeof target.user === 'object' ? target.user : {}) as Record<string, unknown>;
      const profileObj = (target.profile && typeof target.profile === 'object' ? target.profile : {}) as Record<string, unknown>;

      const detailName = String(
        target.name ||
        target.fullName ||
        profileObj.fullName ||
        profileObj.name ||
        userObj.fullName ||
        userObj.name ||
        ''
      ).trim();
      if (detailName && detailName.toLowerCase() !== 'customer' && detailName.toLowerCase() !== 'user') {
        setCustomerName(idOrUserId, detailName);
        if (target.id) setCustomerName(String(target.id), detailName);
        if (target.userId) setCustomerName(String(target.userId), detailName);
        if (userObj.id) setCustomerName(String(userObj.id), detailName);
      }

      const mobile = String(
        target.unmaskedPhone ||
        target.mobile ||
        target.phone ||
        target.phoneNumber ||
        profileObj.mobile ||
        profileObj.phone ||
        userObj.mobile ||
        userObj.phone ||
        ''
      ).trim();

      if (mobile && !mobile.includes('*')) {
        const formatted = formatPhoneNumber(mobile);
        customerPhoneMap.set(idOrUserId, formatted);
        if (target.id) customerPhoneMap.set(String(target.id), formatted);
        if (target.userId) customerPhoneMap.set(String(target.userId), formatted);
        if (userObj.id) customerPhoneMap.set(String(userObj.id), formatted);
        return formatted;
      }
    } catch {
      // If direct customer lookup failed (e.g. 404 because idOrUserId is a user ID), resolve via customer list
      try {
        const res = await httpClient.get<unknown>('/admin/customers');
        const rawData = res.data as Record<string, unknown> | Array<Record<string, unknown>>;
        const list = Array.isArray(rawData)
          ? rawData
          : Array.isArray((rawData as { data?: unknown[] })?.data)
          ? ((rawData as { data: Record<string, unknown>[] }).data)
          : Array.isArray((rawData as { items?: unknown[] })?.items)
          ? ((rawData as { items: Record<string, unknown>[] }).items)
          : [];
        const match = list.find((c) => String(c.id) === idOrUserId || String(c.userId) === idOrUserId);
        if (match && match.id && String(match.id) !== idOrUserId) {
          return await fetchCustomerUnmaskedPhone(String(match.id));
        }
      } catch {
        // Ignore
      }
    } finally {
      inFlightCustomerFetches.delete(idOrUserId);
    }
    const fallback = customerPhoneMap.get(idOrUserId);
    return fallback && !fallback.includes('*') ? fallback : undefined;
  })();

  inFlightCustomerFetches.set(idOrUserId, fetchPromise);
  return fetchPromise;
}

export function setCustomerEmail(idOrUserId: string, email: string): void {
  if (!idOrUserId || !email) return;
  const cleaned = email.trim();
  if (cleaned.includes('*')) return;
  customerEmailMap.set(idOrUserId, cleaned);
}

export function getCustomerEmail(idOrUserId?: string): string | undefined {
  if (!idOrUserId) return undefined;
  return customerEmailMap.get(idOrUserId);
}

export function setCustomerName(idOrUserId: string, name: string): void {
  if (!idOrUserId || !name) return;
  const cleaned = name.trim();
  if (!cleaned || cleaned.toLowerCase() === 'customer' || cleaned.toLowerCase() === 'user') return;
  customerNameMap.set(idOrUserId, cleaned);
}

export function getCustomerName(idOrUserId?: string): string | undefined {
  if (!idOrUserId) return undefined;
  return customerNameMap.get(idOrUserId);
}

export function setWorkerPhone(idOrUserId: string, phone: string): void {
  if (!idOrUserId || !phone) return;
  const formatted = formatPhoneNumber(phone);
  // Do not overwrite an unmasked phone with a masked one
  if (formatted.includes('*') && workerPhoneMap.has(idOrUserId) && !workerPhoneMap.get(idOrUserId)?.includes('*')) {
    return;
  }
  workerPhoneMap.set(idOrUserId, formatted);
}

export function getWorkerPhone(idOrUserId?: string): string | undefined {
  if (!idOrUserId) return undefined;
  return workerPhoneMap.get(idOrUserId);
}

export function setWorkerName(idOrUserId: string, name: string): void {
  if (!idOrUserId || !name) return;
  const cleaned = name.trim();
  if (!cleaned || cleaned.toLowerCase() === 'worker' || cleaned.toLowerCase() === 'user') return;
  workerNameMap.set(idOrUserId, cleaned);
}

export function getWorkerName(idOrUserId?: string): string | undefined {
  if (!idOrUserId) return undefined;
  return workerNameMap.get(idOrUserId);
}

export function setWorkerLocality(idOrUserId: string, locality: string): void {
  if (!idOrUserId || !locality) return;
  const cleaned = locality.trim();
  if (!cleaned || cleaned.toLowerCase() === 'hyderabad') return;
  workerLocalityMap.set(idOrUserId, cleaned);
}

export function getWorkerLocality(idOrUserId?: string): string | undefined {
  if (!idOrUserId) return undefined;
  return workerLocalityMap.get(idOrUserId);
}

export async function preloadCustomerPhones(): Promise<void> {
  if (isCustomerLoading) return;
  isCustomerLoading = true;
  try {
    const res = await httpClient.get<unknown>('/admin/customers', { params: { limit: 100 } });
    const rawData = res.data as Record<string, unknown> | Array<Record<string, unknown>>;
    const list = Array.isArray(rawData)
      ? rawData
      : Array.isArray((rawData as { data?: unknown[] })?.data)
      ? ((rawData as { data: Record<string, unknown>[] }).data)
      : Array.isArray((rawData as { items?: unknown[] })?.items)
      ? ((rawData as { items: Record<string, unknown>[] }).items)
      : Array.isArray((rawData as { customers?: unknown[] })?.customers)
      ? ((rawData as { customers: Record<string, unknown>[] }).customers)
      : [];

    list.forEach((c) => {
      const id = String(c.id || c.customerId || '');
      if (!id) return;
      const listName = String(
        c.name ||
        c.fullName ||
        (c.user as Record<string, unknown>)?.fullName ||
        (c.user as Record<string, unknown>)?.name ||
        ''
      ).trim();
      if (listName && listName.toLowerCase() !== 'customer') {
        setCustomerName(id, listName);
        if (c.userId) setCustomerName(String(c.userId), listName);
      }
      const mobile = String(c.mobile || c.phone || '').trim();
      if (mobile && !mobile.includes('*')) {
        const formatted = formatPhoneNumber(mobile);
        customerPhoneMap.set(id, formatted);
        if (c.userId) customerPhoneMap.set(String(c.userId), formatted);
      }
      const email = String(c.email || c.unmaskedEmail || '').trim();
      if (email && !email.includes('*')) {
        customerEmailMap.set(id, email);
        if (c.userId) customerEmailMap.set(String(c.userId), email);
      }
    });
  } catch {
    // Ignore error
  } finally {
    isCustomerLoading = false;
  }
}

export async function preloadWorkerPhones(): Promise<void> {
  if (isWorkerLoading) return;
  isWorkerLoading = true;
  try {
    const res = await httpClient.get<unknown>('/admin/workers', { params: { limit: 100 } });
    const rawData = res.data as Record<string, unknown> | Array<Record<string, unknown>>;
    const list = Array.isArray(rawData)
      ? rawData
      : Array.isArray((rawData as { data?: unknown[] })?.data)
      ? ((rawData as { data: Record<string, unknown>[] }).data)
      : Array.isArray((rawData as { items?: unknown[] })?.items)
      ? ((rawData as { items: Record<string, unknown>[] }).items)
      : Array.isArray((rawData as { workers?: unknown[] })?.workers)
      ? ((rawData as { workers: Record<string, unknown>[] }).workers)
      : [];

    list.forEach((w) => {
      const id = String(w.id || w.workerId || '');
      if (!id) return;
      const listName = String(
        w.name ||
        w.fullName ||
        (w.user as Record<string, unknown>)?.fullName ||
        (w.user as Record<string, unknown>)?.name ||
        ''
      ).trim();
      if (listName && listName.toLowerCase() !== 'worker') {
        setWorkerName(id, listName);
        if (w.userId) setWorkerName(String(w.userId), listName);
      }
      const mobile = String(w.mobile || w.phone || '').trim();
      if (mobile && !mobile.includes('*')) {
        const formatted = formatPhoneNumber(mobile);
        setWorkerPhone(id, formatted);
        if (w.userId) setWorkerPhone(String(w.userId), formatted);
      }
    });
  } catch {
    // Ignore error
  } finally {
    isWorkerLoading = false;
  }
}

export async function fetchWorkerUnmaskedPhone(idOrUserId: string): Promise<string | undefined> {
  if (!idOrUserId || idOrUserId === 'W-NA') return undefined;
  const existing = workerPhoneMap.get(idOrUserId);
  if (existing && !existing.includes('*')) {
    return existing;
  }
  if (inFlightWorkerFetches.has(idOrUserId)) {
    return inFlightWorkerFetches.get(idOrUserId)!;
  }

  const fetchPromise = (async (): Promise<string | undefined> => {
    try {
      const detailRes = await httpClient.get<Record<string, unknown>>(`/admin/workers/${encodeURIComponent(idOrUserId)}`);
      const raw = (detailRes.data || {}) as Record<string, unknown>;
      const target = (raw.worker || (raw.data && typeof raw.data === 'object' && (raw.data as Record<string, unknown>).worker) || raw.data || raw) as Record<string, unknown>;
      const userObj = (target.user && typeof target.user === 'object' ? target.user : {}) as Record<string, unknown>;
      const profileObj = (target.profile && typeof target.profile === 'object' ? target.profile : {}) as Record<string, unknown>;

      const detailName = String(
        target.name ||
        target.fullName ||
        profileObj.fullName ||
        profileObj.name ||
        userObj.fullName ||
        userObj.name ||
        ''
      ).trim();
      if (detailName && detailName.toLowerCase() !== 'worker' && detailName.toLowerCase() !== 'user') {
        setWorkerName(idOrUserId, detailName);
        if (target.id) setWorkerName(String(target.id), detailName);
        if (target.workerId) setWorkerName(String(target.workerId), detailName);
        if (target.userId) setWorkerName(String(target.userId), detailName);
        if (userObj.id) setWorkerName(String(userObj.id), detailName);
      }

      const mobile = String(
        target.unmaskedPhone ||
        target.mobile ||
        target.phone ||
        target.phoneNumber ||
        profileObj.mobile ||
        profileObj.phone ||
        userObj.mobile ||
        userObj.phone ||
        ''
      ).trim();

      if (mobile && !mobile.includes('*')) {
        const formatted = formatPhoneNumber(mobile);
        workerPhoneMap.set(idOrUserId, formatted);
        if (target.id) workerPhoneMap.set(String(target.id), formatted);
        if (target.workerId) workerPhoneMap.set(String(target.workerId), formatted);
        if (target.userId) workerPhoneMap.set(String(target.userId), formatted);
        if (userObj.id) workerPhoneMap.set(String(userObj.id), formatted);
        return formatted;
      }
    } catch {
      // If direct lookup fails, try preloading
      try {
        await preloadWorkerPhones();
        const loaded = workerPhoneMap.get(idOrUserId);
        if (loaded && !loaded.includes('*')) return loaded;
      } catch {
        // Ignore
      }
    } finally {
      inFlightWorkerFetches.delete(idOrUserId);
    }
    const fallback = workerPhoneMap.get(idOrUserId);
    return fallback && !fallback.includes('*') ? fallback : undefined;
  })();

  inFlightWorkerFetches.set(idOrUserId, fetchPromise);
  return fetchPromise;
}

export async function resolveWorkerName(idOrUserId?: string): Promise<string | undefined> {
  if (!idOrUserId || idOrUserId === 'U-00') return undefined;
  const existing = getWorkerName(idOrUserId);
  if (existing) return existing;
  await preloadWorkerPhones();
  return getWorkerName(idOrUserId);
}

export async function resolveCustomerName(idOrUserId?: string): Promise<string | undefined> {
  if (!idOrUserId || idOrUserId === 'U-00') return undefined;
  const existing = getCustomerName(idOrUserId);
  if (existing) return existing;
  await preloadCustomerPhones();
  return getCustomerName(idOrUserId);
}
