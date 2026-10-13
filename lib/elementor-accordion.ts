/**
 * Some articles use the old theme's Elementor accordion ("The Stone Court
 * connection" + to open). Its markup is a plain <details>/<summary>, so it
 * still opens and closes here without Elementor's script — globals.css
 * styles it (.e-n-accordion). The one thing to clean up in the HTML: each
 * panel repeated its own title as a heading straight inside it, which the
 * old theme hid; drop that duplicate.
 */
const ITEM = /<details\b[^>]*\be-n-accordion-item\b[^>]*>[\s\S]*?<\/details>/g;

function plain(html: string) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;|&#0?39;|’/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function tidyElementorAccordions(html: string): string {
  if (!html.includes("e-n-accordion")) return html;
  return html.replace(ITEM, (item) => {
    const title = /<div class="e-n-accordion-item-title-text">([\s\S]*?)<\/div>/.exec(item)?.[1];
    if (!title) return item;
    const want = plain(title);
    // The first heading inside the panel, if it just repeats the title.
    return item.replace(/(<div role="region"[\s\S]*?)<h([2-6])\b[^>]*>([\s\S]*?)<\/h\2>/, (whole, before, _level, text) =>
      plain(text) === want ? before : whole
    );
  });
}
