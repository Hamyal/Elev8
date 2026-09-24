import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals — Elev8 Services California" },
      {
        name: "description",
        content:
          "Information for regional center service coordinators, families, and case managers making a referral to Elev8 Services California.",
      },
      { property: "og:title", content: "Referrals — Elev8 Services California" },
      {
        property: "og:description",
        content:
          "How to make a referral to Elev8 Services residential, supported living, or day services.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Referrals,
});

function Referrals() {
  return (
    <div className="site-shell max-w-3xl py-14">
      <h1 className="text-3xl font-extrabold text-primary lg:text-4xl">
        Referrals
      </h1>
      <p className="mt-4 text-muted-foreground">
        We welcome referrals from service coordinators, case managers, families,
        and conservators. Share what you can about the person's support needs and
        our team will follow up to discuss fit and next steps.
      </p>

      <h2 className="mt-10 text-xl font-bold text-primary">
        Helpful information to include
      </h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
        <li>Which service is being considered: residential, SLS, or day program</li>
        <li>Preferred area or community</li>
        <li>Support needs and communication preferences</li>
        <li>Referring agency or contact relationship</li>
        <li>Best way and time to reach you</li>
      </ul>

      <p className="mt-8 text-muted-foreground">
        We do not collect medical records or other confidential documentation
        through this website. Send the basics and we'll take it from there.
      </p>

      <Link
        to="/contact"
        className="btn-pill mt-10 inline-block bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Submit a Referral Inquiry
      </Link>
    </div>
  );
}
