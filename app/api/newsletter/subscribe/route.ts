import { NextRequest, NextResponse } from "next/server";
import { subscribeToNewsletter } from "@/lib/newsletter";

export async function POST(request: NextRequest) {
  const data = await request.json().catch(() => ({}));
  const email = typeof data.email === "string" ? data.email.trim() : "";

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
