"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PayPalPayButton } from "@/app/advertise/_components/PayPalPayButton";

/** For an ad sitting unpaid in the dashboard (submitted earlier, payment abandoned or just never finished) — same PayPal flow as the submit form's payment step, so there isn't a second way to pay built separately. */
export function PayAdButton({ adId }: { adId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="dashboard-my-list-edit" onClick={() => setOpen(true)}>
        Pay now
      </button>
    );
  }

  return (
    <div style={{ minWidth: "12rem" }}>
      <PayPalPayButton adId={adId} onPaid={() => router.refresh()} />
    </div>
  );
}
