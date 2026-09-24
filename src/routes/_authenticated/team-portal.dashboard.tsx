import { createFileRoute } from "@tanstack/react-router";

/**
 * Dashboard — intentionally blank for this phase.
 *
 * The brief is the logo and the top navigation only: no cards, counts, tasks
 * or facility selector yet. The fuller version that was built before this
 * request (attention strip, applicant figures, hiring pipeline, per-role
 * sidebar) is kept at docs/dashboard-full.tsx.reference together with its
 * server function, getDashboard() in src/lib/ats.functions.ts, so it can be
 * switched back on without rebuilding it.
 */
export const Route = createFileRoute("/_authenticated/team-portal/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Elev8 Services Team Portal" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  // min-height keeps the footer at the bottom of the window. Without it an
  // empty page collapses to nothing and looks like a failure to load.
  return <section className="site-shell min-h-[60vh] py-10" aria-label="Dashboard" />;
}
