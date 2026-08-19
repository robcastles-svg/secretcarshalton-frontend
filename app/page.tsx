import Link from "next/link";
import { getPosts } from "@/lib/wordpress";

export const revalidate = 3600;

export default async function HomePage() {
  const posts = await getPosts(12);

  return (
    <main className="container">
      <h1>Latest</h1>
      <ul className="post-list">
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={`/${post.slug}`}>
              <span dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
            </Link>
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
          </li>
        ))}
      </ul>
    </main>
  );
}
