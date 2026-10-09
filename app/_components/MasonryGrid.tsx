"use client";

import { Children, cloneElement, isValidElement, useLayoutEffect, useRef, useState } from "react";

/** Matches .post-layout's own breakpoint — below this the sidebar stacks and a single column has nothing to pack, so masonry positioning is pointless overhead. */
const DESKTOP_BREAKPOINT = 861;
const COLUMNS = 2;
/** Matches the column-gap the old CSS-columns masonry used. */
const GAP = 32;

interface CardPosition {
  top: number;
  left: number;
  width: number;
}

/**
 * True masonry — each card goes into whichever column is currently
 * shortest, not "fill column 1, then column 2" like CSS column-count.
 * That distinction is the whole reason this exists: a plain CSS-columns
 * masonry (what .directory-list used before) places items in strict
 * per-column order, so featured listings sorted first all piled into
 * column 1 before anything reached column 2 — the exact clustering
 * DirectoryBrowse's old split into two separate grids was built to avoid.
 * Shortest-column placement means featured and regular cards can be fed
 * in as one plain list and still land spread across both columns, the
 * way the legacy Sabai directory's own (JS-powered) masonry did.
 *
 * Children must each resolve to a single DOM element that accepts a ref
 * and a style prop — DirectoryListingCard's forwardRef exists for this.
 * Below DESKTOP_BREAKPOINT, or before the first client-side measurement
 * pass, cards render in plain document flow (no inline position) so
 * there's never a broken/overlapping layout — just a brief reflow once
 * JS measures real heights and switches to absolute positioning.
 */
export function MasonryGrid({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const [positions, setPositions] = useState<CardPosition[] | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);

  const items = Children.toArray(children);

  useLayoutEffect(() => {
    function recompute() {
      const container = containerRef.current;
      if (!container) return;

      if (window.innerWidth < DESKTOP_BREAKPOINT) {
        setPositions(null);
        setContainerHeight(null);
        return;
      }

      const containerWidth = container.offsetWidth;
      const columnWidth = (containerWidth - GAP * (COLUMNS - 1)) / COLUMNS;
      const columnHeights = new Array(COLUMNS).fill(0);
      const next: CardPosition[] = [];

      itemRefs.current.forEach((el) => {
        if (!el) return;
        let shortest = 0;
        for (let c = 1; c < COLUMNS; c++) {
          if (columnHeights[c] < columnHeights[shortest]) shortest = c;
        }
        next.push({ top: columnHeights[shortest], left: shortest * (columnWidth + GAP), width: columnWidth });
        columnHeights[shortest] += el.offsetHeight + GAP;
      });

      setPositions(next);
      setContainerHeight(Math.max(...columnHeights) - GAP);
    }

    recompute();

    let frame: number;
    function onResize() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recompute);
    }
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  return (
    <ul
      ref={containerRef}
      className="post-list directory-list"
      style={containerHeight != null ? { position: "relative", height: containerHeight } : undefined}
    >
      {items.map((child, i) => {
        if (!isValidElement(child)) return child;
        const position = positions?.[i];
        return cloneElement(child as React.ReactElement<{ style?: React.CSSProperties; ref?: React.Ref<HTMLElement> }>, {
          key: child.key ?? i,
          ref: (el: HTMLElement | null) => {
            itemRefs.current[i] = el;
          },
          style: position ? { position: "absolute", top: position.top, left: position.left, width: position.width } : undefined,
        });
      })}
    </ul>
  );
}
