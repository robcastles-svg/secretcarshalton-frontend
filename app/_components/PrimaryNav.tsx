"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Underlines the current section, matching the reference screenshots'
 * nav treatment. Individual articles live at a flat /{slug} URL (not
 * nested under /news/, /stories/, etc.), so this only lights up on the
 * section/listing pages themselves — an article's category doesn't
 * currently propagate up to the nav.
 */
export function PrimaryNav({ items }: { items: Array<{ label: string; href: string }> }) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const isActive = item.href !== "/" && pathname.startsWith(item.href);
        return (
          <Link key={item.label} href={item.href} className={isActive ? "active" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
