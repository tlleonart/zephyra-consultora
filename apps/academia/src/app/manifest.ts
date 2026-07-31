import type { MetadataRoute } from 'next';
import {
  BRAND_DESCRIPTION,
  BRAND_NAME,
  BRAND_NAME_SHORT,
} from '@/lib/brand';

// Served at /manifest.webmanifest by the App Router file convention. The icon
// FILES are the D-3 swap point: choosing the redrawn flower over the Z monogram
// means overwriting public/icons/* and src/app/{favicon.ico,icon.png,
// apple-icon.png} and touching no code.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME_SHORT,
    description: BRAND_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    // paper and brand green — the L1/L2 tokens, as literals because a manifest
    // cannot read CSS custom properties.
    background_color: '#EFEAE0',
    theme_color: '#1E3C2E',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
