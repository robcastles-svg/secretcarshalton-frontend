"use client";

import { useState } from "react";
import { PayPalPayButton } from "@/app/advertise/_components/PayPalPayButton";

/** Must match SC_Ads_Donations::AMOUNTS. */
const ONE_OFF_AMOUNTS = [5, 10, 20, 30];

/** One-off donation: pick an amount, then pay through the site's own PayPal checkout (SC_Ads_Donations). */
export function OneOffDonation() {
  const [amount, setAmount] = useState<number | null>(null);
  const [paid, setPaid] = useState(false);

  if (paid) {
    return (
      <p className="donate-thanks" role="status">
        Thank you so much for your donation — it really does make a difference.
      </p>
    );
  }

  return (
    <>
      <div className="donate-amounts" role="group" aria-label="One-off amount">
        {ONE_OFF_AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            className={`donate-amount${amount === a ? " donate-amount-active" : ""}`}
            aria-pressed={amount === a}
            onClick={() => setAmount(a)}
          >
            £{a}
          </button>
        ))}
      </div>
      {amount ? (
        <div className="donate-paypal">
          <PayPalPayButton
            adId={amount}
            extraBody={{ amount: String(amount) }}
            endpoints={{ createOrder: "/api/donate/create-order", capture: "/api/donate/capture" }}
            onPaid={() => setPaid(true)}
          />
        </div>
      ) : (
        <p className="donate-hint">Choose an amount to pay by PayPal or card.</p>
      )}
    </>
  );
}
