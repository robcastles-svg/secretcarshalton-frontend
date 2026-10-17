/**
 * Old Google AdSense blocks pasted into WordPress page content (the
 * script tag, the <ins class="adsbygoogle"> slot, the push() call, and
 * sometimes a "Claim this banner space" link), with the <p> or
 * <div align="center"> wordpress wrapped them in. Rob, Oct 2026: replace
 * them with the site's own rotating ad, not Google's.
 */
const OLD_ADSENSE =
  /(?:<p>|<div align="center">)?\s*<script[^>]*pagead2\.googlesyndication\.com[\s\S]*?adsbygoogle\s*=[\s\S]*?<\/script>\s*(?:<small>[\s\S]*?<\/small>)?\s*(?:<\/p>|<\/div>)?/gi;

/**
 * Splits page HTML at its first old AdSense block, dropping every one.
 * Returns [html] when there's none, or [before, after] so the caller can
 * put the site's own ad where the first one was.
 */
export function splitAtOldAdsense(html: string): [string] | [string, string] {
  const first = new RegExp(OLD_ADSENSE.source, "i").exec(html);
  if (!first) return [html];
  const before = html.slice(0, first.index);
  const after = html.slice(first.index + first[0].length).replace(OLD_ADSENSE, "");
  return [before, after];
}
