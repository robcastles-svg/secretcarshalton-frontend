/**
 * Newsletter provider integration, kept behind this one function per the
 * brief ("keep the integration modular so another provider can be
 * substituted later") — nothing outside this file knows it's EmailOctopus.
 *
 * NOT LIVE-VERIFIED: this session's network access couldn't reach
 * emailoctopus.com's own docs to confirm the exact current request shape
 * (blocked by the sandbox's egress policy). This is EmailOctopus's v2 API
 * as documented/understood at the time of writing — Bearer auth,
 * api.emailoctopus.com, POST .../lists/{listId}/contacts — but test it
 * against a real API key + list before relying on it, and fix this
 * function (only this function) if the shape has changed.
 */
export interface NewsletterSubscribeResult {
  status: "subscribed" | "error" | "not_configured";
  message?: string;
}

export async function subscribeToNewsletter(email: string): Promise<NewsletterSubscribeResult> {
  const apiKey = process.env.EMAILOCTOPUS_API_KEY;
  const listId = process.env.EMAILOCTOPUS_LIST_ID;

  if (!apiKey || !listId) {
    return { status: "not_configured" };
  }

  try {
    const res = await fetch(`https://api.emailoctopus.com/lists/${listId}/contacts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email_address: email, status: "subscribed" }),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      return { status: "subscribed" };
    }

    const body = await res.json().catch(() => ({}));
    const errorMessage = body?.error?.message || "";

    // A repeat signup errors rather than no-ops on most list-provider APIs
    // (EmailOctopus included, per how this class of API generally behaves)
    // — treat "already on the list" as success, not a scary error, for
    // someone who's just confirming they're already subscribed.
    if (/already|exist/i.test(errorMessage)) {
      return { status: "subscribed" };
    }

    return { status: "error", message: errorMessage || "Could not subscribe — please try again." };
  } catch {
    return { status: "error", message: "Could not reach the newsletter service — please try again." };
  }
}
