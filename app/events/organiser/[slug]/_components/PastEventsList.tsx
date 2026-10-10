"use client";

import Link from "next/link";
import { useState } from "react";

const INITIAL = 5;

/** Compact past-events list: the 5 most recent, then "Show all". */
export function PastEventsList({ items }: { items: Array<{ slug: string; title: string; date: string }> }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, INITIAL);
  return (
    <>
      <ul className="evx-past-list">
        {shown.map((p) => (
          <li key={p.slug}>
            <time>{p.date}</time>
            <Link href={`/events/${p.slug}`}>{p.title}</Link>
          </li>
        ))}
      </ul>
      {!all && items.length > INITIAL && (
        <button type="button" className="evx-btn evx-btn-sm evx-past-more" onClick={() => setAll(true)}>
          Show all {items.length} past events
        </button>
      )}
    </>
  );
}
