"use client";

import { useEffect, useState } from "react";
import { CMS_ORIGIN } from "@/lib/cms-hosts.mjs";

// One check per page load, however many buttons the page has.
let adminCheck: Promise<boolean> | null = null;
function isAdmin(): Promise<boolean> {
  adminCheck ??= fetch("/api/auth/is-admin")
    .then((res) => (res.ok ? res.json() : { admin: false }))
    .then((data) => Boolean(data.admin))
    .catch(() => false);
  return adminCheck;
}

/**
 * Admins only: opens this item in the CMS's wp-admin editor. Checked in
 * the browser after load (see /api/auth/is-admin), never rendered into
 * the cached HTML. Rob also needs to be logged in to wp-admin itself —
 * a separate login; WordPress asks him first if he isn't.
 */
export function EditInWordPress({ postId, className }: { postId: number; className?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isAdmin().then((admin) => {
      if (!cancelled) setShow(admin);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;
  return (
    <a
      href={`${CMS_ORIGIN}/wp-admin/post.php?post=${postId}&action=edit`}
      className={className ?? "edit-in-wordpress"}
      target="_blank"
      rel="noopener"
    >
      Edit in WordPress
    </a>
  );
}
