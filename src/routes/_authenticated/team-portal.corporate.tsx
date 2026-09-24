import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { SectionPlaceholder } from "@/components/portal/SectionPlaceholder";

/**
 * Corporate.
 *
 * A section of the agreed navigation that has no content yet. It exists so the
 * top bar is complete and every item leads somewhere, rather than being a dead
 * link — the page says plainly that it is not built rather than implying it is
 * empty or broken.
 */
export const Route = createFileRoute("/_authenticated/team-portal/corporate")({
  head: () => ({
    meta: [
      { title: "Corporate — Elev8 Services Team Portal" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <SectionPlaceholder
      icon={Building2}
      title="Corporate"
      description="Company-level information will live here."
    />
  ),
});
