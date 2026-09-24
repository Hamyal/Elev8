import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/programs")({
  head: () => ({
    meta: [
      { title: "Our Programs — Elev8 Services California" },
      {
        name: "description",
        content:
          "How Elev8 Services residential, supported living, and day programs support independence, community inclusion, and daily living skills.",
      },
      {
        property: "og:title",
        content: "Our Programs — Elev8 Services California",
      },
      {
        property: "og:description",
        content:
          "How Elev8 Services programs support independence, community inclusion, and daily living skills.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Programs,
});

const PROGRAMS = [
  {
    title: "Residential Program",
    body: "Licensed adult residential homes with around-the-clock staff support, individualized care plans, healthcare coordination, and a household routine shaped by the people who live there.",
  },
  {
    title: "Supported Living Services (SLS)",
    body: "One-to-one support in a person's own home — help with tenancy, budgeting, cooking, health appointments, transportation, and building natural supports in the neighborhood.",
  },
  {
    title: "Day Program",
    body: "Structured daytime activities focused on life skills, communication, recreation, volunteering, and community inclusion, with schedules built around individual goals.",
  },
];

function Programs() {
  return (
    <div className="site-shell max-w-3xl py-14">
      <h1 className="text-3xl font-extrabold text-primary lg:text-4xl">
        Our Programs
      </h1>
      <p className="mt-4 text-muted-foreground">
        Each program is built around the person: their goals, their pace, and
        the supports they choose.
      </p>

      <div className="mt-10 space-y-8">
        {PROGRAMS.map((p) => (
          <section key={p.title}>
            <h2 className="text-xl font-bold text-primary">{p.title}</h2>
            <p className="mt-2 text-muted-foreground">{p.body}</p>
          </section>
        ))}
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        Questions about eligibility or availability?{" "}
        <Link to="/contact" className="font-semibold text-primary hover:text-accent">
          Get in touch
        </Link>
        .
      </p>
    </div>
  );
}
