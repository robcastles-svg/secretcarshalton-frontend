"use client";

import { useState } from "react";

/**
 * The single event page's own photo — crops to the site's standard 4:3
 * by default (see .event-detail-image in globals.css), and expands to
 * its full, uncropped ratio in place on click (toggling back on a
 * second click), rather than opening a popup/lightbox.
 */
export function EventDetailImage({
  image,
  alt,
}: {
  image: { source_url: string; alt_text: string };
  alt: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      className={expanded ? "event-detail-image event-detail-image-expanded" : "event-detail-image"}
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
      aria-label={expanded ? "Show cropped photo" : "Show full photo"}
    >
      <img src={image.source_url} alt={image.alt_text || alt} />
    </button>
  );
}
