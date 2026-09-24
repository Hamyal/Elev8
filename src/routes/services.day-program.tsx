import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/services/day-program")({
  head: () => ({
    meta: [
      { title: "Adult Day Programs — Elev8 Services California" },
      {
        name: "description",
        content:
          "Structured daytime activities focused on life skills, communication, recreation, volunteering, and community inclusion.",
      },
      {
        property: "og:title",
        content: "Adult Day Programs — Elev8 Services California",
      },
      {
        property: "og:description",
        content:
          "Life skills development, community integration, and meaningful daily activities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DayProgram,
});

function DayProgram() {
  return (
    <div className="site-shell max-w-3xl py-14">
      <h1 className="text-3xl font-extrabold text-primary lg:text-4xl">
        Adult Day Programs
      </h1>
      <p className="mt-4 text-muted-foreground">
        Structured daytime activities focused on life skills, communication,
        recreation, volunteering, and community inclusion, with schedules built
        around individual goals.
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link
          to="/referrals"
          className="btn-pill bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Start a Referral
        </Link>
        <Link
          to="/contact"
          className="btn-pill border border-primary px-6 py-3 text-sm font-semibold text-primary hover:bg-primary/5"
        >
          Contact Us
        </Link>
      </div>
    </div>
  );
}
