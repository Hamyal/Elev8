import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/site/Hero";
import { ServiceCards } from "@/components/site/ServiceCards";
import { OpportunitiesSection } from "@/components/site/OpportunitiesSection";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title:
          "Elev8 Services California — Person-Centered Care in California",
      },
      {
        name: "description",
        content:
          "Elev8 Services California provides person-centered residential, supported living, and day services for adults with developmental disabilities.",
      },
      { property: "og:title", content: "Elev8 Services California" },
      {
        property: "og:description",
        content:
          "Person-centered residential, supported living, and day services for adults with developmental disabilities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Hero />
      <ServiceCards />
      <OpportunitiesSection />
    </>
  );
}

