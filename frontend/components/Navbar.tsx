import Link from 'next/link';
import { Globe, History, Zap, ShieldCheck } from 'lucide-react';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-amber-600 flex items-center justify-center shadow-lg shadow-accent/20 group-hover:scale-105 transition-transform duration-200">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white tracking-tight">WebContact</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-accent/20 text-accent rounded border border-accent/30">AI</span>
            </div>
            <p className="text-[11px] text-gray-400 -mt-0.5">Automated Contact Intelligence</p>
          </div>
        </Link>

        <nav className="flex items-center gap-4">
          <Link 
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-card/80 rounded-lg transition-colors"
          >
            <Zap className="w-4 h-4 text-accent" />
            <span>New Scan</span>
          </Link>
          <Link 
            href="/jobs"
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-card/80 rounded-lg transition-colors"
          >
            <History className="w-4 h-4 text-gray-400" />
            <span>Jobs History</span>
          </Link>
          
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SSRF Protected</span>
          </div>
        </nav>
      </div>
    </header>
  );
}
