"use client";

import { useState } from "react";

/** Small "Copy" pill for contact details. */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="evx-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Clipboard can be unavailable (old browsers, non-HTTPS) — the text is still selectable.
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
