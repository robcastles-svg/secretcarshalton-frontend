"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: {
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onError?: (err: unknown) => void;
      }) => { render: (container: HTMLElement) => void };
    };
  }
}

/**
 * Loads PayPal's JS SDK once (mode/currency come from our own backend, not
 * hardcoded, so this automatically follows whatever SC_Ads_PayPal_Settings
 * is set to — sandbox while testing, live once Rob flips the mode) and
 * renders its Buttons widget. createOrder/onApprove both call our own
 * /api/ads/paypal/* routes rather than talking to PayPal directly — the
 * amount actually charged is always decided server-side from the ad's own
 * stored placement/days, never by anything this component sends.
 */
export function PayPalPayButton({ adId, onPaid }: { adId: number; onPaid: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const configRes = await fetch("/api/ads/paypal/client-id").catch(() => null);
      if (!configRes || !configRes.ok) {
        if (!cancelled) setError("Payment isn't available right now — please try again shortly.");
        return;
      }
      const config = await configRes.json();

      if (!window.paypal) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
            config.clientId
          )}&currency=${encodeURIComponent(config.currency)}&intent=capture`;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load PayPal."));
          document.body.appendChild(script);
        }).catch(() => {
          if (!cancelled) setError("Couldn't load PayPal — check your connection and try again.");
        });
      }

      if (!cancelled && window.paypal && containerRef.current) {
        setReady(true);
        window.paypal.Buttons({
          createOrder: async () => {
            const res = await fetch("/api/ads/paypal/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ adId }),
            });
            const body = await res.json();
            if (!res.ok) {
              setError(body.error || "Could not start payment.");
              throw new Error(body.error || "Could not start payment.");
            }
            return body.orderId;
          },
          onApprove: async (data) => {
            const res = await fetch("/api/ads/paypal/capture-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ adId, orderId: data.orderID }),
            });
            const body = await res.json();
            if (!res.ok) {
              setError(body.error || "Payment didn't go through — please try again.");
              return;
            }
            onPaid();
          },
          onError: () => {
            setError("Something went wrong with PayPal — please try again.");
          },
        }).render(containerRef.current);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adId]);

  return (
    <div>
      <div ref={containerRef} />
      {!ready && !error && <p className="dashboard-hint">Loading payment…</p>}
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
