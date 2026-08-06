import { NotFound } from '@/components/public/NotFound';

/**
 * 404 boundary for the (public) segment. Inherits (public)/layout.tsx, so this
 * one renders WITH the Navbar and Footer. The panel itself is shared with the
 * app-wide fallback at app/not-found.tsx — see that component for why both
 * boundaries exist.
 */
export default function PublicNotFound() {
  return <NotFound />;
}
