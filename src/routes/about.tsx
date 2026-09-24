import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Elev8 Services California" },
      {
        name: "description",
        content:
          "Elev8 Services California provides person-centered residential, supported living, and day services for adults with developmental disabilities.",
      },
      { property: "og:title", content: "About Elev8 Services California" },
      {
        property: "og:description",
        content:
          "Care that helps every person rise — dignity, health, and everyday independence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="site-shell max-w-3xl py-14">
      <h1 className="text-3xl font-extrabold text-primary lg:text-4xl">
        About Elev8 Services
      </h1>
      <p className="mt-6 text-muted-foreground">
        Elev8 Services California supports adults with developmental disabilities across California.
        Our work is built around dignity, health, and everyday independence.
      </p>
      <p className="mt-4 text-muted-foreground">
        Elev8 Services California provides person-centered residential, supported
        living, and day services to adults with developmental disabilities. Our
        approach starts with the individual: their goals, their preferences, and
        the level of support they choose.
      </p>

      <h2 className="mt-10 text-xl font-bold text-primary">What guides us</h2>
      <ul className="mt-4 space-y-2 text-muted-foreground">
        <li>
          <strong className="text-foreground">Respect</strong> — every person is
          heard and treated as an adult with their own voice.
        </li>
        <li>
          <strong className="text-foreground">Freedom</strong> — choice and
          self-direction in daily life.
        </li>
        <li>
          <strong className="text-foreground">Support</strong> — the right
          assistance, delivered consistently and safely.
        </li>
        <li>
          <strong className="text-foreground">Dignity</strong> — a home and a
          community where people belong.
        </li>
      </ul>

      <Link
        to="/contact"
        className="btn-pill mt-10 inline-block bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Contact Us
      </Link>
    </div>
  );
}
