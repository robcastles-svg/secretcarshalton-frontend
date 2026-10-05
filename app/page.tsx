import Link from "next/link";
import { CategoryKeyIcon } from "@/app/_components/CategoryKeyIcon";
import { ContentList } from "@/app/_components/ContentList";
import { HomeComments, type HomeCommentItem } from "@/app/_components/home/HomeComments";
import { HomeFeaturedEvent } from "@/app/_components/home/HomeFeaturedEvent";
import { MostReadList, type MostReadItem } from "@/app/_components/home/MostReadList";
import { ReelsSlider } from "@/app/_components/home/ReelsSlider";
import { SponsorStrip } from "@/app/_components/home/SponsorStrip";
import { getSessionToken } from "@/lib/auth";
import {
  categoryHref,
  getCategories,
  getCategoryBySlug,
  getDirectoryCategories,
  getDirectoryListings,
  getFeaturedImage,
  getFeaturedImagesForPosts,
  getJobListings,
  getLatestComments,
  getLatestPostsInCategories,
  getMembersByIds,
  getPosts,
  getTags,
  getTopPostsThisWeek,
  getUpcomingScEvents,
  GROUPS_CATEGORY_SLUG,
  parseEventDate,
  stripHtml,
} from "@/lib/wordpress";

export const revalidate = 3600;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Mirrors app/community/page.tsx's own stand-in — the real "Community"
// category doesn't have editorial content yet, so Community's pool for
// lead-story purposes is the same Stories > Carshalton Village posts
// /community itself currently shows. Swap this back once Rob's created
// a real Community category (see that file's own docblock).
const COMMUNITY_STAND_IN_SLUG = "carshalton-village";

// The walk-distance "find a walk by time" chips — from-carshalton is the
// one walks category that isn't phrased "N minutes by car" (it's the
// no-car-needed option), which is what the design's "On foot" chip maps
// to; there's no literal "on foot" category in WordPress.
const WALK_TIME_CHIPS = [
  { slug: "from-carshalton", label: "On foot" },
  { slug: "10-minutes-by-car", label: "10" },
  { slug: "20-minutes-by-car", label: "20" },
  { slug: "30-minutes-by-car", label: "30" },
  { slug: "40-minutes-by-car", label: "40+" },
];

// Placeholder tiles so the sponsor strip itself is visible per the design
// handoff — swap for real premium-member logo uploads once that form field
// exists (see SponsorStrip's own docblock). No logoUrl, so each tile falls
// back to showing its name as text.
const DUMMY_SPONSORS = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  name: "Your logo here",
  href: "/directory/featured",
}));

// Placeholder reels so the slider itself is visible per the design handoff
// — the Instagram feed plugin on staging has no public REST API to pull
// real reels from yet (see ReelsSlider's own docblock); swap these for the
// real feed once that bridge exists.
const DUMMY_REELS = Array.from({ length: 9 }, (_, i) => ({
  id: `dummy-${i + 1}`,
  thumbnailUrl: `https://picsum.photos/seed/screel${i + 1}/360/640`,
  videoUrl: "https://www.instagram.com/secret.carshalton/",
}));

