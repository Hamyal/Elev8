import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Payload = z.object({
  token: z.string().min(1).max(500),
  // Matches the minimum the admin-set-password path already enforced.
  password: z.string().min(10).max(200),
});

/**
 * Redeems a single-use invitation or reset link and sets the password.
 * Replaces the Supabase recovery flow plus supabase.auth.updateUser().
 *
 * On success the person is signed in immediately, which is what the
 * set-password page has always expected to happen.
 */
export const Route = createFileRoute("/api/auth/set-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { redeemToken, sessionCookie } = await import("@/server/auth");
        const parsed = Payload.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json(
            { error: "Choose a password of at least 10 characters." },
            { status: 400 },
          );
        }

        const result = await redeemToken(parsed.data.token, parsed.data.password);
        if (!result) {
          return Response.json(
            { error: "That link has expired or has already been used. Ask an administrator to send a new one." },
            { status: 400 },
          );
        }

        return Response.json(
          { user: result.user },
          { headers: { "set-cookie": sessionCookie(result.token), "cache-control": "no-store" } },
        );
      },
    },
  },
});
