/**
 * Shared card-grid page size — News, Directory, Discover, People, Walks,
 * Themes, Stories, Community, Search. Events is month-filtered instead,
 * not paginated by count. 10, not 9: these grids are two columns wide on
 * desktop (.post-list-two-column), and 9 left a single dangling card on
 * its own in the last row — 10 fills every row evenly. News is the one
 * single-column exception; this number isn't load-bearing there, just
 * how many show per page.
 */
export const PAGE_SIZE = 10;

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
