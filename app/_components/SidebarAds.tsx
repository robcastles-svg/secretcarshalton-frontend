import Link from "next/link";
import type { WPAd } from "@/lib/wordpress";
import { AdCard } from "./AdCard";

/**
 * The sidebar ad column — one rotating blue card per active ad passed in.
 * Every page now passes a single "sidebar" ad; "in_feed" used to be a
 * second, separate pool stacked in here too, but it rendered identically
 * to "sidebar" (no real product difference) and has been retired — see
 * AD_SELF_SERVE_PLACEMENTS in lib/wordpress.ts. Falls back to a plain
 * "Advertise here" link when nothing's active, same as AdSlot always did,
 * so the sidebar never just looks broken/empty.
 */
export function SidebarAds({ ads }: { ads: (WPAd | null)[] }) {
  const active = ads.filter((ad): ad is WPAd => Boolean(ad));

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
