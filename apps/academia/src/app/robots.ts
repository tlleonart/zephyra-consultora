import type { MetadataRoute } from 'next';

/**
 * robots.txt.
 *
 * CERRADO POR DEFECTO: se rastrea sólo donde el entorno lo habilita
 * explícitamente (`ZEPHYRA_INDEXABLE=true`). Así, olvidar la variable deja un
 * entorno sin indexar —molesto pero inocuo— en vez de dejar staging compitiendo
 * con producción en Google. Ver ops/http-headers.mjs.
 *
 * Acompaña a la cabecera `x-robots-tag` de ops/http-headers.mjs: robots.txt
 * evita el rastreo, la cabecera evita la indexación de lo que igual se rastree.
 */
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if (process.env.ZEPHYRA_INDEXABLE === 'true') {
    return { rules: [{ userAgent: '*', allow: '/' }] };
  }
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
