import type { Metadata, Viewport } from 'next';
import FirebaseAppShell from '@/components/FirebaseAppShell';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#121316',
};

export const metadata: Metadata = {
  title: 'ReachBot AI — Automated B2B Lead Intelligence & Cold Outreach Platform',
  description: 'Extract 100% verified, deliverable decision-maker email addresses, company metadata, and social profiles automatically.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="bg-matte-900 text-gray-100 antialiased min-h-screen">
        <FirebaseAppShell>
          {children}
        </FirebaseAppShell>
      </body>
    </html>
  );
}
