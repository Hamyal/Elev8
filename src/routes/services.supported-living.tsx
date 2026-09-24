import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/services/supported-living")({
  head: () => ({
    meta: [
      { title: "Supported Living Services (SLS) — Elev8 Services California" },
      {
        name: "description",
        content:
          "One-to-one support in a person's own home: tenancy, budgeting, cooking, health appointments, transportation, and natural supports.",
      },
      {
        property: "og:title",
        content: "Supported Living Services (SLS) — Elev8 Services California",
      },
      {
        property: "og:description",
        content:
          "Personalized support that helps individuals live independently in their own homes, on their own terms.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupportedLiving,
});

function SupportedLiving() {
  return (
    <div className="site-shell max-w-3xl py-14">
      <h1 className="text-3xl font-extrabold text-primary lg:text-4xl">
        Supported Living Services (SLS)
      </h1>
      <p className="mt-4 text-muted-foreground">
        One-to-one support in a person's own home — help with tenancy,
        budgeting, cooking, health appointments, transportation, and building
        natural supports in the neighborhood.
      </p>
      <p className="mt-4 text-muted-foreground">
        Support is personalized so individuals can live independently, on their
        own terms, with the assistance they choose.
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
