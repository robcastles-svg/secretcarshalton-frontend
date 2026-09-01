"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/app/_components/PasswordInput";

export function LoginModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      onClose();
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Login failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div
        className="login-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Log in"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="login-modal-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2>Log in</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Username or email
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoFocus
            />
          </label>
          <label>
            Password
            <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="button-pill button-pill-active" disabled={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="auth-switch">
          <a href="https://www.staging19.secretcarshalton.com/wp-login.php?action=lostpassword">
            Forgot your password?
          </a>
        </p>
        <p className="auth-switch">
          Not a member yet? <Link href="/register">Join Secret Carshalton</Link>
        </p>
      </div>
    </div>
  );
}
