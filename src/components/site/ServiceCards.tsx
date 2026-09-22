import { Link } from "@tanstack/react-router";
import iconResidential from "@/assets/icon-residential.png.asset.json";
import iconSupportedLiving from "@/assets/icon-supported-living.png.asset.json";
import iconDayServices from "@/assets/icon-day-services.png.asset.json";

export const SERVICE_CARDS = [
  {
    icon: iconResidential.url,
    alt: "Home with heart",
    title: "Residential Services",
    description:
      "Licensed adult residential homes with 24-hour staff support and a true sense of home.",
    to: "/services/residential" as const,
  },
  {
    icon: iconSupportedLiving.url,
    alt: "Hands supporting a heart",
    title: "Supported Living",
    description:
      "Personalized one-to-one support so individuals can live independently in their own home.",
    to: "/services/supported-living" as const,
  },
  {
    icon: iconDayServices.url,
    alt: "Community group",
    title: "Day & Community Services",
    description:
      "Daytime activities focused on life skills, recreation, and community inclusion.",
    to: "/services/day-program" as const,
  },
];

export function ServiceCards() {
  return (
    <section className="bg-surface">
      <div className="mx-auto w-[min(1180px,calc(100%-2rem))] py-12 md:w-[min(1180px,calc(100%-4rem))]">
        <div className="text-center">
          <p className="eyebrow">How We Help</p>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground md:text-[2.375rem]">
            Support for the whole person
          </h2>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {SERVICE_CARDS.map((card) => (
            <Link
              key={card.title}
              to={card.to}
              className="flex min-h-[215px] flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-9 text-center transition-colors hover:border-teal"
            >
              <img
                src={card.icon}
                alt={card.alt}
                className="h-[70px] w-[70px] rounded-full object-cover"
              />
              <h3 className="mt-5 text-[1.1875rem] font-bold text-foreground">
                {card.title}
              </h3>
              <span className="mt-[18px] block h-[3px] w-[38px] bg-accent" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
