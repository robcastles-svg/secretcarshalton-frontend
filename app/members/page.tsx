import { Fragment } from "react";
import Link from "next/link";
import { getSessionToken } from "@/lib/auth";
import { getAllMembers, getMemberMe, type WPMember } from "@/lib/wordpress";

export const metadata = { title: "Members — Secret Carshalton" };
export const revalidate = 3600;

const LETTERS = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

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

export default async function MembersPage() {
  const [members, sessionToken] = await Promise.all([getAllMembers().catch(() => []), getSessionToken()]);
  const profile = sessionToken ? await getMemberMe(sessionToken) : null;
  const isAdmin = Boolean(profile?.is_editor);

  const groups = groupByLetter(members);

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
          <nav className="member-alpha-nav" aria-label="Jump to members starting with">
            {LETTERS.map((letter) =>
              groups.has(letter) ? (
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
            {Array.from(groups.entries()).map(([letter, group]) => (
              <Fragment key={letter}>
                <h2 id={`letter-${letter}`} className="member-directory-letter">
                  {letter}
                </h2>
                {group.map((member) => (
                  <div key={member.id} className="member-directory-item">
                    <Link href={`/members/${member.slug}`}>
                      <img src={member.avatar} alt="" loading="lazy" />
                      <span>{member.display_name}</span>
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
                ))}
              </Fragment>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
