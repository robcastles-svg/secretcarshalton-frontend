/**
 * The "Send me the Insider newsletter" tick box at sign-up: adds the
 * member to the EmailOctopus Insider list as *pending*, so EmailOctopus
 * sends its own double opt-in email and they only join once they click it
 * — the same as signing up on /newsletter. Unticked by default.
 *
 * Needs EMAILOCTOPUS_API_KEY (secret, Vercel only) and
 * NEXT_PUBLIC_EMAILOCTOPUS_LIST_ID (not secret; it also switches the tick
 * box on). Tries the current API (v2, bearer key) first and falls back
 * to the older v1.6 one, which takes the key in the body and defaults a
 * list with double opt-in to pending. Never throws: a
 * newsletter hiccup must not stop someone joining the site.
 */
export async function addToNewsletter(email: string): Promise<"added" | "already" | "failed" | "off"> {
  const key = process.env.EMAILOCTOPUS_API_KEY;
  const list = process.env.NEXT_PUBLIC_EMAILOCTOPUS_LIST_ID;
  if (!key || !list || !email) return "off";

  try {
    const v2 = await fetch(`https://api.emailoctopus.com/lists/${encodeURIComponent(list)}/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email_address: email, status: "pending" }),
      signal: AbortSignal.timeout(10_000),
    });
    if (v2.ok) return "added";
    if (v2.status === 409) return "already";

    if (v2.status === 401 || v2.status === 403 || v2.status === 404) {
      const v1 = await fetch(`https://emailoctopus.com/api/1.6/lists/${encodeURIComponent(list)}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, email_address: email }),
        signal: AbortSignal.timeout(10_000),
      });
      if (v1.ok) return "added";
      const body = await v1.json().catch(() => null);
      if (body?.error?.code === "MEMBER_EXISTS_WITH_EMAIL_ADDRESS") return "already";
      console.error("EmailOctopus v1.6 sign-up failed", v1.status, body?.error?.code);
      return "failed";
    }

    console.error("EmailOctopus sign-up failed", v2.status, await v2.text().catch(() => ""));
    return "failed";
  } catch (err) {
    console.error("EmailOctopus sign-up error", err);
    return "failed";
  }
}
