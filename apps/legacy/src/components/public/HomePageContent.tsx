'use client';

import { ServicesSection } from '@/components/public/ServicesSection';
import { ProjectsSection } from '@/components/public/ProjectsSection';
import { TeamSection } from '@/components/public/TeamSection';
import { TrustSection } from '@/components/public/TrustSection';

export function HomePageContent() {
  return (
    <>
      <ServicesSection />
      <ProjectsSection />
      <TeamSection />
      <TrustSection />
    </>
  );
}
