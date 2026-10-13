/** The key from the site logo, reused after category headlines for consistent branding — purely decorative. */
export function CategoryKeyIcon() {
  return <img src="/key-icon.png" alt="" className="category-key-icon" />;
}

/**
 * A headline followed by the key, with the last word and the key held
 * together so a narrow screen never wraps the key onto a line of its own
 * (Rob, 2026-10) — the word moves down with it instead.
 */
export function KeyTitle({ children }: { children: string }) {
  const text = children.trim();
  const cut = text.lastIndexOf(" ");
  return (
    <>
      {cut >= 0 && `${text.slice(0, cut)} `}
      <span className="category-key-nowrap">
        {text.slice(cut + 1)}
        <CategoryKeyIcon />
      </span>
    </>
  );
}
