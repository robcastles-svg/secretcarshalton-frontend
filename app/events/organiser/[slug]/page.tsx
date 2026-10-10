import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SidebarAds } from "@/app/_components/SidebarAds";
import {
  emailFromBadUrl,
  getOccurrences,
  linkDomain,
  monthYear,
  organizerSocials,
  upcomingOccurrences,
} from "@/lib/event-view";
import { getAd, getScEventsByOrganizer, stripHtml } from "@/lib/wordpress";
import { CopyButton } from "../../_components/CopyButton";
import { EventCard } from "../../_components/EventCard";
import { GlobeIcon, MailIcon, PhoneIcon, PinIcon, SOCIAL_ICONS } from "../../_components/EvIcons";
import { BackToEvent } from "../../_components/BackToEvent";
import { OrganizerClaim } from "./_components/OrganizerClaim";
import { PastEventsList } from "../../_components/PastEventsList";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const events = await getScEventsByOrganizer(slug).catch(() => []);
  const organizer = events[0]?.sc_event_organizer_profile;
  if (!organizer) return {};
  return {
    title: `${organizer.name} — events on Secret Carshalton`,
    description: organizer.about?.trim().slice(0, 160) || `Upcoming and past events by ${organizer.name}.`,
  };
}

/**
 * Organiser profile, as the redesign mockup's "Organiser page" tab: white
 * reading cards on the dark page, contact details (only the rows that are
 * filled in) and socials in the sidebar, then "Coming up" cards and a
 * compact past-events list. Contact details live only here, never on
 * each event (brief: "Decisions already made").
 */
export default async function EventsByOrganizerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [events, sidebarAd1, sidebarAd2, sidebarAd3] = await Promise.all([
    getScEventsByOrganizer(slug).catch(() => []),
    getAd("sidebar", 1),
    getAd("sidebar", 2),
    getAd("sidebar", 3),
  ]);

  const organizer = events[0]?.sc_event_organizer_profile;
  if (!organizer) notFound();

  const now = Date.now();
  const upcoming = events
    .map((event) => ({ event, next: upcomingOccurrences(event, now)[0] }))
    .filter((x) => x.next)
    .sort((a, b) => a.next.start.getTime() - b.next.start.getTime());
  const past = events
    .filter((e) => upcomingOccurrences(e, now).length === 0)
    .map((e) => ({ event: e, last: getOccurrences(e).at(-1) }))
    .filter((x) => x.last)
    .sort((a, b) => b.last!.start.getTime() - a.last!.start.getTime())
    .map(({ event, last }) => ({
      slug: event.slug,
      title: stripHtml(event.title.rendered),
      date: last!.start.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    }));

  const firstDates = events.map((e) => getOccurrences(e)[0]?.start).filter((d): d is Date => !!d);
  const earliest = firstDates.length ? new Date(Math.min(...firstDates.map((d) => d.getTime()))) : null;

  // Old records saved an email in the website box ("http://name@example.com");
  // show it as the email it is rather than a broken link.
  const websiteDomain = linkDomain(organizer.url);
  const website = websiteDomain ? (/^https?:\/\//i.test(organizer.url) ? organizer.url : `https://${organizer.url}`) : null;
  const email = organizer.email || emailFromBadUrl(organizer.url);
  const socials = organizerSocials(organizer);
  const hasContact = Boolean(email || organizer.phone || website || organizer.address);

  return (
    <main className="evx evx-page-org">
      <div className="evx-crumb">
        <Suspense
          fallback={
            <Link href="/events" className="evx-back">
              Back to events
            </Link>
          }
        >
          <BackToEvent />
        </Suspense>
      </div>

      <div className="evx-layout">
        <div className="evx-main">
          <article className="evx-seg evx-o-head">
            <p className="evx-eyebrow">Organiser</p>
            <h1 className="evx-o-title">{organizer.name}</h1>
            <p className="evx-o-meta">
              {events.length} event{events.length === 1 ? "" : "s"} on Secret Carshalton
              {earliest ? ` since ${monthYear(earliest)}` : ""}
            </p>
            {organizer.about?.trim() && <p className="evx-o-about">{organizer.about.trim()}</p>}
          </article>

          <article className="evx-seg evx-o-section evx-o-upcoming">
            <h2>
              Coming up <span className="evx-count">{upcoming.length}</span>
            </h2>
            {upcoming.length > 0 ? (
              <div className="evx-grid evx-grid-2">
                {upcoming.map(({ event, next }) => (
                  <EventCard key={event.id} event={event} occurrence={next} tone="light" />
                ))}
              </div>
            ) : (
              <p className="evx-o-empty">
                Nothing coming up just now. <Link href="/events">See all upcoming events →</Link>
              </p>
            )}
          </article>

          {past.length > 0 && (
            <article className="evx-seg evx-o-section evx-o-past">
              <h2>
                Past events <span className="evx-count">{past.length}</span>
              </h2>
              <PastEventsList items={past} />
            </article>
          )}
        </div>

        <aside className="evx-side">
          {hasContact && (
            <section className="evx-card-dk evx-o-contact">
              <p className="evx-eyebrow">Contact</p>
              <ul className="evx-contact">
                {email && (
                  <li>
                    <MailIcon />
                    <a className="evx-contact-v evx-contact-link" href={`mailto:${email}`}>
                      {email}
                    </a>
                    <CopyButton value={email} />
                  </li>
                )}
                {organizer.phone && (
                  <li>
                    <PhoneIcon />
                    <span className="evx-contact-v">{organizer.phone}</span>
                    <CopyButton value={organizer.phone} />
                  </li>
                )}
                {website && (
                  <li>
                    <GlobeIcon />
                    <a className="evx-contact-v evx-contact-link" href={website} target="_blank" rel="noopener noreferrer">
                      {websiteDomain}
                    </a>
                  </li>
                )}
                {organizer.address && (
                  <li>
                    <PinIcon />
                    <span className="evx-contact-v">{organizer.address}</span>
                    <CopyButton value={organizer.address} />
                  </li>
                )}
              </ul>
            </section>
          )}

          {socials.length > 0 && (
            <section className="evx-card-dk evx-o-follow">
              <p className="evx-eyebrow">Follow</p>
              <div className="evx-socials">
                {socials.map((s) => {
                  const Icon = SOCIAL_ICONS[s.network];
                  return (
                    <a
                      key={s.network}
                      className="evx-soc"
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${organizer.name} on ${s.label}`}
                    >
                      <Icon />
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          <section className="evx-card-dk evx-o-claim">
            <p className="evx-eyebrow">Is this your group?</p>
            <Suspense fallback={<p>Keep these details up to date, add a logo and manage your events.</p>}>
              <OrganizerClaim organizerId={organizer.id} slug={organizer.slug} claimPending={Boolean(organizer.claim_pending)} />
            </Suspense>
          </section>

          <div className="evx-o-ads">
            <SidebarAds ads={[sidebarAd1, sidebarAd2, sidebarAd3]} />
          </div>
        </aside>
      </div>
    </main>
  );
}
