"use client";

import { useSyncExternalStore } from "react";

/**
 * Shared between the bell in the top strip and the "Notifications"
 * button at the top of the dashboard sidebar: one unread count, and a
 * way for the sidebar button to open the bell's panel, without the
 * dashboard fetching the notifications a second time.
 */
type State = { unread: number; ready: boolean };

let state: State = { unread: 0, ready: false };
const listeners = new Set<() => void>();
let opener: (() => void) | null = null;

function emit() {
  listeners.forEach((l) => l());
}

export function setUnread(unread: number) {
  state = { unread, ready: true };
  emit();
}

export function registerOpener(fn: (() => void) | null) {
  opener = fn;
  emit();
}

export function openNotifications() {
  opener?.();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const SERVER_STATE: State = { unread: 0, ready: false };

export function useNotificationState(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE
  );
}
