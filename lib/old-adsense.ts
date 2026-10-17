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
 * Splits page HTML at every old AdSense block, dropping the blocks, so
 * the caller can put the site's own ads where they were. One block gives
 * [before, after]; none gives [html].
 */
export function splitAtOldAdsense(html: string): string[] {
  return html.replace(OLD_ADSENSE, "\u0000").split("\u0000");
}
