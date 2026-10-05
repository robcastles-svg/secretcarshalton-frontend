"use client";

import Link from "next/link";
import { useState } from "react";

export interface MostReadItem {
  slug: string;
  title: string;
  imageUrl?: string;
  imageAlt?: string;
}

const COLLAPSED_COUNT = 5;

/** Homepage's "Most read this week" list — rows 1-5 shown by default, "See all 10" expands the rest in place rather than navigating anywhere. */
export function MostReadList({ items }: { items: MostReadItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, COLLAPSED_COUNT);

  return (
    <div className="most-read">
      <div className="most-read-heading">Most read this week</div>
      <ol className="most-read-rows">
        {visible.map((item, i) => (
          <li key={item.slug}>
            <Link href={`/${item.slug}`}>
              <span className="most-read-rank">{i + 1}</span>
              <span className="most-read-thumb">
                {item.imageUrl && <img src={item.imageUrl} alt={item.imageAlt ?? ""} loading="lazy" />}
              </span>
              <span className="most-read-title">{item.title}</span>
            </Link>
          </li>
        ))}
      </ol>
      {items.length > COLLAPSED_COUNT && (
        <button type="button" className="most-read-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less ↑" : `See all ${items.length} ↓`}
        </button>
      )}
    </div>
  );
}
