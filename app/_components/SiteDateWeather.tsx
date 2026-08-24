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

/** Same WMO buckets as describeWeatherCode, mapped to one of a handful of small inline icons — no icon set to install, just a few plain SVGs. */
function WeatherIcon({ code }: { code: number }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
  };

  if (code === 0) {
    // Sun
    return (
      <svg {...common} fill="none" stroke="#f5c542" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4.5" fill="#f5c542" stroke="none" />
        <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8l1.8-1.8M18 6l1.8-1.8" />
      </svg>
    );
  }
  if (code <= 2) {
    // Sun behind cloud
    return (
      <svg {...common} fill="none">
        <circle cx="9" cy="9" r="3.5" fill="#f5c542" />
        <path
          d="M6 18a4 4 0 0 1 .3-8 5 5 0 0 1 9.6 1.2A3.6 3.6 0 0 1 15.5 18H6Z"
          fill="#cdd6dd"
        />
      </svg>
    );
  }
  if (code === 3 || code === 45 || code === 48) {
    // Cloud / fog
    return (
      <svg {...common} fill="none">
        <path
          d="M6 18a4 4 0 0 1 .3-8 5 5 0 0 1 9.6 1.2A3.6 3.6 0 0 1 15.5 18H6Z"
          fill="#b9c2ca"
        />
        {(code === 45 || code === 48) && (
          <path d="M4 20.5h16" stroke="#b9c2ca" strokeWidth="1.6" strokeLinecap="round" />
        )}
      </svg>
    );
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    // Rain
    return (
      <svg {...common} fill="none">
        <path
          d="M6 14.5a4 4 0 0 1 .3-8 5 5 0 0 1 9.6 1.2A3.6 3.6 0 0 1 15.5 14.5H6Z"
          fill="#9fb3c4"
        />
        <path
          d="M8 17.5l-1 3M12 17.5l-1 3M16 17.5l-1 3"
          stroke="#5b8fc9"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    // Snow
    return (
      <svg {...common} fill="none">
        <path
          d="M6 14.5a4 4 0 0 1 .3-8 5 5 0 0 1 9.6 1.2A3.6 3.6 0 0 1 15.5 14.5H6Z"
          fill="#b9c2ca"
        />
        <g stroke="#8fb4d9" strokeWidth="1.6" strokeLinecap="round">
          <path d="M8 17.5v3M6.6 19h2.8" />
          <path d="M12 17.5v3M10.6 19h2.8" />
          <path d="M16 17.5v3M14.6 19h2.8" />
        </g>
      </svg>
    );
  }
  // Thunderstorm (95+)
  return (
    <svg {...common} fill="none">
      <path
        d="M6 14.5a4 4 0 0 1 .3-8 5 5 0 0 1 9.6 1.2A3.6 3.6 0 0 1 15.5 14.5H6Z"
        fill="#8791a0"
      />
      <path d="M12.5 15l-2.5 4h2.2l-1.2 3.5 3.5-4.7h-2.2l1.2-2.8Z" fill="#f5c542" />
    </svg>
  );
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
  const [weather, setWeather] = useState<{ code: number; label: string } | null>(null);

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
        const code = data.current.weather_code;
        setWeather({ code, label: `${temp}°C, ${describeWeatherCode(code)}` });
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
      {weather && (
        <span className="site-date-weather-forecast">
          <WeatherIcon code={weather.code} />
          {weather.label} in Carshalton
        </span>
      )}
    </div>
  );
}
