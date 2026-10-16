/**
 * Where WordPress lives — the one place to change on switch day.
 *
 * Until go-live there are two WordPress installs (see "One CMS, not two"
 * in wordpress-plugins/README.md): articles, pages and the "latest
 * comments" box come from the live site, everything else (the sc-*
 * plugins: events, directory, jobs, members, ads, view counts) from
 * staging19.
 *
 * On switch day, once the merged install answers on its own hostname and
 * before www.secretcarshalton.com is pointed at Vercel, set BOTH to
 * "https://cms.secretcarshalton.com". Leaving ARTICLES_WP_ORIGIN on www
 * after the switch would make the site fetch its articles from itself.
 *
 * Shared by next.config.mjs (the /wp-content rewrite, image hosts) and
 * the app (lib/wordpress.ts, the "Forgot your password?" links), which is
 * why it's a plain .mjs file.
 */

/** The install with the sc-* plugins: members, events, directory, jobs, ads. */
export const CMS_ORIGIN = "https://www.staging19.secretcarshalton.com";

/** The install articles, pages and comments are read from. */
export const ARTICLES_WP_ORIGIN = "https://www.secretcarshalton.com";

/** WordPress's own reset-password page — same accounts as the frontend login. */
export const LOST_PASSWORD_URL = `${CMS_ORIGIN}/wp-login.php?action=lostpassword`;
