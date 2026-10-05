"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Same active-link treatment as PrimaryNav, scaled down for the utility bar's smaller text — bold + a thin underline on whichever of About/Advertise you're currently on. No ActiveNavSection override needed here (unlike PrimaryNav): these are flat standalone pages, not sections with their own sub-content living at other URLs. */
export function UtilityNav({ items }: { items: Array<{ label: string; href: string }> }) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) =>
        item.href.startsWith("http") ? (
          <a key={item.label} href={item.href}>
            {item.label}
          </a>
        ) : (
          <Link key={item.label} href={item.href} className={pathname.startsWith(item.href) ? "active" : undefined}>
            {item.label}
          </Link>
        )
      )}
    </>
  );
}
