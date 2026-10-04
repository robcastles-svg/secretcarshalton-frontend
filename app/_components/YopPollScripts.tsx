"use client";

import { useEffect } from "react";

const WP_BASE = "https://www.secretcarshalton.com";

/**
 * Exact dependency chain the real /polls/ page on secretcarshalton.com
 * loads for YOP Poll's frontend.js — WP core's bundled React/ReactDOM,
 * the @wordpress/element, @wordpress/hooks and @wordpress/i18n packages
 * it's built against, then the plugin bundle itself. Order matters:
 * each one attaches to a global the next one reads (window.React →
 * window.ReactDOM/window.wp.element → window.wp.hooks → window.wp.i18n).
 * Loaded one at a time (not left to next/script's ordering, which isn't
 * guaranteed across separate Script tags) so this is deterministic.
 */
const SCRIPTS = [
  `${WP_BASE}/wp-includes/js/dist/vendor/react.min.js`,
  `${WP_BASE}/wp-includes/js/dist/vendor/react-dom.min.js`,
  `${WP_BASE}/wp-includes/js/dist/vendor/react-jsx-runtime.min.js`,
  `${WP_BASE}/wp-includes/js/dist/hooks.min.js`,
  `${WP_BASE}/wp-includes/js/dist/element.min.js`,
  `${WP_BASE}/wp-includes/js/dist/i18n.min.js`,
];

const PLUGIN_SCRIPT = `${WP_BASE}/wp-content/plugins/yop-poll/build/frontend.js`;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

/**
 * Renders no markup of its own — the actual poll markup (.yop-poll-container
 * + its inline JSON config) comes straight from WP's content.rendered via
 * the normal dangerouslySetInnerHTML on /polls, same as any other page.
 * This just loads the real YOP Poll plugin WP already runs so that static
 * markup becomes the real interactive widget (vote, see live results,
 * "already voted" state) — same plugin and same WordPress REST API Rob
 * already has configured (CORS already open on it), not a rebuild.
 *
 * frontend.js checks document.readyState itself before deciding whether
 * to wait for DOMContentLoaded or run immediately, so loading it late
 * (well after hydration, from a useEffect) still mounts the poll
 * correctly — confirmed by reading the plugin's own bundle.
 */
export function YopPollScripts() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        for (const src of SCRIPTS) {
          if (cancelled) return;
          await loadScript(src);
        }
        if (cancelled) return;

        const w = window as unknown as { yopPollFront?: unknown };
        if (!w.yopPollFront) {
          w.yopPollFront = {
            captcha: {
              recaptchaV2: { siteKey: "" },
              recaptchaV2Invisible: { siteKey: "" },
              recaptchaV3: { siteKey: "" },
              hcaptcha: { siteKey: "" },
              turnstile: { siteKey: "" },
            },
            autoRefreshTime: "0",
            restUrl: `${WP_BASE}/wp-json/yop-poll/v1/`,
            adminAjaxUrl: `${WP_BASE}/wp-admin/admin-ajax.php`,
            wpUserLoggedIn: "",
            wpLoginUrl: `${WP_BASE}/login/`,
          };
        }

        await loadScript(PLUGIN_SCRIPT);
      } catch (err) {
        console.error("YOP Poll failed to load:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
