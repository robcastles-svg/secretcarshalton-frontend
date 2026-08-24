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
 * CloudsPlaceholder when the event has no featured image at all.
 */
export function EventImage({
  image,
  alt,
}: {
  image: { source_url: string; alt_text: string } | null;
  alt: string;
}) {
  return (
    <div className="event-image-frame">
      {image ? <img src={image.source_url} alt={image.alt_text || alt} loading="lazy" /> : <CloudsPlaceholder />}
    </div>
  );
}
