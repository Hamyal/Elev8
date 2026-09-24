import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { SectionPlaceholder } from "@/components/portal/SectionPlaceholder";

/**
 * Reports.
 *
 * A section of the agreed navigation that has no content yet. It exists so the
 * top bar is complete and every item leads somewhere, rather than being a dead
 * link — the page says plainly that it is not built rather than implying it is
 * empty or broken.
 */
export const Route = createFileRoute("/_authenticated/team-portal/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Elev8 Services Team Portal" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <SectionPlaceholder icon={BarChart3} title="Reports" description="Reporting will live here." />
  ),
});
