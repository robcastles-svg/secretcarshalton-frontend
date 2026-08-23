"use client";

import Link from "next/link";
import { useState } from "react";
import type { WPComment } from "@/lib/wordpress";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface CommenterProfile {
  slug: string;
  name: string;
  avatar: string;
}

export function CommentSection({
  postId,
  comments,
  isLoggedIn,
  commenterProfiles,
}: {
  postId: number;
  comments: WPComment[];
  isLoggedIn: boolean;
  // Keyed by WPComment.author (a WP user id) — only present for real,
  // public member accounts (see getMembersByIds). A guest/anonymous
  // comment, or one from staff, simply has no entry here and renders as
  // plain text, same as before this existed.
  commenterProfiles?: Map<number, CommenterProfile>;
}) {
  const [thread, setThread] = useState(comments);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/comments/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, content: text.trim() }),
    });
    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      setText("");
      if (body.status === "approved") {
        setThread((prev) => [
          { id: body.id, post: postId, author_name: body.author_name, content: body.content, date: body.date },
          ...prev,
        ]);
      } else {
        setPendingNotice(true);
      }
    } else {
      setError(body.error || "Something went wrong — please try again.");
    }
    setSubmitting(false);
  }

  return (
    <div className="comment-section" id="comments">
      <div className="comment-section-header">
        <p className="comment-login-hint">
          {!isLoggedIn && (
            <>
              <Link href="/login">Login</Link>/<Link href="/register">Register</Link> to ask a
              question or leave feedback.
            </>
          )}
        </p>
        <h2>Leave a comment</h2>
      </div>

      {isLoggedIn ? (
        <form className="comment-form" onSubmit={handleSubmit}>
          <textarea
            rows={4}
            placeholder="Join the conversation…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
          {error && <p className="auth-error">{error}</p>}
          {pendingNotice && <p className="comment-pending-notice">Thanks — your comment is awaiting moderation.</p>}
          <button type="submit" className="button-pill button-pill-active" disabled={submitting}>
            {submitting ? "Posting…" : "Post comment"}
          </button>
        </form>
      ) : (
        <>
          <Link href="/login" className="comment-box-teaser">
            Leave a first comment…
          </Link>
        <div className="comment-login-promo">
          <div className="comment-login-badge">Member</div>
          <ul>
            <li>Receive a ranking and badge based on your activity</li>
            <li>Create an &apos;about you&apos; page to introduce yourself when people click on your name</li>
            <li>See all your comments and activity in one place</li>
            <li>Connect with friends</li>
          </ul>
          <div className="comment-login-actions">
            <Link href="/login" className="button-pill">
              Log in
            </Link>
            <Link href="/register">Register</Link>
          </div>
        </div>
        </>
      )}

      <div className="comment-count">{thread.length} COMMENT{thread.length === 1 ? "" : "S"}</div>

      {thread.length > 0 && (
        <ul className="comment-thread">
          {thread.map((c) => {
            const profile = c.author ? commenterProfiles?.get(c.author) : undefined;
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
                <div dangerouslySetInnerHTML={{ __html: c.content.rendered }} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
