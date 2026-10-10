/**
 * Line icons for the redesigned events pages, lifted from the signed-off
 * mockup (events-redesign-mockup.html) so they match it exactly. Sized
 * by CSS; aria-hidden because every use sits next to visible text or an
 * aria-label.
 */
import type { ReactNode } from "react";

function Svg({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  return fill ? (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {children}
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const ClockIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);
export const PinIcon = () => (
  <Svg>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Svg>
);
export const TicketIcon = () => (
  <Svg>
    <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />
    <path d="M14 6v12" strokeDasharray="2 2" />
  </Svg>
);
export const TagIcon = () => (
  <Svg>
    <path d="M3 12V4h8l10 10-8 8z" />
    <circle cx="7.5" cy="8.5" r="1.5" />
  </Svg>
);
export const RepeatIcon = () => (
  <Svg>
    <path d="M17 2l3 3-3 3" />
    <path d="M4 11V9a4 4 0 0 1 4-4h12" />
    <path d="M7 22l-3-3 3-3" />
    <path d="M20 13v2a4 4 0 0 1-4 4H4" />
  </Svg>
);
export const CalendarIcon = () => (
  <Svg>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4M12 13v4M10 15h4" />
  </Svg>
);
export const StarIcon = () => (
  <Svg>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z" />
  </Svg>
);
export const MailIcon = () => (
  <Svg>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.5 6.5L12 13l8.5-6.5" />
  </Svg>
);
export const PhoneIcon = () => (
  <Svg>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </Svg>
);
export const GlobeIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </Svg>
);
export const ChevronIcon = () => (
  <Svg>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);
export const ExternalIcon = () => (
  <Svg>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </Svg>
);
export const DirectionsIcon = () => (
  <Svg>
    <path d="M12 2.5l9.5 9.5-9.5 9.5L2.5 12z" />
    <path d="M9 13.5V11h5.5M12.5 8.5L15 11l-2.5 2.5" />
  </Svg>
);
export const LinkIcon = () => (
  <Svg>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  </Svg>
);
export const FacebookIcon = () => (
  <Svg fill>
    <path d="M13.5 21v-7.5H16l.4-3H13.5V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4A21 21 0 0 0 14.3 4c-2.3 0-3.8 1.4-3.8 3.9v2.6H8v3h2.5V21z" />
  </Svg>
);
export const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
  </svg>
);
export const XIcon = () => (
  <Svg fill>
    <path d="M17.5 3.5h3l-6.6 7.6 7.8 9.4h-6.1l-4.8-5.9-5.4 5.9h-3l7-7.9L2 3.5h6.2l4.3 5.4zm-1 15.2h1.7L7.6 5.2H5.8z" />
  </Svg>
);
export const TikTokIcon = () => (
  <Svg fill>
    <path d="M16.6 3c.3 2.2 1.6 3.7 3.9 3.9v3.2a7.4 7.4 0 0 1-3.8-1.1v6.1a5.9 5.9 0 1 1-5.9-5.9c.3 0 .6 0 .9.1v3.3a2.7 2.7 0 1 0 1.8 2.5V3z" />
  </Svg>
);

export const SOCIAL_ICONS = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  x: XIcon,
  tiktok: TikTokIcon,
} as const;
