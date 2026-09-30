/**
 * Mirrors AdCard.tsx's exact markup/classes (minus the link and impression
 * tracking — there's no real ad yet) so what someone sees here while
 * writing their ad is pixel-identical to what actually shows once it's
 * live, not just an approximation. Wrapped in the same .post-list grid
 * AdCard normally sits inside, so it inherits the same card
 * background/border-radius/shadow rather than needing them duplicated.
 */
export function AdPreview({
  headline,
  body,
  imageUrl,
}: {
  headline: string;
  body: string;
  imageUrl: string | null;
}) {
  return (
    <ul className="post-list ad-preview-list">
      <li className="ad-card-external">
        {imageUrl && <img src={imageUrl} alt="" />}
        <div className="card-text">
          <span className="ad-card-badge">Advertisement</span>
          {headline && <span className="card-title">{headline}</span>}
        </div>
        {body && <p className="ad-card-body">{body}</p>}
      </li>
    </ul>
  );
}
