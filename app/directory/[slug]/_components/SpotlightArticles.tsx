import Link from "next/link";
import type { SpotlightArticle } from "@/lib/wordpress";

/**
 * Every listing page has this section (Rob, 2026-10). With articles: a
 * card for each. Without: a quiet line pointing at Featured Gold (which
 * includes a written article) and a link to the Spotlight
 * articles that already exist — the same ⭐️ Business Spotlights
 * lozenge as on the directory homepage.
 */
export function SpotlightArticles({ articles, editHref }: { articles: SpotlightArticle[]; editHref?: string }) {
  return (
    <section className="listing-spotlight" aria-labelledby="listing-spotlight-title">
      <div className="listing-spotlight-head">
        <h2 id="listing-spotlight-title">Spotlight articles by this business</h2>
        {/* Editors only (Rob): jump to the picker on the edit page. */}
        {editHref && (
          <Link href={editHref} className="listing-spotlight-edit">
            Edit spotlight articles
          </Link>
        )}
      </div>
      {articles.length > 0 ? (
        <ul className="listing-spotlight-list">
          {articles.map((a) => (
            <li key={a.slug}>
              <Link href={`/${a.slug}`} className="listing-spotlight-card">
                {a.image ? (
                  <img src={a.image.source_url} alt="" loading="lazy" />
                ) : (
                  <span className="listing-spotlight-noimg" aria-hidden="true" />
                )}
                <span className="listing-spotlight-text">
                  <strong dangerouslySetInnerHTML={{ __html: a.title }} />
                  <time dateTime={a.date}>
                    {new Date(a.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="listing-spotlight-empty">
          <p>
            No spotlight article yet.{" "}
            <Link href="/advertise#featured-gold">Get one with Featured Gold →</Link>
          </p>
          {/* Same lozenge as the directory homepage's link (Rob, 2026-10). */}
          <Link href="/spotlight" className="directory-spotlight-link">
            ⭐️ Business Spotlights
          </Link>
        </div>
      )}
    </section>
  );
}
