"use client";

import { useState } from "react";

interface Draft {
  headline: string;
  standfirst: string;
  excerpt: string;
  body: string;
  seo_title: string;
  seo_description: string;
  categories: string[];
  tags: string[];
}

interface ImagePayload {
  mediaType: string;
  data: string;
  name: string;
}

function fileToPayload(file: File): Promise<ImagePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [, data] = result.split(",", 2);
      resolve({ mediaType: file.type, data, name: file.name });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function DraftWorkflow() {
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<ImagePayload[]>([]);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [published, setPublished] = useState<{ id: number } | null>(null);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const payloads = await Promise.all(files.map(fileToPayload));
    setImages((prev) => [...prev, ...payloads]);
    e.target.value = "";
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setDraft(null);
    setPublished(null);

    const res = await fetch("/api/admin/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes,
        images: images.map(({ mediaType, data }) => ({ mediaType, data })),
      }),
    });
    const body = await res.json();

    if (res.ok) {
      setDraft(body);
    } else {
      setError(body.error || "Something went wrong generating the draft.");
    }
    setGenerating(false);
  }

  async function handlePublish() {
    if (!draft) return;
    setPublishing(true);
    setError(null);

    const res = await fetch("/api/admin/draft/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: draft.headline, content: draft.body, excerpt: draft.excerpt }),
    });
    const body = await res.json();

    if (res.ok) {
      setPublished(body);
    } else {
      setError(body.error || "Something went wrong publishing the draft.");
    }
    setPublishing(false);
  }

  if (published) {
    return (
      <div className="draft-published">
        <p>
          Saved as a pending post (ID {published.id}) on WordPress. Open it from the Posts list in
          wp-admin to review, add a featured image, apply categories/tags, and publish.
        </p>
        <button
          type="button"
          className="button-pill"
          onClick={() => {
            setDraft(null);
            setPublished(null);
            setNotes("");
            setImages([]);
          }}
        >
          Draft another story
        </button>
      </div>
    );
  }

  if (draft) {
    return (
      <div className="draft-review">
        <label>
          Headline
          <input value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} />
        </label>
        <label>
          Standfirst
          <textarea
            rows={2}
            value={draft.standfirst}
            onChange={(e) => setDraft({ ...draft, standfirst: e.target.value })}
          />
        </label>
        <label>
          Excerpt
          <textarea
            rows={2}
            value={draft.excerpt}
            onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })}
          />
        </label>
        <label>
          Body (HTML)
          <textarea
            rows={16}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </label>
        <div className="draft-preview" dangerouslySetInnerHTML={{ __html: draft.body }} />
        <label>
          SEO title
          <input value={draft.seo_title} onChange={(e) => setDraft({ ...draft, seo_title: e.target.value })} />
        </label>
        <label>
          SEO description
          <textarea
            rows={2}
            value={draft.seo_description}
            onChange={(e) => setDraft({ ...draft, seo_description: e.target.value })}
          />
        </label>
        <p className="dashboard-hint">
          Suggested categories: {draft.categories.join(", ") || "none"} — suggested tags:{" "}
          {draft.tags.join(", ") || "none"}. Apply these by hand in wp-admin after publishing as
          pending — they aren&apos;t saved automatically yet.
        </p>
        {error && <p className="auth-error">{error}</p>}
        <div className="dashboard-section-actions">
          <button type="button" className="button-pill button-pill-secondary" onClick={() => setDraft(null)}>
            Start over
          </button>
          <button type="button" className="button-pill" onClick={handlePublish} disabled={publishing}>
            {publishing ? "Saving…" : "Save as pending post"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="draft-input">
      <label>
        Notes / pasted material
        <textarea
          rows={10}
          placeholder="Paste your notes, a press release, or anything else you have..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <label>
        Photos
        <input type="file" accept="image/*" multiple onChange={handleImageSelect} />
      </label>
      {images.length > 0 && (
        <ul className="draft-image-list">
          {images.map((img, i) => (
            <li key={i}>
              {img.name}
              <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="auth-error">{error}</p>}
      <button type="button" className="button-pill" onClick={handleGenerate} disabled={generating}>
        {generating ? "Drafting…" : "Generate draft"}
      </button>
    </div>
  );
}
