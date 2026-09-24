import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { SectionPlaceholder } from "@/components/portal/SectionPlaceholder";

/**
 * Team.
 *
 * A section of the agreed navigation that has no content yet. It exists so the
 * top bar is complete and every item leads somewhere, rather than being a dead
 * link — the page says plainly that it is not built rather than implying it is
 * empty or broken.
 */
export const Route = createFileRoute("/_authenticated/team-portal/team")({
  head: () => ({
    meta: [{ title: "Team — Elev8 Services Team Portal" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <SectionPlaceholder
      icon={Users}
      title="Team"
      description="The staff directory will live here. Accounts and roles are under Access & Settings."
    />
  ),
});
