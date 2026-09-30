"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SubmitCommunityForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const res = await fetch("/api/community/submit", { method: "POST", body: formData });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
      return;
    }

    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <p>
        Thanks — your story&apos;s been submitted for review. You&apos;ll be able to see its status from your
        dashboard, and it&apos;ll appear on the Community page once it&apos;s approved.
      </p>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Headline
        <input type="text" name="title" required placeholder="e.g. Beddington litter-pick this Saturday" />
      </label>
      <label>
        Your story
        <textarea name="body" rows={8} required placeholder="What's happening, who it's for, how to get involved…" />
      </label>
      <label>
        Photo (optional)
        <input type="file" name="image" accept="image/*" />
      </label>

      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="button-pill" disabled={submitting}>
        {submitting ? "Submitting…" : "Share with the community"}
      </button>
    </form>
  );
}
