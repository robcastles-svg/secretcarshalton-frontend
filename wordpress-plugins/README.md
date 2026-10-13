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
| `sc-ads` | live on staging | Admin-manageable ad slots (billboard/leaderboard/sidebar/in-article) — a plain labelled form (image, link, alt text, placement, active toggle, date range), no code editing needed to change a creative. Replaces the hardcoded Billboard/Leaderboard image URLs that were in `app/layout.tsx`. Also owns the site's PayPal setup (one sandbox/live switch under Ads → PayPal Settings), used by text ads, featured events (`sc-events`) and the £1.50 walk-map downloads (`SC_Ads_Map_Sales` — prices and PDFs still come from the WP Express Checkout products).
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

## Payments (Oct 2026)

Everything paid for goes live as soon as PayPal confirms the payment, Rob
gets an email per payment, and **Payments** in wp-admin lists every one
with **Refund** (through PayPal; also stops a yearly subscription) and
**Unpublish** buttons. All of it runs through sc-ads' PayPal settings, so
the sandbox/live switch is in one place.

- `SC_Ads_Payments` (sc-ads): the ledger, the shared checkout
  (`sc-ads/v1/pay/{kind}/{id}/create-order|capture`), yearly subscriptions
  (`sc-ads/v1/subscribe/{kind}/{id}` + `/confirm`, checked daily for
  renewals/cancellations/failures) and the Payments screen. Other plugins
  add products through the `sc_payments_products` filter.
- Products: `job` (sc-jobs, 7 days by pay band), `featured` (one-off,
  1 or 6 months, renewal reminder a week before), `group_promotion`
  (£10/30 days) and `standard_listing` (£2.50/year PayPal subscription,
  unpublished 30 days after a lapsed year) in sc-directory's
  `SC_Directory_Payments`; ads, featured events and walk maps keep their
  own checkout routes but are recorded in the same ledger.
- Listings Featured before this have no `sc_featured_until` and are
  never expired or charged (grandfathered, as above).

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
  its own copies, so edits made there since need re-syncing. Also still
  to reconcile: 4 other newer comments on live, 1 article only on
  staging (abandoned pub), and 2 articles edited differently on each
  site. Re-diff by slug right before the push; `getStagingPostIdBySlug`
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
- [ ] **Listing added on live after the clone:** "Professional Children's
  football coaching" (30 Aug 2026) isn't on staging. Its owner isn't shown
  on the public page; check it in Sabai's admin.
- [ ] **Events added or changed on live since the last check.** Checked
  in full on 13 Oct 2026: all 273 live EventON events compared with
  staging. Fixed then: the 32 repeating events got their missing dates
  (EventON only shows the first date on an event's page, so the original
  migration lost the rest), 6 missing events imported, 3 wrong dates
  corrected, 5 event comments copied, 23 missing photos brought over.
  Re-run the same comparison just before go-live (scripts and method in
  that session: live event pages' `data-time`/`ri-N` repeat links vs
  staging `sc_start`/`sc_repeat_dates`, plus live `ajde_events` comments).
