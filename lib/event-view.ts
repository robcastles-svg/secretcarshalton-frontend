/**
 * Display logic shared by the redesigned event pages (event page,
 * organiser page, and the list cards Stage 3 reuses): dates and repeat
 * dates, price wording, booking card behaviour, calendar links and
 * structured data. Pure functions only — no fetching — so server and
 * client components can both import it.
 *
 * Times: every stored date-time (sc_start, sc_end, sc_repeat_dates) is a
 * UK wall-clock time with no reliable offset. parseEventDate turns those
 * digits into a Date via the *local* Date constructor, so the local
 * getters (getHours etc.) always give back the original UK wall-clock
 * time whatever timezone the server runs in — that's what all display
 * formatting here relies on. Only when a real instant is needed
 * (countdowns, "has it finished", schema.org offsets) does ukInstant()
 * convert to the true moment in Europe/London.
 */
import {
  parseEventDate,
  stripHtml,
  type WPEventOrganizerProfile,
  type WPScEvent,
} from "@/lib/wordpress";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.secretcarshalton.com").replace(/\/$/, "");

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const pad = (n: number) => String(n).padStart(2, "0");

// ---------------------------------------------------------------------------
// UK time
// ---------------------------------------------------------------------------

/** Minutes Europe/London is ahead of UTC at a given instant (0 in GMT, 60 in BST). */
function londonOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - utcMs) / 60000);
}

/** The real instant (ms since epoch) of a UK wall-clock Date from parseEventDate. */
export function ukInstant(wall: Date): number {
  const naiveUtc = Date.UTC(wall.getFullYear(), wall.getMonth(), wall.getDate(), wall.getHours(), wall.getMinutes());
  // Two passes settle correctly either side of a clock change.
  let ms = naiveUtc - londonOffsetMinutes(naiveUtc) * 60000;
  ms = naiveUtc - londonOffsetMinutes(ms) * 60000;
  return ms;
}

