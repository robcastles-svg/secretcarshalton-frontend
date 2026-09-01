import type { WPAd } from "@/lib/wordpress";

/**
 * A blue-outlined ad card in the sidebar — the external/paid counterpart to
 * .directory-card-featured's pink (an internal featured listing shown in the
 * body of the card grid), matching the PDF wireframe's colour-coding: only
 * featured content/listings appear in pink in the body, ads stay blue in
 * the sidebar.
 */
export function AdCard({ ad }: { ad: WPAd }) {
  return (
    <li className="ad-card-external">
      <a href={`/api/ads/click/${ad.id}`} target="_blank" rel="noopener sponsored">
        {ad.image && <img src={ad.image} alt={ad.alt} loading="lazy" />}
        <div className="card-text">
          <span className="ad-card-badge">Advertisement</span>
          {ad.headline && <span className="card-title">{ad.headline}</span>}
        </div>
      </a>
      {ad.body && <p>{ad.body}</p>}
    </li>
  );
}
