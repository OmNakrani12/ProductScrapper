'use client';

import { useRouter } from 'next/navigation';
import { Zap, ShieldCheck, FileSpreadsheet, Bot, ArrowRight, Layers } from 'lucide-react';
import FileUploader from '@/components/FileUploader';

export default function LandingPage() {
  const router = useRouter();

  const handleJobCreated = (jobId: string) => {
    router.push(`/jobs/${jobId}`);
  };

  return (
    <div className="space-y-12 py-4">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-semibold">
          <Zap className="w-3.5 h-3.5" />
          <span>Next-Gen Web Extraction Engine</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Find Publicly Available <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-accent via-amber-400 to-orange-500">
            Contact Information
          </span>{' '}
          from Websites
        </h1>

        <p className="text-base text-gray-400 leading-relaxed max-w-2xl mx-auto">
          Upload a list of websites and automatically discover publicly listed emails, phone numbers, contact pages, and company metadata.
        </p>
      </div>

      {/* Main Upload Card */}
      <div className="relative">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-64 bg-accent/10 blur-3xl rounded-full pointer-events-none -z-10" />
        <FileUploader onJobCreated={handleJobCreated} />
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-border/80">
        <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <Bot className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Hybrid HTTP + Playwright Crawling</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Fast httpx scraping with automatic headless Playwright browser rendering fallback for heavy JS websites.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">SSRF Security & Rate Protection</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Strict domain validation preventing access to local/private network endpoints, enforcing respectful site rules.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Instant CSV / XLSX / JSON Export</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            Download complete clean structured data directly in CSV, Excel XLSX, or raw JSON formats with one click.
          </p>
        </div>
      </div>
    </div>
  );
}
