"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * About/Advertise links with an active-page state (bold + pink underline).
 * Rendered twice by layout.tsx: beside the logo on desktop (styled by
 * .primary-nav) and in the utility bar on mobile (styled by .utility-bar).
 * No ActiveNavSection override needed: these are flat standalone pages,
 * not sections with their own sub-content living at other URLs.
 *
 * `extraActivePaths` covers About specifically: it should stay
 * highlighted across the whole About mini-nav cluster (About Carshalton,
 * Latest comments, Live poll), not just its own /about-secret-carshalton
 * URL — see AboutMiniNav's ABOUT_PAGE_SLUGS, passed in from layout.tsx.
 */
export function UtilityNav({
  items,
}: {
  items: Array<{ label: string; href: string; extraActivePaths?: readonly string[] }>;
}) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) =>
        item.href.startsWith("http") ? (
          <a key={item.label} href={item.href}>
            {item.label}
          </a>
        ) : (
          <Link
            key={item.label}
            href={item.href}
            className={
              pathname.startsWith(item.href) || item.extraActivePaths?.some((p) => pathname.startsWith(p))
                ? "active"
                : undefined
            }
          >
            {item.label}
          </Link>
        )
      )}
    </>
  );
}
