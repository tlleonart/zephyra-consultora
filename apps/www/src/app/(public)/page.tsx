import type { Metadata } from "next";
import { HeroSection } from "@/components/public/HeroSection";
import { HomePageContent } from "@/components/public/HomePageContent";
import { ContactCTA } from "@/components/public/ContactCTA";
import { DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const TITLE = "Zephyra Consultora | Consultoría en Sostenibilidad";
const DESCRIPTION =
  "Transformamos el compromiso con el triple impacto en estrategias concretas que generan valor real para empresas y organizaciones.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: SITE_URL,
    images: [{ url: DEFAULT_OG_IMAGE, alt: TITLE }],
  },
};

export default function HomePage() {
  return (
    <>
      <HeroSection
        title="Somos consultoría en sostenibilidad"
        subtitle="Transformamos el compromiso con el triple impacto en estrategias concretas que generan valor real para empresas y organizaciones."
        ctaText="Conocé nuestros servicios"
        ctaHref="#servicios"
        backgroundImage="/images/hero-background.jpg"
      />
      <HomePageContent />
      <ContactCTA />
    </>
  );
}
