import { cookies } from "next/headers";

export const SESSION_COOKIE = "sc_token";

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** Logs the browser in: the member's bearer token in an httpOnly cookie, never visible to page scripts. */
export function setSessionCookie(response: { cookies: { set: (name: string, value: string, options: object) => unknown } }, token: string, maxAge: number) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge,
    path: "/",
  });
}
