"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function EditAdButton({
  adId,
  headline,
  body,
  link,
}: {
  adId: number;
  headline: string;
  body: string;
  link: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const res = await fetch(`/api/ads/${adId}/update`, { method: "POST", body: formData });

    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong — please try again.");
    }
    setSubmitting(false);
  }

  if (!open) {
    return (
      <button type="button" className="dashboard-my-list-edit" onClick={() => setOpen(true)}>
        Edit
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "0.4rem", minWidth: "14rem", textAlign: "left" }}
    >
      <label className="dashboard-hint" style={{ margin: 0 }}>
        Headline
        <input type="text" name="headline" required defaultValue={headline} style={{ display: "block", width: "100%" }} />
      </label>
      <label className="dashboard-hint" style={{ margin: 0 }}>
        Body text
        <input type="text" name="body" defaultValue={body} style={{ display: "block", width: "100%" }} />
      </label>
      <label className="dashboard-hint" style={{ margin: 0 }}>
        Link
        <input type="url" name="link" required defaultValue={link} style={{ display: "block", width: "100%" }} />
      </label>
      <label className="dashboard-hint" style={{ margin: 0 }}>
        Replace image (optional)
        <input type="file" name="image" accept="image/*" style={{ display: "block", width: "100%" }} />
      </label>
      <span style={{ display: "flex", gap: "0.4rem" }}>
        <button type="submit" className="dashboard-my-list-edit" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </button>
        <button type="button" className="dashboard-my-list-edit" onClick={() => setOpen(false)} disabled={submitting}>
          Cancel
        </button>
      </span>
      {error && <span className="auth-error">{error}</span>}
    </form>
  );
}
