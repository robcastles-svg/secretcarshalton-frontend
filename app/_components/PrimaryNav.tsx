"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveNavSectionOverride } from "./ActiveNavSection";

/**
 * Underlines the current section, matching the reference screenshots'
 * nav treatment. Individual articles live at a flat /{slug} URL (not
 * nested under /news/, /stories/, etc.), so pathname alone can't tell
 * which section they belong to — the post page sets that via
 * SetActiveNavSection (ActiveNavSection.tsx), read here as `override`.
 */
export function PrimaryNav({ items }: { items: Array<{ label: string; href: string }> }) {
  const pathname = usePathname();
  const override = useActiveNavSectionOverride();

  return (
    <>
      {items.map((item) => {
        const isActive =
          override !== null ? override === item.label : item.href !== "/" && pathname.startsWith(item.href);
        return (
          <Fragment key={item.label}>
            <Link href={item.href} className={isActive ? "active" : undefined}>
              {item.label}
            </Link>
            {/* Forces the same wrap point on every page at narrow widths —
                without it, flex-wrap breaks wherever the row runs out of
                room, which shifts depending on which link is currently
                bold (the active one), making the nav a different width
                from page to page. Only takes effect below 720px; see
                .nav-line-break in globals.css. */}
            {item.label === "Walks" && <span className="nav-line-break" aria-hidden="true" />}
          </Fragment>
        );
      })}
    </>
  );
}
