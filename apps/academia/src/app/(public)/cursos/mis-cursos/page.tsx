import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@zephyra/convex/_generated/api';
import { getLearnerSession } from '@/features/auth-learner/lib/session';
import { EmptyCoursesState } from '@/components/public/EmptyCoursesState';
import { MyCourseCard } from '@/components/public/MyCourseCard';
import styles from './MyCourses.module.css';

// force-dynamic: la sesión y las matrículas son lecturas por request.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Mis cursos — Zephyra',
};

/**
 * `/cursos/mis-cursos` — los cursos de la alumna.
 *
 * La pantalla que el comentario de `listMyEnrollments` anunciaba y para la que
 * nunca se creó la tarea: «Powers a future /cursos/mis-cursos dashboard».
 *
 * UN SOLO VIAJE. `listMyCoursesWithProgress` joinea el curso y deriva el
 * avance del lado de Convex, así que acá no hay N+1 ni una segunda pasada para
 * resolver portadas: `coverUrl` viene resuelta.
 *
 * EL ORDEN NO SE TOCA. La query devuelve por `updatedAt` descendente —la
 * matrícula más recién tocada primero— porque el gesto de esta pantalla es
 * "seguir donde iba". Reordenar acá por título o por estado rompería eso en
 * silencio.
 *
 * LA CLAVE DE LISTA ES `enrollmentId`, NO EL SLUG. Una misma persona puede
 * tener dos matrículas al mismo curso (una individual y una por asiento de
 * empresa); con el slug como clave, React colapsaría las dos en una fila.
 *
 * EL GATE ESTÁ DOS VECES a propósito: el middleware ya protege la ruta y emite
 * el `returnTo`, y la llamada a `getLearnerSession()` es defensa en profundidad
 * —el mismo patrón del reproductor— y además de ahí sale el `learnerId` que la
 * query necesita. La query no lleva `requireAuth` justamente porque este server
 * component ya validó la cookie antes de bajárselo.
 *
 * NADA DE PORCENTAJES. Ver `CoursePositionLabel`: no hay fracción honesta que
 * mostrar, y la señal vive en un componente propio para que el día que la haya
 * la barra lo reemplace sin tocar esta pantalla.
 */
export default async function MyCoursesPage() {
  const session = await getLearnerSession();
  if (!session) {
    redirect('/cursos/auth/signin?returnTo=/cursos/mis-cursos');
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const enrollments = await convex.query(
    api.lms.enrollments.listMyCoursesWithProgress,
    { learnerId: session.learnerId }
  );

  return (
    <main className={styles.wrapper}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Mi cuenta</p>
        <h1 className={styles.title}>Mis cursos</h1>
      </div>

      {enrollments.length === 0 ? (
        <EmptyCoursesState
          // El texto del catálogo NO sirve acá: "Próximamente nuevos cursos" le
          // diría a esta alumna que todavía no publicamos nada, y es falso. Hay
          // catálogo; lo que no tiene es un curso suyo. El tratamiento se reusa;
          // la frase, no.
          text="Todavía no tenés cursos. Cuando te sumes a uno, va a aparecer acá para que puedas retomarlo cuando quieras."
          action={
            <Link href="/cursos" className={styles.emptyAction}>
              Ver el catálogo
            </Link>
          }
        />
      ) : (
        <ul className={styles.grid} role="list">
          {enrollments.map((enrollment) => (
            <li key={enrollment.enrollmentId} className={styles.gridItem}>
              <MyCourseCard
                courseSlug={enrollment.courseSlug}
                courseTitle={enrollment.courseTitle}
                coverUrl={enrollment.coverUrl}
                position={enrollment.position}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
