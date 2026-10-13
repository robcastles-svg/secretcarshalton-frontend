"use client";

import { BellIcon } from "@/app/_components/notifications/BellIcon";
import { openNotifications, useNotificationState } from "@/app/_components/notifications/store";

/** Top of the dashboard sidebar: opens the same panel as the bell in the top strip. */
export function SidebarNotificationsButton() {
  const { unread } = useNotificationState();
  return (
    <button type="button" className="dash-notif-button" onClick={openNotifications}>
      <span className="dash-notif-button-label">
        <BellIcon size={20} />
        Notifications
      </span>
      {unread > 0 && <span className="dash-notif-button-count">{unread} new</span>}
    </button>
  );
}
