/**
 * Member messages and the notification bell — the frontend half of
 * sc-membership's SC_Membership_Messages (see that class for how
 * audiences, read state and the batched email work). Safe to import
 * from client components: no server-only code in here.
 */

export interface MemberMessage {
  id: number;
  title: string;
  body: string;
  button_text: string;
  /** "/events/submit" (on this site) or a full https:// link. */
  button_url: string;
  pinned: boolean;
  dismissible: boolean;
  start: string;
  end: string;
  date: string;
  /** Only on the member's own feed. */
  seen?: boolean;
  /** Closed by the member: shown collapsed, can be opened again. */
  dismissed?: boolean;
}

/** Something that happened to the member: a reply, a review, an approval, a reminder… */
export interface ActivityItem {
  id: number;
  type: "reply" | "review" | "comment" | "live" | "approved" | "featured" | "tier" | "ending" | "info" | "todo" | "new" | "signup" | string;
  text: string;
  /** A path on this site, e.g. "/events/autumn-fair#comments". */
  link: string;
  date: string;
  seen: boolean;
}

/** One line of the staff-only "To approve" box, e.g. { label: "3 comments", link: wp-admin… }. */
export interface PendingItem {
  label: string;
  count: number;
  link: string;
}

export interface Notifications {
  unread: number;
  messages: MemberMessage[];
  activity?: ActivityItem[];
  /** Administrators/editors only: what's waiting for approval right now. */
  pending?: PendingItem[];
}

/** "12 minutes ago", "Yesterday", "3 Oct". */
export function timeAgo(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.max(0, Math.round((now - then) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export type AudienceKey =
  | "all"
  | "event_organisers"
  | "listing_owners"
  | "premium_listings"
  | "advertisers"
  | "job_posters"
  | "community_groups";

export const AUDIENCES: Array<{ key: AudienceKey; label: string }> = [
  { key: "all", label: "All members" },
  { key: "event_organisers", label: "Event organisers" },
  { key: "listing_owners", label: "Listing owners" },
  { key: "premium_listings", label: "Premium listings" },
  { key: "advertisers", label: "Advertisers" },
  { key: "job_posters", label: "Job posters" },
  { key: "community_groups", label: "Community groups" },
];

export interface AdminMessage extends Omit<MemberMessage, "seen" | "dismissed"> {
  status: "publish" | "draft";
  state: "live" | "scheduled" | "ended" | "draft";
  audiences: AudienceKey[];
  reach: number;
  seen: number;
  dismissed: number;
  clicked: number;
  email: boolean;
  email_subject: string;
  email_status: "" | "sending" | "done" | "stopped";
  email_total: number;
  email_sent: number;
  email_failed: number;
  modified: string;
}

/** A relative "/events/submit" stays on this site; anything else is a full link. */
export function isExternalLink(url: string): boolean {
  return /^https?:\/\//i.test(url) && !/^https?:\/\/(www\.)?secretcarshalton\.com/i.test(url);
}

/**
 * Which plugin routes the browser may reach through /api/notify/…, and
 * with which methods. Everything else 404s, so the proxy can't be used
 * to call other parts of the membership API.
 */
const PROXY_ROUTES: Array<{ pattern: RegExp; methods: Array<"GET" | "POST">; auth: boolean }> = [
  { pattern: /^notifications$/, methods: ["GET"], auth: true },
  { pattern: /^notifications\/seen$/, methods: ["POST"], auth: true },
  { pattern: /^notifications\/\d+\/(dismiss|restore|click)$/, methods: ["POST"], auth: true },
  { pattern: /^email-preferences$/, methods: ["GET", "POST"], auth: true },
  { pattern: /^email-unsubscribe$/, methods: ["GET", "POST"], auth: false },
  { pattern: /^messages$/, methods: ["GET", "POST"], auth: true },
  { pattern: /^messages\/\d+$/, methods: ["GET", "POST"], auth: true },
  { pattern: /^messages\/\d+\/end$/, methods: ["POST"], auth: true },
  { pattern: /^messages\/test-email$/, methods: ["POST"], auth: true },
  { pattern: /^messages\/reach$/, methods: ["GET"], auth: true },
  { pattern: /^messages\/settings$/, methods: ["GET", "POST"], auth: true },
];

export function proxyRoute(path: string, method: string) {
  const route = PROXY_ROUTES.find((r) => r.pattern.test(path));
  if (!route || !route.methods.includes(method as "GET" | "POST")) return null;
  return route;
}
