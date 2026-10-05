export interface Sponsor {
  id: number;
  name: string;
  /** Omitted for the placeholder tiles shown before real logo uploads exist — see the dummy array in app/page.tsx. */
  logoUrl?: string;
  href: string;
}

/**
 * Auto-scrolling strip of premium-member logos, directly under the nav.
 * Pure CSS marquee (no client JS needed) — duplicates the list once so
 * the looping scroll has no visible seam. Feeding it from real uploads
 * needs the Featured-tier sign-up/edit form to grow a logo-upload field
 * first (separate follow-up) — until then app/page.tsx passes a dummy
 * placeholder array so the slider itself is visible per the design
 * handoff, with a text tile standing in for each logo.
 */
export function SponsorStrip({ sponsors }: { sponsors: Sponsor[] }) {
  if (sponsors.length === 0) return null;

  const track = [...sponsors, ...sponsors];

  return (
    <div className="sponsor-strip">
      <ul className="sponsor-strip-track">
        {track.map((s, i) => (
          <li key={`${s.id}-${i}`}>
            <a href={s.href} title={s.name}>
              <span className="sponsor-strip-label">Premium member</span>
              {s.logoUrl ? (
                <img src={s.logoUrl} alt={s.name} loading="lazy" />
              ) : (
                <span className="sponsor-strip-name">{s.name}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
