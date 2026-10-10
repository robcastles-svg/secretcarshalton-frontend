"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PayPalPayButton } from "@/app/advertise/_components/PayPalPayButton";

/**
 * "Pay £5 with PayPal" for featuring one event — the existing PayPal
 * buttons (same setup as text ads), pointed at the event featuring
 * routes. The price is decided server-side (SC_Events_Featured::PRICE).
 */
export function FeatureEventPay({ eventId, onPaid }: { eventId: number; onPaid?: () => void }) {
  const router = useRouter();
  const [paid, setPaid] = useState(false);

  if (paid) {
    return <div className="evf-msg evf-msg-ok">Thank you — your event is now featured until its date.</div>;
  }
  return (
    <div className="evf-paypal">
      <PayPalPayButton
        adId={eventId}
        endpoints={{
          createOrder: `/api/events/${eventId}/feature/create-order`,
          capture: `/api/events/${eventId}/feature/capture`,
        }}
        onPaid={() => {
          setPaid(true);
          onPaid?.();
          router.refresh();
        }}
      />
    </div>
  );
}
