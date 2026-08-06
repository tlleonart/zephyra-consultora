import { NotFound } from '@/components/public/NotFound';

/**
 * APP-WIDE 404 fallback.
 *
 * Next only reaches a nested not-found.tsx for a path that resolved into that
 * segment. A request for a path matching NO route — /proyectos, /blog,
 * /contacto, / — has no segment to fall into, so without this file it fell
 * through to Next's built-in 404: "This page could not be found.", in English,
 * on a document declaring lang="es", unbranded and with no link out.
 *
 * Those four paths are exactly the ones the institutional site owns and this app
 * does not, which is why the gap became visible now (see
 * @/lib/institutional-links). It is a pre-existing hole, not a regression from
 * the split: it was simply unreachable while a single host served every route.
 */
export default function RootNotFound() {
  return <NotFound />;
}
