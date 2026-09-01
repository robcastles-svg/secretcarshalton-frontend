"use client";

import Link from "next/link";
import { useState } from "react";
import type { WPCategory, WPTag } from "@/lib/wordpress";

/** Sorted by place by default, with a toggle to sort by theme instead — per Rob's spec. Just a link-tile switch, not a page navigation, so it stays instant. */
export function DiscoverBrowseTiles({ areas, themes }: { areas: WPCategory[]; themes: WPTag[] }) {
  const [mode, setMode] = useState<"area" | "theme">("area");

  return (
    <section className="discover-browse">
      <div className="discover-browse-toggle">
        <button type="button" className={mode === "area" ? "active" : undefined} onClick={() => setMode("area")}>
          By area
        </button>
        <button type="button" className={mode === "theme" ? "active" : undefined} onClick={() => setMode("theme")}>
          By theme
        </button>
      </div>

      <ul className="link-list">
        {mode === "area"
          ? areas.map((area) => (
              <li key={area.id}>
                <Link href={`/stories/${area.slug}`}>{area.name}</Link>
              </li>
            ))
          : themes.map((theme) => (
              <li key={theme.id}>
                <Link href={`/themes/${theme.slug}`}>{theme.name}</Link>
              </li>
            ))}
      </ul>
    </section>
  );
}
