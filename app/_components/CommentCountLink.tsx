/** Jumps down to the comment thread (CommentSection renders id="comments"). Hidden entirely at 0 — nothing to jump to. */
export function CommentCountLink({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <a href="#comments" className="comment-count-link" aria-label={`${count} comment${count === 1 ? "" : "s"} — jump to comments`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1-5.2A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
      </svg>
      <span>{count}</span>
    </a>
  );
}
