import type { ReactNode } from "react";
import type { WPAd } from "@/lib/wordpress";

/**
 * A blue-outlined "in-feed" ad — a paid placement mixed directly into a
 * story/listing grid (News, Directory, Discover, etc.), same card footprint
 * as the posts/listings around it. Blue marks it as external/paid, the same
 * way .directory-card-featured's pink marks an internal featured listing —
 * matches the PDF wireframe's colour-coding.
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

/**
 * Inserts an AdCard after every Nth card in an already-rendered list of
 * cards — operating on the rendered elements rather than the underlying
 * data means one helper works for News/Directory/Discover/etc. regardless
 * of whether the grid is posts, listings, or (on Discover) a mix of both.
 * A null ad (nothing active for this placement) is a silent no-op, same
 * as every other ad slot on the site.
 */
export function withInterleavedAd(cards: ReactNode[], ad: WPAd | null, every: number): ReactNode[] {
  if (!ad) return cards;
  const result: ReactNode[] = [];
  cards.forEach((card, i) => {
    result.push(card);
    if ((i + 1) % every === 0) {
      result.push(<AdCard key={`ad-card-${i}`} ad={ad} />);
    }
  });
  return result;
}
