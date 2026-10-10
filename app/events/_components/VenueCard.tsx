import Link from "next/link";
import { StyledMap } from "@/app/_components/StyledMap";
import { DirectionsIcon } from "./EvIcons";

/**
 * The charcoal venue card — map, Directions and one more link — shared by
 * the event page (links to "All events here") and the venue page (links
 * to "Open in Maps"). `className` lets each page place it in its layout.
 */
export function VenueCard({
  name,
  address,
  allEventsHref,
  showOpenInMaps = false,
  className = "",
}: {
  name?: string;
  address?: string;
  allEventsHref?: string | null;
  showOpenInMaps?: boolean;
  className?: string;
}) {
  const query = [name, address].filter(Boolean).join(", ");
  if (!query) return null;
  return (
    <section className={`evx-card-dk evx-venue ${className}`.trim()}>
      <p className="evx-eyebrow">Venue</p>
      {name && <h3>{name}</h3>}
      {address && <p className="evx-addr">{address}</p>}
      <div className="evx-map">
        <StyledMap query={query} />
      </div>
      <div className="evx-venue-actions">
        <a
          className="evx-btn-dark"
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <DirectionsIcon />
          Directions
        </a>
        {showOpenInMaps && (
          <a
            className="evx-text-link"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Maps ↗
          </a>
        )}
        {allEventsHref && (
          <Link className="evx-text-link" href={allEventsHref}>
            All events here →
          </Link>
        )}
      </div>
    </section>
  );
}
