import Link from "next/link";
import type { WPAd } from "@/lib/wordpress";
import { AdCard } from "./AdCard";

/**
 * The sidebar ad column — one rotating blue card per active ad passed in.
 * Every page fetches the single "sidebar" pool 3 times (getAd("sidebar", 1
 * | 2 | 3) — the slot number just keeps the three fetches from being
 * treated as one duplicate request, see getAd's own comment), so up to 3
 * different advertisers can show at once instead of the same one or two
 * repeating; "in_feed" used to be a separate pool stacked in here too, but
 * it rendered identically to "sidebar" (no real product difference) and
 * has been retired — see AD_SELF_SERVE_PLACEMENTS in lib/wordpress.ts.
 * Deduped by id since a small pool can independently roll the same ad
 * into more than one slot — shown once, not stacked twice. Falls back to
 * a plain "Advertise here" link when nothing's active, same as AdSlot
 * always did, so the sidebar never just looks broken/empty.
 */
export function SidebarAds({ ads }: { ads: (WPAd | null)[] }) {
  const seen = new Set<number>();
  const active = ads.filter((ad): ad is WPAd => {
    if (!ad || seen.has(ad.id)) return false;
    seen.add(ad.id);
    return true;
  });

  if (active.length === 0) {
    return (
      <Link href="/advertise" className="sidebar-ad-placeholder">
        Advertise here
      </Link>
    );
  }

  return (
    <ul className="post-list">
      {active.map((ad) => (
        <AdCard key={ad.id} ad={ad} />
      ))}
    </ul>
  );
}
