/** Read-only 1-5 stars: a single review's rating, or a listing's average (rounded to whole stars for the fill, exact in the label). */
export function StarRatingDisplay({ rating, className }: { rating: number; className?: string }) {
  const filled = Math.round(rating);
  return (
    <span
      className={`star-rating-display${className ? ` ${className}` : ""}`}
      aria-label={`Rated ${Number(rating.toFixed(1))} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= filled ? "star-filled" : "star-empty"} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}
