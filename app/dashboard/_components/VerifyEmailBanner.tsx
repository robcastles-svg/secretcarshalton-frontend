"use client";

import { useState } from "react";

export function VerifyEmailBanner() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleResend() {
    setStatus("sending");
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    setStatus(res.ok ? "sent" : "error");
  }

  return (
    <div className="dashboard-banner">
      <p>Please verify your email address to get the most out of your membership.</p>
      <button
        type="button"
        className="button-pill"
        onClick={handleResend}
        disabled={status === "sending" || status === "sent"}
      >
        {status === "sent" ? "Email sent" : status === "sending" ? "Sending…" : "Resend verification email"}
      </button>
      {status === "error" && <p className="auth-error">Something went wrong — please try again.</p>}
    </div>
  );
}
