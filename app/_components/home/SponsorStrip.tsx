export interface Sponsor {
  id: number;
  name: string;
  logoUrl: string;
  href: string;
}

/**
 * Auto-scrolling strip of premium-member logos, directly under the nav.
 * Pure CSS marquee (no client JS needed) — duplicates the list once so
 * the looping scroll has no visible seam. Stubbed empty for now: feeding
 * it needs the Featured-tier sign-up/edit form to grow a logo-upload
 * field first (separate follow-up) — renders nothing until `sponsors`
 * has content, same as-not-shipped-yet approach as ReelsSlider.
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
              <img src={s.logoUrl} alt={s.name} loading="lazy" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
