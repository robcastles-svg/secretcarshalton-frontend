"use client";

import Link from "next/link";
import { useState } from "react";
import type { WPComment } from "@/lib/wordpress";
import { LoginModal } from "@/app/_components/LoginModal";

const EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function withinEditWindow(iso: string) {
  return Date.now() - new Date(iso).getTime() <= EDIT_WINDOW_MS;
}

/**
 * Comments only ever go in as plain text (see submit_comment), but come
 * back through WordPress's comment_text filter wrapped in <p> tags and
 * HTML-entity-encoded (wptexturize, etc.) — undoing both via a detached
 * <textarea>'s own HTML parsing is the standard safe trick for decoding
 * entities (nothing here is ever inserted into the real page as markup).
 */
function plainTextFromRenderedComment(html: string): string {
  const withoutParagraphs = html.replace(/<\/?p>/g, "");
  if (typeof document === "undefined") return withoutParagraphs.trim();
  const el = document.createElement("textarea");
  el.innerHTML = withoutParagraphs;
  return el.value.trim();
}

interface CommenterProfile {
  slug: string;
  name: string;
  avatar: string;
}

function StarRatingInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="star-rating-input" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className={n <= value ? "star-filled" : "star-empty"}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function StarRatingDisplay({ rating }: { rating: number }) {
  return (
    <span className="star-rating-display" aria-label={`Rated ${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? "star-filled" : "star-empty"} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * Upvoting isn't restricted to your own content, and any logged-in
 * member can vote on any comment — a guest gets prompted to log in
 * instead (via onRequireLogin, the same LoginModal every other guarded
 * action here uses). Optimistic: toggles immediately, then reconciles
 * with (or reverts to) the server's own count/voted state rather than
 * trusting the optimistic guess once the request actually returns.
 */
function CommentVoteButton({
  commentId,
  initialCount,
  initialVoted,
  isLoggedIn,
  onRequireLogin,
}: {
  commentId: number;
  initialCount: number;
  initialVoted: boolean;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
}) {
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(initialVoted);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    setPending(true);
    const prevVoted = voted;
    const prevCount = count;
    const nextVoted = !prevVoted;
    setVoted(nextVoted);
    setCount(prevCount + (nextVoted ? 1 : -1));

    const res = await fetch("/api/comments/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });

    if (res.ok) {
      const body = await res.json();
      setVoted(body.voted);
      setCount(body.count);
    } else {
      setVoted(prevVoted);
      setCount(prevCount);
    }
    setPending(false);
  }

  return (
    <button
      type="button"
      className={`comment-vote-button${voted ? " comment-vote-button-active" : ""}`}
      onClick={handleClick}
      disabled={pending}
      aria-pressed={voted}
      aria-label={voted ? "Remove your upvote" : "Upvote this comment"}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill={voted ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M12 4l8 8h-5v8h-6v-8H4l8-8Z" strokeLinejoin="round" />
      </svg>
      {count > 0 ? count : "Upvote"}
    </button>
  );
}

export function CommentSection({
  postId,
  comments,
  isLoggedIn,
  commenterProfiles,
  currentUserId,
  votedCommentIds,
  kind = "comment",
}: {
  postId: number;
  comments: WPComment[];
  isLoggedIn: boolean;
  // Keyed by WPComment.author (a WP user id) — only present for real,
  // public member accounts (see getMembersByIds). A guest/anonymous
  // comment, or one from staff, simply has no entry here and renders as
  // plain text, same as before this existed.
  commenterProfiles?: Map<number, CommenterProfile>;
  // The logged-in viewer's own member id, for showing an Edit link on
  // their own comments — undefined/null for guests, who can't own any.
  currentUserId?: number | null;
  // Which of these comments the viewer has already upvoted — see
  // getVotedCommentIds's docblock for why this is its own prop rather
  // than a field on each WPComment. Empty/undefined for guests, who
  // can't have voted on anything.
  votedCommentIds?: number[];
  // Directory listings get "review" wording + a star rating; posts and
  // events stay plain "comment", no rating.
  kind?: "comment" | "review";
}) {
  const isReview = kind === "review";
  const noun = isReview ? "review" : "comment";
  const nounPlural = isReview ? "reviews" : "comments";

  const [thread, setThread] = useState(comments);
  const votedSet = new Set(votedCommentIds);
  const [text, setText] = useState("");
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);
  const [guestPrompt, setGuestPrompt] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim()) return;
    if (isReview && rating === 0) {
      setError("Please choose a star rating.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/comments/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, content: text.trim(), rating: isReview ? rating : undefined }),
    });
    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      setText("");
      setRating(0);
      if (body.status === "approved") {
        setThread((prev) => [
          {
            id: body.id,
            post: postId,
            author_name: body.author_name,
            content: body.content,
            date: body.date,
            rating: body.rating ?? null,
          },
          ...prev,
        ]);
      } else {
        setPendingNotice(`Thanks — your ${noun} is awaiting moderation.`);
      }
    } else {
      setError(body.error || "Something went wrong — please try again.");
    }
    setSubmitting(false);
  }

  // Replies nest under the comment they answer, oldest first so a
  // conversation reads top to bottom; top-level comments stay newest
  // first. A reply whose parent isn't in this thread (unapproved or
  // beyond the fetch limit) shows at the top level rather than vanishing.
  const threadIds = new Set(thread.map((c) => c.id));
  const repliesByParent = new Map<number, WPComment[]>();
  const topLevel: WPComment[] = [];
  for (const c of thread) {
    if (c.parent && threadIds.has(c.parent)) {
      repliesByParent.set(c.parent, [...(repliesByParent.get(c.parent) ?? []), c]);
    } else {
      topLevel.push(c);
    }
  }
  repliesByParent.forEach((replies) => replies.sort((a, b) => a.date.localeCompare(b.date)));

  function renderComment(c: WPComment) {
    const replies = repliesByParent.get(c.id) ?? [];
    const profile = c.author ? commenterProfiles?.get(c.author) : undefined;
    const isOwn = Boolean(currentUserId && c.author === currentUserId);
    const canEdit = isOwn && withinEditWindow(c.date);

    if (editingId === c.id) {
      return (
        <EditCommentForm
          key={c.id}
          comment={c}
          isReview={isReview}
          noun={noun}
          onCancel={() => setEditingId(null)}
          onSaved={(pendingMessage) => {
            setEditingId(null);
            setThread((prev) => prev.filter((item) => item.id !== c.id));
            setPendingNotice(pendingMessage);
          }}
        />
      );
    }

    return (
      <li key={c.id}>
        {profile ? (
          <Link href={`/members/${profile.slug}`} className="comment-author-link">
            <img src={profile.avatar} alt="" className="comment-author-icon" loading="lazy" />
            <strong>{profile.name}</strong>
          </Link>
        ) : (
          <strong>{c.author_name}</strong>
        )}
        <time dateTime={c.date}>{formatDate(c.date)}</time>
        {isReview && typeof c.rating === "number" && <StarRatingDisplay rating={c.rating} />}
        <div dangerouslySetInnerHTML={{ __html: c.content.rendered }} />
        <div className="comment-actions-row">
          <CommentVoteButton
            commentId={c.id}
            initialCount={c.vote_count ?? 0}
            initialVoted={votedSet.has(c.id)}
            isLoggedIn={isLoggedIn}
            onRequireLogin={() => setShowLoginModal(true)}
          />
          {canEdit && (
            <button type="button" className="comment-edit-link" onClick={() => setEditingId(c.id)}>
              Edit
            </button>
          )}
        </div>
        {replies.length > 0 && <ul className="comment-replies">{replies.map(renderComment)}</ul>}
      </li>
    );
  }

  return (
    <div className="comment-section" id="comments">
      <div className="comment-section-header">
        <p className="comment-login-hint">
          {!isLoggedIn && (
            <>
              <button type="button" className="comment-login-hint-link" onClick={() => setShowLoginModal(true)}>
                Login
              </button>
              /<Link href="/register">Register</Link> to{" "}
              {isReview ? "leave a review." : "ask a question or leave feedback."}
            </>
          )}
        </p>
        <h2>Leave a {noun}</h2>
      </div>

      {isLoggedIn ? (
        <form className="comment-form" onSubmit={handleSubmit}>
          {isReview && <StarRatingInput value={rating} onChange={setRating} />}
          <textarea
            rows={4}
            placeholder={isReview ? "Share your experience…" : "Join the conversation…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
          {error && <p className="auth-error">{error}</p>}
          {pendingNotice && <p className="comment-pending-notice">{pendingNotice}</p>}
          <button type="submit" className="button-pill button-pill-active" disabled={submitting}>
            {submitting ? "Posting…" : `Post ${noun}`}
          </button>
        </form>
      ) : (
        <>
          <div className="comment-form comment-form-guest">
            {isReview && <StarRatingInput value={0} onChange={() => setGuestPrompt(true)} />}
            <textarea
              rows={4}
              placeholder={isReview ? "Share your experience…" : "Join the conversation…"}
              onFocus={() => setGuestPrompt(true)}
              onChange={() => setGuestPrompt(true)}
            />
            {guestPrompt && (
              <p className="comment-guest-prompt">
                <button type="button" className="comment-guest-prompt-link" onClick={() => setShowLoginModal(true)}>
                  Please login to {noun}
                </button>
              </p>
            )}
          </div>
          <div className="comment-login-promo">
            <div className="comment-login-badge">Member</div>
            <ul>
              <li>Receive a ranking and badge based on your activity</li>
              <li>Create an &apos;about you&apos; page to introduce yourself when people click on your name</li>
              <li>See all your comments and activity in one place</li>
              <li>Connect with friends</li>
            </ul>
            <div className="comment-login-actions">
              <button type="button" className="button-pill" onClick={() => setShowLoginModal(true)}>
                Log in
              </button>
              <Link href="/register">Register</Link>
            </div>
          </div>
        </>
      )}

      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}

      {/* Reviews (kind="review") skip this — it's specifically pointing
          at the site's comment activity, not reviews, and /latest-comments
          only ever shows the former. */}
      {!isReview && thread.length === 0 && (
        <p className="comment-empty-hint">
          No comments here yet — be the first.{" "}
          <Link href="/latest-comments">View the newest comments on Discover, News and Walks →</Link>
        </p>
      )}

      <div className="comment-count">
        {thread.length} {nounPlural.toUpperCase()}
      </div>

      {topLevel.length > 0 && <ul className="comment-thread">{topLevel.map(renderComment)}</ul>}
    </div>
  );
}

function EditCommentForm({
  comment,
  isReview,
  noun,
  onCancel,
  onSaved,
}: {
  comment: WPComment;
  isReview: boolean;
  noun: string;
  onCancel: () => void;
  onSaved: (pendingMessage: string) => void;
}) {
  const [text, setText] = useState(() => plainTextFromRenderedComment(comment.content.rendered));
  const [rating, setRating] = useState(comment.rating ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim()) return;
    if (isReview && rating === 0) {
      setError("Please choose a star rating.");
      return;
    }
    setSaving(true);
    setError(null);

    const res = await fetch("/api/comments/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId: comment.id, content: text.trim(), rating: isReview ? rating : undefined }),
    });
    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      onSaved(`Thanks — your edited ${noun} is awaiting moderation.`);
    } else {
      setError(body.error || "Something went wrong — please try again.");
      setSaving(false);
    }
  }

  return (
    <li className="comment-editing">
      <form className="comment-form comment-edit-form" onSubmit={handleSave}>
        {isReview && <StarRatingInput value={rating} onChange={setRating} />}
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} required />
        {error && <p className="auth-error">{error}</p>}
        <div className="comment-edit-actions">
          <button type="submit" className="button-pill button-pill-active" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button type="button" className="comment-edit-cancel" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}
