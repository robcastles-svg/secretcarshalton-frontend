/**
 * The "Send me the Insider newsletter" tick box at sign-up (unticked by
 * default). Always a double opt-in, with one email (Rob, Oct 2026):
 *  - Form sign-ups: the site's own confirmation email is the opt-in. They
 *    are added here as "confirmed" (subscribed) when they click its link.
 *  - Google sign-ups get no site confirmation email, so they're added as
 *    "pending" and EmailOctopus sends its own confirmation email instead.
 * Both are tagged with how they joined, so EmailOctopus shows it; the site
 * also records when a form sign-up confirmed (sc_newsletter_confirmed_at).
 * The /newsletter page form keeps EmailOctopus's own double opt-in.
 *
 * Needs EMAILOCTOPUS_API_KEY (secret, Vercel only) and
 * NEXT_PUBLIC_EMAILOCTOPUS_LIST_ID (not secret; it also switches the tick
 * box on). Tries the current API (v2, bearer key) first and falls back
 * to the older v1.6 one, which takes the key in the body. Never throws: a
 * newsletter hiccup must not stop someone joining the site.
 */
export async function addToNewsletter(
  email: string,
  mode: "confirmed" | "pending"
): Promise<"added" | "already" | "failed" | "off"> {
  const key = process.env.EMAILOCTOPUS_API_KEY;
  const list = process.env.NEXT_PUBLIC_EMAILOCTOPUS_LIST_ID;
  if (!key || !list || !email) return "off";

  const status = mode === "confirmed" ? "subscribed" : "pending";
  const tags = [mode === "confirmed" ? "double-opt-in-website" : "website-signup-google"];
  const v2Url = `https://api.emailoctopus.com/lists/${encodeURIComponent(list)}/contacts`;
  const v2 = (body: object) =>
    fetch(v2Url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

  try {
    let res = await v2({ email_address: email, status, tags });
    // Never lose a subscriber over the tag: retry without it if it's refused.
    if (res.status === 400 || res.status === 422) {
      console.error("EmailOctopus refused the tagged sign-up, retrying untagged", res.status, await res.text().catch(() => ""));
      res = await v2({ email_address: email, status });
    }
    if (res.ok) return "added";
    if (res.status === 409) return "already";

    if (res.status === 401 || res.status === 403 || res.status === 404) {
      const v1 = await fetch(`https://emailoctopus.com/api/1.6/lists/${encodeURIComponent(list)}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, email_address: email, status: status.toUpperCase(), tags }),
        signal: AbortSignal.timeout(10_000),
      });
      if (v1.ok) return "added";
      const body = await v1.json().catch(() => null);
      if (body?.error?.code === "MEMBER_EXISTS_WITH_EMAIL_ADDRESS") return "already";
      console.error("EmailOctopus v1.6 sign-up failed", v1.status, body?.error?.code);
      return "failed";
    }

    console.error("EmailOctopus sign-up failed", res.status, await res.text().catch(() => ""));
    return "failed";
  } catch (err) {
    console.error("EmailOctopus sign-up error", err);
    return "failed";
  }
}
