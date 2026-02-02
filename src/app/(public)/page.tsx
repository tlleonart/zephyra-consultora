import { HeroSection } from '@/components/public/HeroSection';
import { ServicesSection } from '@/components/public/ServicesSection';
import { ProjectsSection } from '@/components/public/ProjectsSection';
import { TeamSection } from '@/components/public/TeamSection';
import { ClientsSection } from '@/components/public/ClientsSection';
import { AlliancesSection } from '@/components/public/AlliancesSection';
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
      <ServicesSection />
      <ProjectsSection />
      <TeamSection />
      <ClientsSection />
      <AlliancesSection />
      <ContactCTA />
    </>
  );
}
