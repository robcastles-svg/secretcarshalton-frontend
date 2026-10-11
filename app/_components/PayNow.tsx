"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PayPalPayButton } from "@/app/advertise/_components/PayPalPayButton";
import { formatUntil } from "@/lib/pricing";

/**
 * A one-off payment on the shared checkout (/api/pay/{kind}/{id}): shows
 * the price and PayPal's buttons, then `paidText` once it's gone through
 * (the item is live by then; "{until}" is filled in with the end date) and
 * a link to it when `viewPath` is given. Plain props rather than a render
 * function, so server pages can use it too. Prices are set server-side;
 * `price` here is only the label.
 */
export function PayNow({
  kind,
  id,
  price,
  what,
  paidText,
  viewPath,
  extraBody,
}: {
  kind: "job" | "featured" | "group_promotion";
  id: number;
  price: string;
  what: string;
  paidText: string;
  /** e.g. "/jobs/" — links to viewPath + the item's slug after payment. */
  viewPath?: string;
  extraBody?: Record<string, string>;
}) {
  const router = useRouter();
  const [result, setResult] = useState<{ slug?: string; until?: string } | null>(null);

  if (result) {
    return (
      <div className="pay-now pay-now-done">
        <p>
          {paidText.replace("{until}", formatUntil(result.until) || "the end of the period")}
          {viewPath && result.slug && (
            <>
              {" "}
              <a href={`${viewPath}${result.slug}`}>View it</a>
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="pay-now">
      <p className="pay-now-head">
        <strong>{price}</strong> — {what}
      </p>
      <PayPalPayButton
        adId={id}
        endpoints={{ createOrder: `/api/pay/${kind}/${id}/create-order`, capture: `/api/pay/${kind}/${id}/capture` }}
        extraBody={extraBody}
        onPaid={(body) => {
          setResult({
            slug: typeof body.slug === "string" ? body.slug : undefined,
            until: typeof body.until === "string" ? body.until : undefined,
          });
          router.refresh();
        }}
      />
    </div>
  );
}

/** "Set up yearly payment" — sends the member to PayPal's subscription page (see /api/subscribe). */
export function SubscribeNow({ kind, id, price, what }: { kind: "standard_listing"; id: number; price: string; what: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/subscribe/${kind}/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: window.location.pathname }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.approveUrl) {
      window.location.href = body.approveUrl;
      return;
    }
    setError(body.error || "Couldn't start the payment — please try again.");
    setBusy(false);
  }

  return (
    <div className="pay-now">
      <p className="pay-now-head">
        <strong>{price}</strong> — {what}
      </p>
      <button type="button" className="button-pill" onClick={start} disabled={busy}>
        {busy ? "Opening PayPal…" : "Pay with PayPal"}
      </button>
      <p className="dashboard-hint">Renews automatically each year — cancel any time from your PayPal account.</p>
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
