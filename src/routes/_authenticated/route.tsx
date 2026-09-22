import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth-client";

/**
 * Staff-only subtree. The session cookie is HttpOnly, so the gate asks the
 * server who is signed in; every server function behind it re-reads the same
 * cookie and re-checks the caller's role.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getSessionUser();
    if (!user) throw redirect({ to: "/team-portal" });
    return { user };
  },
  component: () => <Outlet />,
});
