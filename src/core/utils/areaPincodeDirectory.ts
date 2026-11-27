/**
 * Authoritative Operational Area & Cluster Pincode Directory
 *
 * Persists and resolves exact covered PIN codes for operational areas and clusters.
 * Prevents hardcoding identical PIN codes across distinct clusters while ensuring
 * user-entered PIN codes survive API responses where the database table omits
 * a dedicated pincodes relation.
 */

const STORAGE_KEY = 'sevanest_operational_area_pincodes';

// Authentic default PIN codes for Hyderabad launch operational clusters
const DEFAULT_CLUSTER_PINCODES: Record<string, string[]> = {
  'banjara hills': ['500034'],
  'gachibowli': ['500032'],
  'hitec city': ['500081', '500082'],
  'jubilee hills': ['500033'],
  'kondapur': ['500084'],
  'kukatpally': ['500072'],
  'madhapur': ['500081', '500086'],
  'miyapur': ['500049'],
  'secunderabad': ['500003'],
};

// In-memory fallback cache
const memoryPincodeCache: Record<string, string[]> = {};

/**
 * Validates a postal PIN code according to Indian standards (6 numeric digits).
 */
export function validatePincodeFormat(pincode: string): { isValid: boolean; error?: string } {
  const trimmed = pincode.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Please enter a PIN code.' };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { isValid: false, error: 'PIN code must contain only numeric digits.' };
  }
  if (trimmed.length !== 6) {
    return { isValid: false, error: 'PIN code must be exactly 6 digits (e.g. 500081).' };
  }
  if (trimmed.startsWith('0')) {
    return { isValid: false, error: 'PIN code cannot start with 0.' };
  }
  return { isValid: true };
}

/**
 * Cleans and deduplicates a list of PIN codes.
 */
export function normalizePincodes(pincodes?: (string | number)[] | null): string[] {
  if (!pincodes || !Array.isArray(pincodes)) return [];
  const set = new Set<string>();
  pincodes.forEach((p) => {
    const s = String(p).trim();
    if (/^\d{6}$/.test(s)) {
      set.add(s);
    }
  });
  return Array.from(set);
}

function getStorageMap(): Record<string, string[]> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch {
    // Ignore storage parse error
  }
  return memoryPincodeCache;
}

function saveStorageMap(map: Record<string, string[]>): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // Ignore storage save error
  }
  Object.assign(memoryPincodeCache, map);
}

/**
 * Persists the exact PIN codes entered by an administrator for a cluster / area.
 */
export function setAreaPincodes(areaId: string, clusterName: string, pincodes: string[]): void {
  const clean = normalizePincodes(pincodes);
  const map = getStorageMap();

  if (areaId) {
    map[areaId.toLowerCase().trim()] = clean;
  }
  if (clusterName) {
    map[clusterName.toLowerCase().trim()] = clean;
  }

  saveStorageMap(map);
}

/**
 * Retrieves the authoritative PIN codes for an operational area.
 * First checks user-saved PIN codes, then backend response if provided,
 * and finally accurate Hyderabad defaults for launch clusters.
 */
export function getAreaPincodes(
  areaId?: string,
  clusterName?: string,
  backendPincodes?: unknown
): string[] {
  // If backend returns explicit valid PIN codes, use them
  if (Array.isArray(backendPincodes) && backendPincodes.length > 0) {
    const normalized = normalizePincodes(backendPincodes as string[]);
    if (normalized.length > 0) return normalized;
  }

  const map = getStorageMap();

  if (areaId) {
    const key = areaId.toLowerCase().trim();
    if (map[key] && map[key].length > 0) {
      return [...map[key]];
    }
  }

  if (clusterName) {
    const key = clusterName.toLowerCase().trim();
    if (map[key] && map[key].length > 0) {
      return [...map[key]];
    }

    // Check default cluster mapping
    if (DEFAULT_CLUSTER_PINCODES[key]) {
      return [...DEFAULT_CLUSTER_PINCODES[key]];
    }

    // Partial key matching for launch clusters (e.g. "Kondapur Hub" matches "kondapur")
    for (const [clusterKey, defaultPins] of Object.entries(DEFAULT_CLUSTER_PINCODES)) {
      if (key.includes(clusterKey) || clusterKey.includes(key)) {
        return [...defaultPins];
      }
    }
  }

  return [];
}
