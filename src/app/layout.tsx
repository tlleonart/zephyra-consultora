import './globals.css';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import { ConvexProvider } from '@/providers/ConvexProvider';
import { ToastProvider } from '@/providers/ToastProvider';

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

export const metadata = {
  title: 'Zephyra Consultora',
  description: 'Consultora de sostenibilidad e impacto social',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${dmSans.variable} ${playfair.variable}`}>
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
