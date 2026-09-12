import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// LEARNER BRANCH ONLY. This app serves EXTERNAL users (learners B2C, Org Admins
// B2B, org learners). The admin branch — 'session' cookie + SESSION_SECRET,
// /admin and /login|/forgot-password|/reset-password — lives in
// apps/backoffice/src/middleware.ts and MUST NOT appear here. There is no
// SESSION_SECRET in this app's env and no admin verify path in this bundle, so
// an admin cookie grants nothing on this host by construction (boundaries §4,
// PDD §7.5, SDD §6 SC #3).
//
// Distinct signing key from SESSION_SECRET. Learner cookies cannot validate
// against the admin verify path and vice-versa — the cross-surface escalation
// guard rests on this boundary plus the distinct cookie name. Edge runtime
// cannot import from src/features/auth-learner/lib/session.ts (Next.js bundler
// constraint on server-only helpers — that module imports `next/headers`), so
// the verify logic is INLINED here. Do not "clean this up" into an import.
// MUST match the dev fallback in features/auth-learner/lib/session.ts. When
// LEARNER_JWT_SECRET is unset (local dev), the session is signed with
// 'fallback-learner-secret-for-development-only'; a divergent fallback here
// silently fails verification and bounces a freshly-minted learner (e.g. a
// just-claimed org_learner) to sign-in. Production sets LEARNER_JWT_SECRET, so
// this only affects dev parity — but the divergence is a real local-dev bug.
const learnerSecretKey = new TextEncoder().encode(
  process.env.LEARNER_JWT_SECRET || 'fallback-learner-secret-for-development-only'
);

// /cursos/<slug>/player and any nested sub-path (e.g. /player/scorm-frame).
// /cursos, /cursos/<slug>, and /cursos/auth/* MUST remain PUBLIC — catalog
// and learner sign-in entry points cannot be gated by the very session they
// mint.
//
// The pattern stays narrowly scoped to /cursos/<slug>/player rather than
// widening to /^\/[^/]+\/player/: the /cursos prefix is KEPT on this host
// (boundaries v1.1 §3.1 D1), so there is no reason to match an arbitrary first
// segment.
//
// EL PANEL DE LA ALUMNA VUELVE, Y CON SU PROPIA ENTRADA. El comentario que
// estaba acá decía que `learnerProtectedRoutes = ['/cursos/mis-cursos']` de
// apps/legacy NO se arrastraba —esa página nunca existió, así que la entrada
// gateaba un 404— y anticipaba por escrito que "a learner dashboard will be
// (re)introduced deliberately with its own matcher entry". Esto es esa
// reintroducción deliberada, no el arrastre que aquel comentario rechazaba.
//
// ORDEN DENTRO DEL SPRINT, dicho para que no se lea como el mismo error: la
// entrada aterriza ANTES que las dos páginas, porque las páginas dependen de
// ella (se construyen ya gateadas y con su returnTo funcionando). La ventana en
// la que estas dos rutas gatean un 404 es de horas y dentro de la misma rama;
// si el sprint se cerrara sin las páginas, estas dos líneas se van con ellas.
//
// SON PREFIJOS, no rutas exactas: el `(\/|$)` cubre cualquier sub-ruta que
// cuelgue de ellas más adelante sin tener que volver a este archivo. Y ojo con
// el efecto lateral: /cursos/<slug> comparte espacio de nombres con estas dos,
// así que un curso publicado con slug `mis-cursos` o `cuenta` quedaría gateado
// además de inalcanzable. Es la misma colisión que ya existía a nivel de
// carpetas en el App Router; sólo que ahora también se ve acá.
const learnerProtectedPatterns: RegExp[] = [
  /^\/cursos\/[^/]+\/player(\/|$)/,
  /^\/cursos\/mis-cursos(\/|$)/,
  /^\/cursos\/cuenta(\/|$)/,
];
// Rutas que MINTEAN sesión. Una alumna que ya la tiene no tiene nada que hacer
// en ellas, así que se la manda al catálogo.
//
// /cursos/auth/set-password NO ESTÁ EN ESTA LISTA, y su ausencia es el arreglo.
// Estuvo acá desde el split y dejaba la ruta inalcanzable para todo el mundo:
// con sesión rebotaba el middleware antes de que la página corriera, y sin
// sesión rebotaba la página, que exige sesión. La entrada siempre estuvo mal
// categorizada — set-password no mintea nada, es POSTERIOR a la sesión: la
// alumna ya está autenticada y lo que hace ahí es elegir contraseña.
//
// Sacarla destraba además el alta con correo nuevo. El consumo del enlace
// mágico setea la cookie también en la activación, la pantalla de verificación
// empuja a set-password?firstTime=true, y el middleware veía "alumna
// autenticada sobre ruta de auth" y la mandaba a /cursos. Resultado: quien se
// daba de alta por primera vez aterrizaba en el catálogo sin que nadie le
// pidiera contraseña.
//
// La ruta NO pasa a learnerProtectedPatterns: la página ya se protege sola
// (llama getLearnerSession y redirige a signin sin ella), y gatearla acá además
// duplicaría el guard en dos lugares que pueden divergir.
const learnerAuthRoutes = [
  '/cursos/auth/signup',
  '/cursos/auth/signin',
  '/cursos/auth/verify',
];

