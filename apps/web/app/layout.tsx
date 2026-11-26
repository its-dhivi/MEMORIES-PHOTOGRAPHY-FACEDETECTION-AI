import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Cormorant_Garamond, DM_Sans } from 'next/font/google';
import { QueryProvider } from '@/components/query-provider';
import './globals.css';
const sans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });
const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-cormorant',
});
export const metadata: Metadata = {
  title: {
    default: 'AI Photo Finder | Memories Photography',
    template: '%s | Memories Photography',
  },
  description: 'Secure event photo discovery for Memories Photography.',
};
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${sans.variable} ${display.variable}`}
    >
      <body className="font-sans antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
