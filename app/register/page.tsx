"use client";

import Link from "next/link";
import { GoogleSignIn } from "@/app/_components/GoogleSignIn";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/app/_components/PasswordInput";
import { SpamTrap, spamFields } from "@/app/_components/SpamTrap";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newsletter, setNewsletter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, newsletter, ...spamFields(e.currentTarget) }),
    });

    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Registration failed. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="container auth-page">
      <h1>Join Secret Carshalton</h1>
      <p>
        Membership is free, and unlocks comments, event RSVPs, directory listings and more —
        with tiers and badges as you get involved.
      </p>
      {/* One tick box for both ways of joining: it's above the Google button. */}
      <label className="auth-newsletter">
        <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} />
        <span>
          Send me the <b>Secret Carshalton Insider</b> newsletter. We&rsquo;ll email you to confirm first, and you can
          unsubscribe any time.
        </span>
      </label>
      <GoogleSignIn newsletter={newsletter} />
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Username <small>(shown publicly)</small>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <PasswordInput
            value={password}
            onChange={setPassword}
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="button-pill" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </button>
        <SpamTrap />
      </form>
      <p className="auth-switch">
        Already a member? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
