import { NextResponse } from "next/server";
import { getAdPayPalClientId } from "@/lib/wordpress";

/** Public — no auth, the PayPal Client ID isn't a secret and the frontend needs it unauthenticated to load the JS SDK before the member even submits anything. */
export async function GET() {
  const result = await getAdPayPalClientId();
  if (!result) {
    return NextResponse.json({ error: "PayPal is not available right now." }, { status: 503 });
  }
  return NextResponse.json(result);
}
