"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveNavSectionOverride } from "./ActiveNavSection";

export type TileNavItem = {
  label: string;
  href: string;
  /** Section label SetActiveNavSection reports for flat-URL posts (see navSectionForCategories). */
  section: string;
  icon: React.ReactNode;
  /** Other URL prefixes that should light this tile too (e.g. the /whats-on-in-* pages for Events). */
  extraActivePrefixes?: string[];
};

/**
 * Full-width pink icon-tile bar under the header (Rob's mockup). The
 * active check mirrors the old text nav's, so a tile stays lit on its section
 * landing page, any sub-page under it, and on flat-URL posts via the
 * ActiveNavSection override.
 */
export function TileNav({ items }: { items: TileNavItem[] }) {
  const pathname = usePathname();
  const override = useActiveNavSectionOverride();

  return (
    <nav className="tile-nav" aria-label="Sections">
      <ul>
        {items.map((item) => {
          const isActive =
            override !== null
              ? override === item.section
              : [item.href, ...(item.extraActivePrefixes ?? [])].some((p) => pathname.startsWith(p));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={isActive ? "active" : undefined}
                aria-current={isActive ? "page" : undefined}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
