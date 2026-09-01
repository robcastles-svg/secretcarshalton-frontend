import Link from "next/link";

/** Page-number + Previous/Next pagination shared by every card grid (News, Directory, Discover, People, Walks, Themes, Stories) — keeps a page to 9 cards instead of one long scroll. Events uses month browsing instead, not this. */
export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const numbers = new Set<number>([1, totalPages]);
  for (let p = page - 2; p <= page + 2; p++) {
    if (p >= 1 && p <= totalPages) numbers.add(p);
  }
  const sorted = Array.from(numbers).sort((a, b) => a - b);

  const items: Array<number | "ellipsis"> = [];
  let previous = 0;
  for (const p of sorted) {
    if (p - previous > 1) items.push("ellipsis");
    items.push(p);
    previous = p;
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 ? (
        <Link href={buildHref(page - 1)} className="pagination-prev">
          Previous
        </Link>
      ) : (
        <span className="pagination-prev pagination-disabled">Previous</span>
      )}

      <div className="pagination-numbers">
        {items.map((item, i) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${i}`} className="pagination-ellipsis">
              …
            </span>
          ) : (
            <Link
              key={item}
              href={buildHref(item)}
              className={item === page ? "active" : undefined}
              aria-current={item === page ? "page" : undefined}
            >
              {item}
            </Link>
          )
        )}
      </div>

      {page < totalPages ? (
        <Link href={buildHref(page + 1)} className="pagination-next">
          Next
        </Link>
      ) : (
        <span className="pagination-next pagination-disabled">Next</span>
      )}
    </nav>
  );
}
