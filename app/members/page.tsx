import Link from "next/link";
import { getAllMembers } from "@/lib/wordpress";

export const metadata = { title: "Members — Secret Carshalton" };
export const revalidate = 3600;

export default async function MembersPage() {
  const members = await getAllMembers().catch(() => []);

  return (
    <main className="container">
      <h1>Members</h1>
      <p className="search-subtitle">Everyone who&apos;s registered with Secret Carshalton.</p>

      {members.length === 0 ? (
        <p>No members yet.</p>
      ) : (
        <ul className="member-directory-list">
          {members.map((member) => (
            <li key={member.id}>
              <Link href={`/members/${member.slug}`}>
                <img src={member.avatar} alt="" loading="lazy" />
                <span>{member.display_name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
