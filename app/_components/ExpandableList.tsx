import type { ReactNode } from "react";

const VISIBLE_LIMIT = 3;

/**
 * A list of up to VISIBLE_LIMIT items, with any overflow tucked behind a
 * <details> "show N more" — a member with a lot of history (events,
 * listings, comments) would otherwise run the page on indefinitely.
 * `listClassName` matches each section's existing list markup so the
 * "more" batch renders identically to the visible one.
 */
export function ExpandableList<T>({
  items,
  listClassName,
  itemKey,
  renderItem,
  noun,
}: {
  items: T[];
  listClassName: string;
  itemKey: (item: T) => string | number;
  renderItem: (item: T) => ReactNode;
  noun: string;
}) {
  const visible = items.slice(0, VISIBLE_LIMIT);
  const rest = items.slice(VISIBLE_LIMIT);

  return (
    <>
      <ul className={listClassName}>
        {visible.map((item) => (
          <li key={itemKey(item)}>{renderItem(item)}</li>
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="member-profile-more">
          <summary>
            Show {rest.length} more {noun}
            {rest.length === 1 ? "" : "s"}
          </summary>
          <ul className={listClassName}>
            {rest.map((item) => (
              <li key={itemKey(item)}>{renderItem(item)}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
