const PLACEHOLDER_HEADLINE = "Your headline will appear here";
const PLACEHOLDER_BODY = "A short line about your offer or business";

/**
 * A flat, Canva-style landscape placeholder (hills + sun) shown in the
 * image slot until a real one's uploaded — so the card never looks broken
 * or empty at first load, before anyone's touched the form.
 */
function PlaceholderImage() {
  return (
    <svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true" className="ad-preview-placeholder-image">
      <rect width="52" height="52" rx="6" fill="#dce9f7" />
      <circle cx="36" cy="15" r="6" fill="#ffcf5c" />
      <path d="M0 42 L13 27 L23 37 L33 23 L52 42 Z" fill="#2f6fb3" />
      <path d="M0 47 L11 39 L21 47 Z" fill="#1f4f80" />
    </svg>
  );
}

/**
 * Mirrors AdCard.tsx's exact markup/classes (minus the link and impression
 * tracking — there's no real ad yet) so what someone sees here while
 * writing their ad is pixel-identical to what actually shows once it's
 * live, not just an approximation. Wrapped in the same .post-list grid
 * AdCard normally sits inside, so it inherits the same card
 * background/border-radius/shadow rather than needing them duplicated.
 *
 * Falls back to a holding image/headline/body for whichever fields are
 * still empty, rather than rendering a mostly-blank card — easier to see
 * what an ad's actually going to look like before you've written one.
 *
 * .ad-preview-list is a fixed (not viewport-relative) width matching the
 * real desktop sidebar column it'll end up in, so what you see while
 * filling the form on a phone isn't a wider, stretched-out version of the
 * real thing.
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
        <div className="ad-card-row">
          {imageUrl ? <img src={imageUrl} alt="" /> : <PlaceholderImage />}
          <div className="card-text">
            <span className="ad-card-badge">Advertisement</span>
            <span className={headline ? "card-title" : "card-title ad-preview-placeholder"}>
              {headline || PLACEHOLDER_HEADLINE}
            </span>
            <p className={body ? "ad-card-body" : "ad-card-body ad-preview-placeholder"}>
              {body || PLACEHOLDER_BODY}
            </p>
          </div>
        </div>
      </li>
    </ul>
  );
}
