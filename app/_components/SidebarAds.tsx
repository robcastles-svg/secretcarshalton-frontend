import Link from "next/link";
import type { WPAd } from "@/lib/wordpress";
import { AdCard } from "./AdCard";

/**
 * The sidebar ad column, as many stacked blue cards as there are active
 * ads across the placements passed in (News/Events/Directory show two —
 * "in_feed" and "sidebar" — Discover shows just "in_feed", matching how
 * many ad blocks the PDF wireframe draws per page). Falls back to a plain
 * "Advertise here" link when nothing's active, same as AdSlot always did,
 * so the sidebar never just looks broken/empty.
 */
export function SidebarAds({ ads }: { ads: (WPAd | null)[] }) {
  const active = ads.filter((ad): ad is WPAd => Boolean(ad));

  if (active.length === 0) {
    return (
      <Link href="/advertising-contact" className="sidebar-ad-placeholder">
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