- [ ] **Directory listing edits on live since the last check.** All 122
  listings were compared with live on 13 Oct 2026 (description, phone,
  email); only Lambert Heating had changed, and was updated. Re-run just
  before go-live, and copy any edits across.
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
- [ ] **Old plugins off, then deleted, before the push** (Rob, Oct 2026).
  Scan of every post and page (12 Oct 2026) sorted the ~75 plugins:
  - *Keep* — the sc-* plugins, Yoast SEO, YOP Poll (/polls), WP Express
    Checkout (walk-map products), Classic Editor, Site Reviews (/reviews),
    Easy Social Feed (homepage reels, via sc-membership's
    /instagram-feed), Vision (the coat-of-arms article), SiteGround
    Speed Optimizer (purges the server cache on content changes).
  - *Off now* (replaced, or the old theme only): Sabai ×4, EventON ×2,
    AdRotate, GamiPress, BuddyPress and its add-ons (sc-membership 0.23.4
    keeps bans without it), Youzify ×2, Profile Builder, Theme My Login
    ×2, WP ULike, WP Popular Posts, Decent Comments, wpDiscuz, Mailchimp
    for WP, Site Kit, Fluent Snippets (old-theme CSS/PHP only), and the
    old-theme extras (snow, weather, back-to-top, prettyPhoto, carousel,
    Ditty, AOS, the Elementor filter/post-kit widgets, Smart Recent
    Posts, Black Studio TinyMCE, Sassy Social Share, Show Current
    Template, featured-image toggles, Remove Category URL, WP Select
    Primary Category, WP Simple Adsense, WP Rollback).
  - *Off once the frontend replacements are merged:* SiteOrigin Widgets +
    Elementor (About/Welcome/Privacy now in `lib/static-pages.ts`, Donate
    is `app/donate`), Contact Form 7 + WP Armour (`app/contact`),
    HTML5 Video Player (`lib/html5-video.ts`), Featured Image from URL
    (one article's stock image — Rob is replacing it).
  - Switch off in batches and check the site; delete a week later.
  - **Done on staging19, 13 Oct 2026:** the 50 switched-off plugins' files
    were removed (Rob's backup copy: staging21.staging19). Only the
    folders went — a temporary admin-only tool deleted them without
    running each plugin's uninstall routine, so their database tables and
    options are untouched (Sabai's reviews included). 19 plugins remain,
    all active. Don't use WordPress's own Delete button for the rest
    later: it runs uninstall routines, which can wipe data.
  - Old pages built with SiteOrigin/Elementor that nobody visits will
    break once those are off — unpublish them.
- [ ] **Keep a copy of the old site** (Rob, 13 Oct 2026). On switch day,
  right after freezing the old site and before the push, create a
  SiteGround staging copy of the live install (e.g. "oldsite") — the old
  site exactly as it was, to look things up in or switch back to. Delete
  staging21 first to make room (each copy is ~65K inodes).
- [ ] **Media URLs after `www` moves to Vercel.** Article, page and
  Instagram images and videos are stored with
  `https://www.secretcarshalton.com/wp-content/...` URLs. Once `www` is
  the new site those paths must still resolve — add a Vercel rewrite of
  `/wp-content/:path*` to the CMS hostname (or search-replace the URLs to
  it) as part of the switch.
- [ ] **Two articles' videos are gone for good:** "Student nurses at St
  Helier Hospital in 1943…" and "Bringing old Carshalton photos back to
  life…" use an old `[video id=…]` shortcode whose files were deleted
  long ago (they show nothing on the old site either). Rob to re-upload
  or remove the mentions.

## After going live

Things Rob has asked to do once the new site is live — remind him.

- [ ] **"Edit in WordPress" button for admins** (Rob, 13 Oct 2026). On
  articles, events, listings, jobs, groups and pages: a small button,
  shown only when logged in as an admin, opening that item's
  `wp-admin/post.php?post=ID&action=edit` on cms.secretcarshalton.com.
  Pages are cached copies, so add it client-side after a session check,
  never in the server-rendered HTML. On events and listings show it
  alongside the existing frontend "Edit" form. Rob needs to be logged in
  to wp-admin too (separate login); WordPress sends him there first if not.
- [ ] **Back up the new setup** (Rob, 13 Oct 2026). Once go-live checks
  out, create a SiteGround staging copy of the cms install as a backup —
  so there are two staging copies: the old site and the new CMS. The
  frontend code is already in GitHub, and Vercel keeps every earlier
  deployment for an instant rollback. staging19 can be deleted after.
- [ ] **Delete staging21.staging19.secretcarshalton.com** — Rob's backup
  copy from before the 13 Oct plugin clean-up (~65K inodes). Safe once a
  few days have passed with nothing missing; staging19's SiteGround daily
  backups (kept 30 days) cover the same.

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
