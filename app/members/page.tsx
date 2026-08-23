import { Fragment } from "react";
import Link from "next/link";
import { getSessionToken } from "@/lib/auth";
import { getAllMembers, getMemberMe, type WPMember } from "@/lib/wordpress";

export const metadata = { title: "Members — Secret Carshalton" };
export const revalidate = 3600;

// "#" last, not first — a plain string sort puts symbols/digits before "A",
// which reads as a stray leading group rather than the deliberate catch-all
// it's meant to be.
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

function letterKey(name: string): string {
  const ch = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(ch) ? ch : "#";
}

function groupByLetter(members: WPMember[]): Map<string, WPMember[]> {
  const groups = new Map<string, WPMember[]>();
  for (const member of members) {
    const key = letterKey(member.display_name);
    const group = groups.get(key);
    if (group) {
      group.push(member);
    } else {
      groups.set(key, [member]);
    }
  }
  return groups;
}

function MemberCard({ member, isAdmin, rank }: { member: WPMember; isAdmin: boolean; rank?: number }) {
  return (
    <div className="member-directory-item">
      <Link href={`/members/${member.slug}`}>
        <img src={member.avatar} alt="" loading="lazy" />
        <span>{member.display_name}</span>
        {rank !== undefined && member.points > 0 && (
          <span className="member-points-badge">
            #{rank} · {member.points} pt{member.points === 1 ? "" : "s"}
          </span>
        )}
      </Link>
      {isAdmin && (
        <Link
          href={`/members/${member.slug}`}
          className="member-directory-edit"
          aria-label={`Manage ${member.display_name}`}
          title="Manage member"
        >
          Edit
        </Link>
      )}
    </div>
  );
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const sortMode = sort === "active" ? "active" : "az";

  const [members, sessionToken] = await Promise.all([getAllMembers().catch(() => []), getSessionToken()]);
  const profile = sessionToken ? await getMemberMe(sessionToken) : null;
  const isAdmin = Boolean(profile?.is_editor);
  const letterGroups = groupByLetter(members);

  return (
    <main className="container">
      <div className="page-header-row">
        <h1>Members</h1>
        <span className="member-count">{members.length} member{members.length === 1 ? "" : "s"}</span>
      </div>
      <p className="search-subtitle">Everyone who&apos;s registered with Secret Carshalton.</p>

      {members.length === 0 ? (
        <p>No members yet.</p>
      ) : (
        <>
          <div className="event-view-switch">
            <Link href="/members" className={sortMode === "az" ? "active" : undefined}>
              Alphabetical
            </Link>
            <Link href="/members?sort=active" className={sortMode === "active" ? "active" : undefined}>
              Most active
            </Link>
          </div>

          {sortMode === "active" ? (
            (() => {
              // Split rather than one sorted-by-points list: with almost
              // everyone tied at 0 points (no activity yet), a single list
              // sorted that way is indistinguishable from alphabetical
              // once past the handful of members who've actually done
              // something — which reads as "the sort isn't working" even
              // though it is. Keeping the two groups visually separate
              // makes the real ranking obvious for exactly as many people
              // as it actually applies to.
              const ranked = [...members]
                .filter((m) => m.points > 0)
                .sort((a, b) => b.points - a.points || a.display_name.localeCompare(b.display_name));
              const unranked = members
                .filter((m) => m.points === 0)
                .sort((a, b) => a.display_name.localeCompare(b.display_name));

              return (
                <>
                  {ranked.length > 0 && (
                    <>
                      <h2 className="member-directory-letter">Most active</h2>
                      <div className="member-directory-grid">
                        {ranked.map((member, i) => (
                          <MemberCard key={member.id} member={member} isAdmin={isAdmin} rank={i + 1} />
                        ))}
                      </div>
                    </>
                  )}
                  <h2 className="member-directory-letter">
                    {ranked.length > 0 ? "Not yet active" : "No activity yet"}
                  </h2>
                  <div className="member-directory-grid">
                    {unranked.map((member) => (
                      <MemberCard key={member.id} member={member} isAdmin={isAdmin} />
                    ))}
                  </div>
                </>
              );
            })()
          ) : (
            <>
              <nav className="member-alpha-nav" aria-label="Jump to members starting with">
                {LETTERS.map((letter) =>
                  letterGroups.has(letter) ? (
                    <a key={letter} href={`#letter-${letter}`}>
                      {letter}
                    </a>
                  ) : (
                    <span key={letter} aria-hidden="true">
                      {letter}
                    </span>
                  )
                )}
              </nav>

              <div className="member-directory-grid">
                {LETTERS.filter((letter) => letterGroups.has(letter)).map((letter) => (
                  <Fragment key={letter}>
                    <h2 id={`letter-${letter}`} className="member-directory-letter">
                      {letter}
                    </h2>
                    {letterGroups.get(letter)!.map((member) => (
                      <MemberCard key={member.id} member={member} isAdmin={isAdmin} />
                    ))}
                  </Fragment>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
