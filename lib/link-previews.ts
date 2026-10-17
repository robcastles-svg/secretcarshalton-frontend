/**
 * A web address pasted on a line of its own in an article (WordPress
 * leaves it as plain text: <p>https://…</p>) becomes a preview card with
 * the linked page's picture, title and description, read from its
 * og: tags (Rob, Oct 2026). Our own pages are linked by path, so they
 * open in the same tab. Video and social links are left alone (the
 * other embed helpers deal with those), and anything that can't be
 * previewed still becomes a normal clickable link.
 */

const BARE_LINK = /<p>\s*(https?:\/\/[^\s<>"]+)\s*<\/p>/g;
const SKIP_HOSTS = /(^|\.)(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|fb\.watch|x\.com|twitter\.com|vimeo\.com)$/i;
const OWN_HOSTS = /^(www\.)?(cms\.)?secretcarshalton\.com$/i;
const MAX_PREVIEWS = 10;

type Preview = { title: string; description?: string; image?: string; site: string };

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function meta(html: string, key: string): string | undefined {
  const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i").exec(html)?.[0];
  const content = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1];
  return content ? decode(content).trim() || undefined : undefined;
}

async function fetchPreview(url: URL): Promise<Preview | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SecretCarshaltonPreview/1.0)" },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 86400 },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return null;
    const head = (await res.text()).slice(0, 200_000);
    const rawTitle = meta(head, "og:title") ?? decode(/<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1] ?? "").trim();
    if (!rawTitle) return null;
    const own = OWN_HOSTS.test(url.hostname);
    // Our own titles end "— Directory — Secret Carshalton" or "| Secret Carshalton": the card already says where it's from.
    const title = own ? rawTitle.replace(/\s*(?:—\s*Directory\s*)?[—|]\s*Secret Carshalton$/i, "") : rawTitle;
    const image = meta(head, "og:image") ?? meta(head, "twitter:image");
    return {
      title,
      description: meta(head, "og:description") ?? meta(head, "description"),
      image: image && /^https?:\/\//.test(image) ? image : undefined,
      site: own ? "Secret Carshalton" : (meta(head, "og:site_name") ?? url.hostname.replace(/^www\./, "")),
    };
  } catch {
    return null;
  }
}

function card(url: URL, p: Preview): string {
  const own = OWN_HOSTS.test(url.hostname) && !url.hostname.startsWith("cms.");
  const href = own ? `${url.pathname}${url.search}${url.hash}` : url.href;
  const external = own ? "" : ' target="_blank" rel="noopener noreferrer"';
  const desc = p.description ? p.description.slice(0, 180) + (p.description.length > 180 ? "…" : "") : "";
  return (
    `<a class="link-preview${p.image ? "" : " link-preview-no-image"}" href="${escape(href)}"${external}>` +
    (p.image ? `<img src="${escape(p.image)}" alt="" loading="lazy">` : "") +
    `<span class="link-preview-body"><span class="link-preview-site">${escape(p.site)}</span>` +
    `<strong>${escape(p.title)}</strong>` +
    (desc ? `<span class="link-preview-desc">${escape(desc)}</span>` : "") +
    `</span></a>`
  );
}

export async function addLinkPreviews(html: string): Promise<string> {
  const matches = [...html.matchAll(BARE_LINK)].slice(0, MAX_PREVIEWS);
  if (matches.length === 0) return html;

  const replacements = await Promise.all(
    matches.map(async ([whole, raw]) => {
      let url: URL;
      try {
        url = new URL(decode(raw));
      } catch {
        return [whole, whole] as const;
      }
      if (SKIP_HOSTS.test(url.hostname)) return [whole, whole] as const;
      const preview = await fetchPreview(url);
      const fallback = `<p><a href="${escape(url.href)}">${escape(url.href)}</a></p>`;
      return [whole, preview ? card(url, preview) : fallback] as const;
    })
  );

  let out = html;
  for (const [whole, replacement] of replacements) out = out.replace(whole, replacement);
  return out;
}
