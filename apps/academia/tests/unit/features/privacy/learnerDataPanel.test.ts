/**
 * UAT1 / U4 — la privacidad deja de ser una puerta cerrada para la alumna B2C.
 *
 * RELEASE GATE DE PRIVACIDAD, y es lo que este archivo custodia:
 *
 *   1. El pedido de baja NO ejecuta la baja. `lmsCustomers` registra `deletedBy`
 *      contra `adminUsers` y el esquema es explícito: "Learners NEVER appear as
 *      deletedBy in ANY row (PDD H-2 mitigation)". Si algún día esta acción
 *      escribe `deletedAt`, esa invariante se rompe y el registro de quién borró
 *      a quién deja de ser cierto. El test falla antes.
 *
 *   2. La rama de la alumna CON organización no se toca. El panel de
 *      consentimiento es el gate servidor del progreso nominal (PDD §6.4); este
 *      sprint le agrega una hermana, no lo modifica.
 *
 *   3. La identidad sale de la cookie, nunca del cliente. Un correo que viniera
 *      del formulario convertiría esto en "pedí la baja de cualquiera".
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP = path.resolve(__dirname, '../../../..');
const read = (p: string) => fs.readFileSync(path.join(APP, p), 'utf8');

const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const LINE_COMMENT = new RegExp(String.raw`^\s*//.*$`, 'gm');
/** Los docblocks CITAN la invariante; las prohibiciones se leen en código. */
const code = (p: string) =>
  read(p).replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');

const ACCION = 'src/features/privacy/actions/request-account-deletion.ts';
const PANEL = 'src/features/privacy/components/LearnerDataPanel/LearnerDataPanel.tsx';
const PAGINA = 'src/app/(public)/cursos/privacidad/page.tsx';

describe('U4 — release gate: el pedido de baja no borra nada', () => {
  it('no escribe deletedAt ni deletedBy', () => {
    const c = code(ACCION);
    expect(c).not.toContain('deletedAt');
    expect(c).not.toContain('deletedBy');
  });

  it('no llama a ninguna mutación de borrado', () => {
    const c = code(ACCION);
    expect(c).not.toMatch(/convex\.mutation/);
    expect(c).not.toMatch(/delete[A-Z]\w*Customer/);
    expect(c).not.toMatch(/softDelete/);
  });

  it('lo único que hace es avisar: abre un trámite, no lo cierra', () => {
    expect(code(ACCION)).toContain('sendLearnerEmail');
  });

  it('la identidad sale de la sesión, no de un parámetro del cliente', () => {
    const c = code(ACCION);
    expect(c).toContain('getLearnerSession()');
    // La acción no recibe argumentos: no hay correo que pueda venir de afuera.
    expect(c).toMatch(/requestAccountDeletion\s*=\s*async\s*\(\s*\)\s*:/);
  });

  it('sin sesión no hace nada', () => {
    expect(code(ACCION)).toMatch(/if \(!session\) \{\s*return \{ success: false/);
  });
});

describe('U4 — la página resuelve por tipo de alumna y no rebota', () => {
  it('ya no manda al catálogo a quien no tiene organización', () => {
    expect(code(PAGINA)).not.toContain("redirect('/cursos')");
  });

  it('sin sesión sigue pidiendo iniciar sesión', () => {
    expect(code(PAGINA)).toContain('/cursos/auth/signin?returnTo=/cursos/privacidad');
  });

  it('con organización sigue mostrando el panel de consentimiento, intacto', () => {
    const c = code(PAGINA);
    expect(c).toContain('<ConsentPanel');
    expect(c).toContain('organizationName="tu organización"');
  });

  it('sin organización muestra la pantalla de datos', () => {
    expect(code(PAGINA)).toContain('<LearnerDataPanel');
  });
});

describe('U4 — lo que la pantalla promete es lo que pasa', () => {
  it('dice que la cuenta sigue activa hasta que alguien procese el pedido', () => {
    const c = code(PANEL);
    expect(c).toContain('sigue activa');
  });

  it('avisa que se pierde el acceso a los cursos comprados', () => {
    expect(code(PANEL)).toContain('perdés el acceso a los cursos');
  });

  it('no promete exportación de datos, que no está construida', () => {
    const c = code(PANEL).toLowerCase();
    expect(c).not.toContain('descargar mis datos');
    expect(c).not.toContain('exportar');
  });

  it('pide confirmación antes de mandar el pedido', () => {
    expect(code(PANEL)).toContain("setEstado('confirmando')");
  });
});
