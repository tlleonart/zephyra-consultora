/**
 * UAT1 / U6 — la pantalla de ingreso deja de afirmar que mandó un mail que no mandó.
 *
 * LO QUE SE FIJA, Y POR QUÉ IMPORTA QUE SEA UN SOLO MENSAJE. La respuesta tiene
 * que ser **indistinguible** entre un correo que tiene cuenta y uno que no: esa
 * es la anti-enumeración, ratificada por Tomás el 2026-09-12, y es lo único que
 * impide que cualquiera sondee el padrón de alumnas probando direcciones. Dos
 * textos distintos según el caso serían exactamente el oráculo que se quiere
 * evitar — y este archivo existe para que nadie los reintroduzca "para que se
 * entienda mejor".
 *
 * El defecto original era el opuesto y convivía con una rama muerta: el mensaje
 * que se mostraba afirmaba el envío, y el mensaje anti-enumeración correcto
 * estaba escrito en un `else` al que la acción nunca llega (devuelve
 * `success: true` siempre, a propósito).
 *
 * Es un test estructural sobre la fuente, como los de `app/`: el componente es
 * `'use client'` con dos acciones de servidor y `useSearchParams`, y lo que hay
 * que fijar es qué texto puede existir en el archivo, no cómo se pinta.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const FORM = path.resolve(
  __dirname,
  '../../../../src/features/auth-learner/components/LearnerSigninForm/LearnerSigninForm.tsx'
);
const src = () => fs.readFileSync(FORM, 'utf8');

const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const LINE_COMMENT = new RegExp(String.raw`^\s*//.*$`, 'gm');
/** El docblock CITA el texto viejo para explicarlo; la prohibición se lee en código. */
const code = () => src().replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');

describe('U6 — el ingreso no promete un mail que no mandó', () => {
  it('no afirma el envío: ese era el texto que dejaba esperando', () => {
    expect(code()).not.toContain('Te enviamos un link. Revisá tu mail');
  });

  it('el mensaje es condicional, no una afirmación', () => {
    expect(code()).toContain(
      'Si ese correo tiene una cuenta, en un minuto te llega el link para entrar.'
    );
  });

  it('hay UN solo mensaje para el pedido de link (release gate: anti-enumeración)', () => {
    const c = code();
    // Una sola constante, y ninguna otra cadena que suene a "te mandamos algo".
    const declaraciones = c.match(/const MAGIC_LINK_REQUESTED_MESSAGE\s*=/g) ?? [];
    expect(declaraciones).toHaveLength(1);
    // La rama muerta del `else` con su propio texto no puede volver.
    expect(c).not.toContain('Si esta cuenta existe, recibirás un link');
    // Nada que dependa del resultado para elegir qué decir.
    expect(c).not.toMatch(/result\.success\s*\?/);
    expect(c).not.toMatch(/if \(result\.success\) \{\s*setSuccessMessage/);
  });

  it('todas las ramas del pedido de link usan esa misma constante', () => {
    const c = code();
    const usos = c.match(/setSuccessMessage\(([^)]*)\)/g) ?? [];
    expect(usos.length).toBeGreaterThan(0);
    for (const uso of usos) {
      expect(uso).toContain('MAGIC_LINK_REQUESTED_MESSAGE');
    }
  });

  it('ofrece las dos salidas junto al mensaje, no solo al pie', () => {
    const c = code();
    // El bloque de ayuda existe y cuelga del estado de exito.
    expect(c).toMatch(/\{successMessage && \([\s\S]*?successHelp/);
    expect(c).toContain('/cursos/auth/signup');
    expect(c).toContain('/cursos/auth/recovery');
  });

  it('no las duplica: el pie se esconde cuando ya se mostraron arriba', () => {
    expect(code()).toMatch(/\{!successMessage && \([\s\S]*?footerLinks/);
  });
});
