import { Link } from "@tanstack/react-router";

import heroCaregiver from "@/assets/hero-caregiver.png.asset.json";

export function Hero() {
  return (
    <section className="bg-background">
      <div className="mx-auto grid w-[min(1180px,calc(100%-2rem))] items-center gap-9 pb-14 pt-5 md:w-[min(1180px,calc(100%-4rem))] lg:grid-cols-[39%_61%]">
        <div>
          <p className="eyebrow">Person-Centered Support</p>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.06] tracking-[-0.04em] text-foreground lg:text-[3.875rem]">
            Care that helps
            <br />
            every person
            <br />
            <span className="text-accent">rise.</span>
          </h1>
          <p className="mt-7 max-w-[470px] text-lg leading-relaxed text-foreground lg:text-xl">
            Person-centered, healthcare-informed support for adults with developmental disabilities—promoting health, safety, independence, and meaningful community participation.
          </p>
          <div className="mt-8 flex flex-wrap gap-[18px]">
            <Link
              to="/services"
              className="inline-flex items-center rounded-md border-2 border-primary px-6 py-4 text-base font-bold text-primary transition-colors hover:bg-secondary"
            >
              Explore Services
            </Link>
            <Link
              to="/careers"
              className="inline-flex items-center rounded-md border-2 border-accent bg-accent px-6 py-4 text-base font-bold text-accent-foreground transition-colors hover:brightness-95"
            >
              Internships &amp; Careers
            </Link>
          </div>
        </div>

        <img
          src={heroCaregiver.url}
          alt="Caregiver supporting an adult client"
          className="block h-[380px] w-full rounded-[30px] object-cover object-center lg:h-[500px]"
        />
      </div>
    </section>
  );
}
