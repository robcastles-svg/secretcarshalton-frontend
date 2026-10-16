/**
 * Where WordPress lives — the one place to change on switch day.
 *
 * Everything comes from the one CMS install: staging19 was moved to
 * cms.secretcarshalton.com on switch day (16 Oct 2026, SiteGround "Move
 * Application"; it answers on www.cms). The two constants are kept apart
 * only so a future move of either is a one-line change. Never point
 * ARTICLES_WP_ORIGIN back at www.secretcarshalton.com: that's this app
 * now, so the site would fetch its articles from itself.
 *
 * Shared by next.config.mjs (the /wp-content rewrite, image hosts) and
 * the app (lib/wordpress.ts, the "Forgot your password?" links), which is
 * why it's a plain .mjs file.
 */

/** The install with the sc-* plugins: members, events, directory, jobs, ads. */
export const CMS_ORIGIN = "https://www.cms.secretcarshalton.com";

/** The install articles, pages and comments are read from. */
export const ARTICLES_WP_ORIGIN = "https://www.cms.secretcarshalton.com";

/** WordPress's own reset-password page — same accounts as the frontend login. */
export const LOST_PASSWORD_URL = `${CMS_ORIGIN}/wp-login.php?action=lostpassword`;
