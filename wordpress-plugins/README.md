# Secret Carshalton — custom WordPress plugins (Track 2)

Source of truth for the custom plugin suite that replaces the current
third-party stack (Sabai Directory, GamiPress, and eventually the EventON
data model) with plugins that share one login, one member record, and one
set of hooks — instead of five plugins that don't know about each other.

## Why this exists / deploy model

This sandbox can only reach the outside world over HTTPS (port 443) — raw
SSH/TCP is blocked by the environment's egress policy, which rules out
SiteGround's native Git-deploy feature (it's SSH-only). So the deploy model
is:

1. Plugin PHP lives here, in git, on the frontend repo — real version
   history, real diffs, real PRs.
2. Deploys happen by building a zip from a given folder and pushing it
   through the WordPress admin session over HTTPS (Plugins → Add New →
   Upload), scripted the same way the staging-site exploration in this
   session was done. Slower than `git push`, but it's the mechanism that
   actually works from here.
3. Staging (`staging19.secretcarshalton.com`) is always the deploy target
   until Rob reviews and asks for it to go live.

If SiteGround's Git feature turns out to support an HTTPS remote (not
confirmed yet), that would be a straightforward upgrade to step 2 later.

## Plugins

| Plugin | Status | Purpose |
|---|---|---|
| `sc-membership` | live on staging | Central member record: points, tiers, directory-upgrade approval queue, plus a bearer-token auth bridge (`/login`, `/register`) so the Next.js frontend can log members in without a second auth system — same `wp_users` table, same passwords. |
| `sc-directory` | live on staging, real data migrated | Replaces Sabai Directory. Schema modeled on the real data scraped from staging (see below) — same shape, clean REST-first implementation via a plain CPT. 118 of the 136 real Sabai listings imported (the rest were pending/draft/trashed in the original and weren't migrated); all unclaimed until Rob supplies real owner emails (task pending). |
| `sc-events` | live on staging, real data migrated | Replaces the EventON data layer. Real REST fields (start/end/venue) instead of scraping schema.org JSON-LD out of HTML, which is what the frontend used to do (and what caused two of this session's build failures). All 257 real events migrated from EventON's live data; the frontend now reads from sc-events end to end — see app/events/, app/page.tsx, lib/wordpress.ts's getScEvents/getUpcomingScEvents. |
| `sc-ads` | live on staging | Admin-manageable ad slots (billboard/leaderboard/sidebar/in-article) — a plain labelled form (image, link, alt text, placement, active toggle, date range), no code editing needed to change a creative. Replaces the hardcoded Billboard/Leaderboard image URLs that were in `app/layout.tsx`.

## Frontend wiring (Next.js side)

- `/login`, `/register`, `/dashboard` — call `app/api/auth/*` routes, which
  proxy server-to-server to `sc-membership`'s bearer-token endpoints and
  hold the token in an httpOnly cookie. The token never reaches client JS,
  and CORS isn't a factor since it's never called directly from the browser.
- `/directory`, `/directory/[slug]` — read `sc-directory` via
  `lib/wordpress.ts`'s `getDirectoryListings*` functions.
- `/events`, `/events/[slug]`, and the homepage's Events strip — read
  `sc-events` via `getScEvents`/`getUpcomingScEvents`/`getScEventBySlug`.
- `app/layout.tsx`'s Billboard/Leaderboard slots read `sc-ads` via `getAd()`.
- All of the above point at `WP_STAGING_ROOT` (`staging19.secretcarshalton.com`)
  in `lib/wordpress.ts`, not the live site — these plugins aren't deployed
  to production yet. Swap that constant once they are.

## Real data model this is based on (scraped from staging, 2026-08-21)

**Sabai Directory** — 136 listings (121 published / 8 pending / 7 draft / 3
trashed). Categories: B2B, Trades, House and Home, Fitness, Families, Pets,
Everything else, Places to go, Places to stay, Groups to join, Venues for
hire, Spotlight upgrade. Per-listing: title, category, structured address
(street/town/region/postcode/country), website, description, map +
directions, social share, "member since [date] (N views)", reviews
(via Site Reviews plugin). Claim states: Unclaimed / Claimed / Claim
expiring (7d/30d) / Claim expired. Feature states: Featured/Unfeatured,
Flagged/Unflagged. Plans seen: FREE, £1/month (likely more not yet
enumerated).

**GamiPress** — installed but *not configured* (confirmed empty on
`points-type`/`achievement-type`/`rank-type`, Rob confirmed he doesn't use
it for ranking currently). No existing tier/badge data to migrate — the
membership tier system in `sc-membership` is a clean design, not a port.

**Payments** — Rob currently runs membership manually via a PayPal
subscription (WP Express Checkout plugin is installed). `sc-membership`
tracks approval state; it does not (yet) touch payment collection —
that stays manual/PayPal for now per Rob's existing process.

## Contract between plugins (so they "talk to each other cleanly")

`sc-membership` exposes:
- `sc_membership_award_points( $user_id, $points, $reason, $source )` —
  any plugin calls this to award points (comments, event RSVPs, directory
  actions all just call this one function).
- Action `sc_membership_tier_changed( $user_id, $old_tier, $new_tier )` —
  fired when points cross a tier threshold, for badge display / emails.
- REST `GET /wp-json/sc-membership/v1/me` — current member's tier/points/
  directory-upgrade status, for the Next.js frontend to render a member
  dashboard.

`sc-directory` fires `sc_directory_listing_claimed` and
`sc_directory_upgrade_requested` (with a `listing_id`); `sc-membership`
listens for those (see `class-sc-membership-hooks.php`) and stores which
listing an upgrade request is for, so the admin approval queue shows it.
On approval, `sc-membership` fires `sc_membership_upgrade_reviewed`, and
`sc-directory` listens for *that* to actually flip the listing's plan/
featured meta — neither plugin needs to know the other's internal fields,
just the three action names between them.

`sc-events` fires `sc_events_rsvp` on RSVP; `sc-membership` has listened
for it since before `sc-events` existed (5 points per RSVP).

## Lessons from building this (read before adding a new CPT-based plugin)

Two real outages happened while building `sc-directory`, both worth not
repeating:

1. **`register_post_type()`/`register_taxonomy()` must only ever run on
   `init`, never `plugins_loaded`.** Our deploy path re-uploads a new
   version over an already-active plugin, which never re-fires
   `register_activation_hook` — so anything that needs to run once per
   version bump (seeding taxonomy terms, etc.) needs its own version-check
   that runs on `init`, calling a narrow function (just the seeding, not
   full `register()` again) — not on `plugins_loaded`. Getting this wrong
   took the entire staging site down twice, including wp-admin.
2. **New CPTs need `'custom-fields'` in their `supports` array**, or
   `register_post_meta()` fields silently never appear in (or save via)
   the REST `meta` object, even though nothing errors. Hit this twice —
   once on `sc-directory`, then again on `sc-ads` right after, because the
   lesson wasn't carried forward the first time. Include it from the start.

Also: always rebuild and verify a plugin's zip (`unzip -p file.zip
path/to/file.php | grep ...`) immediately before uploading — a stale zip
from before a source fix looks identical to a correct one until it's live.
