# Secret Carshalton — notes for Claude

This repo is a Next.js frontend + a suite of custom WordPress plugins
(`wordpress-plugins/`) for Secret Carshalton, a local-news site. See
`wordpress-plugins/README.md` for the plugin deploy model (staging,
HTTPS-only, no SSH) and the plugin contract between them.

## The AI editorial workflow — manual, not the in-app button

The brief calls for Claude to draft articles from notes/photos. There are
two ways that can happen in this codebase:

1. **The in-app "Draft a story" feature** (`/admin/draft`, `app/api/admin/draft/`)
   — a one-click UI for editors, calling the Claude API server-side. This
   needs `ANTHROPIC_API_KEY` set in Vercel's environment variables, which
   Rob has deliberately **not** set up — it costs a small per-draft fee,
   and he's a solo operator who doesn't need the extra billing yet. The
   route degrades to a clear "not configured" message rather than failing
   opaquely; leave it as-is unless asked to change it.

2. **The actual current workflow: talk to Claude directly.** Rob writes
   his notes/photos to a Claude Code session (whichever one — this isn't
   tied to a single conversation), Claude drafts the article, and Claude
   **publishes it directly via the WordPress REST API** using the
   Application Password credentials already present in the environment
   (`WP_SITE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD` — the **live** site,
   `secretcarshalton.com`, not staging). This costs nothing beyond
   whatever Claude plan the session is already running under — no
   separate API key, no per-draft billing.

**When Rob asks you to draft/write/post a story in a session:**

- Write it in the Secret Carshalton editorial voice — reuse the style
  rules in `lib/editorial-guide.ts` (voice, structure: headline,
  standfirst, excerpt, HTML body, SEO title/description, categories,
  tags) rather than improvising a different tone.
- Never invent facts, quotes, or figures not in what Rob gave you. Flag
  speculation as speculation.
- Create the post via `POST https://secretcarshalton.com/wp-json/wp/v2/posts`
  with HTTP Basic Auth (`WP_USERNAME` / `WP_APP_PASSWORD` from the
  environment) — Application Passwords are REST-API-only by WP core
  design, which is exactly what this needs (unlike the wp-admin HTML
  session hack `wordpress-plugins/README.md` describes for plugin
  uploads — that's a different, heavier mechanism for a different job).
- **Always create as `status: "pending"` or `"draft"`, never `"publish"`**
  — matches the brief's draft → human approval → publish requirement,
  and matches how every other submission path in this codebase already
  works (member listing/event submissions land as 'pending' too). Only
  set `status: "publish"` if Rob explicitly says to publish immediately.
- Show Rob the drafted fields before creating the post so he can approve
  or ask for changes — don't post-then-tell.
- After creating it, tell him the post ID/edit link so he can review,
  add a featured image, and apply categories/tags in wp-admin.

If Rob later wants the in-app button live instead (e.g. handing drafting
off to another editor who doesn't have Claude Code access), that's just
adding the API key in Vercel — the code is already there and doesn't
need rebuilding.
