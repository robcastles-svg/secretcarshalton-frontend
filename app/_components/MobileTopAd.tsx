import type { WPAd } from "@/lib/wordpress";
import { AdCard } from "./AdCard";

/**
 * One rotating blue ad at the very top of a category page, mobile-only
 * (see .mobile-top-ad in globals.css) — on narrow screens the sidebar
 * this ad would otherwise only live in commonly sits below the main
 * content, so a visitor who never scrolls that far would never see it.
 */
export function MobileTopAd({ ad }: { ad: WPAd | null }) {
  if (!ad) return null;
  return (
    <div className="mobile-top-ad">
      <ul className="post-list">
        <AdCard ad={ad} />
      </ul>
    </div>
  );
}
