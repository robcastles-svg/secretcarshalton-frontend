import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { dateParts, displayOccurrence, formatTimeRange, venueShort } from "@/lib/event-view";
import { getFeaturedImage, getScEventBySlug, stripHtml } from "@/lib/wordpress";

export const revalidate = 3600;

const W = 1080;
const H = 1920;
const PINK = "#cc99a2";

/**
 * The event's own Instagram Story picture (1080×1920, 9:16), made on
 * demand from the event's details: logo and /EVENTS along the top, the
 * photo, then the date tile, title, time and venue as on the event cards.
 * The top and bottom are left clear for Instagram's own buttons and the
 * link sticker. Rob signed off the design (mock-up, Oct 2026).
 * StoryShareButton on the event page hands it to the phone's share sheet.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getScEventBySlug(slug).catch(() => null);
  if (!event) notFound();

  const [regular, bold, black, logo, photo] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/roboto-latin-400-normal.woff")),
    readFile(join(process.cwd(), "assets/fonts/roboto-latin-700-normal.woff")),
    readFile(join(process.cwd(), "assets/fonts/roboto-latin-900-normal.woff")),
    readFile(join(process.cwd(), "assets/logo-white.png")),
    photoDataUrl(getFeaturedImage(event)?.source_url),
  ]);

  const title = stripHtml(event.title.rendered);
  const occurrence = displayOccurrence(event);
  const date = occurrence ? dateParts(occurrence.start) : null;
  const time = occurrence ? formatTimeRange(occurrence) : null;
  const venue = venueShort(event);
  const titleSize = title.length > 60 ? 50 : title.length > 36 ? 58 : 66;

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", background: "#1f1d21", fontFamily: "Roboto" }}>
        {photo && (
          <img src={photo} width={W} height={H} style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" }} />
        )}
        {/* Tints the full-bleed photo behind everything, so it reads as a backdrop. */}
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, background: "rgba(24,21,27,0.86)" }} />

        <div style={{ position: "relative", width: W, height: H, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 40 }}>
          <div style={{ width: 920, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <img src={`data:image/png;base64,${logo.toString("base64")}`} width={346} height={50} />
            <div style={{ display: "flex", fontSize: 34, fontWeight: 900, letterSpacing: 7, color: PINK }}>/EVENTS</div>
          </div>

          {photo && (
            <div style={{ marginTop: 40, width: 920, height: 900, display: "flex", borderRadius: 36, overflow: "hidden" }}>
              <img src={photo} width={920} height={900} style={{ width: 920, height: 900, objectFit: "cover", objectPosition: "center 30%" }} />
            </div>
          )}

          <div
            style={{
              marginTop: photo ? -60 : 40,
              width: 920,
              display: "flex",
              gap: 40,
              padding: "48px 52px 52px",
              background: "#2f2b31",
              border: "2px solid #423c44",
              borderRadius: 36,
            }}
          >
            {date && (
              <div
                style={{
                  width: 170,
                  height: 196,
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#232025",
                  border: "3px solid #423c44",
                  borderRadius: 28,
                }}
              >
                <div style={{ display: "flex", fontSize: 32, fontWeight: 700, letterSpacing: 4, color: PINK }}>{date.weekday}</div>
                <div style={{ display: "flex", fontSize: 86, fontWeight: 900, lineHeight: 1.05, color: "#fff" }}>{date.day}</div>
                <div style={{ display: "flex", fontSize: 32, fontWeight: 700, letterSpacing: 4, color: "#b3a9af" }}>{date.month}</div>
              </div>
            )}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: titleSize, fontWeight: 900, lineHeight: 1.08, color: PINK, textTransform: "uppercase" }}>
                {title}
              </div>
              <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 14, fontSize: 36, color: "#f3eef1" }}>
                {time && (
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <ClockIcon />
                    {time}
                  </div>
                )}
                {venue && (
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <PinIcon />
                    {venue}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: "Roboto", data: regular, weight: 400, style: "normal" },
        { name: "Roboto", data: bold, weight: 700, style: "normal" },
        { name: "Roboto", data: black, weight: 900, style: "normal" },
      ],
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" },
    }
  );
}

/**
 * The event photo as a data URL, or null. The image renderer reads PNG
 * and JPEG only — a WebP photo (a handful of events) or one that won't
 * load gets the version without a photo rather than a broken image.
 */
async function photoDataUrl(url: string | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), next: { revalidate: 3600 } });
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!res.ok || (type !== "image/jpeg" && type !== "image/png")) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

function ClockIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#b3a9af" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#b3a9af" strokeWidth="2">
      <path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
