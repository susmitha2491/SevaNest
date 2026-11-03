import { httpClient } from '../api/httpClient';

const customerPhoneMap = new Map<string, string>();
const workerPhoneMap = new Map<string, string>();
const customerEmailMap = new Map<string, string>();

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
  customerPhoneMap.set(idOrUserId, formatted);
}

export function getCustomerPhone(idOrUserId?: string): string | undefined {
  if (!idOrUserId) return undefined;
  return customerPhoneMap.get(idOrUserId);
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

export function setWorkerPhone(idOrUserId: string, phone: string): void {
  if (!idOrUserId || !phone) return;
  const formatted = formatPhoneNumber(phone);
  workerPhoneMap.set(idOrUserId, formatted);
}

export function getWorkerPhone(idOrUserId?: string): string | undefined {
  if (!idOrUserId) return undefined;
  return workerPhoneMap.get(idOrUserId);
}

export async function preloadCustomerPhones(): Promise<void> {
  if (isCustomerLoading) return;
  isCustomerLoading = true;
  try {
    const res = await httpClient.get<unknown>('/admin/customers');
    const rawData = res.data as Record<string, unknown> | Array<Record<string, unknown>>;
    const list = Array.isArray(rawData)
      ? rawData
      : Array.isArray((rawData as { items?: unknown[] })?.items)
      ? ((rawData as { items: Record<string, unknown>[] }).items)
      : Array.isArray((rawData as { customers?: unknown[] })?.customers)
      ? ((rawData as { customers: Record<string, unknown>[] }).customers)
      : Array.isArray((rawData as { data?: unknown[] })?.data)
      ? ((rawData as { data: Record<string, unknown>[] }).data)
      : [];

    await Promise.all(
      list.map(async (c) => {
        try {
          const id = String(c.id || c.customerId || '');
          if (!id) return;
          if (customerPhoneMap.has(id)) return;
          const detailRes = await httpClient.get<Record<string, unknown>>(`/admin/customers/${id}`);
          const detail = (detailRes.data?.data || detailRes.data) as Record<string, unknown>;
          const mobile = String(detail?.mobile || detail?.phone || '');
          if (mobile && !mobile.includes('*')) {
            const formatted = formatPhoneNumber(mobile);
            customerPhoneMap.set(id, formatted);
            if (c.userId) customerPhoneMap.set(String(c.userId), formatted);
            if (detail.userId) customerPhoneMap.set(String(detail.userId), formatted);
          }
          const email = String(detail?.email || detail?.unmaskedEmail || '');
          if (email && !email.includes('*')) {
            customerEmailMap.set(id, email.trim());
            if (c.userId) customerEmailMap.set(String(c.userId), email.trim());
            if (detail.userId) customerEmailMap.set(String(detail.userId), email.trim());
          }
        } catch {
          // Ignore individual fetch failure
        }
      })
    );
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
    const res = await httpClient.get<unknown>('/admin/workers');
    const rawData = res.data as Record<string, unknown> | Array<Record<string, unknown>>;
    const list = Array.isArray(rawData)
      ? rawData
      : Array.isArray((rawData as { items?: unknown[] })?.items)
      ? ((rawData as { items: Record<string, unknown>[] }).items)
      : Array.isArray((rawData as { workers?: unknown[] })?.workers)
      ? ((rawData as { workers: Record<string, unknown>[] }).workers)
      : Array.isArray((rawData as { data?: unknown[] })?.data)
      ? ((rawData as { data: Record<string, unknown>[] }).data)
      : [];

    await Promise.all(
      list.map(async (w) => {
        try {
          const id = String(w.id || w.workerId || '');
          if (!id) return;
          if (workerPhoneMap.has(id)) return;
          const detailRes = await httpClient.get<Record<string, unknown>>(`/admin/workers/${id}`);
          const detail = (detailRes.data?.data || detailRes.data) as Record<string, unknown>;
          const mobile = String(detail?.mobile || detail?.phone || '');
          if (mobile && !mobile.includes('*')) {
            const formatted = formatPhoneNumber(mobile);
            workerPhoneMap.set(id, formatted);
            if (w.userId) workerPhoneMap.set(String(w.userId), formatted);
            if (detail.userId) workerPhoneMap.set(String(detail.userId), formatted);
          }
        } catch {
          // Ignore individual fetch failure
        }
      })
    );
  } catch {
    // Ignore error
  } finally {
    isWorkerLoading = false;
  }
}
