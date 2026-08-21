import { cookies } from "next/headers";

export const SESSION_COOKIE = "sc_token";

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}
