/**
 * The events list pages (events redesign, Stage 3): which events show
 * where, in what order and grouping, and the addresses of every list
 * page. Pure functions, no fetching, so proxy.ts can share listHref /
 * parseMonthSlug without pulling in the WordPress client.
 *
 * Addresses (agreed with Rob):
 *   /events                      all upcoming
 *   /events/this-weekend         this weekend
 *   /events/month/november-2026  a month
 *   /events/category/music       a topic ("free" = free events)
 *   /whats-on-in-carshalton etc. an area (the sc_event_category slug)
 * Topic + month/weekend combinations are query strings (?topic=music)
 * rather than pages of their own, to avoid thin pages. On area pages,
 * both the month and the topic are query strings (?when=&topic=).
 */

export const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The three area pages — slug is both the page address and the sc_event_category slug. */
export const AREAS = [
  {
    slug: "whats-on-in-carshalton",
    name: "Carshalton",
    title: "What's On in Carshalton",
    intro: "Events in Carshalton Village, Carshalton Beeches and around the ponds.",
  },
  {
    slug: "whats-on-in-sutton",
    name: "Sutton",
    title: "What's On in Sutton",
    intro: "Events in Sutton, Cheam, Wallington and the rest of the borough.",
  },
  {
    slug: "whats-on-outside-sutton",
    name: "Outside Sutton",
    title: "What's On Outside Sutton",
    intro: "Worth the short trip: events just beyond the borough.",
  },
] as const;

export type AreaSlug = (typeof AREAS)[number]["slug"];

export function findArea(slug: string | undefined | null) {
  return AREAS.find((a) => a.slug === slug) ?? null;
}

/** "all" | "weekend" | "2026-11" */
export type When = string;

export interface ListFilter {
  area?: string | null;
  when: When;
  topic?: string | null;
}

/** "2026-11" → "november-2026" */
export function monthSlug(when: string): string {
  const [y, m] = when.split("-").map(Number);
  return `${MONTHS_LONG[m - 1].toLowerCase()}-${y}`;
}

/** "november-2026" → "2026-11", or null if it isn't a month address. */
export function parseMonthSlug(slug: string): string | null {
  const match = /^([a-z]+)-(\d{4})$/.exec(slug);
  if (!match) return null;
  const m = MONTHS_LONG.findIndex((n) => n.toLowerCase() === match[1]);
  if (m < 0) return null;
  return `${match[2]}-${String(m + 1).padStart(2, "0")}`;
}

export function monthLabel(when: string, withYear = true): string {
  const [y, m] = when.split("-").map(Number);
  return withYear ? `${MONTHS_LONG[m - 1]} ${y}` : MONTHS_LONG[m - 1];
}

export function addMonths(when: string, n: number): string {
  const [y, m] = when.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Today's date in the UK, as a local-midnight Date (same convention as parseEventDate). */
export function ukToday(now = Date.now()): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(now));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return new Date(get("year"), get("month") - 1, get("day"));
}

export function currentMonth(now = Date.now()): string {
  const t = ukToday(now);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

/** The month pills: this month and the next three. */
export function pillMonths(now = Date.now()): string[] {
  const first = currentMonth(now);
  return [0, 1, 2, 3].map((n) => addMonths(first, n));
}

/**
 * This weekend, as [Saturday 00:00, Monday 00:00) in UK wall-clock time.
 * On a Saturday or Sunday it's the weekend we're in.
 */
export function weekendRange(now = Date.now()): { from: Date; to: Date } {
  const today = ukToday(now);
  const dow = today.getDay(); // 0 Sun … 6 Sat
  const toSat = dow === 0 ? -1 : 6 - dow;
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() + toSat);
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 2);
  return { from, to };
}

/** "Sat 10 – Sun 11 October" */
export function weekendLabel(now = Date.now()): string {
  const { from } = weekendRange(now);
  const sun = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  const sameMonth = sun.getMonth() === from.getMonth();
  return `Sat ${from.getDate()}${sameMonth ? "" : ` ${MONTHS_LONG[from.getMonth()]}`} – Sun ${sun.getDate()} ${
    MONTHS_LONG[sun.getMonth()]
  }`;
}

export function monthRange(when: string): { from: Date; to: Date } {
  const [y, m] = when.split("-").map(Number);
  return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
}

/** Start of next Monday — the end of "This week" in the main list. */
export function endOfThisWeek(now = Date.now()): Date {
  const today = ukToday(now);
  const daysToMon = ((8 - today.getDay()) % 7) || 7;
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToMon);
}

/**
 * Address of a list page. Mirrors the mockup's listUrl(), with the
 * month/category addresses Rob agreed (prefixed, so they can't clash with
 * event slugs under /events/[slug]).
 */
export function listHref({ area, when, topic }: ListFilter): string {
  const q = new URLSearchParams();
  if (area) {
    if (when !== "all") q.set("when", when === "weekend" ? "this-weekend" : monthSlug(when));
    if (topic) q.set("topic", topic);
    const qs = q.toString();
    return `/${area}${qs ? `?${qs}` : ""}`;
  }
  if (when === "all") return topic ? `/events/category/${topic}` : "/events";
  if (topic) q.set("topic", topic);
  const qs = q.toString();
  const base = when === "weekend" ? "/events/this-weekend" : `/events/month/${monthSlug(when)}`;
  return `${base}${qs ? `?${qs}` : ""}`;
}

/** Reads an area page's ?when= back into a When. */
export function parseWhenParam(value: string | undefined | null): When {
  if (!value) return "all";
  if (value === "this-weekend") return "weekend";
  return parseMonthSlug(value) ?? "all";
}

/** Old EventON-era tag slug for free events — merged into the price-based "Free" category. */
export const LEGACY_FREE_TAG = "free-entry";
/** Topics that don't get a category of their own in the dropdown. */
export const HIDDEN_TOPICS = new Set([LEGACY_FREE_TAG, "other"]);
