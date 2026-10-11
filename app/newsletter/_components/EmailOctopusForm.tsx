"use client";

import { useEffect, useRef } from "react";

/**
 * The same EmailOctopus sign-up form the WordPress /newsletter page uses
 * (email, first and last name, double opt-in), so sign-ups land on the
 * Insider list exactly as before, with no API key needed. Their embed
 * script draws the form where its <script> tag sits, so it's inserted
 * into this box on mount — a <script> in JSX wouldn't run after a
 * client-side navigation.
 */
const FORM_ID = "ee7f6e32-51cc-11ef-93fa-0d30bddda032";

export function EmailOctopusForm() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://eocampaign1.com/form/${FORM_ID}.js`;
    script.dataset.form = FORM_ID;
    el.appendChild(script);
    return () => {
      el.innerHTML = "";
    };
  }, []);

  return <div ref={box} className="newsletter-embed" />;
}
