import { notFound, redirect } from 'next/navigation';
import { ConvexHttpClient } from 'convex/browser';
import { getLearnerSession } from '@/features/auth-learner/lib/session';
import { PackCalculator } from '@/features/packs/components/PackCalculator';
import { api } from '@zephyra/convex/_generated/api';
import type { Id } from '@zephyra/convex/_generated/dataModel';

// Owner-gated per-course pack page. force-dynamic: owner gate + course read are
// per-request; pricing is reactive client-side via computePackPrice.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title: `Comprar para mi equipo — Zephyra`,
    description: `Calculá el precio por volumen para el curso ${slug} y comprá los lugares para tu equipo.`,
  };
}

/**
 * E2/E3 — the per-course pack page. Resolves the owner session + the org (so the
 * checkout action has the organizationId) + the course, then mounts the live
 * calculator. A non-purchasable / unknown slug is a notFound — the calculator
 * itself never renders a price (the server does).
 */
export default async function EmpresaCoursePackPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await getLearnerSession();
  if (!session || session.type !== 'org_admin') {
    redirect(`/cursos/auth/signin?returnTo=/empresa/cursos/${slug}`);
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  const org = await convex.query(api.lms.org.getOrganizationByOwner, {
    callerCustomerId: session.learnerId as Id<'lmsCustomers'>,
  });
  if (!org) {
    redirect('/empresa/registro');
  }

  const course = await convex.query(api.lms.courses.getBySlug, { slug });
  if (
    !course ||
    course.isPurchasable !== true ||
    typeof course.priceUsd !== 'number' ||
    !(course.priceUsd > 0)
  ) {
    notFound();
  }

  return (
    <PackCalculator
      courseId={course._id}
      courseTitle={course.title}
      organizationId={org._id}
    />
  );
}
