import { UserRound, HeartHandshake, Users, Star } from "lucide-react";

const VALUES = [
  {
    icon: UserRound,
    title: "Person-Centered",
    description: "We see the person, value their voice, and follow their goals.",
  },
  {
    icon: HeartHandshake,
    title: "Compassionate",
    description: "We lead with kindness and treat every person with dignity.",
  },
  {
    icon: Users,
    title: "Inclusive",
    description: "We build belonging and celebrate every individual.",
  },
  {
    icon: Star,
    title: "Purpose-Driven",
    description: "We show up with heart and a commitment to quality care.",
  },
];

export function ValuesStrip() {
  return (
    <section className="bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {VALUES.map((value) => {
          const Icon = value.icon;
          return (
            <div key={value.title} className="flex items-start gap-3">
              <Icon className="h-8 w-8 shrink-0 text-teal" strokeWidth={1.5} />
              <div>
                <h3 className="text-sm font-bold text-primary">{value.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {value.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
