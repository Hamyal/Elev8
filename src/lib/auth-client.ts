/**
 * Browser-side session helpers, replacing `supabase.auth`.
 *
 * The session lives in an HttpOnly cookie rather than browser storage, so
 * there is no token for this module to hold, read, or refresh -- the cookie
 * travels with every request on its own. What is left is four calls against
 * the routes in src/routes/api/auth, and a small cache so that a page with
 * several guarded components does not ask the server who is signed in once
 * per component.
 */

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
};

let cached: { user: SessionUser | null } | null = null;
let inFlight: Promise<SessionUser | null> | null = null;

async function postJson(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body ?? {}),
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload } as const;
}

/** Clears the cached session. Called after any change to who is signed in. */
export function invalidateSession() {
  cached = null;
  inFlight = null;
}

/** The signed-in staff member, or null. Concurrent callers share one request. */
export async function getSessionUser(options?: { force?: boolean }): Promise<SessionUser | null> {
  if (options?.force) invalidateSession();
  if (cached) return cached.user;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const response = await fetch("/api/auth/session", { credentials: "same-origin" });
      const payload = (await response.json().catch(() => ({}))) as { user?: SessionUser | null };
      const user = payload.user ?? null;
      cached = { user };
      return user;
    } catch {
      // A network failure is not proof of being signed out, so don't cache it.
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Returns an error message on failure, or null on success. */
export async function signIn(email: string, password: string): Promise<string | null> {
  const { ok, payload } = await postJson("/api/auth/sign-in", { email, password });
  invalidateSession();
  if (!ok) {
    return (
      (payload as { error?: string }).error ??
      "That email and password combination did not match a staff account."
    );
  }
  cached = { user: (payload as { user: SessionUser }).user };
  return null;
}

export async function signOut(): Promise<void> {
  await postJson("/api/auth/sign-out");
  invalidateSession();
  cached = { user: null };
}

/** Redeems an invitation or reset token and signs the person in. */
export async function setPassword(token: string, password: string): Promise<string | null> {
  const { ok, payload } = await postJson("/api/auth/set-password", { token, password });
  invalidateSession();
  if (!ok) {
    return (
      (payload as { error?: string }).error ??
      "That link is no longer valid. Ask an administrator to send a new one."
    );
  }
  cached = { user: (payload as { user: SessionUser }).user };
  return null;
}
