"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/**
 * Google Identity Services. Read through gsi() rather than declaring it on
 * Window: StyledMap already declares the Maps API there, and the two clash.
 */
type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
};
function gsi(): GoogleIdentity | undefined {
  return (window as unknown as { google?: GoogleIdentity }).google;
}

let scriptPromise: Promise<void> | null = null;
function loadGoogle(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Google sign-in didn't load"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * "Continue with Google" (Google's own button), on /login, /register and
 * the login pop-up. An existing member is logged in straight away; someone
 * new picks their public username first (prefilled with a suggestion), so
 * their real Google name is never published without asking. Shows nothing
 * until NEXT_PUBLIC_GOOGLE_CLIENT_ID is set.
 */
export function GoogleSignIn({
  newsletter = false,
  next = "/dashboard",
  onDone,
}: {
  /** The sign-up page's "Send me the Insider newsletter" box, for new accounts. */
  newsletter?: boolean;
  next?: string;
  /** Instead of navigating (the login pop-up refreshes the page it's on). */
  onDone?: () => void;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const newsletterRef = useRef(newsletter);
  newsletterRef.current = newsletter;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signup, setSignup] = useState<{ token: string; username: string } | null>(null);
  // Google refuses to sign in inside the Facebook/Instagram apps' own browsers.
  const [inAppBrowser, setInAppBrowser] = useState(false);

  function finish() {
    if (onDone) {
      onDone();
    } else {
      router.push(next);
    }
    router.refresh();
  }

  useEffect(() => {
    if (/FBAN|FBAV|FB_IAB|Instagram/i.test(navigator.userAgent)) {
      setInAppBrowser(true);
      return;
    }
    if (!CLIENT_ID || !box.current) return;
    let cancelled = false;
    loadGoogle()
      .then(() => {
        const google = gsi();
        if (cancelled || !box.current || !google?.accounts?.id) return;
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async ({ credential }) => {
            setBusy(true);
            setError(null);
            const res = await fetch("/api/auth/google", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ credential }),
            });
            const data = await res.json().catch(() => ({}));
            setBusy(false);
            if (!res.ok) return setError(data.error || "Google sign-in didn't work — please try again.");
            if (data.needs_username) return setSignup({ token: data.signup_token, username: data.suggestion || "" });
            finish();
          },
        });
        google.accounts.id.renderButton(box.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: Math.min(box.current.offsetWidth || 320, 400),
        });
      })
      .catch(() => setError("Google sign-in couldn't load. You can still use a username and password."));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function completeSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!signup) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/google/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signup_token: signup.token, username: signup.username, newsletter: newsletterRef.current }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return finish();
    setBusy(false);
    setError(data.error || "Couldn't create your account — please try again.");
  }

  if (!CLIENT_ID) return null;

  if (signup) {
    return (
      <form className="google-username" onSubmit={completeSignup}>
        <h2>Choose your public username</h2>
        <p>This is the name other people see on your comments and profile. You can change how your name shows later, from your dashboard.</p>
        <label>
          Username
          <input
            type="text"
            value={signup.username}
            onChange={(e) => setSignup({ ...signup, username: e.target.value })}
            minLength={3}
            maxLength={30}
            required
            autoFocus
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" className="button-pill" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    );
  }

  if (inAppBrowser) {
    return (
      <div className="google-signin">
        <p className="google-signin-note">
          To continue with Google, open this page in your phone&rsquo;s browser — tap <b>⋮</b> or <b>…</b> at the top, then
          &ldquo;Open in browser&rdquo;. Or use a username and password below.
        </p>
        <p className="auth-or">
          <span>or</span>
        </p>
      </div>
    );
  }

  return (
    <div className="google-signin">
      <div ref={box} className="google-signin-button" aria-busy={busy} />
      {error && <p className="auth-error">{error}</p>}
      <p className="auth-or">
        <span>or</span>
      </p>
    </div>
  );
}
