import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { confirmSubscription } from "@/lib/wordpress";

export const metadata = { title: "Payment — Secret Carshalton", robots: { index: false } };

/**
 * Where PayPal sends someone back after approving a yearly subscription
 * (see /api/subscribe). PayPal adds ?subscription_id=…; confirming it with
 * WordPress puts the listing live.
 */
export default async function SubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; id?: string; subscription_id?: string }>;
}) {
  const { kind = "", id = "", subscription_id: subscriptionId = "" } = await searchParams;
  const token = await getSessionToken();
  if (!token) {
    redirect(`/login?next=${encodeURIComponent(`/payment/subscribed?kind=${kind}&id=${id}&subscription_id=${subscriptionId}`)}`);
  }

  const result =
    /^[a-z_]+$/.test(kind) && Number(id) && subscriptionId
      ? await confirmSubscription(token, kind, Number(id), subscriptionId)
      : { code: "missing", message: "This link is missing its payment details." };

  return (
    <main className="container auth-page">
      {"status" in result ? (
        <>
          <h1>Thank you — you&apos;re all set</h1>
          <p>
            Your payment is set up and your listing is now live. PayPal will renew it automatically each year; you can
            cancel any time from your PayPal account.
          </p>
          <p>
            {result.slug && (
              <>
                <Link href={`/directory/${result.slug}`} className="button-pill">
                  View your listing
                </Link>{" "}
              </>
            )}
            <Link href="/dashboard" className="button-pill button-pill-secondary">
              Go to your dashboard
            </Link>
          </p>
        </>
      ) : (
        <>
          <h1>We couldn&apos;t confirm that payment</h1>
          <p>{result.message}</p>
          <p>
            If PayPal took the payment, it will be sorted out — we get notified. You can also{" "}
            <Link href="/contact">contact us</Link>.
          </p>
          <Link href="/dashboard" className="button-pill button-pill-secondary">
            Go to your dashboard
          </Link>
        </>
      )}
    </main>
  );
}
