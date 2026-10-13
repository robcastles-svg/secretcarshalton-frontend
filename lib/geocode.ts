/**
 * Venue coordinates for the event and venue pages' magenta map. Directory
 * listings store lat/lng, so StyledMap draws them straight away; events only
 * have a typed venue name and address, and StyledMap's own fallback (the
 * Maps JS Geocoder in the visitor's browser) needs the Geocoding API
 * enabled on the site's Google key — when it isn't, event maps fell back
 * to the plain grey embed. Looking the address up here, on the server,
 * gives events the same styled map either way.
 *
 * Free services only, no keys:
 * - an address with a UK postcode goes to postcodes.io (exact, no limits
 *   worth worrying about);
 * - anything else goes to OpenStreetMap's Nominatim, whose usage policy asks
 *   for at most one request a second and an identifying User-Agent. It's
 *   skipped during `next build` (which renders dozens of event pages at
 *   once) and only used when a page regenerates on a visit.
 * Every answer is cached for 30 days; a failure just means no coordinates,
 * and StyledMap falls back as before.
 */

const CACHE_SECONDS = 60 * 60 * 24 * 30;
const POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

export type LatLng = { lat: number; lng: number };

async function getJson<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers,
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(4000),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch (err) {
    // Next's own control-flow signals carry a digest and must pass through.
    if (err && typeof err === "object" && "digest" in err) throw err;
    return null;
  }
}

async function fromPostcode(text: string): Promise<LatLng | null> {
  const m = text.match(POSTCODE_RE);
  if (!m) return null;
  const postcode = `${m[1]} ${m[2]}`.toUpperCase();
  const data = await getJson<{ result?: { latitude?: number; longitude?: number } }>(
    `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`
  );
  const r = data?.result;
  return r && typeof r.latitude === "number" && typeof r.longitude === "number"
    ? { lat: r.latitude, lng: r.longitude }
    : null;
}

async function fromNominatim(q: string): Promise<LatLng | null> {
  if (process.env.NEXT_PHASE === "phase-production-build") return null;
  const params = new URLSearchParams({
    format: "json",
    limit: "1",
    countrycodes: "gb",
    // Prefer matches around Carshalton/Sutton without excluding the rest.
    viewbox: "-0.45,51.45,0.05,51.25",
    q,
  });
  const data = await getJson<Array<{ lat: string; lon: string }>>(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { "User-Agent": "SecretCarshalton/1.0 (info@secretcarshalton.com)" }
  );
  const hit = data?.[0];
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export async function geocodeVenue(name?: string, address?: string): Promise<LatLng | null> {
  const full = [name, address].filter(Boolean).join(", ").trim();
  if (!full) return null;
  return (
    (await fromPostcode(full)) ??
    (await fromNominatim(full)) ??
    (address && address !== full ? await fromNominatim(address) : null)
  );
}
