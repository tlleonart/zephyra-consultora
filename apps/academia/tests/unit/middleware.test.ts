/**
 * Unit tests for apps/academia/src/middleware.ts — LEARNER BRANCH ONLY.
 *
 * apps/legacy's tests/unit/middleware.test.ts covered both branches in one file
 * because one middleware carried both. After the split there are three
 * middlewares (www: none, backoffice: admin, academia: learner), so the suite
 * splits with them. This file is the learner half, ported verbatim in intent
 * from that file's "learner protected route branch" describe.
 *
 * Two assertions from the original could not come along and are called out
 * rather than dropped silently:
 *   - the four ADMIN-branch cases (/admin redirects to /login, /login bounce)
 *     have no subject here — this bundle has no admin branch at all. They live
 *     in apps/backoffice's middleware (currently untested — T-fe-007 issue #4).
 *   - "redirects /admin/lms/courses to /login when only a session-learner
 *     cookie is present (inverse cross-surface guard)" needed the admin branch
 *     to do the redirecting. On this host /admin is not a route at all, so the
 *     property becomes stronger and different: the request simply falls through
 *     (asserted below) and reaches a 404 — an admin surface cannot be reached
 *     from the academia host by any cookie. The escalation direction that DOES
 *     have a subject here (an admin cookie must not open the player) is kept.
 *
 * The admin-style token is signed with a LOCAL constant, not
 * process.env.SESSION_SECRET: this app has no SESSION_SECRET (tests/setup.ts).
 */
import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { middleware } from "../../src/middleware";

// The admin surface's signing key as seen from this app: same algorithm,
// deliberately different value, deliberately not from the environment.
const ADMIN_STYLE_SECRET = new TextEncoder().encode(
  "test-session-secret-not-for-production-use"
);

const LEARNER_SECRET = new TextEncoder().encode(
  process.env.LEARNER_JWT_SECRET ??
    "test-learner-jwt-secret-not-for-production-use"
);

