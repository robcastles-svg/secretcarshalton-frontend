import { KeyTitle } from "./CategoryKeyIcon";

/**
 * A section's own headline with its name in small capitals above it, e.g.
 * COMMUNITY / People power (Rob, 2026-10) — the same type as the directory
 * category pages' hero, on the plain white page.
 */
export function PageTitle({ eyebrow, children }: { eyebrow: string; children: string }) {
  return (
    <div className="page-title">
      <span className="page-title-eyebrow">{eyebrow}</span>
      <h1>
        <KeyTitle>{children}</KeyTitle>
      </h1>
    </div>
  );
}
