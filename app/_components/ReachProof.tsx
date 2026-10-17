import Link from "next/link";
import { REACH } from "@/lib/socialStats";

/**
 * "Why Secret Carshalton?" — the reach evidence shown on every page that
 * asks people to advertise, list or add something (Rob, Oct 2026). Open
 * next to the price on paid pages; folded into a one-line "Who'll see
 * this?" bar on the free forms, so the form still comes first. Plain
 * <details>, no script.
 *
 * `audience` picks the wording: logo lines only where there's a logo (ads
 * and listings), and the stories line only where it's true — every event,
 * paid job posts, promoted groups (Rob).
 */
type Audience = "advertiser" | "event" | "job" | "group" | "news";

const STORIES: Partial<Record<Audience, string>> = {
  event: "Every event gets a mention on our Facebook and Instagram stories",
  job: "Paid job posts get a mention on our Facebook and Instagram stories",
  group: "Promoted groups get a mention on our Facebook and Instagram stories",
};

function TickList({ audience }: { audience: Audience }) {
  const logo = audience === "advertiser";
  const items = [
    `${logo ? "Your logo seen" : "Seen"} by ${REACH.visitors}* website visitors a month`,
    logo
      ? `Your logo in front of over ${REACH.instagram} local Instagram followers`
      : `Over ${REACH.instagram} local Instagram followers`,
    `Over ${REACH.facebook} Facebook page followers`,
    "A super-engaged social audience, with lots of comments and shares",
    logo ? `Your logo sometimes appears at the end of our social reels, which average ${REACH.reelViews} views` : null,
    STORIES[audience] ?? null,
  ].filter((x): x is string => Boolean(x));

  return (
    <>
      <ul className="reach-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
        <li>
          A popular local site: <Link href="/reviews">see what people say</Link>
        </li>
      </ul>
      <p className="reach-note">
        * 40,000 from server stats, 6,000 from Google Analytics. Bots make traffic hard to measure, so the true figure
        is probably in between.
      </p>
    </>
  );
}

export function ReachProof({ audience, folded = false }: { audience: Audience; folded?: boolean }) {
  if (folded) {
    return (
      <details className="reach-proof reach-proof-folded">
        <summary>
          <span>Who&rsquo;ll see this?</span>
          <span className="reach-summary-hint">Our reach</span>
        </summary>
        <TickList audience={audience} />
      </details>
    );
  }
  return (
    <section className="reach-proof" aria-labelledby="reach-proof-title">
      <h2 id="reach-proof-title">Why Secret Carshalton?</h2>
      <TickList audience={audience} />
    </section>
  );
}
