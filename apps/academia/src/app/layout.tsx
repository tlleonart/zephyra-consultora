import '@zephyra/ui/styles/globals.css';
// L2 — the Arena skin. Imported HERE and only here, and it does nothing on its
// own: every rule inside is scoped to [data-theme='academia'], which is set on
// <html> below. apps/www and apps/backoffice neither import this file nor set the
// attribute, so the only thing they inherit from the rebrand is the L1
// correction in variables.css. See packages/ui/src/styles/theme-academia.css.
import '@zephyra/ui/styles/theme-academia.css';
import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import { ConvexProvider } from '@zephyra/ui/providers/ConvexProvider';
import { ToastProvider } from '@zephyra/ui/providers/ToastProvider';
import { BRAND_DESCRIPTION, BRAND_NAME } from '@/lib/brand';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

// This app used to declare the INSTITUTIONAL site's metadata — title "Zephyra
// Consultora" — which meant the wrong browser tab, the wrong Open Graph card and
// the wrong search result on every Academia page. The name comes from
// @/lib/brand so there is exactly one place it can ever be wrong.
//
// The icons are deliberately NOT declared here: Next picks them up by file
// convention from src/app/{favicon.ico,icon.png,apple-icon.png}. Declaring them
// as well emits duplicate <link rel="icon"> tags.
export const metadata: Metadata = {
  title: {
    default: BRAND_NAME,
    template: `%s · ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  applicationName: BRAND_NAME,
  openGraph: {
    siteName: BRAND_NAME,
    title: BRAND_NAME,
    description: BRAND_DESCRIPTION,
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      // The theme switch. One attribute, one app, no leakage.
      data-theme="academia"
      className={`${dmSans.variable} ${playfair.variable}`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
        />
      </head>
      <body>
        <ConvexProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ConvexProvider>
      </body>
    </html>
  );
}
