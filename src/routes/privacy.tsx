import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Elev8 Services California" },
      {
        name: "description",
        content:
          "How Elev8 Services California handles information submitted through this website.",
      },
      {
        property: "og:title",
        content: "Privacy Policy — Elev8 Services California",
      },
      {
        property: "og:description",
        content:
          "How Elev8 Services California handles information submitted through this website.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-extrabold text-primary lg:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-6 text-muted-foreground">
        This website collects only the information you choose to send us through
        the contact form: your name, email address, optional phone number, the
        topic you select, and your message.
      </p>
      <h2 className="mt-8 text-xl font-bold text-primary">How we use it</h2>
      <p className="mt-2 text-muted-foreground">
        We use your information solely to respond to your inquiry. We do not
        sell it, and we do not share it with third parties for marketing.
      </p>
      <h2 className="mt-8 text-xl font-bold text-primary">Sensitive information</h2>
      <p className="mt-2 text-muted-foreground">
        Please do not submit medical records or other confidential documentation
        through this website. Contact us and we will arrange a secure method.
      </p>
      <h2 className="mt-8 text-xl font-bold text-primary">Questions or removal</h2>
      <p className="mt-2 text-muted-foreground">
        To ask about your information or request its deletion, email{" "}
        <a href="mailto:info@arfsd.com" className="font-semibold text-primary hover:text-accent">
          info@arfsd.com
        </a>
        .
      </p>
    </div>
  );
}
