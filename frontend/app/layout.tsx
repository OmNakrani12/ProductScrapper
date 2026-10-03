import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'WebContact AI - Find Publicly Available Contact Info',
  description: 'Upload a list of websites and automatically discover publicly listed emails, phone numbers, and contact pages.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-gray-100 antialiased min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-border/60 py-6 bg-surface/30">
          <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-500">
            <p>WebContact AI &copy; {new Date().getFullYear()} — Enterprise Automated Contact Intelligence System.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
