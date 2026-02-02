/**
 * Static image fallback mappings for entities
 * Used when Convex storage URLs are not yet available
 */

// Team member name to image filename mapping
const TEAM_IMAGE_MAP: Record<string, string> = {
  'Martina Fay': '/images/martina.jpeg',
  'Natalia Bertinelli': '/images/natalia.jpg',
  'Camila Limansky': '/images/camila.jpeg',
  'Juana Solotar': '/images/juana.jpeg',
  'Estefanía Grisanti': '/images/estefania.jpeg',
  'Magdalena Blaha': '/images/magdalena.png',
};

// Client name to logo filename mapping
const CLIENT_LOGO_MAP: Record<string, string> = {
  'Limansky': '/images/limansky.webp',
  'Cibic': '/images/cibic.webp',
  'Mercado de Gafas': '/images/mdg.webp',
  'LABIN': '/images/labin-logo.jpeg',
};

// Alliance name to logo filename mapping
const ALLIANCE_LOGO_MAP: Record<string, string> = {
  'Colectar': '/images/colectar.webp',
  'Fundación Rosario': '/images/fundacion-rosario.webp',
  'Crowe': '/images/crowe.webp',
};

// Blog post slug to cover image mapping
const BLOG_COVER_MAP: Record<string, string> = {
  'que-es-ser-una-empresa-b': '/images/b_corp.webp',
  'desarrollo-sostenible-17-ods': '/images/desarrollo_sostenible.webp',
  'huella-carbono-guia-empresas': '/images/huella_carbono.webp',
};

// Project slug to image mapping
const PROJECT_IMAGE_MAP: Record<string, string> = {
  'programa-sustentabilidad-corporativa': '/images/project-sustentabilidad.jpg',
  'certificacion-b-corp-servicios': '/images/project-bcorp.jpg',
  'huella-carbono-evento-corporativo': '/images/project-huella.jpg',
};

/**
 * Get team member image URL with static fallback
 */
export const getTeamMemberImage = (
  name: string,
  convexUrl: string | null | undefined
): string | null => {
  if (convexUrl) return convexUrl;
  return TEAM_IMAGE_MAP[name] || null;
};

/**
 * Get client logo URL with static fallback
 */
export const getClientLogo = (
  name: string,
  convexUrl: string | null | undefined
): string | null => {
  if (convexUrl) return convexUrl;
  return CLIENT_LOGO_MAP[name] || null;
};

/**
 * Get alliance logo URL with static fallback
 */
export const getAllianceLogo = (
  name: string,
  convexUrl: string | null | undefined
): string | null => {
  if (convexUrl) return convexUrl;
  return ALLIANCE_LOGO_MAP[name] || null;
};

/**
 * Get blog post cover URL with static fallback
 */
export const getBlogCoverImage = (
  slug: string,
  convexUrl: string | null | undefined
): string | null => {
  if (convexUrl) return convexUrl;
  return BLOG_COVER_MAP[slug] || null;
};

/**
 * Get project image URL with static fallback
 */
export const getProjectImage = (
  slug: string,
  convexUrl: string | null | undefined
): string | null => {
  if (convexUrl) return convexUrl;
  return PROJECT_IMAGE_MAP[slug] || null;
};
