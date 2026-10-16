"use client";

import { useEffect } from "react";

/** Our own sites — links to these open in the same tab. */
const OWN_HOSTS = ["secretcarshalton.com", "www.secretcarshalton.com"];

/**
 * Site-wide link rule (Rob, 2026-10): links to other websites open in a
 * new tab, links to our own pages open in the same one — wherever the
 * link came from (article text from WordPress, listings, ads, our own
 * components). Applied at the moment of the click, so it covers links
 * added after the page loads too. mailto:/tel: and downloads are left
 * alone.
 */
export function LinkTargets() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      const own = url.host === window.location.host || OWN_HOSTS.includes(url.host);
      if (own) {
        if (a.target === "_blank") a.removeAttribute("target");
      } else if (a.target !== "_blank") {
        a.target = "_blank";
        const rel = new Set((a.rel || "").split(/\s+/).filter(Boolean));
        rel.add("noopener");
        rel.add("noreferrer");
        a.rel = [...rel].join(" ");
      }
    }
    // Capture phase, so the target is set before the browser (or Next's
    // Link) acts on the click.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
