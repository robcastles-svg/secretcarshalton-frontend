"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A dark magenta Google Maps theme, hand-composed to match EventON's own
 * venue map (still live on staging at /whats-on-in-carshalton/ etc) —
 * see this component's own docblock for why a real Maps JavaScript API
 * theme is used here instead of the CSS-filter approximation this
 * replaced. Standard Google Maps style-array format (featureType/
 * elementType/stylers); no official EventON style JSON was available to
 * copy exactly, so this is a close visual match, not a byte-for-byte port.
 */
const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#3b0d24" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#3b0d24" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#f3d1de" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#5c1c3a" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#4a1430" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#2e0a1c" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#7a2449" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#4a1430" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#9c2f5c" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#5c1c3a" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#4a1430" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#260715" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#7a2449" }] },
];

/**
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — set in Vercel's env vars, not hardcoded
 * here. Maps JS keys are meant to be client-visible (restricted by HTTP
 * referrer in Google Cloud Console, not kept secret) — EventON's own pages
 * already expose one the same way, in their own page source. But a key
 * *string* committed into a public-shaped repo still gets auto-flagged and
 * can get suspended by Google's own abuse scanning regardless of whether
 * it was ever meant to be secret, so the literal value belongs in env vars
 * either way, never in source. Whether that key's referrer allow-list
 * covers this frontend's domain(s), not just staging19's, is unverified —
 * this sandbox's network policy blocks google.com outright, so
 * loading/testing it here isn't possible. If it's restricted to staging19
 * only, the Maps JS script will load but every tile request gets refused —
 * falls back to the plain embed below rather than a broken grey box.
 */
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
        Marker: new (opts: Record<string, unknown>) => unknown;
        Geocoder: new () => {
          geocode: (
            request: { address: string },
            callback: (results: Array<{ geometry: { location: { toJSON: () => { lat: number; lng: number } } } }> | null, status: string) => void
          ) => void;
        };
      };
    };
  }
}

let mapsLoadPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (!GOOGLE_MAPS_API_KEY) return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set"));
  if (window.google?.maps) return Promise.resolve();
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps script failed to load"));
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}

/**
 * The magenta-styled venue map used on event and directory listing pages.
 * Pass lat/lng directly when already known (directory listings store
 * these); events only ever have a free-text address, so this geocodes it
 * client-side via the same Maps API key instead. Degrades to the old
 * plain (CSS-tinted, see .event-map iframe in globals.css) embed on any
 * failure — script blocked, key not allowed for this referrer, geocoding
 * denied for this key/project, address not found, etc — so a real
 * problem with the styled map never means no map at all.
 */
export function StyledMap({ query, lat, lng }: { query: string; lat?: number; lng?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function render(center: { lat: number; lng: number }) {
      if (cancelled || !ref.current || !window.google) return;
      const map = new window.google.maps.Map(ref.current, {
        center,
        zoom: 15,
        styles: MAP_STYLE,
        disableDefaultUI: true,
        zoomControl: true,
      });
      new window.google.maps.Marker({ position: center, map });
    }

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !window.google) return;
        if (typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng)) {
          render({ lat, lng });
          return;
        }
        new window.google.maps.Geocoder().geocode({ address: query }, (results, status) => {
          if (cancelled) return;
          if (status === "OK" && results?.[0]) {
            render(results[0].geometry.location.toJSON());
          } else {
            setFailed(true);
          }
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [query, lat, lng]);

  // Google's keyless "universal" directions URL — no API involved at all,
  // so this always works regardless of whether the styled map above loaded,
  // fell back, or the API key isn't configured yet. Opens the Maps app on
  // mobile or maps.google.com on desktop, routing from wherever the visitor
  // already is (Google asks/uses their location) to this address or
  // coordinates — exactly what EventON's own "Get Directions" button does.
  const directionsHref =
    typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng)
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;

  return (
    <>
      {failed ? (
        <iframe
          title="Location map"
          width="100%"
          height="220"
          style={{ border: 0, borderRadius: 8, display: "block" }}
          loading="lazy"
          src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`}
        />
      ) : (
        <div ref={ref} style={{ width: "100%", height: 220, borderRadius: 8 }} />
      )}
      <a
        href={directionsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="button-pill button-pill-secondary styled-map-directions"
      >
        Get Directions
      </a>
    </>
  );
}
