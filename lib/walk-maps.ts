/**
 * Walks that sell a £1.50 route map embed WP Express Checkout's shortcode,
 * which renders a buy button, a modal and inline scripts that only work
 * on the WordPress theme. Here each of those blocks is cut out of the
 * post HTML and replaced with a marker comment that the article page
 * swaps for WalkMapBuy (same PayPal setup as ads/events — see
 * SC_Ads_Map_Sales). The product's name and price are read from the
 * block for display only; the amount charged is always the server's.
 */

export interface WalkMap {
  productId: number;
  name: string;
  price: string;
}

export const WALK_MAP_MARKER = /<!--sc-map:(\d+)-->/;

const BLOCK_START = /<div class="wpec-product-default-template[^"]*wpec-product-item-(\d+)"/g;
const WRAPPER_COMMENT = /<!-- the \.wpec-product-item-wrapper[^>]*-->\s*$/;

/** Index just past the </div> that closes the <div> opening at `start`, or -1. */
function endOfDiv(html: string, start: number): number {
  const tag = /<div\b|<\/div>/gi;
  tag.lastIndex = start;
  let depth = 0;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[0].toLowerCase() === "</div>" ? -1 : 1;
    if (depth === 0) return tag.lastIndex;
  }
  return -1;
}

function decodeName(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw;
  }
}

export function extractWalkMaps(html: string): { html: string; maps: Map<number, WalkMap> } {
  const maps = new Map<number, WalkMap>();
  if (!html.includes("wpec-product-default-template")) return { html, maps };

  let out = "";
  let pos = 0;
  BLOCK_START.lastIndex = 0;
  for (let m = BLOCK_START.exec(html); m; m = BLOCK_START.exec(html)) {
    const end = endOfDiv(html, m.index);
    if (end === -1) break;
    const block = html.slice(m.index, end);
    const productId = Number(m[1]);
    if (!maps.has(productId)) {
      maps.set(productId, {
        productId,
        name: decodeName(block.match(/"name":"((?:[^"\\]|\\.)*)"/)?.[1] ?? "Route map"),
        price: block.match(/class="wpec-price-amount">([^<]+)</)?.[1].trim() ?? "",
      });
    }
    out += html.slice(pos, m.index).replace(WRAPPER_COMMENT, "") + `<!--sc-map:${productId}-->`;
    pos = end;
    BLOCK_START.lastIndex = end;
  }
  return { html: out + html.slice(pos), maps };
}