/** ISO 8601 with the UK offset, e.g. "2026-10-22T19:30:00+01:00" — what schema.org/Google want. */
export function ukIso(wall: Date): string {
  const offset = londonOffsetMinutes(ukInstant(wall));
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return (
    `${wall.getFullYear()}-${pad(wall.getMonth() + 1)}-${pad(wall.getDate())}` +
    `T${pad(wall.getHours())}:${pad(wall.getMinutes())}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

// ---------------------------------------------------------------------------
// Dates and repeats
// ---------------------------------------------------------------------------

export interface Occurrence {
  start: Date;
  /** Same length as the first date's start→end, or null when no end time is stored. */
  end: Date | null;
}

/**
 * Every date this event runs on, earliest first — the repeat list when
 * there is one, otherwise just sc_start. Each repeat date gets the same
 * duration as the first (sc_start → sc_end), when an end time exists.
 * An end on a different day to the start (or before it) is ignored for
 * repeat dates, since "same time and place each date" is the only shape
 * the add-event form produces.
 */
export function getOccurrences(event: WPScEvent): Occurrence[] {
  const first = parseEventDate(event.meta.sc_start);
  const firstEnd = parseEventDate(event.meta.sc_end, true);
  const durationMs =
    first && firstEnd && firstEnd.getTime() > first.getTime() ? firstEnd.getTime() - first.getTime() : null;

  const repeat = (event.meta.sc_repeat_dates ?? []).map((d) => parseEventDate(d)).filter((d): d is Date => !!d);
  if (repeat.length === 0) {
    return first ? [{ start: first, end: durationMs ? firstEnd : null }] : [];
  }
  return repeat
    .sort((a, b) => a.getTime() - b.getTime())
    .map((start) => ({ start, end: durationMs ? new Date(start.getTime() + durationMs) : null }));
}

export function isRepeating(event: WPScEvent): boolean {
  return (event.meta.sc_repeat_dates?.length ?? 0) > 1;
}

/** The date/time something has finished by: its end if known, otherwise the end of its start day. */
function finishInstant(o: Occurrence): number {
  if (o.end) return ukInstant(o.end);
  const endOfDay = new Date(o.start.getFullYear(), o.start.getMonth(), o.start.getDate(), 23, 59);
  return ukInstant(endOfDay);
}

/** Dates not yet over (an event happening right now still counts). */
export function upcomingOccurrences(event: WPScEvent, now = Date.now()): Occurrence[] {
  return getOccurrences(event).filter((o) => finishInstant(o) >= now);
}

/** The date to show for this event: the next one still to come, or the last one if it's all over. */
export function displayOccurrence(event: WPScEvent, now = Date.now()): Occurrence | null {
  const all = getOccurrences(event);
  return upcomingOccurrences(event, now)[0] ?? all[all.length - 1] ?? null;
}

export function isFinished(event: WPScEvent, now = Date.now()): boolean {
  return getOccurrences(event).length > 0 && upcomingOccurrences(event, now).length === 0;
}

/**
 * Featured right now: the featured flag is on, the event is a single
 * (non-repeating) event, and it hasn't finished. Paid featuring lasts
 * until the event's date, so the badge and slider spot drop off by
 * themselves once it's over, whatever the stored flag still says.
 */
export function isFeaturedNow(event: WPScEvent, now = Date.now()): boolean {
  if (!event.meta.sc_event_featured || isRepeating(event) || isFinished(event, now)) return false;
  const until = event.meta.sc_event_featured_until;
  if (until && /^\d{4}-\d{2}-\d{2}$/.test(until)) {
    const [y, m, d] = until.split("-").map(Number);
    if (ukInstant(new Date(y, m - 1, d, 23, 59)) < now) return false;
  }
  return true;
}

export interface DateParts {
  weekday: string;
  day: number;
  month: string;
  year: number;
  /** "Thu 22 Oct 2026" — for aria-labels and lists. */
  label: string;
}

export function dateParts(d: Date): DateParts {
  const weekday = DAYS[d.getDay()];
  const month = MONTHS[d.getMonth()];
  return {
    weekday,
    day: d.getDate(),
    month,
    year: d.getFullYear(),
    label: `${weekday.charAt(0)}${weekday.slice(1).toLowerCase()} ${d.getDate()} ${month.charAt(0)}${month
      .slice(1)
      .toLowerCase()} ${d.getFullYear()}`,
  };
}

/** "7:30 pm", "11 am" — the mockup's style. */
export function formatTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${pad(m)}` : ""} ${suffix}`;
}

/**
 * "7:30 – 9:30 pm", "11 am – 4 pm", or just the start. Midnight starts
 * are how EventON stored all-day/time-unknown events, so those show no
 * time at all rather than a misleading "12 am".
 */
export function formatTimeRange(o: Occurrence): string | null {
  const { start, end } = o;
  if (start.getHours() === 0 && start.getMinutes() === 0) return null;
  if (!end || end.getDate() !== start.getDate()) return formatTime(start);
  const s = formatTime(start);
  const e = formatTime(end);
  const sameHalf = (start.getHours() >= 12) === (end.getHours() >= 12);
  return sameHalf ? `${s.replace(/ (am|pm)$/, "")} – ${e}` : `${s} – ${e}`;
}

/** "Today", "Tomorrow", "In 12 days", "Finished" — the pill above the event title. */
export function relativeDayLabel(o: Occurrence, finished: boolean, repeating: boolean, now = Date.now()): string {
  if (finished) return "Finished";
  // Compare UK calendar days, not raw hours.
  const today = new Date(new Date(now).toLocaleString("en-US", { timeZone: "Europe/London" }));
  const startDay = Date.UTC(o.start.getFullYear(), o.start.getMonth(), o.start.getDate());
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((startDay - todayDay) / 86_400_000);
  const base = days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
  return repeating ? `Next date · ${base.charAt(0).toLowerCase()}${base.slice(1)}` : base;
}

/** "November 2024" */
export function monthYear(d: Date): string {
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** Short pattern for the repeat flag on cards: "Monthly" / "Weekly", from the stored pattern text. */
export function repeatFlag(event: WPScEvent): string | null {
  if (!isRepeating(event)) return null;
  const pattern = event.meta.sc_repeat_pattern?.trim();
  const word = pattern ? pattern.split(/[,·]/)[0].trim() : "";
  return word || "Repeats";
}

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------

export function formatPounds(amount: string | undefined): string | null {
  if (!amount) return null;
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`;
}

export interface PriceInfo {
  kind: "free" | "paid";
  /** "£7", "From £7", "Free" — the big number in the booking card. */
  headline: string;
  /** Concession note, e.g. "£6 members". */
  note: string | null;
  /** "£7 · £6 members" — the chip under the title. */
  chip: string;
}

