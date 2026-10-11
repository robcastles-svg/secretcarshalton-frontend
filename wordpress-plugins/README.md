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
| `sc-revalidate` | live on staging | Tells the frontend to refresh its hourly-cached pages the moment content changes (publish/update/unpublish/delete, approved comments, term edits) — calls `/api/revalidate` with `{ all: true }` once per request, non-blocking. Settings → Site refresh holds the frontend URL and the shared secret (Vercel env `REVALIDATE_SECRET`). Blog posts are read from the **live** WordPress, so it needs installing there too before new posts refresh instantly. |

## Directory listings: legacy vs new plans (Rob, 2026-10)

- **Listings from before the new pricing are grandfathered.** They stay on
  the yearly subscription they originally signed up to (paid by hand via
  PayPal on the old site) — nothing should expire, charge or remove them
  for not being on a new plan.
- **Non-Featured listings display as Standard** (headline, category,
  address, website). Their photos, description, socials etc. stay saved
  on the listing and reappear if it goes Featured again — see
  `app/directory/[slug]/page.tsx`.
- `sc_plan` records whether a listing is paid; `sc_featured_tier` is only
  set for the new packages, so a legacy paid Featured listing has
  `sc_plan = paid` with an empty tier (e.g. Lambert Heating & Renewables).
  Carshalton Camera Club is Featured for free on purpose (positioning).
- **New listings** use the new plans on `/advertise` / `lib/pricing.ts`
  (Standard £2.50/year, Featured packages).

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

## Before going live

- [ ] **Admin access to wp-admin after the domain switch.** Right now
  `www.secretcarshalton.com` points straight at this WordPress hosting, so
  `/wp-admin` just works. Once that domain gets repointed to the Next.js
  app (Vercel) so it becomes the live site, `/wp-admin` on that domain
  stops resolving to WordPress at all — WordPress hasn't moved, the
  domain just no longer reaches it, so Rob would otherwise be locked out
  of the CMS. Needs a DNS record (added by Rob/whoever manages the
  domain, not doable from this sandbox) giving WordPress a stable,
  separate hostname before the domain switch happens — either keep using
  `staging19.secretcarshalton.com` permanently, or set up a dedicated one
  like `cms.secretcarshalton.com`, both pointed at this same hosting.
  The dashboard's Editorial panel already has a "WordPress admin" button
  (`WP_ADMIN_URL` in `lib/wordpress.ts`, derived from `WP_STAGING_ROOT`)
  that'll follow automatically once that constant is repointed at
  go-live — but the DNS side still needs doing first.
- [ ] **One CMS, not two.** Live (`www.secretcarshalton.com`) and staging
  (`staging19`) are separate databases that don't sync. The frontend
  reads articles, pages and the "latest comments" box from live, and
  everything else (events, directory, jobs, members, article comments,
  view counts, bookmarks, ads) from staging. They've drifted since
  staging was cloned. The plan:
  1. Bring staging up to date with live (next item).
  2. SiteGround "Push to Live" to copy staging over the live install.
     Confirm it pushes the whole database, not just files, and freeze
     publishing on live between step 1 and the push, or it gets
     overwritten.
  3. Give that install a CMS hostname (e.g. `cms.secretcarshalton.com`).
     Renaming the staging copy in SiteGround only changes its label, not
     its URL. Repoint `WP_BASE` and `WP_STAGING_ROOT` in
     `lib/wordpress.ts` at it, then switch `www` to Vercel. Staging19
     goes back to being a test copy.
- [ ] **Up-to-date articles and comments.** As of Oct 2026, live had 4
  articles staging didn't. On 11 Oct 2026 they were re-created on staging
  under new IDs (live → staging: 41261 → 43199 tree measurement, 41327 →
  43201 Bongs on the High Street, 41344 → 43204 Islands in the Stream,
  41434 → 43206 History sleuth), with their featured and inline images
  uploaded to staging and the tree article's 2 comments. Live still has
  its own copies, so edits made there since need re-syncing. Also on
  11 Oct: the 4 other newer live comments (1 on the fire-walking article,
  3 on the Dave Barry Quartet and Day of Dance 2026 events) were copied
  with their original authors and dates; the 2 articles edited on both
  sites were reconciled (only a tag and a category had changed on live);
  and the "Community" category, created on live after the clone, was
  added on staging (ID 1163 there, 815 on live). The abandoned-pub
  article exists only on staging, which is fine since staging becomes the
  CMS. Re-diff by slug right before the push; `getStagingPostIdBySlug`
  in `lib/wordpress.ts` explains why articles must be re-created on
  staging (new IDs) rather than copied with their live IDs.
- [ ] **Ownerships.** Directory listings were imported unclaimed (see the
  sc-directory row above); assign real owners. Check event organiser
  ownership too, now that most member-written events are linked to an
  organiser.
- [ ] **Directory listing start dates** (when each listing began). The
  import set 51 listings' dates to the import day (21 Aug 2026). 49 were
  reset on staging (11 Oct 2026) to the "Member since" date on their old
  Sabai page on live. Still open:
  - Red Onion Design (41279) and Dog Walker / Pet Sitter (42052) have no
    live page. Dog Walker was added on staging on 24 Aug 2026, so its
    date may be right; Red Onion's needs supplying.
  - 1st Wallington Scouts (41283, staging 4 Jan 2022, live 28 Mar 2025)
    and Logo Fiasco Records (41394, staging 30 Sep 2024, live 8 Nov 2025)
    disagree with live and need checking by hand.
- [ ] **Members who joined live since the clone.** Live and staging have
  assigned the same user IDs (4394+) to different people, so members can't
  be copied with their IDs. Only active ones are copied (reviewers so far:
  Morgan and nicky23, created on staging 11 Oct 2026 by
  `tools/sync_live_reviews.py`). They get a random password and use
  "forgot password" after go-live. As of 11 Oct, 19 other live-only
  sign-ups had done nothing (several look like spam) and aren't copied.
  Before the push, delete staging's test accounts (`claudetest…`,
  `sc-smoke-test`).
- [ ] **Directory reviews.** Sabai reviews were never migrated. Run
  `python3 wordpress-plugins/tools/sync_live_reviews.py --apply` (needs
  sc-membership 0.23.3+): it copies each live review with its stars and
  owner replies, creates missing reviewers, and skips anything already
  copied. First run 11 Oct 2026 copied 7 reviews and 2 replies. Re-run
  just before go-live, then pause sign-ups and reviews on the old site
  until the switch.
- [x] **Listing added on live after the clone:** "Professional Children's
  football coaching" (30 Aug 2026) was created on staging on 11 Oct 2026
  (listing 43223, owner KooraAca, user 4246). Its 238 live views aren't in
  `listing-baselines.json` yet; add it when that file is regenerated for
  go-live.
- [ ] **Correct view counts.**
  - *Listings:* staging only had views since the import. sc-post-views
    0.5.0 seeds each listing's old Sabai total from
    `sc-post-views/data/listing-baselines.json` (118 listings, matched by
    title) and removes the article views misfiled against listings 41344
    and 41434 (see `remove_misfiled_article_views()`). The old site keeps
    counting until the switch, so regenerate the file and bump
    `SC_POST_VIEWS_LISTING_SEED` just before go-live to bring the totals
    up to date.
  - *Articles:* the 4 re-created articles get their live Post Views
    Counter totals from `sc-post-views/data/article-baselines.json`
    (sc-post-views 0.5.1). Like the listings, regenerate it and bump
    `SC_POST_VIEWS_ARTICLE_SEED` just before go-live.

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
