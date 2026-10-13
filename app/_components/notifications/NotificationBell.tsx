"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MemberMessage, Notifications } from "@/lib/notifications";
import { BellIcon } from "./BellIcon";
import { MessageCard } from "./MessageCard";
import { registerOpener, setUnread } from "./store";

function post(path: string, body?: unknown) {
  return fetch(`/api/notify/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined);
}

/**
 * The bell at the right of the top strip, for logged-in members. The
 * strip is rendered per visitor on the server already, so the messages
 * arrive with the page (no extra request, no count popping in late).
 * Opening the panel marks everything in it as seen, which clears the
 * count; the red dots stay for that viewing so it's clear what was new.
 * On a phone the panel slides up from the bottom instead of dropping
 * down — easier with a thumb.
 */
export function NotificationBell({ initial }: { initial: Notifications | null }) {
  const [messages, setMessages] = useState<MemberMessage[]>(initial?.messages ?? []);
  const [unread, setUnreadLocal] = useState(initial?.unread ?? 0);
  const [open, setOpen] = useState(false);
  // Which ones were new when the panel was opened — keeps their dots.
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setUnread(unread);
  }, [unread]);

  const openPanel = useCallback(() => {
    setOpen(true);
    const unseen = messages.filter((m) => !m.seen).map((m) => m.id);
    if (unseen.length) {
      setFreshIds(new Set(unseen));
      setMessages((ms) => ms.map((m) => ({ ...m, seen: true })));
      setUnreadLocal(0);
      post("notifications/seen", { ids: unseen });
    }
  }, [messages]);

  useEffect(() => {
    registerOpener(openPanel);
    return () => registerOpener(null);
  }, [openPanel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  // Closing a message collapses it to its title rather than removing it,
  // so it can be opened again (Rob, 2026-10).
  const dismiss = (id: number) => {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, dismissed: true, seen: true } : m)));
    post(`notifications/${id}/dismiss`);
  };

  const restore = (id: number) => {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, dismissed: false } : m)));
    post(`notifications/${id}/restore`);
  };

  const pinned = messages.filter((m) => m.pinned);
  const others = messages.filter((m) => !m.pinned);

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className={open ? "notif-bell notif-bell-open" : "notif-bell"}
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        <BellIcon />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <>
          <div className="notif-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="notif-panel" role="dialog" aria-label="Notifications">
            <div className="notif-panel-head">
              <strong>Notifications</strong>
              <button type="button" className="notif-close" aria-label="Close" onClick={() => setOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="notif-panel-body">
              {messages.length === 0 ? (
                <p className="notif-empty">
                  Nothing new. Messages from Secret Carshalton, and replies and updates on what you&apos;ve posted, will
                  show up here.
                </p>
              ) : (
                <>
                  {pinned.map((m) => (
                    <MessageCard
                      key={m.id}
                      message={m}
                      unread={freshIds.has(m.id)}
                      collapsed={m.dismissed}
                      onDismiss={() => dismiss(m.id)}
                      onExpand={() => restore(m.id)}
                      onButtonClick={() => post(`notifications/${m.id}/click`)}
                    />
                  ))}
                  {others.map((m) => (
                    <MessageCard
                      key={m.id}
                      message={m}
                      unread={freshIds.has(m.id)}
                      collapsed={m.dismissed}
                      onDismiss={() => dismiss(m.id)}
                      onExpand={() => restore(m.id)}
                      onButtonClick={() => post(`notifications/${m.id}/click`)}
                    />
                  ))}
                </>
              )}
            </div>

            <div className="notif-panel-foot">
              <Link href="/dashboard#email-settings" onClick={() => setOpen(false)}>
                Email settings
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
