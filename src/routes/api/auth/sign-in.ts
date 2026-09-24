import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Credentials = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

/**
 * Staff sign-in. Replaces supabase.auth.signInWithPassword().
 *
 * A wrong address and a wrong password produce the same message, so the
 * endpoint cannot be used to discover which staff emails exist.
 */
export const Route = createFileRoute("/api/auth/sign-in")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { signIn, sessionCookie, isSecureRequest } = await import("@/server/auth");
        const parsed = Credentials.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Enter your work email and password." }, { status: 400 });
        }

        const result = await signIn(parsed.data.email.trim(), parsed.data.password);
        if (!result) {
          return Response.json(
            { error: "That email and password combination did not match a staff account." },
            { status: 401 },
          );
        }

        return Response.json(
          { user: result.user },
          {
            headers: {
              "set-cookie": sessionCookie(result.token, isSecureRequest(request)),
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});
