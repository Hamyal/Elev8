import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/team-portal")({
  component: () => <Outlet />,
});
