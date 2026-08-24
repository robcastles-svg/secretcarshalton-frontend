"use client";

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
          <Link key={item.label} href={item.href} className={isActive ? "active" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
