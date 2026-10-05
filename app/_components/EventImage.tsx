"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

/**
 * A soft sky-and-clouds placeholder for events with no featured image —
 * drawn inline (no network fetch, no licensing to worry about) rather
 * than sourcing a stock photo. Sized to fill whatever frame it's put in.
 */
function CloudsPlaceholder() {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="No photo available for this event">
      {/* Flat fill rather than a <linearGradient> — a gradient needs a
          def'd id, and this can render many times on one page (every
          event with no featured image), which would mean duplicate ids
          on the page and unreliable rendering across browsers. */}
      <rect width="400" height="300" fill="#cfe3f2" />
      <g fill="#ffffff" opacity="0.9">
        <ellipse cx="90" cy="125" rx="55" ry="28" />
        <ellipse cx="140" cy="110" rx="40" ry="24" />
        <ellipse cx="60" cy="140" rx="35" ry="20" />
        <ellipse cx="300" cy="190" rx="70" ry="30" />
        <ellipse cx="250" cy="175" rx="45" ry="26" />
        <ellipse cx="340" cy="205" rx="40" ry="22" />
        <ellipse cx="205" cy="85" rx="32" ry="18" />
      </g>
    </svg>
  );
}

/**
 * Every event card variant (main /events list, "Latest events added",
 * homepage) wraps its image in this — owns the clipping frame the hover
 * zoom (see .event-image-frame in globals.css) needs, and falls back to
 * CloudsPlaceholder when the event has no featured image at all. Every
 * frame crops to the site's standard 4:3 (set by context-specific CSS on
 * .event-image-frame, not here).
 *
 * `expandable` opts into a click-to-enlarge lightbox showing the photo at
 * its full, uncropped ratio — only the /events listing page passes this
 * (EventCountdown's hero, EventsGrid's cards); elsewhere (the homepage)
 * the frame is a plain crop with no click interaction of its own, since
 * the whole card there is already a single link to the event.
 */
export function EventImage({
  image,
  alt,
  expandable = false,
}: {
  image: { source_url: string; alt_text: string } | null;
  alt: string;
  expandable?: boolean;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!expandable || !image) {
    return (
      <div className="event-image-frame">
        {image ? <img src={image.source_url} alt={image.alt_text || alt} loading="lazy" /> : <CloudsPlaceholder />}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="event-image-frame event-image-frame-expandable"
        onClick={(e) => {
          // The frame sits beside a sibling <Link> to the event (see
          // EventCountdown/EventsGrid) rather than nested inside one —
          // anchors can't nest a <button> — but stopPropagation is still
          // cheap insurance against any ancestor click handler.
          e.stopPropagation();
          setLightboxOpen(true);
        }}
        aria-label={`View full photo for ${alt}`}
      >
        <img src={image.source_url} alt={image.alt_text || alt} loading="lazy" />
      </button>
      {/* Portaled to document.body rather than rendered in place — this
          button sits inside a card <li> that's both overflow:hidden (the
          card's own rounded corners) and matched by the shared
          ".post-list li > div { display: none }" rule (meant for
          PostListCard's own unclassed excerpt div); a lightbox rendered
          as a normal child here would be either invisible (caught by
          that rule) or clipped, depending on the card type. */}
      {lightboxOpen &&
        createPortal(
          <div
            className="event-image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={`Photo for ${alt}`}
            onClick={() => setLightboxOpen(false)}
          >
            <button
              type="button"
              className="event-image-lightbox-close"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(false);
              }}
              aria-label="Close"
            >
              ×
            </button>
            <img src={image.source_url} alt={image.alt_text || alt} />
          </div>,
          document.body
        )}
    </>
  );
}
