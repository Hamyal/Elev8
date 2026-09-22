import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeDollarSign, FileText, Award, CalendarClock } from "lucide-react";
import heroCaregiver from "@/assets/hero-caregiver.png.asset.json";
import { createApplicationAttempt } from "@/lib/application-attempt";

export const Route = createFileRoute("/careers/")({
  head: () => ({
    meta: [
      {
        title: "Paid Pre-Med & Pre-Health Internship — Elev8 Services",
      },
      {
        name: "description",
        content:
          "Paid, hands-on patient care experience for pre-med and pre-health students supporting adults with developmental disabilities. Flexible scheduling in California.",
      },
      {
        property: "og:title",
        content: "Paid Pre-Med & Pre-Health Internship — Elev8 Services",
      },
      {
        property: "og:description",
        content:
          "Turn your coursework into real-world patient care. Paid internship and career opportunities with Elev8 Services California.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Careers,
});

const BENEFITS = [
  {
    icon: BadgeDollarSign,
    title: "Get Paid While Gaining Experience",
    body: "Earn income while developing meaningful, real-world patient-support skills.",
  },
  {
    icon: FileText,
    title: "Build a Stronger Résumé",
    body: "Add relevant, hands-on experience to your professional-school or graduate-school application.",
  },
  {
    icon: Award,
    title: "Earn a Letter of Recommendation",
    body: "Demonstrate your reliability, professionalism, and commitment to person-centered care.",
  },
  {
    icon: CalendarClock,
    title: "Flexible Scheduling",
    body: "Build valuable experience while balancing your college coursework.",
  },
];

const FIELDS =
  "Pre-Med · Biology · Chemistry · Pharmacy · Nursing · Psychology · Neuroscience · Public Health · Health Sciences · Kinesiology · Child Development · Human Services · Social Work · Related Fields";

function Careers() {
  const scrollToEmployment = (e: React.MouseEvent) => {
    e.preventDefault();
    document
      .getElementById("employment")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="w-full overflow-x-hidden">
      {/* Hero */}
      <section
        id="paid-internship"
        className="mx-auto w-full max-w-5xl scroll-mt-20 px-4 py-10 sm:py-14"
      >
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-10">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
              Paid Pre-Med &amp; Pre-Health Internship
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight text-primary sm:text-4xl">
              Turn Your Coursework Into Real-World Patient Care
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Gain paid, hands-on experience providing person-centered patient
              support to adults with developmental disabilities—while building
              your résumé and preparing for your future healthcare career.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/careers/apply"
                search={{ fresh: true }}
                onClick={() => createApplicationAttempt()}
                className="block w-full rounded-lg bg-accent px-6 py-4 text-center text-base font-bold text-accent-foreground sm:w-auto sm:py-3 sm:text-sm"
              >
                Apply for the Paid Internship
              </Link>
              <a
                href="#employment"
                onClick={scrollToEmployment}
                className="block w-full rounded-lg bg-primary px-6 py-4 text-center text-base font-bold text-primary-foreground sm:w-auto sm:py-3 sm:text-sm"
              >
                Explore Career Opportunities
              </a>
            </div>
          </div>

          <div className="relative min-w-0">
            <img
              src={heroCaregiver.url}
              alt="A healthcare professional in navy scrubs providing medication support to an adult in a home setting"
              className="h-64 w-full rounded-2xl object-cover object-center sm:h-80 md:h-[420px]"
              loading="lazy"
            />
            <div className="relative -mt-8 ml-2 mr-8 rounded-lg border border-border border-l-[3px] border-l-accent bg-card p-4 shadow-sm sm:ml-4">
              <p className="text-sm font-bold text-primary">
                Get paid while building your future.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Meaningful experience. Flexible scheduling. A stronger
                application.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-12">
        <h2 className="text-2xl font-extrabold text-primary">
          Why Students Choose Elev8
        </h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="min-w-0 border-t-2 border-accent pt-4">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="mt-3 text-base font-bold text-primary">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Eligible fields */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-14">
        <div className="border-t border-border pt-10 text-center">
          <h2 className="text-xl font-bold text-primary sm:text-2xl">
            Ideal for Students Studying or Pursuing
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-muted-foreground">
            {FIELDS}
          </p>
        </div>
      </section>

      {/* Employment */}
      <section id="employment" className="scroll-mt-20 bg-primary">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
          <h2 className="text-2xl font-extrabold text-primary-foreground sm:text-3xl">
            Looking for Employment Rather Than an Internship?
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-primary-foreground/80">
            Explore direct-support, supported-living, day-program, and
            administrative opportunities with Elev8 Services. We welcome
            applicants who bring patience, reliability, professionalism, and
            respect to this work.
          </p>
          <Link
            to="/careers/apply"
            search={{ fresh: true }}
            onClick={() => createApplicationAttempt()}
            className="mt-6 block w-full rounded-lg bg-accent px-6 py-4 text-center text-base font-bold text-accent-foreground sm:inline-block sm:w-auto sm:py-3 sm:text-sm"
          >
            View Career Opportunities
          </Link>
        </div>
      </section>
    </div>
  );
}
