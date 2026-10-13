/**
 * Articles embed TikToks with TikTok's own paste-in code: a
 * <blockquote class="tiktok-embed" data-video-id="…"> plus a
 * <script src="https://www.tiktok.com/embed.js">. The script turned the
 * quote into a player on the old WordPress theme, but scripts inside
 * post HTML never run here (React inserts them inert), so only the
 * caption text showed. Each one is swapped for TikTok's official iframe
 * player instead, and the dead script tag is dropped.
 */

const TIKTOK_BLOCKQUOTE = /<blockquote\b[^>]*\btiktok-embed\b[^>]*>[\s\S]*?<\/blockquote>/g;
const TIKTOK_SCRIPT = /(<p>\s*)?<script\b[^>]*tiktok\.com\/embed\.js[^>]*>\s*<\/script>(\s*<\/p>)?/g;

export function replaceTikTokEmbeds(html: string): string {
  if (!html.includes("tiktok-embed")) return html;
  return html
    .replace(TIKTOK_BLOCKQUOTE, (block) => {
      const id =
        /\bdata-video-id="(\d+)"/.exec(block)?.[1] ?? /tiktok\.com\/@[^/"]+\/video\/(\d+)/.exec(block)?.[1];
      if (!id) return block;
      return (
        `<div class="post-tiktok"><iframe src="https://www.tiktok.com/player/v1/${id}?rel=0" ` +
        `title="TikTok video" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" ` +
        `allowfullscreen loading="lazy"></iframe></div>`
      );
    })
    .replace(TIKTOK_SCRIPT, "");
}
