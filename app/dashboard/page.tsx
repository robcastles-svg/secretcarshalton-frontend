import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AD_SELF_SERVE_PLACEMENTS,
  getMemberMe,
  getMyAds,
  getMyBookmarks,
  getMyComments,
  getMyCommunityPosts,
  getMyEvents,
  getMyJobs,
  getMyListings,
  getMyRsvpdEvents,
  linkForPostType,
  parseEventDate,
} from "@/lib/wordpress";
import { FEATURED_DIRECTORY_TIERS } from "@/lib/pricing";
import { getSessionToken } from "@/lib/auth";
import { ExpandableList } from "@/app/_components/ExpandableList";
import { ExtendAdButton } from "./_components/ExtendAdButton";
import { PayAdButton } from "./_components/PayAdButton";
import { DeleteAdButton } from "./_components/DeleteAdButton";
import { EditAdButton } from "./_components/EditAdButton";
import { LogoutButton } from "./_components/LogoutButton";
import { VerifyEmailBanner } from "./_components/VerifyEmailBanner";

export const metadata = { title: "Your dashboard — Secret Carshalton" };

const UPGRADE_STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Not approved",
};

const POST_STATUS_LABEL: Record<string, string> = {
  publish: "Live",
  pending: "Awaiting review",
  draft: "Draft",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * sc_start isn't always valid ISO — older, migrated events carry a
 * malformed format like "2026-5-24T14:30+0:00" (unpadded month/day, a
 * broken timezone offset) that new Date() can't parse. parseEventDate
 * already handles this everywhere else on the site; formatDate's plain
 * new Date() doesn't, so a raw formatDate(rsvp.start) rendered "Invalid
 * Date" for exactly those older events.
 */
function formatEventStart(raw: string) {
  const date = parseEventDate(raw);
  return date
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
}

// Matches SC_Membership_Tiers::all() in wordpress-plugins/sc-membership —
// keep these two in sync if the tier ladder changes.
const TIERS = [
  { slug: "newcomer", label: "Newcomer", threshold: 0 },
  { slug: "regular", label: "Regular", threshold: 50 },
  { slug: "local_legend", label: "Local Legend", threshold: 200 },
  { slug: "carshalton_champion", label: "Carshalton Champion", threshold: 500 },
];

function adStatusChip(ad: { active: boolean; paymentStatus: string }) {
  if (ad.active) return { label: "Live", cls: "dash-chip-ok" };
  if (ad.paymentStatus === "paid") return { label: "Paid — going live soon", cls: "dash-chip-sched" };
  return { label: "Awaiting payment", cls: "dash-chip-wait" };
}

function postStatusChip(status: string) {
  if (status === "publish") return { label: "Live", cls: "dash-chip-ok" };
  if (status === "pending") return { label: "Awaiting review", cls: "dash-chip-wait" };
  return { label: POST_STATUS_LABEL[status] ?? status, cls: "dash-chip-off" };
}

export default async function DashboardPage() {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const profile = await getMemberMe(token);
  if (!profile) redirect("/login");

  const [myListings, myEvents, myComments, myBookmarks, myRsvps, myAds, myJobs, myCommunityPosts] = await Promise.all([
    getMyListings(token),
    getMyEvents(token),
    getMyComments(token),
    getMyBookmarks(token),
    getMyRsvpdEvents(token),
    getMyAds(token),
    getMyJobs(token),
    getMyCommunityPosts(token),
  ]);

  const hasBusiness = profile.directory_upgrade_status === "approved";
  const businessListing = hasBusiness
    ? myListings.find((l) => l.id === profile.directory_upgrade_listing_id)
    : undefined;
  const businessTier = FEATURED_DIRECTORY_TIERS.find((t) => t.slug === profile.directory_upgrade_tier);

  const hasAds = myAds.length > 0;
  const hasSubmissions = myEvents.length > 0 || myJobs.length > 0 || myCommunityPosts.length > 0;

  return (
    <main className="container dash-page" id="dash-top">
      <div className="dash-layout">
        {/* Sidebar — a plain always-visible nav on desktop. On mobile it's
            collapsed behind a tap-to-expand toggle (CSS-only checkbox hack,
            no JS) so it stays at the TOP where it's discoverable as
            navigation, without pushing real content down a 20-link wall. */}
        <input type="checkbox" id="dash-nav-toggle" className="dash-nav-toggle-input" />
        <label htmlFor="dash-nav-toggle" className="dash-nav-toggle-label">
          Jump to a section
        </label>
        <nav className="dash-sidebar" aria-label="My account">
          <div className="dash-sidebar-label">My Secret Carshalton</div>
          <a href="#dash-top" className="dash-sidebar-link dash-sidebar-link-current">
            Overview
          </a>
          <a href="#account" className="dash-sidebar-link">
            My profile
          </a>
          <a href="#comments" className="dash-sidebar-link">
            My comments
          </a>
          <a href="#bookmarks" className="dash-sidebar-link">
            Saved &amp; favourites
          </a>

          <div className="dash-sidebar-label">My content</div>
          <a href="#rsvps" className="dash-sidebar-link">
            My events
          </a>
          {myJobs.length > 0 && (
            <a href="#submissions-jobs" className="dash-sidebar-link">
              My jobs
            </a>
          )}
          <a href="#community-posts" className="dash-sidebar-link">
            My community groups
          </a>

          {hasAds && (
            <>
              <div className="dash-sidebar-label">My advertising</div>
              <a href="#advertising" className="dash-sidebar-link">
                Adverts
              </a>
            </>
          )}

          {hasBusiness && (
            <>
              <div className="dash-sidebar-label">My business</div>
              <a href="#business" className="dash-sidebar-link">
                Directory listing
              </a>
              <a href="#business-campaign" className="dash-sidebar-link">
                Campaign progress
              </a>
            </>
          )}

          <div className="dash-sidebar-label">Create</div>
          <Link href="/events/submit" className="dash-sidebar-link">
            Submit an event
          </Link>
          <Link href="/jobs/manager" className="dash-sidebar-link">
            Submit a job
          </Link>
          <Link href="/community/groups/submit" className="dash-sidebar-link">
            Submit a community group
          </Link>
          <Link href="/advertise" className="dash-sidebar-link dash-sidebar-link-highlight">
            Advertise on Secret Carshalton
          </Link>
        </nav>

        {/* Main column — section order below follows the sidebar's own
            top-to-bottom order (My Secret Carshalton -> My content -> My
            advertising -> My business), so a sidebar link scrolls roughly
            the direction its position implies rather than jumping
            backwards. */}
        <div className="dash-main">
          <div className="dash-hero">
            <div>
              <h1 className="dash-h1">
                {profile.is_returning ? "Welcome back" : "Hi"} {profile.display_name}
              </h1>
              <p className="dash-hero-sub">Everything attached to your account, in one place.</p>
            </div>
            <div className="dash-hero-actions">
              <Link href="/advertise" className="button-pill">
                Advertise
              </Link>
              <LogoutButton />
            </div>
          </div>

          <p className="dashboard-members-link">
            <Link href="/members">Browse all members →</Link>
          </p>

          {!profile.email_verified && <VerifyEmailBanner />}

          {profile.is_editor && (
            <section className="dash-panel dash-editor-cta">
              <h2 className="dash-h3">Editorial</h2>
              <p className="dashboard-hint">Draft a new story from notes or photos, with Claude&apos;s help.</p>
              <Link href="/admin/draft" className="button-pill">
                Draft a story
              </Link>
            </section>
          )}

          {/* Quick actions */}
          <div className="dash-quick-actions">
            <Link href="/events/submit" className="dash-action">
              <strong>Submit an event</strong>
              <span className="dash-action-meta">Free · promote for £5</span>
            </Link>
            <Link href="/jobs/manager" className="dash-action">
              <strong>Submit a job</strong>
              <span className="dash-action-meta">From £15 · runs 7 days</span>
            </Link>
            <Link href="/community/groups/submit" className="dash-action">
              <strong>Submit a group</strong>
              <span className="dash-action-meta">Free · promote for £10</span>
            </Link>
            <Link href="/advertise#text-ads" className="dash-action">
              <strong>Create a Text Ad</strong>
              <span className="dash-action-meta">From £2.50 a day</span>
            </Link>
          </div>

          {/* Tier / points card — unchanged from the previous dashboard */}
          <div className="dashboard-tier-card">
            <div className="dashboard-tier-badge">{profile.tier.label}</div>
            <p className="dashboard-points">{profile.points} points</p>
            {profile.next_tier && profile.points_to_next_tier !== null && (
              <p className="dashboard-progress">
                {profile.points_to_next_tier} points to <strong>{profile.next_tier.label}</strong>
              </p>
            )}
            <p className="dashboard-joined">
              Member since {new Date(profile.joined_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>

            <details className="dashboard-tier-explainer">
              <summary>How tiers &amp; points work</summary>
              <p>Points build up as you take part around the site:</p>
              <ul>
                <li>+2 for a comment that gets approved</li>
                <li>+5 for marking yourself interested in an event</li>
                <li>+10 for claiming an event listing</li>
                <li>+15 for claiming a directory listing</li>
              </ul>
              <ul className="dashboard-tier-ladder">
                {TIERS.map((tier) => (
                  <li key={tier.slug} className={profile.tier.slug === tier.slug ? "current" : undefined}>
                    {tier.label}
                    <span>{tier.threshold}+ points</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>

          {/* Account — matches the sidebar's "My Secret Carshalton" group, first */}
          <section className="dash-panel" id="account">
            <h2 className="dash-h3">Account</h2>
            <div className="dashboard-account-row">
              {/* Every member shows the same badge — no profile photo uploads, by design (see SC_Membership_REST::filter_default_avatar). The directory is where we want people putting in effort, not a personal profile. */}
              <img src="/default-avatar.png" alt="" className="dashboard-avatar" />
              <span className="dashboard-greeting">
                {profile.is_returning ? "Welcome back" : "Hello"} {profile.display_name}
              </span>
            </div>
            <p className="dashboard-hint">
              Username and email aren&apos;t shown here yet — coming soon, once account details are wired up.
            </p>
            <a
              className="button-pill button-pill-secondary"
              href="https://www.staging19.secretcarshalton.com/wp-login.php?action=lostpassword"
            >
              Change password
            </a>
          </section>

          {/* Free for every member */}
          <div className="dash-group">
            <h2 className="dash-group-title">Free for every member</h2>

            <section className="dash-panel" id="comments">
              <h3 className="dash-h3">Your comments</h3>
              {myComments.length === 0 ? (
                <p className="dashboard-hint">Nothing yet — comment on a story to join the conversation.</p>
              ) : (
                <ExpandableList
                  items={myComments}
                  listClassName="dashboard-my-list dashboard-my-comments"
                  itemKey={(comment) => comment.id}
                  noun="comment"
                  renderItem={(comment) => (
                    <>
                      <div>
                        {comment.status !== "approved" && (
                          <span className="dashboard-status-badge dashboard-status-pending">Awaiting moderation</span>
                        )}
                        {(() => {
                          const link = linkForPostType(comment.post_type, comment.post_slug);
                          return link ? (
                            <Link href={link}>{comment.post_title}</Link>
                          ) : (
                            <span>{comment.post_title ?? "A post"}</span>
                          );
                        })()}
                        <time>{formatDate(comment.date)}</time>
                      </div>
                      <p dangerouslySetInnerHTML={{ __html: comment.content.rendered }} />
                    </>
                  )}
                />
              )}
            </section>

            <section className="dash-panel" id="rsvps">
              <h3 className="dash-h3">Events you&apos;re going to</h3>
              {myRsvps.length === 0 ? (
                <p className="dashboard-hint">Nothing yet — RSVP to an event to keep track of it here.</p>
              ) : (
                <ExpandableList
                  items={myRsvps}
                  listClassName="dashboard-my-list"
                  itemKey={(rsvp) => rsvp.id}
                  noun="event"
                  renderItem={(rsvp) => (
                    <>
                      <Link href={`/events/${rsvp.slug}`}>{rsvp.title}</Link>
                      {rsvp.start && formatEventStart(rsvp.start) && (
                        <time className="dashboard-my-list-date">{formatEventStart(rsvp.start)}</time>
                      )}
                    </>
                  )}
                />
              )}
            </section>

            <section className="dash-panel" id="bookmarks">
              <h3 className="dash-h3">Bookmarks</h3>
              {myBookmarks.length === 0 ? (
                <p className="dashboard-hint">
                  Nothing saved yet — bookmark a story or directory listing to find it again here.
                </p>
              ) : (
                <ExpandableList
                  items={myBookmarks}
                  listClassName="dashboard-my-list"
                  itemKey={(bookmark) => `${bookmark.content_type}-${bookmark.content_id}`}
                  noun="bookmark"
                  renderItem={(bookmark) => (
                    <>
                      <span className={`dashboard-status-badge dashboard-status-${bookmark.content_type}`}>
                        {bookmark.content_type === "listing" ? "Directory" : "Story"}
                      </span>
                      <Link href={bookmark.link}>{bookmark.title}</Link>
                    </>
                  )}
                />
              )}
            </section>
          </div>

          {/* My submissions — matches the sidebar's "My content" group (events/jobs/community groups) */}
          {hasSubmissions && (
            <section className="dash-submissions" id="submissions" aria-labelledby="submissions-h">
              <h2 id="submissions-h" className="dash-h2">
                My submissions
              </h2>
              <div className="dash-submissions-grid">
                <div className="dash-panel dash-panel-tight" id="submissions-events">
                  <div className="dash-panel-head">
                    <h3 className="dash-h3">Events</h3>
                    <Link href="/events/submit" className="dash-manage-link">
                      Manage
                    </Link>
                  </div>
                  {myEvents.length === 0 ? (
                    <p className="dashboard-hint">Nothing submitted yet.</p>
                  ) : (
                    <ExpandableList
                      items={myEvents}
                      listClassName="dash-row-list"
                      itemKey={(event) => event.id}
                      noun="event"
                      renderItem={(event) => {
                        const chip = postStatusChip(event.status);
                        return (
                          <>
                            <div>
                              {event.status === "publish" ? (
                                <Link href={`/events/${event.slug}`}>{event.title}</Link>
                              ) : (
                                <span>{event.title}</span>
                              )}
                              <div className="dash-meta">
                                {event.featured
                                  ? "Featured"
                                  : event.featuredStatus === "pending"
                                    ? "Featured requested"
                                    : `${event.views} view${event.views === 1 ? "" : "s"}`}
                                {" · "}
                                <Link href={`/events/${event.slug}/edit`} className="dash-manage-link">
                                  Edit
                                </Link>
                              </div>
                            </div>
                            <span className={`dash-chip ${chip.cls}`}>{chip.label}</span>
                          </>
                        );
                      }}
                    />
                  )}
                </div>

                <div className="dash-panel dash-panel-tight" id="submissions-jobs">
                  <div className="dash-panel-head">
                    <h3 className="dash-h3">Jobs</h3>
                    <Link href="/jobs/manager" className="dash-manage-link">
                      Manage
                    </Link>
                  </div>
                  {myJobs.length === 0 ? (
                    <p className="dashboard-hint">Nothing submitted yet.</p>
                  ) : (
                    <ExpandableList
                      items={myJobs}
                      listClassName="dash-row-list"
                      itemKey={(job) => job.id}
                      noun="job"
                      renderItem={(job) => {
                        const chip =
                          job.status === "publish"
                            ? { label: "Live", cls: "dash-chip-ok" }
                            : job.paymentStatus === "paid"
                              ? { label: "Paid — awaiting review", cls: "dash-chip-sched" }
                              : { label: "Awaiting payment", cls: "dash-chip-wait" };
                        return (
                          <>
                            <div>
                              {job.status === "publish" ? (
                                <Link href={`/jobs/${job.slug}`}>{job.title}</Link>
                              ) : (
                                <span>{job.title}</span>
                              )}
                              {job.company && <div className="dash-meta">{job.company}</div>}
                            </div>
                            <span className={`dash-chip ${chip.cls}`}>{chip.label}</span>
                          </>
                        );
                      }}
                    />
                  )}
                </div>

                <div className="dash-panel dash-panel-tight" id="submissions-community">
                  <div className="dash-panel-head">
                    <h3 className="dash-h3">Community groups</h3>
                    <Link href="/directory/submit" className="dash-manage-link">
                      Manage
                    </Link>
                  </div>
                  {myCommunityPosts.length === 0 ? (
                    <p className="dashboard-hint">Nothing shared yet.</p>
                  ) : (
                    <ExpandableList
                      items={myCommunityPosts}
                      listClassName="dash-row-list"
                      itemKey={(post) => post.id}
                      noun="post"
                      renderItem={(post) => {
                        const chip = postStatusChip(post.status);
                        return (
                          <>
                            {post.status === "publish" ? (
                              <Link href={`/${post.slug}`}>{post.title}</Link>
                            ) : (
                              <span>{post.title}</span>
                            )}
                            <span className={`dash-chip ${chip.cls}`}>{chip.label}</span>
                          </>
                        );
                      }}
                    />
                  )}
                </div>
              </div>
            </section>
          )}

          <div className="dash-group">
            <h2 className="dash-group-title">Share something free</h2>

            <section className="dash-panel" id="directory">
              <h3 className="dash-h3">Your directory listing{myListings.length === 1 ? "" : "s"}</h3>
              {myListings.length === 0 ? (
                <p className="dashboard-hint">Nothing yet — claim an existing listing or add a new one.</p>
              ) : (
                <ExpandableList
                  items={myListings}
                  listClassName="dashboard-my-list"
                  itemKey={(listing) => listing.id}
                  noun="listing"
                  renderItem={(listing) => (
                    <>
                      <span className={`dashboard-status-badge dashboard-status-${listing.status}`}>
                        {POST_STATUS_LABEL[listing.status] ?? listing.status}
                      </span>
                      {listing.status === "publish" ? (
                        <Link href={`/directory/${listing.slug}`}>{listing.title}</Link>
                      ) : (
                        <span>{listing.title}</span>
                      )}
                      <span className="dashboard-my-list-views">
                        {listing.views} view{listing.views === 1 ? "" : "s"}
                      </span>
                      <Link href={`/directory/${listing.slug}/edit`} className="dashboard-my-list-edit">
                        Edit
                      </Link>
                    </>
                  )}
                />
              )}
              <div className="dashboard-section-actions">
                <Link href="/directory" className="button-pill button-pill-secondary">
                  Browse the directory
                </Link>
                <Link href="/directory/submit" className="button-pill">
                  Add a listing
                </Link>
              </div>
            </section>

            <section className="dash-panel" id="community-posts">
              <h3 className="dash-h3">Your community post{myCommunityPosts.length === 1 ? "" : "s"}</h3>
              {myCommunityPosts.length === 0 ? (
                <p className="dashboard-hint">Nothing shared yet — got some local news worth spreading?</p>
              ) : (
                <ExpandableList
                  items={myCommunityPosts}
                  listClassName="dashboard-my-list"
                  itemKey={(post) => post.id}
                  noun="post"
                  renderItem={(post) => (
                    <>
                      <span className={`dashboard-status-badge dashboard-status-${post.status}`}>
                        {POST_STATUS_LABEL[post.status] ?? post.status}
                      </span>
                      {post.status === "publish" ? (
                        <Link href={`/${post.slug}`}>{post.title}</Link>
                      ) : (
                        <span>{post.title}</span>
                      )}
                    </>
                  )}
                />
              )}
              <div className="dashboard-section-actions">
                <Link href="/community" className="button-pill button-pill-secondary">
                  Browse community news
                </Link>
                <Link href="/community/submit" className="button-pill">
                  Share community news
                </Link>
              </div>
            </section>
          </div>

          <div className="dash-group">
            <h2 className="dash-group-title">Get more reach</h2>
            <p className="dash-group-intro">
              Not a business — but if you&apos;re already sharing something here for free, you can pay to get it
              seen further.
            </p>

            <div className="dash-submissions-grid">
              <section className="dash-panel dash-panel-tight">
                <h3 className="dash-h3">Featured event</h3>
                {(() => {
                  const featuredEvent = myEvents.find((e) => e.featured);
                  const pendingEvent = myEvents.find((e) => e.featuredStatus === "pending");
                  const eligibleEvents = myEvents.filter(
                    (e) => e.status === "publish" && !e.featured && e.featuredStatus !== "pending"
                  );

                  if (featuredEvent) {
                    return (
                      <p>
                        <Link href={`/events/${featuredEvent.slug}`}>{featuredEvent.title}</Link> is currently
                        featured at the top of Events.
                      </p>
                    );
                  }
                  if (pendingEvent) {
                    return (
                      <p>
                        Request pending review for{" "}
                        <Link href={`/events/${pendingEvent.slug}`}>{pendingEvent.title}</Link>.
                      </p>
                    );
                  }
                  if (eligibleEvents.length === 0) {
                    return (
                      <p className="dashboard-hint">
                        {myEvents.length === 0
                          ? "Submit an event first, then you can pay to feature it."
                          : "None of your events are eligible right now — only a live event can be featured."}
                      </p>
                    );
                  }
                  return (
                    <>
                      <p className="dashboard-hint">
                        Pay to take over the &quot;Coming up next&quot; spot at the top of Events.
                      </p>
                      <ul className="dashboard-my-list">
                        {eligibleEvents.map((event) => (
                          <li key={event.id}>
                            <span>{event.title}</span>
                            <Link href={`/events/${event.slug}/feature`} className="dashboard-my-list-edit">
                              Request featured
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  );
                })()}
              </section>

              <section className="dash-panel dash-panel-tight">
                <h3 className="dash-h3">Groups &amp; clubs</h3>
                <p className="dashboard-hint">
                  Run a local group? It lives in{" "}
                  <Link href="/community/groups">Groups to join</Link>, free, the same as any directory listing —
                  and eligible for the same featured upgrade above once it&apos;s added.
                </p>
                <div className="dashboard-section-actions">
                  <Link href="/community/groups" className="button-pill button-pill-secondary">
                    Browse groups
                  </Link>
                  <Link href="/community/groups/submit" className="button-pill">
                    Add your group
                  </Link>
                </div>
              </section>
            </div>
          </div>

          {/* Directory upgrade upsell — only when not already an approved Featured business.
              Sits right where "My business" would be, matching the sidebar's last group. */}
          {!hasBusiness && (
            <section className="dash-panel" id="grow">
              <h2 className="dash-h3">Grow your business</h2>
              {profile.directory_upgrade_status === "rejected" && (
                <p className="dashboard-hint">Your last request wasn&apos;t approved — you can try again.</p>
              )}
              {profile.directory_upgrade_status === "pending" ? (
                <p>
                  Status: <strong>{UPGRADE_STATUS_LABEL.pending}</strong>
                </p>
              ) : (
                <>
                  <p className="dashboard-hint">
                    Own a local business? Get the long-form listing — full details, photos and a featured spot at
                    the top of your category, from £50/month.
                  </p>
                  <Link href="/dashboard/upgrade" className="button-pill">
                    Request directory upgrade
                  </Link>
                </>
              )}
            </section>
          )}

          {/* My advertising — matches the sidebar's "My advertising" group */}
          {hasAds && (
            <section className="dash-panel" id="advertising" aria-labelledby="advertising-h">
              <div className="dash-panel-head">
                <h2 id="advertising-h" className="dash-h2">
                  My advertising
                </h2>
                <Link href="/advertise#text-ads" className="button-pill button-pill-secondary">
                  Advertise again
                </Link>
              </div>
              <div className="dash-table-wrap">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Advert</th>
                      <th>Dates</th>
                      <th>Status</th>
                      <th>Performance</th>
                      <th>
                        <span className="dash-sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAds.map((ad) => {
                      const chip = adStatusChip(ad);
                      return (
                        <tr key={ad.id}>
                          <td>
                            <strong>{ad.headline}</strong>
                            <div className="dash-meta">
                              {AD_SELF_SERVE_PLACEMENTS.find((p) => p.slug === ad.placement)?.label ?? ad.placement}
                              {" · "}
                              {ad.daysRequested} day{ad.daysRequested === 1 ? "" : "s"}
                            </div>
                          </td>
                          <td className="dash-meta">—</td>
                          <td>
                            <span className={`dash-chip ${chip.cls}`}>{chip.label}</span>
                          </td>
                          <td className="dash-meta">
                            {ad.views} view{ad.views === 1 ? "" : "s"}, {ad.clicks} click{ad.clicks === 1 ? "" : "s"}
                          </td>
                          <td className="dash-table-actions">
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
                              {ad.active && <ExtendAdButton adId={ad.id} />}
                              {!ad.active && ad.paymentStatus !== "paid" && <PayAdButton adId={ad.id} />}
                              <EditAdButton adId={ad.id} headline={ad.headline} body={ad.body} link={ad.link} />
                              <DeleteAdButton adId={ad.id} active={ad.active} />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="dashboard-hint">
                Exact start/end dates for each ad aren&apos;t shown here yet — we&apos;ll add them once that&apos;s
                wired up.
              </p>
              <div className="dashboard-section-actions">
                <Link href="/advertise#text-ads" className="button-pill">
                  Write another ad
                </Link>
              </div>
            </section>
          )}

          {/* My business — matches the sidebar's "My business" group, last */}
          {hasBusiness && (
            <section className="dash-panel" id="business" aria-labelledby="business-h">
              <div className="dash-panel-head">
                <div>
                  <div className="dash-eyebrow">My business</div>
                  <h2 id="business-h" className="dash-h2">
                    {businessListing ? businessListing.title : "Your business"}
                  </h2>
                </div>
                {businessListing && (
                  <div className="dash-panel-head-actions">
                    {businessListing.status === "publish" && (
                      <Link href={`/directory/${businessListing.slug}`} className="button-pill button-pill-secondary">
                        View listing
                      </Link>
                    )}
                    <Link href={`/directory/${businessListing.slug}/edit`} className="button-pill">
                      Edit listing
                    </Link>
                  </div>
                )}
              </div>

              <div className="dash-stat-row">
                <div className="dash-stat-card dash-stat-card-dark">
                  <span className="dash-stat-label dash-stat-label-gold">Current package</span>
                  <span className="dash-stat-value">{businessTier?.label ?? "Featured"}</span>
                  <span className="dash-stat-sub">
                    {businessTier ? `${businessTier.price} ${businessTier.per}` : profile.directory_upgrade_amount_paid}
                  </span>
                </div>
                <div className="dash-stat-card">
                  <span className="dash-stat-label">Renewal</span>
                  <span className="dash-stat-value">
                    {profile.directory_upgrade_expires_at ? formatDate(profile.directory_upgrade_expires_at) : "—"}
                  </span>
                  <Link href="/dashboard/upgrade" className="dash-stat-link">
                    Manage renewal
                  </Link>
                </div>
                <div className="dash-stat-card">
                  <span className="dash-stat-label">Listing views</span>
                  <span className="dash-stat-value">{businessListing ? businessListing.views : "—"}</span>
                  <span className="dash-stat-sub">All time — monthly stats aren&apos;t tracked yet</span>
                </div>
              </div>

              <div id="business-campaign" className="dash-campaign">
                <div className="dash-campaign-title">Campaign progress</div>
                <p className="dashboard-hint">
                  Step-by-step tracking for your banner, article and social promotion isn&apos;t built yet — for
                  now, check with the team directly about where things are up to. This panel will show live status
                  here once it&apos;s wired up.
                </p>
              </div>
            </section>
          )}

          {/* Activity quick stats */}
          <section className="dash-activity-stats" aria-label="My activity">
            <a href="#comments" className="dash-action">
              <span className="dash-action-meta">My comments</span>
              <strong className="dash-action-stat">{myComments.length}</strong>
              <span className="dash-action-cta">View comments</span>
            </a>
            <a href="#bookmarks" className="dash-action">
              <span className="dash-action-meta">Saved &amp; favourites</span>
              <strong className="dash-action-stat">{myBookmarks.length}</strong>
              <span className="dash-action-cta">View saved</span>
            </a>
            <a href="#account" className="dash-action">
              <span className="dash-action-meta">My profile</span>
              <strong className="dash-action-stat">{profile.display_name}</strong>
              <span className="dash-action-cta">View account</span>
            </a>
          </section>

          <section className="dash-panel" id="activity">
            <h2 className="dash-h3">Recent activity</h2>
            {profile.recent_activity.length === 0 ? (
              <p>Nothing yet — comment on a story, RSVP to an event, or claim your directory listing to start earning points.</p>
            ) : (
              <ul className="dashboard-activity-list">
                {profile.recent_activity.map((entry, i) => (
                  <li key={i}>
                    <span className="dashboard-activity-points">+{entry.points}</span>
                    <span>{entry.reason}</span>
                    <time>{new Date(entry.date).toLocaleDateString("en-GB")}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