// UAT1 / U2. A donde mandar a una alumna que YA tiene sesion y cae sobre una
// ruta que mintea sesion.
//
// Antes esto no existia: se la mandaba siempre al catalogo, tirando el
// `returnTo` que la propia pagina de destino habia puesto en la URL. El efecto
// lo reportaron las testers sin saber que era esto: /empresa gatea a quien no
// es duena de empresa mandandola a `signin?returnTo=/empresa`, el middleware
// veia "alumna autenticada sobre ruta de auth" y la devolvia a /cursos. Asi
// que /empresa "se transformaba en el link de cursos" para cualquiera con la
// sesion iniciada, y la propuesta B2B quedaba inalcanzable.
//
// ESTO ES UNA REDIRECCION ABIERTA SI SE HACE MAL, y por eso el destino se
// valida en vez de confiarse. La guarda que hace el trabajo pesado es la
// comparacion de origen: `new URL(raw, origin)` resuelve las formas que
// parecen relativas y no lo son —`//evil.com` es protocolo-relativa, y el
// parser ademas descarta tabs y saltos de linea intercalados, que es el truco
// clasico para colar `/	/evil.com`— y cualquiera de esas termina con un
// origen distinto del nuestro. Se devuelve solo la parte de ruta, nunca la URL
// entera que llego.
//
// La segunda guarda es contra el rebote infinito: si el `returnTo` apunta a
// otra ruta de auth, volveriamos a entrar por esta misma rama.
const FALLBACK_AFTER_AUTH = '/cursos';

const safeReturnTo = (raw: string | null, origin: string): string => {
  if (!raw) return FALLBACK_AFTER_AUTH;
  // Tiene que ser una ruta de este sitio, escrita como ruta.
  if (!raw.startsWith('/')) return FALLBACK_AFTER_AUTH;
  let resolved: URL;
  try {
    resolved = new URL(raw, origin);
  } catch {
    return FALLBACK_AFTER_AUTH;
  }
  if (resolved.origin !== origin) return FALLBACK_AFTER_AUTH;
  // Nada de volver a una ruta que mintea sesion: seria este mismo rebote otra vez.
  if (learnerAuthRoutes.some((route) => resolved.pathname.startsWith(route))) {
    return FALLBACK_AFTER_AUTH;
  }
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
};

const verifyLearnerSessionInMiddleware = async (token: string): Promise<boolean> => {
  try {
    await jwtVerify(token, learnerSecretKey);
    return true;
  } catch {
    return false;
  }
};

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Learner branch. Uses 'session-learner' cookie + LEARNER_JWT_SECRET.
  // An admin 'session' cookie is intentionally insufficient to grant access to
  // learner-protected routes; admins who want to test the player must create
  // a learner account (Sprint 1 locked behavior, cross-surface guard).
  const isLearnerProtectedRoute = learnerProtectedPatterns.some(pattern => pattern.test(path));
  const isLearnerAuthRoute = learnerAuthRoutes.some(route => path.startsWith(route));

  const learnerCookie = request.cookies.get('session-learner')?.value;
  let isLearnerAuthenticated = false;
  if (learnerCookie) {
    isLearnerAuthenticated = await verifyLearnerSessionInMiddleware(learnerCookie);
  }

  if (isLearnerProtectedRoute && !isLearnerAuthenticated) {
    const signinUrl = new URL('/cursos/auth/signin', request.url);
    signinUrl.searchParams.set('returnTo', path);
    return NextResponse.redirect(signinUrl);
  }

  if (isLearnerAuthRoute && isLearnerAuthenticated) {
    // Respeta el `returnTo` que puso la pagina que gateo, si es seguro.
    // Sin `returnTo` el destino sigue siendo el catalogo, como siempre.
    const target = safeReturnTo(
      request.nextUrl.searchParams.get('returnTo'),
      request.nextUrl.origin
    );
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

// Matcher unchanged from apps/legacy: the pattern already catches /cursos/* and
// /empresa/* while excluding api/static. Critically it excludes `api`, which is
// why /api/lms/asset/[slug]/[...path] (the SCORM proxy) is NOT intercepted —
// the CAMPUS iframe fetches assets without going through this middleware. Any
// future auth gate on the proxy (T-fe-008b) therefore has to live in the route
// handler itself, not here.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
