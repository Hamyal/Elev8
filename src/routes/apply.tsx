import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/apply")({
  beforeLoad: () => {
    throw redirect({ to: "/careers", hash: "paid-internship" });
  },
});