const signAdminStyleSession = async (): Promise<string> => {
  return await new SignJWT({ sub: "user-1", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(ADMIN_STYLE_SECRET);
};

const signValidLearnerSession = async (): Promise<string> => {
  return await new SignJWT({
    learnerId: "lms-customer-1",
    email: "learner@example.com",
    type: "individual",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(LEARNER_SECRET);
};

const makeRequest = (url: string, cookieHeader?: string): NextRequest => {
  const headers = new Headers();
  if (cookieHeader) headers.set("cookie", cookieHeader);
  return new NextRequest(new URL(url), { headers });
};

describe("middleware — learner protected route branch", () => {
  it("redirects an anonymous request to /cursos/<slug>/player to /cursos/auth/signin with returnTo", async () => {
    const req = makeRequest(
      "http://localhost:3000/cursos/intro-to-x/player"
    );
    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).not.toBeNull();
    const url = new URL(location!);
    expect(url.pathname).toBe("/cursos/auth/signin");
    expect(url.searchParams.get("returnTo")).toBe("/cursos/intro-to-x/player");
  });

  it("passes through /cursos/<slug>/player with a valid session-learner cookie", async () => {
    const token = await signValidLearnerSession();
    const req = makeRequest(
      "http://localhost:3000/cursos/intro-to-x/player",
      `session-learner=${token}`
    );
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects /cursos/<slug>/player to learner signin when only an admin-style session cookie is present (cross-surface guard)", async () => {
    const adminToken = await signAdminStyleSession();
    const req = makeRequest(
      "http://localhost:3000/cursos/intro-to-x/player",
      `session=${adminToken}`
    );
    const res = await middleware(req);
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).not.toBeNull();
    const url = new URL(location!);
    expect(url.pathname).toBe("/cursos/auth/signin");
  });

  it("redirects an authenticated learner away from /cursos/auth/signin to /cursos", async () => {
    const token = await signValidLearnerSession();
    const req = makeRequest(
      "http://localhost:3000/cursos/auth/signin",
      `session-learner=${token}`
    );
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/cursos$/);
  });

  it("passes through /cursos/auth/signin when no cookie is present (form must render)", async () => {
    const req = makeRequest("http://localhost:3000/cursos/auth/signin");
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through /cursos (catalog) anonymously — route is PUBLIC", async () => {
    const req = makeRequest("http://localhost:3000/cursos");
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through /cursos/<slug> (detail) anonymously — route is PUBLIC", async () => {
    const req = makeRequest("http://localhost:3000/cursos/intro-to-x");
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through /empresa/* — the B2B surface is not learner-gated here", async () => {
    // /empresa keeps its prefix on this host (boundaries v1.1 §3.1 D2). Org
    // authority is enforced server-side (requireOrgOwner + callerCustomerId),
    // not in middleware; a middleware gate here would break /empresa/registro
    // and /empresa/invitacion, which are pre-session entry points.
    for (const path of [
      "/empresa",
      "/empresa/cursos",
      "/empresa/registro",
      "/empresa/invitacion",
    ]) {
      const res = await middleware(makeRequest(`http://localhost:3000${path}`));
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    }
  });
});

/**
 * AC 7 — las páginas de cuenta de la alumna están protegidas.
 *
 * ESTE BLOQUE INVIERTE UN TEST QUE YA EXISTÍA, no agrega uno nuevo sobre terreno
 * virgen. Hasta acá el archivo afirmaba, en el describe "dropped and absent
 * surfaces", que el middleware NO gateaba /cursos/mis-cursos:
 *
 *   it("does NOT gate /cursos/mis-cursos (dead matcher entry removed)")
 *
 * Esa aserción era correcta cuando se escribió y su motivo está en el propio
 * middleware: apps/legacy gateaba esa ruta, la página nunca existió, y la
 * entrada terminaba protegiendo un 404. El mismo comentario anticipaba la
 * salida: "a learner dashboard will be (re)introduced deliberately with its own
 * matcher entry". La reintroducción es ésta, así que la propiedad se da vuelta
 * a propósito. NO es una regresión ni una relajación del gate: es el gate
 * llegando a la ruta que aquel comentario le reservó.
 *
 * El caso "una ruta inexistente no se gatea" sigue cubierto, con un sujeto que
 * de verdad no existe (ver el describe de abajo).
 */
describe("middleware — el área de cuenta de la alumna (AC 7)", () => {
  const ACCOUNT_ROUTES = ["/cursos/mis-cursos", "/cursos/cuenta"];

  it("gatea /cursos/mis-cursos y /cursos/cuenta sin sesión, con su returnTo", async () => {
    for (const path of ACCOUNT_ROUTES) {
      const res = await middleware(makeRequest(`http://localhost:3000${path}`));
      expect(res.status, `${path} debería redirigir`).toBe(307);
      const location = res.headers.get("location");
      expect(location).not.toBeNull();
      const url = new URL(location!);
      expect(url.pathname).toBe("/cursos/auth/signin");
      // El returnTo se EMITE bien acá. Que la vuelta completa funcione después
      // de activar la cuenta es otro asunto y otro defecto: la rama de
      // activación lo pierde. AC 7 exige que el redirect lo lleve, y lo lleva.
      expect(url.searchParams.get("returnTo")).toBe(path);
    }
  });

  it("deja pasar /cursos/mis-cursos y /cursos/cuenta con una sesión válida", async () => {
    const token = await signValidLearnerSession();
    for (const path of ACCOUNT_ROUTES) {
      const res = await middleware(
        makeRequest(`http://localhost:3000${path}`, `session-learner=${token}`)
      );
      expect(res.status, `${path} debería pasar`).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("una cookie de admin no abre el área de cuenta (guarda entre superficies)", async () => {
    const adminToken = await signAdminStyleSession();
    for (const path of ACCOUNT_ROUTES) {
      const res = await middleware(
        makeRequest(`http://localhost:3000${path}`, `session=${adminToken}`)
      );
      expect(res.status, `${path} con cookie de admin`).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe(
        "/cursos/auth/signin"
      );
    }
  });

  it("gatea también las sub-rutas que cuelguen de ellas", async () => {
    // Las entradas son prefijos, no rutas exactas: agregar una sub-pantalla más
    // adelante no exige acordarse de volver al middleware.
    for (const path of ["/cursos/mis-cursos/archivados", "/cursos/cuenta/datos"]) {
      const res = await middleware(makeRequest(`http://localhost:3000${path}`));
      expect(res.status, `${path} debería redirigir`).toBe(307);
      expect(new URL(res.headers.get("location")!).searchParams.get("returnTo")).toBe(
        path
      );
    }
  });

  it("no arrastra el gate al catálogo: /cursos y /cursos/<slug> siguen públicos", async () => {
    // La regresión que estas tres líneas nuevas podrían causar y nadie vería:
    // que un patrón demasiado ancho gatee el catálogo entero.
    for (const path of ["/cursos", "/cursos/mis-cursos-de-diversidad"]) {
      const res = await middleware(makeRequest(`http://localhost:3000${path}`));
      expect(res.status, `${path} debe seguir público`).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    }
  });
});

/**
 * /cursos/auth/set-password — una ruta que hasta acá no podía abrir NADIE.
 *
 * Estaba listada en `learnerAuthRoutes`, la lista de rutas que MINTEAN sesión.
 * El efecto combinado era una superficie muerta: con sesión rebotaba el
 * middleware a /cursos antes de que la página corriera, y sin sesión rebotaba
 * la página, que llama getLearnerSession() y redirige a signin. Los dos
 * caminos cerrados.
 *
 * Y explicaba un defecto que el testing no había podido diagnosticar: el alta
 * con correo nuevo no pedía contraseña. El consumo del enlace mágico setea la
 * cookie también en la activación, la verificación empuja a
 * set-password?firstTime=true, y el middleware veía una alumna autenticada
 * sobre una ruta de auth. La alumna caía en el catálogo, con sesión abierta y
 * sin contraseña.
 *
 * El arreglo es sacar la entrada. Estos tests fijan las dos mitades: con sesión
 * se llega, sin sesión sigue rebotando —pero rebota la PÁGINA, no el
 * middleware, que es la diferencia que hace que la ruta exista.
 */
describe("middleware — /cursos/auth/set-password es alcanzable con sesión", () => {
  it("deja pasar a una alumna CON sesión (antes la rebotaba a /cursos)", async () => {
    const token = await signValidLearnerSession();
    const res = await middleware(
      makeRequest(
        "http://localhost:3000/cursos/auth/set-password",
        `session-learner=${token}`
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("deja pasar también con ?firstTime=true, que es como llega el alta nueva", async () => {
    const token = await signValidLearnerSession();
    const res = await middleware(
      makeRequest(
        "http://localhost:3000/cursos/auth/set-password?firstTime=true",
        `session-learner=${token}`
      )
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("SIN sesión el middleware no redirige: el rebote a signin lo hace la página", async () => {
    // La ruta no se agregó a learnerProtectedPatterns a propósito. La página ya
    // se protege sola; gatearla acá además pondría el mismo guard en dos
    // lugares que pueden divergir. Lo que el middleware tiene que hacer es
    // DEJARLA PASAR para que la página decida.
    const res = await middleware(
      makeRequest("http://localhost:3000/cursos/auth/set-password")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("las otras tres rutas de auth siguen rebotando a quien ya tiene sesión", async () => {
    // El cambio es de UNA entrada. Si se llevara puesta la propiedad de las
    // otras tres, la lista entera quedaría inerte y nadie lo vería.
    const token = await signValidLearnerSession();
    for (const path of [
      "/cursos/auth/signup",
      "/cursos/auth/signin",
      "/cursos/auth/verify",
    ]) {
      const res = await middleware(
        makeRequest(`http://localhost:3000${path}`, `session-learner=${token}`)
      );
      expect(res.status, `${path} debería rebotar`).toBe(307);
      expect(res.headers.get("location")).toMatch(/\/cursos$/);
    }
  });
});

describe("middleware — dropped and absent surfaces", () => {
  it("no gatea una ruta que no existe (el caso que cubría el test de mis-cursos)", async () => {
    // La propiedad original —el middleware no protege superficies inexistentes—
    // se conserva con un sujeto que efectivamente no existe en este bundle.
    const res = await middleware(
      makeRequest("http://localhost:3000/cursos/panel-inexistente")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("has no admin branch: /admin/lms/courses is never redirected to /login", async () => {
    // Structural assertion of the auth separation. Not "an admin cookie is
    // rejected" — there is no admin verify path in this bundle to reject it
    // with. The admin surface simply does not exist on this host.
    const anon = await middleware(
      makeRequest("http://localhost:3000/admin/lms/courses")
    );
    expect(anon.status).toBe(200);
    expect(anon.headers.get("location")).toBeNull();

    const withLearner = await middleware(
      makeRequest(
        "http://localhost:3000/admin/lms/courses",
        `session-learner=${await signValidLearnerSession()}`
      )
    );
    expect(withLearner.status).toBe(200);
    expect(withLearner.headers.get("location")).toBeNull();
  });
});
