/** Shared icon set for listing/business social links — used by DirectoryListingCard (category-page cards) and the listing detail page. */

export function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7C16.4 3.66 15.4 3.5 14.2 3.5c-2.4 0-4 1.46-4 4.15V10H7.5v3.1h2.7V21h3.3Z" />
    </svg>
  );
}

export function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TwitterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 4l16 16M20 4 4 20" />
    </svg>
  );
}

export function LinkedinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6.94 8.5H4.05V20h2.89V8.5ZM5.5 4a1.68 1.68 0 1 0 0 3.36A1.68 1.68 0 0 0 5.5 4ZM20 13.28C20 10.1 18.14 8.5 15.63 8.5c-1.44 0-2.4.68-2.84 1.5V8.79h-2.9v11.2h2.9v-6.24c0-.6.03-1.2.44-1.63.34-.35.79-.5 1.23-.5.86 0 1.53.53 1.53 1.98V20H20v-6.72Z" />
    </svg>
  );
}

export function YoutubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12s0-3.1-.4-4.6a2.7 2.7 0 0 0-1.9-1.9C18.2 5.1 12 5.1 12 5.1s-6.2 0-7.7.4A2.7 2.7 0 0 0 2.4 7.4C2 8.9 2 12 2 12s0 3.1.4 4.6a2.7 2.7 0 0 0 1.9 1.9c1.5.4 7.7.4 7.7.4s6.2 0 7.7-.4a2.7 2.7 0 0 0 1.9-1.9c.4-1.5.4-4.6.4-4.6Z" fillOpacity="0" stroke="currentColor" strokeWidth="2" />
      <path d="M10 15.2 15.5 12 10 8.8v6.4Z" />
    </svg>
  );
}

export interface ListingSocials {
  sc_facebook?: string;
  sc_instagram?: string;
  sc_twitter?: string;
  sc_linkedin?: string;
  sc_youtube?: string;
}

/** Builds the {key,url,Icon} list DirectoryListingCard and the listing detail page both render as an icon row, already filtered to only the socials a listing actually has. */
export function listingSocials(meta: ListingSocials) {
  return [
    { key: "facebook", url: meta.sc_facebook, Icon: FacebookIcon },
    { key: "instagram", url: meta.sc_instagram, Icon: InstagramIcon },
    { key: "twitter", url: meta.sc_twitter, Icon: TwitterIcon },
    { key: "linkedin", url: meta.sc_linkedin, Icon: LinkedinIcon },
    { key: "youtube", url: meta.sc_youtube, Icon: YoutubeIcon },
  ].filter((s): s is { key: string; url: string; Icon: typeof FacebookIcon } => Boolean(s.url));
}
