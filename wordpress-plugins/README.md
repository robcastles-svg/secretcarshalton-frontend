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
| `sc-membership` | in progress | Central member record: points, tiers, directory-upgrade approval queue. Everything else hooks into this rather than keeping its own copy of "who's a member." |
| `sc-directory` | not started | Replaces Sabai Directory. Schema modeled on the real data scraped from staging (see below) — same shape, clean REST-first implementation. |
| `sc-events` | not started | Replaces the EventON data layer. Same public shape the frontend already expects (`getEvents`/`getEventSchema` in `lib/wordpress.ts`), but with real REST fields (start/end/venue) instead of scraping schema.org JSON-LD out of HTML, which is what the frontend currently has to do because EventON doesn't expose it.

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

`sc-directory` (when built) will fire `sc_directory_listing_claimed` and
`sc_directory_upgrade_requested`; `sc-membership` already listens for
those action names (see `class-sc-membership-hooks.php`) so the approval
queue works the moment the directory plugin starts firing them — no
changes needed on the membership side.
