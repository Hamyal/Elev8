/**
 * Server-function middleware that establishes who is calling.
 *
 * Drop-in replacement for the Supabase bearer-token middleware. The contract
 * the ATS server functions depend on is unchanged -- `context.supabase` is a
 * query client whose statements run as the caller, and `context.userId` is
 * their uuid -- so none of those handlers needed editing.
 *
 * The difference is where identity comes from and how long it lasts. The
 * session cookie is read once, and the whole handler then runs inside a single
 * database transaction pinned to that user. Every statement it issues is
 * subject to the same row-level-security policies as before, and because the
 * handler is one transaction, a failure part-way through a multi-step workflow
 * rolls the whole thing back rather than leaving a half-applied milestone.
 *
 * This file lives in src/lib rather than src/server because ats.functions.ts
 * imports it, and that module is bundled for the browser -- the build denies
 * any client-side import of src/server. The server-only modules are therefore
 * loaded inside the .server() callback, which is stripped from that bundle.
 */
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { withRole } = await import("@/server/db");
  const { pgRest } = await import("@/server/pgrest");
  const { readSessionCookie, userFromSession } = await import("@/server/auth");

  const request = getRequest();
  if (!request?.headers) throw new Error("Unauthorized: No request headers available");

  const user = await userFromSession(readSessionCookie(request));
  if (!user) throw new Error("Unauthorized: Please sign in again.");

  return withRole("authenticated", user.id, (client) =>
    next({
      context: {
        supabase: pgRest(client),
        db: client,
        userId: user.id,
        user,
      },
    }),
  );
});

/**
 * Kept under the old name so the ~35 call sites in ats.functions.ts read the
 * same as before. New code should import `requireAuth`.
 */
export const requireSupabaseAuth = requireAuth;
