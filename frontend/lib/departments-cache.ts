/**
 * In-memory cache for departments and divisions (TTL 5 min).
 * Backend also caches in Redis; this avoids repeat requests when opening modals.
 */

const TTL_MS = 5 * 60 * 1000; // 5 minutes

type CacheEntry<T> = { data: T; expires: number };

let departmentsCache: CacheEntry<unknown[]> | null = null;
const divisionsCache = new Map<string, CacheEntry<unknown[]>>();

function isExpired(entry: CacheEntry<unknown>): boolean {
  return Date.now() > entry.expires;
}

export function getCachedDepartments(): unknown[] | null {
  if (!departmentsCache || isExpired(departmentsCache)) return null;
  return departmentsCache.data as unknown[];
}

export function setCachedDepartments(data: unknown[]): void {
  departmentsCache = { data, expires: Date.now() + TTL_MS };
}

export function getCachedDivisions(departmentId: string): unknown[] | null {
  const entry = divisionsCache.get(departmentId);
  if (!entry || isExpired(entry)) return null;
  return entry.data as unknown[];
}

export function setCachedDivisions(departmentId: string, data: unknown[]): void {
  divisionsCache.set(departmentId, {
    data,
    expires: Date.now() + TTL_MS,
  });
}

export function clearDepartmentsCache(): void {
  departmentsCache = null;
  divisionsCache.clear();
}
