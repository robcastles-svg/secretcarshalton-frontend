/**
 * Server half of SpamTrap (app/_components/SpamTrap.tsx): true when the
 * hidden "website" field was filled in, or the form was submitted less
 * than MIN_FORM_MS after it opened — or the timing is missing, which
 * means the request didn't come from the site's own form.
 */
const MIN_FORM_MS = 2000;

export const SPAM_MESSAGE = "Sorry, that didn't go through — please wait a moment and try again.";

export function looksLikeSpam(website: unknown, formMs: unknown): boolean {
  if (typeof website === "string" && website.trim() !== "") return true;
  const ms = Number(formMs);
  return !Number.isFinite(ms) || ms < MIN_FORM_MS;
}
