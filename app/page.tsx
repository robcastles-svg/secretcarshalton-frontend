import Link from "next/link";
import { ContentList } from "@/app/_components/ContentList";
import {
  getCategoryBySlug,
  getEventSchema,
  getEvents,
  getFeaturedImage,
  getLatestComments,
  getLatestPostInCategories,
  getMostReadPosts,
  getPosts,
  getCategories,
  mapWithConcurrency,
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
  const [recentPosts, walksCategory, allCategories, events] = await Promise.all([
    getPosts(20),
    getCategoryBySlug("walks"),
    getCategories(),
    getEvents(4),
  ]);

  const [hero, ...cardPosts] = recentPosts.slice(0, 4);

  const walkChildIds = walksCategory
    ? allCategories.filter((c) => c.parent === walksCategory.id).map((c) => c.id)
    : [];
  const [latestWalk, comments, eventSchemas, mostRead] = await Promise.all([
    getLatestPostInCategories(walkChildIds),
    getLatestComments(3),
    mapWithConcurrency(events, 4, (event) => getEventSchema(event.slug).catch(() => null)),
    getMostReadPosts(recentPosts, 10),
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
              {events.map((event, i) => {
                const image = getFeaturedImage(event);
                const schema = eventSchemas[i];
                const startDate = parseEventDate(schema?.startDate);
                const venue = schema?.location?.[0];
                return (
                  <li key={event.id}>
                    <Link href={`/events/${event.slug}`}>
                      {image && <img src={image.source_url} alt={image.alt_text} />}
                      <div>
                        <span dangerouslySetInnerHTML={{ __html: event.title.rendered }} />
                        {startDate && (
                          <time dateTime={startDate.toISOString()}>
                            {startDate.toLocaleString("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                            {venue?.name ? ` — ${venue.name}` : ""}
                          </time>
                        )}
                      </div>
                    </Link>
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
                <Link href={`/${latestWalk.slug}`} className="feature-row">
                  {image && <img src={image.source_url} alt={image.alt_text} />}
                  <div>
                    <span dangerouslySetInnerHTML={{ __html: latestWalk.title.rendered }} />
                    <p>{stripHtml(latestWalk.excerpt.rendered)}</p>
                  </div>
                </Link>
              </section>
            );
          })()}

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

        {mostRead.length > 0 && (
          <section className="home-section">
            <h2>🔥 Most read</h2>
            <ol className="most-read-list">
              {mostRead.map((post) => (
                <li key={post.id}>
                  <Link href={`/${post.slug}`}
                    dangerouslySetInnerHTML={{ __html: post.title.rendered }}
                  />
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </main>
  );
}
