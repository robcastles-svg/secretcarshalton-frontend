"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ActiveNavSectionContext = createContext<{
  override: string | null;
  setOverride: (value: string | null) => void;
} | null>(null);

/**
 * Individual articles live at a flat /{slug} URL, not nested under
 * /news/, /stories/, etc. — so PrimaryNav's pathname check alone can't
 * tell which top-level section a given post belongs to. This context lets
 * the post page (which already knows its own categories) tell the nav
 * which section to highlight instead.
 */
export function ActiveNavSectionProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<string | null>(null);
  return (
    <ActiveNavSectionContext.Provider value={{ override, setOverride }}>
      {children}
    </ActiveNavSectionContext.Provider>
  );
}

export function useActiveNavSectionOverride() {
  return useContext(ActiveNavSectionContext)?.override ?? null;
}

/** Rendered by a flat-URL post page to say which nav item it belongs to. Clears itself on unmount (navigating away). */
export function SetActiveNavSection({ section }: { section: string | null }) {
  const ctx = useContext(ActiveNavSectionContext);
  useEffect(() => {
    if (!ctx || !section) return;
    ctx.setOverride(section);
    return () => ctx.setOverride(null);
  }, [ctx, section]);
  return null;
}
