import Link from "next/link";
import { ContentList } from "@/app/_components/ContentList";
import { DirectoryListingCard } from "@/app/_components/DirectoryListingCard";
import { EventImage } from "@/app/_components/EventImage";
import { eventTopicsFor, EventTopics } from "@/app/_components/EventTopics";
import {
  getCategoryBySlug,
  getDirectoryListings,
  getFeaturedImage,
  getLatestComments,
  getLatestPostInCategories,
  getPosts,
  getCategories,
  getScEventTags,
  getTopPostsThisWeek,
  getUpcomingScEvents,
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

export default async function HomePage() {
  // A single failed WordPress fetch used to be able to take the whole
  // homepage down with it (see ac88a2b's commit message — this exact
  // Promise.all crashed a build with no fallback anywhere in the chain).
  // Every branch below already renders fine with an empty/null result
  // (the "no posts" state, conditionally-rendered sections), so catching
  // here just lets that existing degrade-gracefully behavior actually work.
  const [recentPosts, walksCategory, allCategories, events, eventTags, directoryListings] = await Promise.all([
    getPosts(20).catch(() => []),
    getCategoryBySlug("walks").catch(() => null),
    getCategories().catch(() => []),
    getUpcomingScEvents(4).catch(() => []),
    getScEventTags().catch(() => []),
    getDirectoryListings(10).catch(() => []),
  ]);

  // One spotlight (the most recent featured/paid listing, if any) shown on
  // its own above the grid, then the 3 latest listings otherwise — not
  // re-showing the spotlighted one there too.
  const spotlightListing = directoryListings.find((l) => l.meta.sc_featured);
  const latestListings = directoryListings.filter((l) => l.id !== spotlightListing?.id).slice(0, 3);

  const [hero, ...cardPosts] = recentPosts.slice(0, 4);

  const walkChildIds = walksCategory
    ? allCategories.filter((c) => c.parent === walksCategory.id).map((c) => c.id)
    : [];
  const [latestWalk, comments, topThisWeek] = await Promise.all([
    getLatestPostInCategories(walkChildIds).catch(() => null),
    getLatestComments(3).catch(() => []),
    getTopPostsThisWeek(10).catch(() => []),
  ]);

  if (!hero) {
    return (
      <main className="container">
        <h1>Latest</h1>
        <p>No posts found.</p>
      </main>
    );
  }

  const heroImage = getFeaturedImage(hero);

  return (
    <main>
      <div className="container">
        <section className="hero">
          <Link href={`/${hero.slug}`} className="hero-text">
            <span className="hero-eyebrow">Latest</span>
            <h1 dangerouslySetInnerHTML={{ __html: hero.title.rendered }} />
            <p>{stripHtml(hero.excerpt.rendered)}</p>
            <time dateTime={hero.date}>{formatDate(hero.date)}</time>
            <span className="button-pill hero-readmore">Read more</span>
          </Link>
          {heroImage && (
            <Link href={`/${hero.slug}`} className="hero-image">
              <img src={heroImage.source_url} alt={heroImage.alt_text} />
            </Link>
          )}
        </section>

        <ContentList items={cardPosts} />
      </div>

      <div className="newsletter-cta">
        <div className="container newsletter-cta-inner">
          <span>Get the Secret Carshalton newsletter in your inbox</span>
          <Link href="/newsletter" className="button-pill">
            Subscribe
          </Link>
        </div>
      </div>

      <div className="container">
        {events.length > 0 && (
          <section className="home-section">
            <div className="home-section-header">
              <h2>Events</h2>
              <Link href="/events">All events</Link>
            </div>
            <ul className="event-row-list">
              {events.map((event) => {
                const image = getFeaturedImage(event);
                const startDate = parseEventDate(event.meta.sc_start);
                const topics = eventTopicsFor(eventTags, event.sc_event_tag);
                return (
                  <li key={event.id}>
                    <Link href={`/events/${event.slug}`}>
                      <EventImage image={image} alt={stripHtml(event.title.rendered)} />
                      <div className="event-card-heading">
                        {startDate && (
                          <div className="event-card-date-badge">
                            <span className="event-card-date-badge-weekday">
                              {startDate.toLocaleString("en-GB", { weekday: "short" }).toUpperCase()}
                            </span>
                            <span className="event-card-date-badge-day">{startDate.getDate()}</span>
                            <span className="event-card-date-badge-month">
                              {startDate.toLocaleString("en-GB", { month: "short" }).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="card-title" dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
                      </div>
                    </Link>
                    <EventTopics topics={topics} className="event-row-topics" />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {latestWalk &&
          (() => {
            const image = getFeaturedImage(latestWalk);
            return (
              <section className="home-section">
                <div className="home-section-header">
                  <h2>Walks</h2>
                  <Link href="/walks">All walks</Link>
                </div>
                <div className="hero hero-secondary">
                  <Link href={`/${latestWalk.slug}`} className="hero-text">
                    <h3 dangerouslySetInnerHTML={{ __html: latestWalk.title.rendered }} />
                    <p>{stripHtml(latestWalk.excerpt.rendered)}</p>
                    <span className="button-pill hero-readmore">Read more</span>
                  </Link>
                  {image && (
                    <Link href={`/${latestWalk.slug}`} className="hero-image">
                      <img src={image.source_url} alt={image.alt_text} loading="lazy" />
                    </Link>
                  )}
                </div>
              </section>
            );
          })()}

        {(spotlightListing || latestListings.length > 0) && (
          <section className="home-section">
            <div className="home-section-header">
              <h2>Directory</h2>
              <Link href="/directory">Browse the directory</Link>
            </div>

            {spotlightListing &&
              (() => {
                const image = getFeaturedImage(spotlightListing);
                return (
                  <Link href={`/directory/${spotlightListing.slug}`} className="feature-row directory-spotlight">
                    {image && <img src={image.source_url} alt={image.alt_text} loading="lazy" />}
                    <div>
                      <span className="directory-badge">Featured</span>
                      <span dangerouslySetInnerHTML={{ __html: spotlightListing.title.rendered }} />
                      <p>{stripHtml(spotlightListing.content.rendered).slice(0, 140)}</p>
                    </div>
                  </Link>
                );
              })()}

            {latestListings.length > 0 && (
              <ul className="post-list directory-list">
                {latestListings.map((listing) => (
                  <DirectoryListingCard key={listing.id} listing={listing} />
                ))}
              </ul>
            )}
          </section>
        )}

        {comments.length > 0 && (
          <section className="home-section">
            <h2>Your latest comments</h2>
            <ul className="comment-list">
              {comments.map((comment) => (
                <li key={comment.id}>
                  <Link href={`/${comment.postSlug}`}>
                    <strong>{comment.author_name}</strong>
                    <span> @ {stripHtml(comment.postTitle)}</span>
                  </Link>
                  <p>{stripHtml(comment.content.rendered)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {topThisWeek.length > 0 && (
          <section className="home-section">
            <h2>Top 10 stories this week</h2>
            <ol className="most-read-list">
              {topThisWeek.map((post) => (
                <li key={post.post_id}>
                  <Link href={`/${post.slug}`}>{post.title}</Link>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </main>
  );
}
