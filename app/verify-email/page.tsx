"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = "verifying" | "success" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found in this link.");
      return;
    }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus("success");
        } else {
          setStatus("error");
          setMessage(data.error || "This verification link is invalid or has already been used.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Couldn't reach the membership service — please try again in a moment.");
      });
  }, [token]);

  return (
    <main className="container auth-page">
      <h1>Confirm your email</h1>
      {status === "verifying" && <p>Confirming your email address…</p>}
      {status === "success" && (
        <p>
          Your email is confirmed. <Link href="/dashboard">Go to your dashboard</Link>
        </p>
      )}
      {status === "error" && (
        <>
          <p className="auth-error">{message}</p>
          <p>
            <Link href="/dashboard">Go to your dashboard</Link> — you can resend the verification
            email from there.
          </p>
        </>
      )}
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="container auth-page">
          <h1>Confirm your email</h1>
          <p>Confirming your email address…</p>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