/** Null when the price isn't known (not set, "Not sure", or paid with no amount). */
export function getPrice(event: WPScEvent): PriceInfo | null {
  const m = event.meta;
  if (m.sc_price_type === "free") return { kind: "free", headline: "Free", note: null, chip: "Free" };
  if (m.sc_price_type !== "paid") return null;
  const pounds = formatPounds(m.sc_price_amount);
  if (!pounds) return null;
  const headline = m.sc_price_from ? `From ${pounds}` : pounds;
  const note = m.sc_price_concession?.trim() || null;
  return { kind: "paid", headline, note, chip: note ? `${headline} · ${note}` : headline };
}

export function offerPrice(event: WPScEvent): string | null {
  if (event.meta.sc_price_type === "free") return "0";
  return event.meta.sc_price_type === "paid" && formatPounds(event.meta.sc_price_amount)
    ? String(Number(event.meta.sc_price_amount))
    : null;
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

/** "psychicandholistic.co.uk" from a URL, or null if it isn't a usable web link. */
export function linkDomain(url: string | undefined): string | null {
  if (!url || looksLikeEmail(url)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Mirrors SC_Events_Meta::looks_like_email — "a@b.com", "mailto:…", or "http://a@b.com". */
export function looksLikeEmail(value: string | undefined): boolean {
  const v = (value ?? "").trim();
  if (!v) return false;
  if (/^mailto:/i.test(v)) return true;
  const rest = v.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  return rest.split("/")[0].includes("@");
}

/** "http://susan@example.com" → "susan@example.com" (old data saved an email as a URL), else null. */
export function emailFromBadUrl(value: string | undefined): string | null {
  if (!looksLikeEmail(value)) return null;
  const email = (value ?? "").trim().replace(/^mailto:/i, "").replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").split("/")[0];
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

export type Booking =
  | { kind: "contact"; email: string | null; phone: string | null }
  | { kind: "link"; url: string; domain: string; linkKind: "tickets" | "website" }
  | { kind: "none" }
  /** Older events with nothing recorded about booking. */
  | { kind: "unknown" };

/**
 * Which booking card to show. Booking email/phone fall back to the
 * organiser's when left blank. Events from before booking types existed
 * get a sensible guess from what they do have: a link becomes "Visit
 * website" (we can't tell if it's a ticket page), and an email saved in
 * the link field by mistake becomes contact-to-book.
 */
export function getBooking(event: WPScEvent): Booking {
  const m = event.meta;
  const org = event.sc_event_organizer_profile;
  const orgEmail = org?.email || emailFromBadUrl(org?.url) || null;

  if (m.sc_booking_type === "contact") {
    const email = m.sc_booking_email || orgEmail;
    const phone = m.sc_booking_phone || org?.phone || null;
    return email || phone ? { kind: "contact", email, phone } : { kind: "unknown" };
  }
  if (m.sc_booking_type === "none") return { kind: "none" };

  const domain = linkDomain(m.sc_event_url);
  if (domain) {
    const url = /^https?:\/\//i.test(m.sc_event_url) ? m.sc_event_url : `https://${m.sc_event_url}`;
    const linkKind = m.sc_booking_type === "link" && m.sc_booking_link_kind === "tickets" ? "tickets" : "website";
    return { kind: "link", url, domain, linkKind };
  }

  const badEmail = emailFromBadUrl(m.sc_event_url);
  if (badEmail) return { kind: "contact", email: badEmail, phone: m.sc_booking_phone || null };

  return { kind: "unknown" };
}

// ---------------------------------------------------------------------------
// Calendar, venue, organiser
// ---------------------------------------------------------------------------

function gcalStamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

/**
 * Google Calendar "add event" link for one date. Times are sent without a
 * trailing Z plus ctz=Europe/London, so Google reads them as UK time —
 * sending UTC here is what used to put summer events an hour late.
 * No end time → a one-hour slot.
 */
export function googleCalendarUrl(event: WPScEvent, o: Occurrence): string {
  const end = o.end ?? new Date(o.start.getTime() + 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: stripHtml(event.title.rendered),
    dates: `${gcalStamp(o.start)}/${gcalStamp(end)}`,
    ctz: "Europe/London",
    details: `${stripHtml(event.content.rendered).slice(0, 400)}\n\n${SITE_URL}/events/${event.slug}`,
    location: venueQuery(event),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function venueQuery(event: WPScEvent): string {
  return [event.meta.sc_venue_name, event.meta.sc_venue_address].filter(Boolean).join(", ");
}

/** "Honeywood Museum, Carshalton" — venue name plus the town from the address, for chips and cards. */
export function venueShort(event: WPScEvent): string | null {
  const name = event.meta.sc_venue_name?.trim();
  if (!name) return null;
  const town = (event.meta.sc_venue_address ?? "")
    .split(",")
    .map((s) => s.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/, "").trim())
    .filter(Boolean)
    .find((part) => /^(Carshalton|Sutton|Wallington|Cheam|Beddington|Hackbridge|Belmont|Worcester Park|Croydon|Mitcham|Morden|Banstead|Epsom|Purley|Coulsdon)/i.test(part));
  return town && !name.toLowerCase().includes(town.toLowerCase()) ? `${name}, ${town}` : name;
}

export interface OrganizerSocial {
  network: "facebook" | "instagram" | "x" | "tiktok";
  label: string;
  url: string;
}

/**
 * The organiser's social links, from the separate per-network fields,
 * topped up from the old comma-separated list for any network the new
 * fields don't have yet. Anything that isn't a recognisable link to one
 * of the four networks is skipped.
 */
export function organizerSocials(org: WPEventOrganizerProfile | null | undefined): OrganizerSocial[] {
  if (!org) return [];
  const labels = { facebook: "Facebook", instagram: "Instagram", x: "X", tiktok: "TikTok" } as const;
  const found = new Map<OrganizerSocial["network"], string>();
  const add = (network: OrganizerSocial["network"], raw: string | undefined) => {
    const v = raw?.trim();
    if (!v || found.has(network) || looksLikeEmail(v)) return;
    found.set(network, /^https?:\/\//i.test(v) ? v : `https://${v}`);
  };
  add("facebook", org.facebook);
  add("instagram", org.instagram);
  add("x", org.x);
  add("tiktok", org.tiktok);
  for (const raw of (org.socials ?? "").split(/[,\s]+/)) {
    if (/facebook\.com|fb\.com/i.test(raw)) add("facebook", raw);
    else if (/instagram\.com/i.test(raw)) add("instagram", raw);
    else if (/(twitter|x)\.com/i.test(raw)) add("x", raw);
    else if (/tiktok\.com/i.test(raw)) add("tiktok", raw);
  }
  return [...found].map(([network, url]) => ({ network, label: labels[network], url }));
}

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------

/**
 * schema.org Event JSON-LD — one Event per upcoming date for a repeating
 * event (Google's guidance for events on several dates), or one for a
 * single event. Times carry the real UK offset. Price goes in `offers`
 * when known.
 */
export function eventJsonLd(event: WPScEvent, imageUrl: string | null, now = Date.now()) {
  const upcoming = upcomingOccurrences(event, now);
  const dates = upcoming.length > 0 ? upcoming : getOccurrences(event).slice(-1);
  const org = event.sc_event_organizer_profile;
  const price = offerPrice(event);
  const booking = getBooking(event);
  const pageUrl = `${SITE_URL}/events/${event.slug}`;
  const orgUrl = org?.url && !looksLikeEmail(org.url) ? org.url : undefined;

  const base = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: stripHtml(event.title.rendered),
    description: stripHtml(event.content.rendered).slice(0, 300) || undefined,
    url: pageUrl,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: event.meta.sc_venue_name
      ? { "@type": "Place", name: event.meta.sc_venue_name, address: event.meta.sc_venue_address || undefined }
      : undefined,
    organizer: org
      ? { "@type": "Organization", name: org.name, url: orgUrl }
      : event.meta.sc_organizer
      ? { "@type": "Organization", name: event.meta.sc_organizer }
      : undefined,
    image: imageUrl ? [imageUrl] : undefined,
    offers:
      price !== null
        ? {
            "@type": "Offer",
            price,
            priceCurrency: "GBP",
            url: booking.kind === "link" ? booking.url : pageUrl,
            availability: "https://schema.org/InStock",
          }
        : undefined,
  };

  return dates.map((o) => ({
    ...base,
    startDate: ukIso(o.start),
    endDate: o.end ? ukIso(o.end) : undefined,
  }));
}
