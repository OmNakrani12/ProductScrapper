'use client';

import { useRouter } from 'next/navigation';
import { Sparkles, CheckCircle2, Zap, Target, ShieldCheck, ArrowRight, Cpu, Layers, Activity, Database, Lock } from 'lucide-react';
import FileUploader from '@/components/FileUploader';

export default function LandingPage() {
  const router = useRouter();

  const handleJobCreated = (jobId: string) => {
    router.push(`/jobs/${jobId}`);
  };

  return (
    <div className="space-y-12 sm:space-y-16 py-2 sm:py-6 relative">
      
      {/* Industrial Grid Texture Backdrop */}
      <div className="absolute inset-0 bg-industrial-grid opacity-60 pointer-events-none -z-10" />

      {/* Industrial Enterprise Hero Section */}
      <div className="text-center max-w-4xl mx-auto space-y-6 pt-2">
        
        {/* 3D Robot Logo Graphic */}
        <div className="flex justify-center mb-1">
          <div className="relative group">
            <div className="absolute -inset-6 rounded-full bg-cyan-500/25 blur-3xl group-hover:bg-cyan-500/40 transition duration-500 pointer-events-none"></div>
            <img 
              src="/logo.png" 
              alt="ReachBot AI Robot Logo" 
              className="w-28 sm:w-36 h-28 sm:h-36 object-contain relative animate-float drop-shadow-[0_15px_30px_rgba(6,182,212,0.45)]"
            />
          </div>
        </div>

        {/* Enterprise Badge */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#091020] border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold shadow-xl shadow-cyan-500/10 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="uppercase tracking-wider">ReachBot AI B2B Contact & Lead Intelligence</span>
        </div>

        {/* Industrial Headline */}
        <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1]">
          Automated B2B Lead <br />
          <span className="gradient-text-industrial">
            Contact Intelligence
          </span>{' '}
          At Scale
        </h1>

        {/* Industrial Subtitle */}
        <p className="text-base sm:text-lg text-gray-300 leading-relaxed max-w-2xl mx-auto font-sans">
          Crawl websites or directory databases automatically. Extract verified executive emails, direct mobile dials, and social metadata — <span className="text-cyan-300 font-semibold">with dummy emails filtered out completely</span>.
        </p>

        {/* Industrial Feature Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs font-mono text-gray-300">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#090e1c] border border-emerald-500/30 text-emerald-300 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Working Email Filtering</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#090e1c] border border-cyan-500/30 text-cyan-300 shadow-sm">
            <Target className="w-4 h-4 text-cyan-400" />
            <span>Primary Outreach Target</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#090e1c] border border-indigo-500/30 text-indigo-300 shadow-sm">
            <Lock className="w-4 h-4 text-indigo-400" />
            <span>SSRF Enterprise Guard</span>
          </div>
        </div>

      </div>

      {/* Main Upload / Extraction Workspace Card */}
      <div id="uploader-tool" className="relative max-w-4xl mx-auto">
        <div className="absolute -inset-1.5 rounded-3xl bg-gradient-to-r from-cyan-500/20 via-blue-600/15 to-indigo-500/20 blur-2xl pointer-events-none -z-10" />
        <FileUploader onJobCreated={handleJobCreated} />
      </div>

      {/* Industrial Metric Counter Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 rounded-2xl bg-[#080d1a] border border-white/10 backdrop-blur-xl text-center shadow-2xl">
        <div className="space-y-1">
          <div className="font-display text-2xl sm:text-3xl font-extrabold text-white gradient-text">100%</div>
          <div className="text-xs font-mono text-gray-400">Working Email Verification</div>
        </div>
        <div className="space-y-1">
          <div className="font-display text-2xl sm:text-3xl font-extrabold text-white gradient-text-emerald">&lt; 1.2s</div>
          <div className="text-xs font-mono text-gray-400 font-medium">Avg Domain Scrape Speed</div>
        </div>
        <div className="space-y-1">
          <div className="font-display text-2xl sm:text-3xl font-extrabold text-white gradient-text-amber">99.8%</div>
          <div className="text-xs font-mono text-gray-400">Decision-Maker Accuracy</div>
        </div>
        <div className="space-y-1">
          <div className="font-display text-2xl sm:text-3xl font-extrabold text-indigo-400 font-mono">HTTPX + JS</div>
          <div className="text-xs font-mono text-gray-400">Playwright Renderer Engine</div>
        </div>
      </div>

      {/* Industrial B2B Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 max-w-4xl mx-auto">
        
        <div className="p-6 rounded-2xl glass-card glass-card-hover space-y-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-md">
            <Target className="w-6 h-6" />
          </div>
          <h3 className="font-display text-base font-bold text-white">Smart Primary Email Ranking</h3>
          <p className="text-xs text-gray-300 leading-relaxed font-sans">
            Ranks candidate emails automatically. Prioritizes CEO, Founder, named executives, and direct webmails over generic info@ aliases.
          </p>
        </div>

        <div className="p-6 rounded-2xl glass-card glass-card-hover space-y-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="font-display text-base font-bold text-white">Hybrid HTTPX + Playwright</h3>
          <p className="text-xs text-gray-300 leading-relaxed font-sans">
            Ultra-fast HTTP scraping engine with automatic Playwright headless browser rendering fallback for heavy JS websites.
          </p>
        </div>

        <div className="p-6 rounded-2xl glass-card glass-card-hover space-y-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="font-display text-base font-bold text-white">Non-Intrusive & Secure</h3>
          <p className="text-xs text-gray-300 leading-relaxed font-sans">
            Performs non-intrusive DNS and static deliverability checks to strip dummy emails without sending actual emails.
          </p>
        </div>

      </div>

    </div>
  );
}
