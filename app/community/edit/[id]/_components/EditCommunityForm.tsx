"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OwnCommunityPost } from "@/lib/owner-edit";
import { shrinkFormImages } from "@/lib/shrink-image";

/** The member's own community post. Changes to a published post go back for a quick check before they show. */
export function EditCommunityForm({ post }: { post: OwnCommunityPost }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const formData = await shrinkFormImages(new FormData(e.currentTarget));
    const res = await fetch(`/api/community/${post.id}/update`, { method: "POST", body: formData });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Something went wrong — please try again.");
      setSaving(false);
      return;
    }
    setDone(
      body.backToReview
        ? "Saved. As it was already published, it'll go back up once we've had a quick look at the changes."
        : "Saved."
    );
    setSaving(false);
    router.refresh();
  }

  if (done) {
    return (
      <>
        <p>{done}</p>
        <Link href="/dashboard#community-posts" className="button-pill">
          Back to your dashboard
        </Link>
      </>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Headline
        <input type="text" name="title" required defaultValue={post.title} />
      </label>
      <label>
        Your story
        <textarea name="body" rows={10} required defaultValue={post.body} />
      </label>
      {post.image && <img src={post.image} alt="" style={{ maxWidth: 240, borderRadius: 8 }} />}
      <label>
        {post.image ? "Replace photo (optional)" : "Photo (optional)"}
        <input type="file" name="image" accept="image/*" />
      </label>
      {post.status === "publish" && (
        <p className="dashboard-hint">This is live — your changes will show once we&apos;ve had a quick look at them.</p>
      )}

      {error && <p className="auth-error">{error}</p>}
      <div className="dashboard-section-actions">
        <button type="submit" className="button-pill" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        <Link href="/dashboard#community-posts" className="button-pill button-pill-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
