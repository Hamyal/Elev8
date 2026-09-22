import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/services/residential")({
  head: () => ({
    meta: [
      { title: "Residential Services — Elev8 Services California" },
      {
        name: "description",
        content:
          "Licensed adult residential homes with 24-hour staff support, individualized care plans, and healthcare coordination.",
      },
      {
        property: "og:title",
        content: "Residential Services — Elev8 Services California",
      },
      {
        property: "og:description",
        content:
          "Licensed adult residential homes with 24-hour staff support and individualized care plans.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Residential,
});

function Residential() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-extrabold text-primary lg:text-4xl">
        Residential Services
      </h1>
      <p className="mt-4 text-muted-foreground">
        Licensed adult residential homes with around-the-clock staff support,
        individualized care plans, healthcare coordination, and a household
        routine shaped by the people who live there.
      </p>
      <p className="mt-4 text-muted-foreground">
        Our homes provide 24-hour care and a true sense of home for adults with
        developmental disabilities.
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
