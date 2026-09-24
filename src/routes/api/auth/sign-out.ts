import { createFileRoute } from "@tanstack/react-router";

/** Ends the session and clears the cookie. Replaces supabase.auth.signOut(). */
export const Route = createFileRoute("/api/auth/sign-out")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { clearedSessionCookie, readSessionCookie, signOut, isSecureRequest } =
          await import("@/server/auth");
        await signOut(readSessionCookie(request));
        return Response.json(
          { ok: true },
          {
            headers: {
              "set-cookie": clearedSessionCookie(isSecureRequest(request)),
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});
