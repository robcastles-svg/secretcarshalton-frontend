import { NextRequest, NextResponse } from "next/server";
import { sendContactMessage } from "@/lib/wordpress";
import { looksLikeSpam, SPAM_MESSAGE } from "@/lib/spam";

/** The contact form (app/contact): spam check here, then SC_Membership_Contact emails it. */
export async function POST(request: NextRequest) {
  const data = await request.json().catch(() => ({}));
  if (looksLikeSpam(data.website, data.form_ms)) {
    return NextResponse.json({ error: SPAM_MESSAGE }, { status: 400 });
  }
  const field = (k: string) => (typeof data[k] === "string" ? data[k].trim() : "");
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const result = await sendContactMessage(
    { name: field("name"), email: field("email"), subject: field("subject"), message: field("message") },
    ip
  );
  if (result.ok) return NextResponse.json({ sent: true });
  return NextResponse.json({ error: result.message }, { status: result.status });
}
