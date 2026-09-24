import { createFileRoute, Link } from "@tanstack/react-router";
import { SERVICE_CARDS } from "@/components/site/ServiceCards";

export const Route = createFileRoute("/services/")({
  head: () => ({
    meta: [
      { title: "Services — Elev8 Services California" },
      {
        name: "description",
        content:
          "Residential living, Supported Living Services (SLS), and day services for adults with developmental disabilities.",
      },
      { property: "og:title", content: "Services — Elev8 Services California" },
      {
        property: "og:description",
        content:
          "Residential living, Supported Living Services (SLS), and day services for adults with developmental disabilities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Services,
});

function Services() {
  return (
    <div className="site-shell max-w-7xl py-14">
      <div className="site-shell max-w-2xl text-center">
        <h1 className="text-3xl font-extrabold text-primary lg:text-4xl">
          Our Services
        </h1>
        <p className="mt-3 text-muted-foreground">
          A continuum of person-centered services designed to meet each
          individual where they are.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {SERVICE_CARDS.map((service) => {
          return (
            <div
              key={service.title}
              className="flex flex-col items-center rounded-3xl bg-card p-8 text-center shadow-md ring-1 ring-border/60"
            >
              <img
                src={service.icon}
                alt={service.alt}
                className="h-16 w-16 rounded-full object-cover"
              />
              <h2 className="mt-5 text-xl font-bold text-primary">
                {service.title}
              </h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                {service.description}
              </p>
              <Link
                to={service.to}
                className="btn-pill mt-6 inline-flex bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Learn More
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-12 text-center">
        <Link
          to="/referrals"
          className="btn-pill bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Start a Referral
        </Link>
      </div>
    </div>
  );
}
