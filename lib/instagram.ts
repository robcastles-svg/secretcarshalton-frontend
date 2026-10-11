import type { ReelItem } from "@/app/_components/home/ReelsSlider";

/**
 * The homepage "Reels & photos" strip, fed by the Instagram feed WordPress
 * already has: Easy Social Feed (connected to @secret.carshalton) renders
 * the latest posts into the WordPress homepage and keeps each image on the
 * WordPress server (uploads/esf-instagram/{id}.jpg). It has no Instagram
 * REST API, so this reads that rendered feed — which also keeps the
 * plugin's own refresh running, as it updates when the feed renders — and
 * its public per-post popup for the post's own Instagram link and
 * caption. Cached for an hour; any failure just hides the strip.
 */

// Same WordPress the articles come from (see WP_BASE in lib/wordpress.ts).
const WP_SITE = "https://www.secretcarshalton.com";
const PROFILE_URL = "https://www.instagram.com/secret.carshalton/";
const MAX_ITEMS = 15;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "’")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(20_000) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** The post's own Instagram link, caption and whether it's a video, from the plugin's popup. */
async function postDetails(popupUrl: string): Promise<{ url: string | null; caption: string; isVideo: boolean }> {
  const html = await fetchText(popupUrl);
  if (!html) return { url: null, caption: "", isVideo: false };
  const url = html.match(/href="(https:\/\/www\.instagram\.com\/(?:p|reel|tv)\/[^"]+)"/)?.[1] ?? null;
  const caption = decodeEntities(
    (html.match(/esf-insta-feed-description[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "").replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
  return { url, caption, isVideo: /<video\b|\/reel\//.test(html) };
}

export async function getInstagramFeed(): Promise<ReelItem[]> {
  const home = await fetchText(`${WP_SITE}/`);
  if (!home) return [];

  const seen = new Set<string>();
  const found: { id: string; popupUrl: string; thumbnailUrl: string }[] = [];
  const item = /<a class="esf_insta_feed_fancy_popup[^"]*"[^>]*?data-src="([^"]+)"[\s\S]*?<img[^>]*?src="([^"]+)"/g;
  for (let m = item.exec(home); m && found.length < MAX_ITEMS; m = item.exec(home)) {
    const popupUrl = decodeEntities(m[1]);
    const id = popupUrl.match(/[?&]pid=(\d+)/)?.[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    found.push({ id, popupUrl, thumbnailUrl: decodeEntities(m[2]) });
  }

  return Promise.all(
    found.map(async ({ id, popupUrl, thumbnailUrl }) => {
      const details = await postDetails(popupUrl);
      return {
        id,
        thumbnailUrl,
        videoUrl: details.url ?? PROFILE_URL,
        caption: details.caption,
        isVideo: details.isVideo,
      };
    })
  );
}
