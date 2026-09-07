/**
 * AC 11 — la sesión no se filtra al cliente.
 *
 * `toPublicLearnerSession` es el único punto por donde la sesión de la alumna
 * cruza del servidor al navegador (`(public)/layout.tsx` → `<Navbar session>`).
 * Estos tests fijan que la proyección es una LISTA BLANCA: `email` y `type`
 * pasan, todo lo demás se queda del lado del servidor, y agregar un campo al
 * payload no lo filtra por omisión.
 *
 * El complemento —que el HTML realmente servido tampoco los contenga— está en
 * tests/unit/app/public-layout-session.test.tsx, porque ahí hay markup que
 * inspeccionar. Los dos hacen falta: esta capa fija la intención, aquélla fija
 * el resultado.
 */
import { describe, it, expect } from 'vitest';
import {
  PUBLIC_LEARNER_SESSION_FIELDS,
  toPublicLearnerSession,
  type PublicLearnerSession,
} from '@/features/auth-learner/lib/public-session';
import type { LearnerSessionPayload } from '@/features/auth-learner/lib/session';

const fullPayload = {
  learnerId: 'kn7c2tmh0000zzzz' as LearnerSessionPayload['learnerId'],
  email: 'nati@example.com',
  type: 'org_learner',
  organizationId: 'org-abc-123',
  exp: 1893456000,
} satisfies LearnerSessionPayload;

describe('toPublicLearnerSession — AC 11', () => {
  it('deja pasar email y type', () => {
    expect(toPublicLearnerSession(fullPayload)).toEqual({
      email: 'nati@example.com',
      type: 'org_learner',
    });
  });

  it('NO deja pasar learnerId, organizationId ni exp', () => {
    const projected = toPublicLearnerSession(fullPayload)!;
    const keys = Object.keys(projected);

    expect(keys).not.toContain('learnerId');
    expect(keys).not.toContain('organizationId');
    expect(keys).not.toContain('exp');
    // La forma exacta, no sólo la ausencia de los tres nombres conocidos: un
    // campo NUEVO en LearnerSessionPayload también tiene que romper este test.
    expect(keys.sort()).toEqual(['email', 'type']);
    expect(keys.sort()).toEqual([...PUBLIC_LEARNER_SESSION_FIELDS].sort());
  });

  it('no arrastra campos que el payload no declara (lista blanca, no lista negra)', () => {
    // Un payload de un deployment más viejo/nuevo con claves extra. La
    // proyección las ignora en vez de copiarlas.
    const withExtras = {
      ...fullPayload,
      iat: 1693456000,
      role: 'superadmin',
      impersonatedBy: 'admin-1',
    } as unknown as LearnerSessionPayload;

    const projected = toPublicLearnerSession(withExtras)!;
    expect(Object.keys(projected).sort()).toEqual(['email', 'type']);
    expect(JSON.stringify(projected)).not.toContain('superadmin');
    expect(JSON.stringify(projected)).not.toContain('impersonatedBy');
  });

  it('serializa a exactamente dos claves — es lo que viaja en el payload RSC', () => {
    expect(JSON.parse(JSON.stringify(toPublicLearnerSession(fullPayload)))).toEqual({
      email: 'nati@example.com',
      type: 'org_learner',
    });
  });

  it('sin sesión devuelve null (null y undefined dan lo mismo)', () => {
    expect(toPublicLearnerSession(null)).toBeNull();
    expect(toPublicLearnerSession(undefined)).toBeNull();
  });

  it('conserva los tres tipos de sesión — el menú de T-fe-005 discrimina por type', () => {
    const types: PublicLearnerSession['type'][] = [
      'individual',
      'org_admin',
      'org_learner',
    ];
    for (const type of types) {
      expect(toPublicLearnerSession({ ...fullPayload, type })!.type).toBe(type);
    }
  });
});
