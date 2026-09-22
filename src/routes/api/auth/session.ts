import { createFileRoute } from "@tanstack/react-router";

/** Who is signed in, if anyone. Replaces supabase.auth.getUser(). */
export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { readSessionCookie, userFromSession } = await import("@/server/auth");
        const user = await userFromSession(readSessionCookie(request));
        return Response.json(
          { user },
          // A session answer must never be served from a cache.
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
