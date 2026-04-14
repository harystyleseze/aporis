import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const mono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Aporis — AI Yield Intelligence Terminal',
  description:
    'Discover, analyze, and execute optimal DeFi yield opportunities across 10 protocols and 16 chains. Powered by LI.FI Earn.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${mono.variable} dark`}>
      <body className="min-h-screen antialiased relative">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
