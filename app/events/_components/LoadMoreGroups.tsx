"use client";

import { useState, type ReactNode } from "react";

/**
 * The grouped events list ("This week", "Later in October", …) with a
 * "Load more events" button. Cards are rendered on the server and passed
 * in; this only decides how many are shown.
 */
export function LoadMoreGroups({
  groups,
  pageSize,
}: {
  groups: Array<{ label: string; cards: ReactNode[] }>;
  pageSize: number;
}) {
  const total = groups.reduce((n, g) => n + g.cards.length, 0);
  const [limit, setLimit] = useState(pageSize);

  let remaining = limit;
  const shown = groups
    .map((g) => {
      const cards = g.cards.slice(0, Math.max(0, remaining));
      remaining -= cards.length;
      return { label: g.label, cards };
    })
    .filter((g) => g.cards.length > 0);

  return (
    <>
      {shown.map((g) => (
        <div className="evl-group" key={g.label}>
          <h2>{g.label}</h2>
          <div className="evx-grid evx-grid-2">{g.cards}</div>
        </div>
      ))}
      {limit < total && (
        <button type="button" className="evx-btn evx-btn-sm evl-load-more" onClick={() => setLimit((n) => n + pageSize)}>
          Load more events
        </button>
      )}
    </>
  );
}
