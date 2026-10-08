"use client";

import Link from "next/link";
import { useState } from "react";

export interface MostReadItem {
  slug: string;
  title: string;
  imageUrl?: string;
  imageAlt?: string;
  excerpt?: string;
}

const COLLAPSED_COUNT = 5;

/**
 * Homepage's "Most read this week" list. Mobile: rows 1-5 shown by
 * default, "See all 10" expands the rest in place. Desktop: all 10 always
 * shown in two columns of five, toggle hidden — every row is rendered and
 * CSS (.most-read-extra / .most-read-expanded) decides what's visible.
 */
export function MostReadList({ items }: { items: MostReadItem[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`most-read${expanded ? " most-read-expanded" : ""}`}>
      <div className="most-read-heading">Most read this week</div>
      <ol className="most-read-rows">
        {items.map((item, i) => (
          <li key={item.slug} className={i >= COLLAPSED_COUNT ? "most-read-extra" : undefined}>
            <Link href={`/${item.slug}`}>
              <span className="most-read-rank">{i + 1}</span>
              <span className="most-read-thumb">
                {item.imageUrl && <img src={item.imageUrl} alt={item.imageAlt ?? ""} loading="lazy" />}
              </span>
              <span className="most-read-text">
                <span className="most-read-title">{item.title}</span>
                {item.excerpt && <span className="most-read-excerpt">{item.excerpt}</span>}
              </span>
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
