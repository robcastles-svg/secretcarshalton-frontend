import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/auth";
import { getMemberMe } from "@/lib/wordpress";

/** Editors only (Rob) — same gate as /admin/draft. Returns the profile for the email preview's "Hi …". */
export async function requireEditor() {
  const token = await getSessionToken();
  if (!token) redirect("/login");
  const profile = await getMemberMe(token);
  if (!profile?.is_editor) redirect("/dashboard");
  return profile;
}
