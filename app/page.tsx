import Link from "next/link";
import { getFeaturedImage, getPosts } from "@/lib/wordpress";

export const revalidate = 3600;

export default async function HomePage() {
  const posts = await getPosts(12);

  return (
    <main className="container">
      <h1>Latest</h1>
      <ul className="post-list">
        {posts.map((post) => {
          const image = getFeaturedImage(post);
          return (
            <li key={post.id}>
              <Link href={`/${post.slug}`}>
                {image && <img src={image.source_url} alt={image.alt_text} />}
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
          );
        })}
      </ul>
    </main>
  );
}
