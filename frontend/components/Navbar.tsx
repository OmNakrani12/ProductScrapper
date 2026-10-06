import Link from 'next/link';
import { Globe, History, Zap, ShieldCheck, Sparkles, ChevronRight, Compass, Terminal, Cpu } from 'lucide-react';

export default function Navbar() {
  return (
    <div className="w-full sticky top-0 z-50">
      
      {/* Top Industrial Announcement Bar */}
      <div className="w-full bg-gradient-to-r from-cyan-950 via-slate-900 to-indigo-950 border-b border-white/10 px-4 py-1.5 text-[11px] font-medium text-gray-300 flex items-center justify-center gap-2">
        <span className="px-2 py-0.2 bg-cyan-500/20 text-cyan-300 rounded font-mono font-bold text-[10px] border border-cyan-500/30 uppercase tracking-wider">
          v2.4 Enterprise Release
        </span>
        <span className="hidden sm:inline text-gray-300">
          Automatic Working Email Validation & MX Record Filtering Engine Enabled
        </span>
        <span className="flex items-center gap-0.5 text-cyan-400 font-semibold hover:underline cursor-pointer">
          Learn More <ChevronRight className="w-3 h-3" />
        </span>
      </div>

      {/* Main Industrial Header Navbar */}
      <header className="w-full border-b border-white/10 bg-[#050811]/85 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Industrial Brand Logo */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="relative">
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 opacity-75 blur group-hover:opacity-100 transition duration-300"></div>
              <div className="relative w-11 h-11 rounded-xl bg-[#090e1a] border border-white/20 flex items-center justify-center p-1 shadow-xl overflow-hidden">
                <img 
                  src="/logo.png" 
                  alt="ReachBot AI Logo" 
                  className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                />
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-lg text-white tracking-wider uppercase group-hover:text-cyan-400 transition-colors">
                  Reach<span className="text-cyan-400">Bot.AI</span>
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-white/10 text-gray-200 rounded border border-white/15 tracking-widest uppercase">
                  ENTERPRISE
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono tracking-wider -mt-0.5">
                Outreach & Lead Intelligence Engine
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 font-sans text-xs">
            <Link 
              href="/"
              className="flex items-center gap-2 px-3.5 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl font-medium transition-all"
            >
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Extractor Engine</span>
            </Link>

            <Link 
              href="/jobs"
              className="flex items-center gap-2 px-3.5 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl font-medium transition-all"
            >
              <History className="w-4 h-4 text-gray-400" />
              <span>Scrape History</span>
            </Link>

            <a 
              href="#uploader-tool"
              className="flex items-center gap-2 px-3.5 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl font-medium transition-all"
            >
              <Compass className="w-4 h-4 text-indigo-400" />
              <span>Directory Finder</span>
            </a>
          </nav>

          {/* Right Action & Status CTAs */}
          <div className="flex items-center gap-3">
            {/* Operational Status Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#090f1e] border border-emerald-500/30 text-[11px] font-mono text-emerald-400 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>System Operational</span>
            </div>

            {/* Launch CTA */}
            <Link
              href="/"
              className="px-4 py-2 text-xs font-bold text-white rounded-xl glow-button flex items-center gap-2"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>New Extraction</span>
            </Link>
          </div>

        </div>
      </header>
    </div>
  );
}
