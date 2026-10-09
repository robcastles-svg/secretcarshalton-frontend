"use client";

import Link from "next/link";
import { useState } from "react";
import { LoginModal } from "@/app/_components/LoginModal";

export interface HomeCommentItem {
  id: number;
  text: string;
  commentLink: string;
  authorName: string;
  authorSlug?: string;
  articleSlug: string;
  articleTitle: string;
  date: string;
  dateLabel: string;
}

/**
 * Three links per comment, per the design handoff: the comment text goes
 * to that comment on the article, the article title goes to the article,
 * and the commenter's name goes to their member bio — except the name
 * link needs the viewer logged in first (same login pop-up Bookmark
 * uses on category pages), so a logged-out click opens that instead of
 * navigating. A comment with no public profile (guest/staff — no
 * authorSlug) renders the name as plain text either way.
 */
export function HomeComments({ comments, isLoggedIn }: { comments: HomeCommentItem[]; isLoggedIn: boolean }) {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <ul className="home-comments-grid">
        {comments.map((c) => (
          <li key={c.id}>
            <Link href={c.commentLink} className="home-comment-text">
              “{c.text}”
            </Link>
            <div className="home-comment-byline">
              {c.authorSlug ? (
                isLoggedIn ? (
                  <Link href={`/members/${c.authorSlug}`} className="home-comment-author">
                    {c.authorName}
                  </Link>
                ) : (
                  <button type="button" className="home-comment-author home-comment-author-button" onClick={() => setShowLogin(true)}>
                    {c.authorName}
                  </button>
                )
              ) : (
                <span className="home-comment-author">{c.authorName}</span>
              )}
              <span>
                {" "}
                on <Link href={`/${c.articleSlug}`}>{c.articleTitle}</Link>
              </span>
              <time className="home-comment-date" dateTime={c.date}>
                {c.dateLabel}
              </time>
            </div>
          </li>
        ))}
      </ul>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
