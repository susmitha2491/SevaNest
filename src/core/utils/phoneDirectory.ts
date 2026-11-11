import { httpClient } from '../api/httpClient';

const customerPhoneMap = new Map<string, string>();
const workerPhoneMap = new Map<string, string>();
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

export async function fetchCustomerUnmaskedPhone(idOrUserId: string): Promise<string | undefined> {
  if (!idOrUserId) return undefined;
  const existing = customerPhoneMap.get(idOrUserId);
  if (existing && !existing.includes('*')) {
    return existing;
  }
  try {
    const detailRes = await httpClient.get<Record<string, unknown>>(`/admin/customers/${idOrUserId}`);
    const detail = (detailRes.data?.data || detailRes.data) as Record<string, unknown>;
    const detailName = String(detail?.name || detail?.fullName || (detail?.user as Record<string, unknown>)?.fullName || (detail?.user as Record<string, unknown>)?.name || '');
    if (detailName) {
      setCustomerName(idOrUserId, detailName);
      if (detail.id) setCustomerName(String(detail.id), detailName);
      if (detail.userId) setCustomerName(String(detail.userId), detailName);
    }
    const mobile = String(detail?.mobile || detail?.phone || '');
    if (mobile && !mobile.includes('*')) {
      const formatted = formatPhoneNumber(mobile);
      customerPhoneMap.set(idOrUserId, formatted);
      if (detail.id) customerPhoneMap.set(String(detail.id), formatted);
      if (detail.userId) customerPhoneMap.set(String(detail.userId), formatted);
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
  }
  return existing && !existing.includes('*') ? existing : undefined;
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
      if (mobile) {
        const formatted = formatPhoneNumber(mobile);
        workerPhoneMap.set(id, formatted);
        if (w.userId) workerPhoneMap.set(String(w.userId), formatted);
      }
    });
  } catch {
    // Ignore error
  } finally {
    isWorkerLoading = false;
  }
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
