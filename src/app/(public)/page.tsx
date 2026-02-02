import { HeroSection } from '@/components/public/HeroSection';
import { HomePageContent } from '@/components/public/HomePageContent';
import { ContactCTA } from '@/components/public/ContactCTA';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Zephyra Consultora | Consultoría en Sostenibilidad',
  description:
    'Acompañamos a organizaciones en su transformación hacia prácticas más responsables con el medio ambiente y la sociedad.',
};

export default function HomePage() {
  return (
    <>
      <HeroSection
        title="Construyendo un futuro sostenible"
        subtitle="Acompañamos a organizaciones en su transformación hacia prácticas más responsables con el medio ambiente y la sociedad."
        ctaText="Conocé nuestros servicios"
        ctaHref="#servicios"
        backgroundImage="/images/hero-background.jpg"
      />
      <HomePageContent />
      <ContactCTA />
    </>
  );
}
