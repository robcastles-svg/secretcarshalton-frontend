import Link from "next/link";
import { redirect } from "next/navigation";
import { PayNow, SubscribeNow } from "@/app/_components/PayNow";
import { getSessionToken } from "@/lib/auth";
import { GROUP_PROMOTION_PRICE, STANDARD_LISTING_PRICE, formatUntil } from "@/lib/pricing";
import { getMyJobs, getMyListings } from "@/lib/wordpress";
import { FeaturedPay } from "./_components/FeaturedPay";

export const metadata = { title: "Pay — Secret Carshalton", robots: { index: false } };

/**
 * One place to pay for something already submitted: the dashboard's
 * "Pay now"/"Renew" links and the Featured renewal email point here.
 * ?kind=job|standard_listing|featured|group_promotion&id=…
 */
export default async function PayPage({ searchParams }: { searchParams: Promise<{ kind?: string; id?: string }> }) {
  const { kind = "", id = "" } = await searchParams;
  const token = await getSessionToken();
  if (!token) redirect(`/login?next=${encodeURIComponent(`/payment/pay?kind=${kind}&id=${id}`)}`);

  const itemId = Number(id);
  let body: React.ReactNode = null;
  let heading = "Payment";

  if (kind === "job") {
    const job = (await getMyJobs(token)).find((j) => j.id === itemId);
    if (job) {
      heading = job.title;
      body =
        job.status === "publish" ? (
          <p>This job is already live{job.expiresOn ? ` until ${formatUntil(job.expiresOn)}` : ""}.</p>
        ) : (
          <PayNow
            kind="job"
            id={job.id}
            price={job.price || ""}
            what="job post, live for 7 days"
            paidText="Paid — your job is live until {until}."
            viewPath="/jobs/"
          />
        );
    }
  } else {
    const listing = (await getMyListings(token)).find((l) => l.id === itemId);
    if (listing) {
      heading = listing.title;
      if (kind === "standard_listing") {
        body = listing.subscribed ? (
          <p>This listing already has a yearly payment set up.</p>
        ) : (
          <SubscribeNow kind="standard_listing" id={listing.id} price={STANDARD_LISTING_PRICE} what="standard directory listing" />
        );
      } else if (kind === "featured") {
        body = (
          <>
            {listing.featuredUntil && <p>Currently Featured until {formatUntil(listing.featuredUntil)} — renewing adds on to that.</p>}
            <FeaturedPay listingId={listing.id} initialTier={listing.featuredTier} />
          </>
        );
      } else if (kind === "group_promotion") {
        body = (
          <>
            {listing.promotedUntil && <p>Currently promoted until {formatUntil(listing.promotedUntil)} — paying again adds 30 days.</p>}
            <PayNow
              kind="group_promotion"
              id={listing.id}
              price={GROUP_PROMOTION_PRICE.split(" ")[0]}
              what="promote your group for 30 days"
              paidText="Paid — your group is promoted until {until}."
            />
          </>
        );
      }
    }
  }

  return (
    <main className="container auth-page">
      <h1>{heading}</h1>
      {body ?? <p>We couldn&apos;t find that item on your account.</p>}
      <p>
        <Link href="/dashboard">Back to your dashboard</Link>
      </p>
    </main>
  );
}
