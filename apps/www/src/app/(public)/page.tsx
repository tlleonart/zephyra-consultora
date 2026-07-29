import { HeroSection } from "@/components/public/HeroSection";
import { HomePageContent } from "@/components/public/HomePageContent";
import { ContactCTA } from "@/components/public/ContactCTA";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Zephyra Consultora | Consultoría en Sostenibilidad",
  description:
    "Transformamos el compromiso con el triple impacto en estrategias concretas que generan valor real para empresas y organizaciones.",
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
