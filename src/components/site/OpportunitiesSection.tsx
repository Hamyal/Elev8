import { Link } from "@tanstack/react-router";
import iconStudents from "@/assets/icon-students.png.asset.json";
import iconCareProfessionals from "@/assets/icon-care-professionals.jpeg.asset.json";

export function OpportunitiesSection() {
  return (
    <section className="bg-background">
      <div className="mx-auto w-[min(1180px,calc(100%-2rem))] pb-8 pt-14 md:w-[min(1180px,calc(100%-4rem))]">
        <div className="text-center">
          <p className="eyebrow">Grow With Elev8</p>
          <h2 className="mt-4 mb-9 text-3xl font-extrabold leading-[1.08] tracking-tight text-foreground lg:text-[2.5rem]">
            Meaningful opportunities.
            <br />
            <span className="text-accent">Lasting impact.</span>
          </h2>
        </div>

        <div className="grid gap-7 md:grid-cols-2">
          <div className="flex min-h-[470px] flex-col items-center rounded-xl border border-accent bg-card px-8 py-7 text-center lg:px-11">
            <img
              src={iconStudents.url}
              alt="Growing seedling"
              className="h-[62px] w-[62px] rounded-full object-cover"
            />
            <h3 className="mt-4 text-[1.6875rem] font-bold text-foreground">
              Students &amp; Interns
            </h3>
            <span className="mt-[18px] block h-[3px] w-[38px] bg-accent" />
            <h4 className="mx-auto mt-4 max-w-[380px] text-lg font-bold leading-snug text-foreground">
              Build meaningful experience before your next step.
            </h4>
            <p className="mx-auto mt-3 max-w-[470px] text-base leading-relaxed text-foreground">
              Gain person-centered experience supporting adults with
              developmental disabilities — ideal for students pursuing medicine,
              nursing, pharmacy, physician assistant studies, psychology,
              behavioral health, or human services.
            </p>
            <Link
              to="/careers"
              className="mt-auto w-full rounded-md bg-accent px-6 py-3.5 text-base font-bold text-accent-foreground transition-all hover:brightness-95"
            >
              Explore Internships
            </Link>
          </div>

          <div className="flex min-h-[470px] flex-col items-center rounded-xl border border-teal bg-card px-8 py-7 text-center lg:px-11">
            <img
              src={iconCareProfessionals.url}
              alt="Two care professionals connecting through teamwork"
              className="h-[62px] w-[62px] rounded-full object-cover"
            />
            <h3 className="mt-4 text-[1.6875rem] font-bold text-foreground">
              Care Professionals
            </h3>
            <span className="mt-[18px] block h-[3px] w-[38px] bg-teal" />
            <h4 className="mx-auto mt-4 max-w-[380px] text-lg font-bold leading-snug text-foreground">
              Make a difference through meaningful work.
            </h4>
            <p className="mx-auto mt-3 max-w-[470px] text-base leading-relaxed text-foreground">
              Explore opportunities providing person-centered care, positive
              behavioral support, and assistance with health, independence, and
              community participation.
            </p>
            <Link
              to="/careers"
              className="mt-auto w-full rounded-md bg-teal px-6 py-3.5 text-base font-bold text-teal-foreground transition-all hover:brightness-95"
            >
              View Open Positions
            </Link>
          </div>
        </div>

        <div className="mt-7 flex flex-col items-start gap-[18px] rounded-[14px] bg-primary px-6 py-5 text-primary-foreground sm:flex-row sm:items-center">
          <span className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-full bg-teal">
            <svg
              viewBox="0 0 48 48"
              className="h-9 w-9"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={2}
              aria-hidden="true"
            >
              <circle cx="24" cy="13" r="5" />
              <circle cx="10" cy="22" r="4" />
              <circle cx="38" cy="22" r="4" />
              <path d="M15 43V34c0-6 4-10 9-10s9 4 9 10v9M3 43V34c0-5 3-8 7-8M45 43V34c0-5-3-8-7-8" />
            </svg>
          </span>
          <div className="flex-1">
            <h3 className="text-[1.4375rem] font-bold text-primary-foreground">
              Families &amp; Referral Partners
            </h3>
            <p className="mt-1 text-[0.9375rem] leading-relaxed text-primary-foreground">
              We partner with families, schools, hospitals, case managers, and
              community organizations to connect individuals with the right
              support.
            </p>
          </div>
          <Link
            to="/referrals"
            className="rounded-md border-2 border-card bg-card px-7 py-3.5 text-base font-bold text-foreground transition-colors hover:bg-secondary"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </section>
  );
}
