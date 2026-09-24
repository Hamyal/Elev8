import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/accessibility")({
  head: () => ({
    meta: [
      { title: "Accessibility — Elev8 Services California" },
      {
        name: "description",
        content:
          "Our commitment to an accessible website and how to request assistance or report a barrier.",
      },
      {
        property: "og:title",
        content: "Accessibility — Elev8 Services California",
      },
      {
        property: "og:description",
        content:
          "Our commitment to an accessible website and how to request assistance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Accessibility,
});

function Accessibility() {
  return (
    <div className="site-shell max-w-3xl py-14">
      <h1 className="text-3xl font-extrabold text-primary lg:text-4xl">
        Accessibility
      </h1>
      <p className="mt-6 text-muted-foreground">
        Elev8 Services California is committed to making this website usable by
        everyone, including people who use screen readers, keyboard navigation,
        or magnification. We aim to follow recognized accessibility guidelines
        (WCAG 2.1 AA) and improve continuously.
      </p>
      <h2 className="mt-8 text-xl font-bold text-primary">Need assistance?</h2>
      <p className="mt-2 text-muted-foreground">
        If any part of this site is difficult to use, or you'd like information
        in another format, email{" "}
        <a href="mailto:info@arfsd.com" className="font-semibold text-primary hover:text-accent">
          info@arfsd.com
        </a>{" "}
        and we will help and work to fix the barrier.
      </p>
    </div>
  );
}
