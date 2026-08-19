import { ContentList } from "@/app/_components/ContentList";
import { getPosts } from "@/lib/wordpress";

export const revalidate = 3600;

export default async function HomePage() {
  const posts = await getPosts(12);

  return (
    <main className="container">
      <h1>Latest</h1>
      <ContentList items={posts} />
    </main>
  );
}
