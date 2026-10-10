"use client";

import { useRouter } from "next/navigation";
import { ChevronIcon } from "./EvIcons";

/**
 * The single "All categories" dropdown beside the month pills. Each
 * option is a real list page address (see listHref), so choosing one
 * just navigates there.
 */
export function CategorySelect({
  options,
  value,
  allHref,
}: {
  options: Array<{ value: string; label: string; href: string }>;
  value: string;
  allHref: string;
}) {
  const router = useRouter();
  return (
    <label className={`evl-cat${value ? " evl-cat-on" : ""}`}>
      <span className="evl-sr">Category</span>
      <select
        value={value}
        onChange={(e) => {
          const picked = options.find((o) => o.value === e.target.value);
          router.push(picked ? picked.href : allHref);
        }}
      >
        <option value="">All categories</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronIcon />
    </label>
  );
}
