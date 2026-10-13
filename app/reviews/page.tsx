import { StarRatingDisplay } from "@/app/_components/StarRatingDisplay";
import { GUESTBOOK_REVIEWS } from "@/lib/guestbook-reviews";

export const metadata = {
  title: "Reviews — Secret Carshalton",
  description: "What people say about Secret Carshalton, and how to leave us a Google review.",
  alternates: { canonical: "/reviews" },
};

const GOOGLE_REVIEW_URL = "https://g.page/r/CRzNaDJZeYudEBM/review";

/** Replaces the old WordPress reviews page (Site Reviews guestbook shortcode, 7 a page). */
export default function ReviewsPage() {
  return (
    <main className="container reviews-page">
      <h1>Reviews</h1>
      <div className="reviews-intro">
        <p>We&apos;d love to know what you think of Secret Carshalton. Please share a Google review.</p>
        <a className="button-pill button-pill-active reviews-google" href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer">
          Leave a Google review
        </a>
      </div>

      <h2 className="reviews-sub">From our guestbook</h2>
      <p className="reviews-thanks">Thank you to everyone who left a review on our old online guestbook.</p>
      <div className="reviews-grid">
        {GUESTBOOK_REVIEWS.map((r) => (
          <figure className="review-card" key={`${r.author}-${r.title}`}>
            <h3>{r.title}</h3>
            <StarRatingDisplay rating={r.rating} />
            <blockquote>
              {r.text.map((t, i) => (
                <p key={i}>{t}</p>
              ))}
            </blockquote>
            <figcaption>
              <strong>{r.author}</strong>
              <time dateTime={r.date}>
                {new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </time>
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
