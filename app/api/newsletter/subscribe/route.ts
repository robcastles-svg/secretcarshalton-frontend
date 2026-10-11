import { NextRequest, NextResponse } from "next/server";
import { subscribeToNewsletter } from "@/lib/newsletter";
import { looksLikeSpam, SPAM_MESSAGE } from "@/lib/spam";

export async function POST(request: NextRequest) {
  const data = await request.json().catch(() => ({}));
  const email = typeof data.email === "string" ? data.email.trim() : "";

  if (looksLikeSpam(data.website, data.form_ms)) {
    return NextResponse.json({ error: SPAM_MESSAGE }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const result = await subscribeToNewsletter(email);

  if (result.status === "subscribed") {
    return NextResponse.json({ status: "subscribed" });
  }
  if (result.status === "not_configured") {
    return NextResponse.json(
      { error: "Newsletter signup isn't connected yet — check back soon." },
      { status: 503 }
    );
  }
  return NextResponse.json({ error: result.message }, { status: 502 });
}
