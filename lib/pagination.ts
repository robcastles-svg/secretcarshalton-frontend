/** Shared card-grid page size — News, Directory, Discover, People, Walks, Themes, Stories. Events is month-filtered instead, not paginated by count. */
export const PAGE_SIZE = 9;

export function parsePageParam(raw?: string): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

/** Clamps the requested page into range and slices it out — an out-of-range page (stale link, edited URL) lands on the nearest real page instead of rendering empty. */
export function paginate<T>(items: T[], requestedPage: number, pageSize = PAGE_SIZE): { items: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page, totalPages };
}
