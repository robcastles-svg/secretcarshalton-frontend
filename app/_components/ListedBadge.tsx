"use client";

import { useState } from "react";
import { SITE_URL } from "@/lib/event-view";

const BADGE = "/listed-on-secret-carshalton.png";

/**
 * "Listed on Secret Carshalton" badge (Rob, 2026-10) — encourages people
 * who post on the site to show it on their own website. Download the
 * image, or copy a ready-made snippet that links back to their own page
 * here (good for them, good for us). Shown after submitting something,
 * on the dashboard, the listing edit page and the Advertise page.
 *
 * `path` is their page on this site ("/directory/acme"); without one the
 * badge links to the homepage.
 */
export function ListedBadge({ path = "", compact = false }: { path?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const link = SITE_URL + (path || "/");
  const code = `<a href="${link}" target="_blank" rel="noopener"><img src="${SITE_URL}${BADGE}" alt="Listed on Secret Carshalton" width="300" height="74"></a>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Older browsers: the code is also shown in the box below to copy by hand.
    }
  }

  return (
    <div className={compact ? "listed-badge listed-badge-compact" : "listed-badge"}>
      <img src={BADGE} alt="Listed on Secret Carshalton" className="listed-badge-img" width={300} height={74} />
      <div className="listed-badge-text">
        <strong>Show you&apos;re on Secret Carshalton</strong>
        <p>
          Add our badge to your website — it links straight to {path ? "your page" : "Secret Carshalton"}, so people
          can find you here, and it helps more locals discover what&apos;s on.
        </p>
        <div className="listed-badge-actions">
          <a href={BADGE} download="listed-on-secret-carshalton.png" className="button-pill button-pill-secondary">
            Download badge
          </a>
          <button type="button" className="button-pill button-pill-secondary" onClick={copy}>
            {copied ? "Copied ✓" : "Copy website code"}
          </button>
        </div>
        {!compact && (
          <details className="listed-badge-code">
            <summary>Show the code</summary>
            <code>{code}</code>
          </details>
        )}
      </div>
    </div>
  );
}
