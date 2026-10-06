import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'ReachBot AI — Automated B2B Lead Intelligence & Cold Outreach Platform',
  description: 'Extract 100% verified, deliverable decision-maker email addresses, mobile direct dials, and metadata from websites automatically.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="bg-background text-gray-100 antialiased min-h-screen flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
        
        {/* Background Ambient Glow Orbs */}
        <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none -z-10 animate-pulse" />
        <div className="fixed top-1/3 right-1/4 w-96 h-96 bg-indigo-500/10 blur-[140px] rounded-full pointer-events-none -z-10" />
        <div className="fixed bottom-0 left-1/3 w-[500px] h-[500px] bg-amber-500/5 blur-[160px] rounded-full pointer-events-none -z-10" />

        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {children}
        </main>

        <footer className="border-t border-white/10 py-8 bg-[#04070e]/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-white">ReachBot AI</span>
              <span>&copy; {new Date().getFullYear()} — Automated Outreach & Contact Intelligence Platform</span>
            </div>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Primary Working Email Filtering Active
              </span>
              <span className="text-gray-400">HTTPX + Headless Playwright</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