export default async function HomePage() {
  const [
    recentPosts,
    allCategories,
    allTags,
    newsCategory,
    storiesParent,
    walksCategory,
    directoryCategories,
    directoryListings,
    jobListings,
    topThisWeek,
    rawComments,
    events,
    sessionToken,
  ] = await Promise.all([
    getPosts(24).catch(() => []),
    getCategories().catch(() => []),
    getTags().catch(() => []),
    getCategoryBySlug("news").catch(() => null),
    getCategoryBySlug("stories").catch(() => null),
    getCategoryBySlug("walks").catch(() => null),
    getDirectoryCategories().catch(() => []),
    getDirectoryListings(30).catch(() => []),
    getJobListings(30).catch(() => []),
    getTopPostsThisWeek(10).catch(() => []),
    getLatestComments(3).catch(() => []),
    getUpcomingScEvents(20).catch(() => []),
    getSessionToken(),
  ]);

  const categoriesById = new Map(allCategories.map((c) => [c.id, c]));
  const tagsById = new Map(allTags.map((t) => [t.id, t]));

  const areas = storiesParent ? allCategories.filter((c) => c.parent === storiesParent.id && c.count > 0) : [];
  const communityStandIn = allCategories.find((c) => c.slug === COMMUNITY_STAND_IN_SLUG);
  const walkChildCategories = walksCategory ? allCategories.filter((c) => c.parent === walksCategory.id) : [];

  // Lead: one story picked from News, Discover (the Stories areas), Walks
  // or Community — the newest post across that combined pool, not just
  // the newest post site-wide (which would also catch Business Spotlight).
  const leadCategoryIds = new Set<number>([
    ...(newsCategory ? [newsCategory.id] : []),
    ...areas.map((a) => a.id),
    ...(walksCategory ? [walksCategory.id] : []),
    ...walkChildCategories.map((c) => c.id),
    ...(communityStandIn ? [communityStandIn.id] : []),
  ]);
  const lead = recentPosts.find((p) => p.categories?.some((id) => leadCategoryIds.has(id))) ?? recentPosts[0];

  if (!lead) {
    return (
      <main className="container">
        <h1>Latest</h1>
        <p>No posts found.</p>
      </main>
    );
  }

  const leadImage = getFeaturedImage(lead);
  const leadCategory = lead.categories?.map((id) => categoriesById.get(id)).find(Boolean);

  // More latest: the 4 newest posts from any category, excluding the lead.
  const moreLatest = recentPosts.filter((p) => p.id !== lead.id).slice(0, 4);

  // Most read this week — sc-post-views gives post_id/slug/title/views,
  // no image, so the 60px thumbnails are a separate batched lookup
  // straight against the posts themselves (see getFeaturedImagesForPosts).
  const mostReadImages = await getFeaturedImagesForPosts(topThisWeek.map((p) => p.post_id));
  const mostReadItems: MostReadItem[] = topThisWeek.map((p) => ({
    slug: p.slug,
    title: p.title,
    imageUrl: mostReadImages.get(p.post_id)?.source_url,
    imageAlt: mostReadImages.get(p.post_id)?.alt_text,
  }));

  // Walks: the latest walk, falling back to the 2nd-latest if the latest
  // is already today's lead story.
  const walkCandidates = walksCategory
    ? await getLatestPostsInCategories(
        [walksCategory.id, ...walkChildCategories.map((c) => c.id)],
        2
      ).catch(() => [])
    : [];
  const latestWalk = walkCandidates.find((w) => w.id !== lead.id) ?? walkCandidates[0] ?? null;
  const latestWalkImage = latestWalk ? getFeaturedImage(latestWalk) : null;
  const latestWalkDistance = latestWalk
    ? walkChildCategories.find((c) => latestWalk.categories?.includes(c.id) && c.slug !== "from-carshalton")
    : undefined;

  // Events: a paid-upgrade "featured" event takes the hero slot over
  // whatever's chronologically soonest, same rule /events itself uses.
  const featuredEvent = events.find((e) => e.meta.sc_event_featured) ?? events[0] ?? null;
  const featuredEventStart = featuredEvent ? parseEventDate(featuredEvent.meta.sc_start) : null;
  const comingUpEvents = events.filter((e) => e.id !== featuredEvent?.id).slice(0, 4);

  // Directory: Groups to join lives on /community now, not the Directory
  // (see GROUPS_CATEGORY_SLUG's own docblock) — excluded here same as
  // everywhere else Directory listings are browsed.
  const groupsCategory = directoryCategories.find((c) => c.slug === GROUPS_CATEGORY_SLUG);
  const eligibleListings = directoryListings.filter(
    (l) => !groupsCategory || !l.sc_listing_category?.includes(groupsCategory.id)
  );
  const featuredListings = eligibleListings.filter((l) => l.meta.sc_featured);
  // "Rotates on each page load" per the design, within the limits of
  // ISR caching — this re-rolls once per revalidate window (currently
  // hourly), same caveat DirectoryBrowse's own "reshuffled hourly"
  // random sort already documents, not a true per-visit shuffle.
  const spotlightListing =
    featuredListings.length > 0 ? featuredListings[Math.floor(Math.random() * featuredListings.length)] : null;
  const latestListings = eligibleListings.filter((l) => l.id !== spotlightListing?.id).slice(0, 3);
  const listingCategoriesById = new Map(directoryCategories.map((c) => [c.id, c]));

  // Jobs: an optional featured job — when none is set the slot just
  // doesn't render (see JSX below), the list doesn't need to "move up",
  // it's already a plain list either way.
  const featuredJob = jobListings.find((j) => j.meta.featured) ?? null;
  const latestJobs = jobListings.filter((j) => j.id !== featuredJob?.id).slice(0, 3);

  // Comments: resolve each commenter's public profile (for the member-bio
  // link) the same way CommentSectionAsync does, via a batch id lookup.
  const commenterProfiles = await getMembersByIds(rawComments.map((c) => c.author ?? 0)).catch(
    () => new Map<number, { slug: string; name: string; avatar: string; joinedAt: string }>()
  );
  const comments: HomeCommentItem[] = rawComments.map((c) => {
    const profile = c.author ? commenterProfiles.get(c.author) : undefined;
    const postPath = c.link ? new URL(c.link).pathname : `/${c.postSlug}`;
    return {
      id: c.id,
      text: stripHtml(c.content.rendered),
      commentLink: postPath,
      authorName: profile?.name ?? c.author_name,
      authorSlug: profile?.slug,
      articleSlug: c.postSlug,
      articleTitle: stripHtml(c.postTitle),
    };
  });

  return (
    <main>
      <SponsorStrip sponsors={DUMMY_SPONSORS} />

      <div className="container home-top-grid">
        <Link href={`/${lead.slug}`} className="home-lead">
          {leadImage && (
            <div className="home-lead-image">
              <img src={leadImage.source_url} alt={leadImage.alt_text} />
            </div>
          )}
          <div className="home-lead-kicker">
            <span>Latest</span>
            <CategoryKeyIcon />
          </div>
          {leadCategory && <div className="home-lead-meta">{leadCategory.name}</div>}
          <h1 dangerouslySetInnerHTML={{ __html: lead.title.rendered }} />
          <p>{stripHtml(lead.excerpt.rendered)}</p>
          <time className="home-lead-date" dateTime={lead.date}>
            {formatDate(lead.date)}
          </time>
        </Link>

        {/* Rendered twice — here (desktop sidebar) and again below More
            Latest (mobile/tablet) — rather than one instance reordered
            with CSS, since "move past an entire other section" isn't
            something a single flex/grid `order` can do once More Latest
            is a separate full-width band in between. Each copy keeps its
            own expand/collapse state; CSS shows only one at a time per
            breakpoint, see .most-read-desktop-slot/.most-read-mobile-slot. */}
        {mostReadItems.length > 0 && (
          <div className="most-read-desktop-slot">
            <MostReadList items={mostReadItems} />
          </div>
        )}
      </div>

      {moreLatest.length > 0 && (
        <div className="more-latest-band">
          <div className="container">
            <div className="home-section-header">
              <h2>
                More latest
                <CategoryKeyIcon />
              </h2>
              <div className="more-latest-links">
                <Link href="/news">More News →</Link>
                <Link href="/discover">More Discover →</Link>
                <Link href="/walks">More Walks →</Link>
                <Link href="/community">More Community →</Link>
              </div>
            </div>
            <ContentList
              items={moreLatest}
              categoriesById={categoriesById}
              tagsById={tagsById}
              className="post-list-four-column"
            />
          </div>
        </div>
      )}

      {mostReadItems.length > 0 && (
        <div className="container most-read-mobile-slot">
          <MostReadList items={mostReadItems} />
        </div>
      )}

      {featuredEvent && featuredEventStart && (
        <div className="home-events-band">
          <div className="container">
            <div className="home-section-header">
              <h2>
                Events
                <CategoryKeyIcon />
              </h2>
              <div className="more-latest-links">
                <Link href="/events/submit">Add event</Link>
                <Link href="/events">All events →</Link>
              </div>
            </div>
            <div className="home-events-grid">
              <HomeFeaturedEvent
                title={featuredEvent.title.rendered}
                slug={featuredEvent.slug}
                startDate={featuredEventStart}
                venueName={featuredEvent.meta.sc_venue_name}
                image={getFeaturedImage(featuredEvent)}
                imageAlt={stripHtml(featuredEvent.title.rendered)}
              />
              {comingUpEvents.length > 0 && (
                <div className="coming-up-list">
                  <h3>Coming up</h3>
                  <ul>
                    {comingUpEvents.map((event) => {
                      const start = parseEventDate(event.meta.sc_start);
                      return (
                        <li key={event.id}>
                          <Link href={`/events/${event.slug}`}>
                            {start && (
                              <div className="event-card-date-badge">
                                <span className="event-card-date-badge-weekday">
                                  {start.toLocaleString("en-GB", { weekday: "short" }).toUpperCase()}
                                </span>
                                <span className="event-card-date-badge-day">{start.getDate()}</span>
                                <span className="event-card-date-badge-month">
                                  {start.toLocaleString("en-GB", { month: "short" }).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <span>
                              <span
                                className="coming-up-list-title"
                                dangerouslySetInnerHTML={{ __html: event.title.rendered }}
                              />
                              {start && (
                                <span className="coming-up-list-meta">
                                  {start.toLocaleString("en-GB", { weekday: "long" })}
                                  {event.meta.sc_venue_name ? ` · ${event.meta.sc_venue_name}` : ""}
                                </span>
                              )}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {latestWalk && (
        <div className="container">
          <section className="home-section">
            <div className="home-section-header">
              <h2>
                Walks
                <CategoryKeyIcon />
              </h2>
              <Link href="/walks">All walks →</Link>
            </div>
            <Link href={`/${latestWalk.slug}`} className="home-walk">
              <div className="home-walk-image">
                {latestWalkImage && <img src={latestWalkImage.source_url} alt={latestWalkImage.alt_text} />}
              </div>
              <div>
                <span className="home-walk-label">
                  Latest walk{latestWalkDistance ? ` · ${latestWalkDistance.name}` : ""}
                </span>
                <h3 dangerouslySetInnerHTML={{ __html: latestWalk.title.rendered }} />
                <p>{stripHtml(latestWalk.excerpt.rendered)}</p>
              </div>
            </Link>
            <div className="walk-time-heading">Find a walk by time from Carshalton</div>
            <div className="walk-time-chips">
              {WALK_TIME_CHIPS.map((chip) => (
                <Link key={chip.slug} href={`/walks?filter=${chip.slug}`}>
                  {chip.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}

      {(spotlightListing || latestListings.length > 0 || featuredJob || latestJobs.length > 0) && (
        <div className="home-dir-jobs-band">
          <div className="container home-dir-jobs-grid">
            <div className="home-dir-jobs-col">
              <div className="home-section-header">
                <h2>
                  Directory
                  <CategoryKeyIcon />
                </h2>
                <div className="more-latest-links">
                  <Link href="/directory/submit">Get listed</Link>
                  <Link href="/directory">Browse →</Link>
                </div>
              </div>

              {spotlightListing &&
                (() => {
                  const image = getFeaturedImage(spotlightListing);
                  const category = spotlightListing.sc_listing_category
                    ?.map((id) => listingCategoriesById.get(id))
                    .find(Boolean);
                  return (
                    <Link href={`/directory/${spotlightListing.slug}`} className="home-featured-pink">
                      {image && <img src={image.source_url} alt={image.alt_text} />}
                      <span className="directory-badge">Featured</span>
                      <div className="home-featured-pink-body">
                        {category && <span className="home-featured-kicker">{category.name}</span>}
                        <strong dangerouslySetInnerHTML={{ __html: spotlightListing.title.rendered }} />
                        {spotlightListing.meta.sc_tagline && (
                          <span className="home-featured-sub">{spotlightListing.meta.sc_tagline}</span>
                        )}
                      </div>
                    </Link>
                  );
                })()}

              {latestListings.length > 0 && (
                <>
                  <div className="walk-time-heading">Latest listings</div>
                  <ul className="home-latest-rows">
                    {latestListings.map((listing) => {
                      const category = listing.sc_listing_category?.map((id) => listingCategoriesById.get(id)).find(Boolean);
                      return (
                        <li key={listing.id}>
                          <Link href={`/directory/${listing.slug}`}>
                            <span dangerouslySetInnerHTML={{ __html: listing.title.rendered }} />
                            {category && <span className="home-latest-row-right">{category.name}</span>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>

            <div className="home-dir-jobs-col">
              <div className="home-section-header">
                <h2>
                  Latest jobs
                  <CategoryKeyIcon />
                </h2>
                <div className="more-latest-links">
                  <Link href="/jobs/manager">Post a job</Link>
                  <Link href="/jobs">All jobs →</Link>
                </div>
              </div>

              {featuredJob && (
                <Link href={`/jobs/${featuredJob.slug}`} className="home-featured-pink">
                  <span className="directory-badge">Featured</span>
                  <div className="home-featured-pink-body">
                    <span className="home-featured-kicker">Featured job</span>
                    <strong dangerouslySetInnerHTML={{ __html: featuredJob.title.rendered }} />
                    {featuredJob.meta.job_company && (
                      <span className="home-featured-sub">{featuredJob.meta.job_company}</span>
                    )}
                  </div>
                </Link>
              )}

              {latestJobs.length > 0 && (
                <>
                  <div className="walk-time-heading">More jobs</div>
                  <ul className="home-latest-rows">
                    {latestJobs.map((job) => {
                      const ageDays = Math.max(
                        0,
                        Math.floor((Date.now() - new Date(job.date).getTime()) / 86_400_000)
                      );
                      return (
                        <li key={job.id} className="home-latest-rows-meta">
                          <Link href={`/jobs/${job.slug}`}>
                            <strong dangerouslySetInnerHTML={{ __html: job.title.rendered }} />
                          </Link>
                          <span>
                            {[job.meta.job_company, job.meta.job_salary_text].filter(Boolean).join(" · ")}
                            <br />
                            {ageDays === 0 ? "Today" : ageDays === 1 ? "1 day ago" : `${ageDays} days ago`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {comments.length > 0 && (
        <div className="container">
          <section className="home-section">
            <div className="home-section-header">
              <h2>Latest comments</h2>
            </div>
            <HomeComments comments={comments} isLoggedIn={Boolean(sessionToken)} />
          </section>
        </div>
      )}

      <div className="container">
        <section className="home-section">
          <div className="home-section-header">
            <h2>Reels &amp; photos</h2>
            <a href="https://www.instagram.com/secret.carshalton" target="_blank" rel="noopener noreferrer">
              @secret.carshalton →
            </a>
          </div>
          <ReelsSlider items={DUMMY_REELS} />
        </section>
      </div>
    </main>
  );
}
