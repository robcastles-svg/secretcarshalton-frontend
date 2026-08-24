"use client";

import { useEffect, useState } from "react";

// Carshalton, Greater London.
const LAT = 51.3721;
const LON = -0.1673;

/** WMO weather codes (what Open-Meteo's API returns) collapsed to a short label. */
function describeWeatherCode(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Weather unavailable";
}

function formatToday(): string {
  const now = new Date();
  const weekday = now.toLocaleDateString("en-GB", { weekday: "long" });
  const day = now.getDate();
  const month = now.toLocaleDateString("en-GB", { month: "long" });
  const year = now.getFullYear();
  return `${weekday} ${day} ${month}, ${year}`;
}

/**
 * Both the date and weather are computed after mount, not during render —
 * this sits in the root layout, which every page shares, and most pages
 * are statically regenerated on a revalidate window (commonly 1h). A date
 * baked in at render time would just be whatever day the page was last
 * regenerated, not necessarily today. Rendering nothing until mounted (the
 * same pattern AdSlot uses) avoids a server/client mismatch from that.
 *
 * Weather comes from Open-Meteo, not a keyed provider (OpenWeather etc.)
 * — no API key to provision or bill, matches this codebase's existing
 * preference for no-key services (see the directory's Nominatim geocoding).
 */
export function SiteDateWeather() {
  const [today, setToday] = useState<string | null>(null);
  const [weather, setWeather] = useState<string | null>(null);

  useEffect(() => {
    setToday(formatToday());

    let cancelled = false;
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&timezone=Europe%2FLondon`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.current) return;
        const temp = Math.round(data.current.temperature_2m);
        setWeather(`${temp}°C, ${describeWeatherCode(data.current.weather_code)}`);
      })
      .catch(() => {
        if (!cancelled) setWeather(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!today) return null;

  return (
    <div className="site-date-weather-bar">
      <span>{today}</span>
      {weather && <span>{weather} in Carshalton</span>}
    </div>
  );
}
