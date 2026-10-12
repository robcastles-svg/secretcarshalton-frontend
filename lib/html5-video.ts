/**
 * Some articles embed a video with the old HTML5 Video Player plugin. In
 * the post HTML that's an empty <div> whose data-attributes JSON holds
 * the video file; the plugin's own script built the player on the old
 * WordPress theme, so on this site the div stayed empty and the video
 * never showed. Each one is swapped for a plain <video> with the
 * browser's own controls, so the plugin can be retired.
 */

const PLAYER_DIV = /<div\b[^>]*\bhtml5_video_players\b[^>]*>\s*<\/div>/g;

function decodeAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function replaceHtml5VideoPlayers(html: string): string {
  if (!html.includes("html5_video_players")) return html;
  return html.replace(PLAYER_DIV, (tag) => {
    const raw = /\bdata-attributes="([^"]*)"/.exec(tag)?.[1];
    if (!raw) return tag;
    let attrs: { source?: string; poster?: string };
    try {
      attrs = JSON.parse(decodeAttr(raw));
    } catch {
      return tag;
    }
    // "?autoplay=1" on one source was a player setting, not part of the file name.
    const src = (attrs.source ?? "").split("?")[0];
    if (!/^https?:\/\/.+\.(mp4|webm|mov|m4v)$/i.test(src)) return tag;
    const poster = attrs.poster && /^https?:\/\//.test(attrs.poster) ? ` poster="${escapeAttr(attrs.poster)}"` : "";
    return `<video class="post-video" src="${escapeAttr(src)}"${poster} controls playsinline preload="metadata"></video>`;
  });
}
