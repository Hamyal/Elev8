import { createFileRoute } from "@tanstack/react-router";
import { ContactForm } from "@/components/site/ContactForm";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Elev8 Services California" },
      {
        name: "description",
        content:
          "Contact Elev8 Services California about residential, supported living, or day services, referrals, careers, and internships.",
      },
      { property: "og:title", content: "Contact Elev8 Services California" },
      {
        property: "og:description",
        content:
          "Reach the Elev8 Services team about services, referrals, careers, and internships.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contact,
});

function Contact() {
  return <ContactForm />;
}
