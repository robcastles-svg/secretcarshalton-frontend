import { HIDDEN_TOPICS } from "@/lib/event-list";
import { getScEventTags } from "@/lib/wordpress";

/** A ?topic= / category slug only if it's a real topic ("free" or a visible event tag), else null. */
export async function cleanTopic(raw: string | undefined): Promise<string | null> {
  if (!raw) return null;
  if (raw === "free") return "free";
  if (HIDDEN_TOPICS.has(raw)) return null;
  const tags = await getScEventTags().catch(() => []);
  return tags.some((t) => t.slug === raw) ? raw : null;
}
