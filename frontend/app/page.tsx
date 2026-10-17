'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Zap, 
  History, 
  TrendingUp, 
  MoreVertical,
  Code2,
  Bot
} from 'lucide-react';
import FileUploader from '@/components/FileUploader';

export default function LandingPage() {
  const router = useRouter();

  const handleJobCreated = (jobId: string) => {
    router.push(`/jobs/${jobId}`);
  };

  return (
    <div className="space-y-3 max-w-6xl mx-auto py-1">
      
      {/* ------------------------------------------------------------- */}
      {/* COMPACT HEADER (Clean Firebase Console Overview)               */}
      {/* ------------------------------------------------------------- */}
      {/* ------------------------------------------------------------- */}
      {/* COMPACT HEADER (Clean Firebase Console Overview)               */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Analytics
          </h1>
          <span className="text-gray-600 hidden sm:inline">•</span>
          <span className="text-xs text-gray-400">
            Real-time lead extraction & cold outreach
          </span>
        </div>

        <Link
          href="/jobs"
          className="firebase-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 self-start sm:self-auto touch-target justify-center"
        >
          <History className="w-3.5 h-3.5 text-gray-400" />
          <span>Past Jobs History</span>
        </Link>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* COMPACT ANALYTICS CARD (Matches Screenshot without Bloat)      */}
      {/* ------------------------------------------------------------- */}
      <div className="firebase-card overflow-hidden">
        
        {/* Card Header Bar */}
        <div className="px-4 py-2 border-b border-matte-700/80 flex items-center justify-between bg-matte-850/50">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-firebase-400" />
            <span className="text-xs font-semibold text-white">
              Operations & Outreach
            </span>
          </div>
          <button 
            type="button" 
            className="text-gray-400 hover:text-white p-0.5 rounded transition-colors"
            title="Options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 3 Metric Columns */}
        <div className="p-3.5 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 divide-y sm:divide-y-0 sm:divide-x divide-matte-700/60">
          
          {/* Metric 1 */}
          <div className="space-y-0.5 sm:pr-3">
            <div className="text-[11px] font-medium text-gray-400">
              Daily active contacts
            </div>
            <div className="text-xl font-mono font-bold text-white tracking-wide">
              ---
            </div>
            <div className="text-[10px] text-gray-400 font-mono">
              MX & DNS Deliverability
            </div>
          </div>

          {/* Metric 2 */}
          <div className="pt-2 sm:pt-0 sm:px-3 space-y-0.5">
            <div className="text-[11px] font-medium text-gray-400">
              Host deduplication
            </div>
            <div className="text-xl font-mono font-bold text-emerald-400 tracking-wide">
              100%
            </div>
            <div className="text-[10px] text-gray-400 font-mono">
              1 email per multi-site owner
            </div>
          </div>

          {/* Metric 3 */}
          <div className="pt-2 sm:pt-0 sm:pl-3 space-y-0.5">
            <div className="text-[11px] font-medium text-gray-400">
              Gemini key rotator
            </div>
            <div className="text-xl font-mono font-bold text-firebase-400 tracking-wide">
              Active
            </div>
            <div className="text-[10px] text-gray-400 font-mono">
              4 models with auto-failover
            </div>
          </div>

        </div>

        {/* Compact Sub-Table Status Row */}
        <div className="border-t border-matte-700/80 px-4 py-2 bg-matte-850/40 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1.5">
          <div className="flex items-center gap-2">
            <Code2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold text-white text-[11px]">Engine:</span>
            <span className="text-[11px] text-gray-300 font-mono">Playwright + HTTPX Fast Scraper</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono text-gray-400">
            <span>Status: <strong className="text-emerald-400">Active</strong></span>
            <span>Deliverability: <strong className="text-white">100%</strong></span>
            <span>Speed: <strong className="text-firebase-400">High Concurrent</strong></span>
          </div>
        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* COMPACT EXTRACTION STUDIO (Target Input Workspace)            */}
      {/* ------------------------------------------------------------- */}
      <div className="firebase-card p-4 sm:p-5 space-y-4">
        <div className="border-b border-matte-700/80 pb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-firebase-400" />
            <h2 className="text-xs sm:text-sm font-bold text-white">
              Target Website Extraction Studio
            </h2>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">
            ✓ 100% Primary Emails
          </span>
        </div>

        <FileUploader onJobCreated={handleJobCreated} />
      </div>

    </div>
  );
}
