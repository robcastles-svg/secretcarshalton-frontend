import Link from "next/link";
import { isExternalLink, type MemberMessage } from "@/lib/notifications";

type CardMessage = Pick<MemberMessage, "title" | "body" | "button_text" | "button_url" | "pinned" | "dismissible">;

/**
 * One message from Secret Carshalton as it appears in the bell — the
 * pink box for a pinned one, a plain row otherwise. Also the live
 * preview on Rob's edit screen, so what he sees there is exactly this.
 */
export function MessageCard({
  message,
  unread = false,
  collapsed = false,
  onDismiss,
  onExpand,
  onButtonClick,
}: {
  message: CardMessage;
  unread?: boolean;
  /** Closed by the member: just the title, tap to open it again. */
  collapsed?: boolean;
  onDismiss?: () => void;
  onExpand?: () => void;
  onButtonClick?: () => void;
}) {
  if (collapsed) {
    return (
      <button
        type="button"
        className={message.pinned ? "notif-msg-collapsed notif-msg-collapsed-pinned" : "notif-msg-collapsed"}
        aria-expanded="false"
        onClick={onExpand}
      >
        <span className="notif-msg-collapsed-title">{message.title}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    );
  }

  const button =
    message.button_text && message.button_url ? (
      isExternalLink(message.button_url) || message.button_url.startsWith("mailto:") ? (
        <a
          href={message.button_url}
          className="notif-msg-button"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onButtonClick}
        >
          {message.button_text} →
        </a>
      ) : (
        <Link href={message.button_url} className="notif-msg-button" onClick={onButtonClick}>
          {message.button_text} →
        </Link>
      )
    ) : null;

  return (
    <div className={message.pinned ? "notif-msg notif-msg-pinned" : "notif-msg"}>
      <div className="notif-msg-main">
        <div className="notif-msg-eyebrow">
          From Secret Carshalton{message.pinned ? " · Pinned" : ""}
          {unread && <span className="notif-dot" aria-label="New" />}
        </div>
        <strong className="notif-msg-title">{message.title || "Your title"}</strong>
        {message.body && <p className="notif-msg-body">{message.body}</p>}
        {button}
      </div>
      {message.dismissible && onDismiss && (
        <button type="button" className="notif-msg-dismiss" aria-label="Close message" aria-expanded="true" onClick={onDismiss}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
