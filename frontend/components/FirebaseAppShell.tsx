'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Zap, 
  History, 
  Key, 
  Mail, 
  Menu, 
  X, 
  ChevronRight, 
  ChevronDown
} from 'lucide-react';
import GeminiKeyManagerModal from './GeminiKeyManagerModal';
import { getGeminiKeysStatus } from '@/lib/api';
import { GeminiPoolStatus } from '@/types';

interface FirebaseAppShellProps {
  children: React.ReactNode;
}

export default function FirebaseAppShell({ children }: FirebaseAppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showKeysModal, setShowKeysModal] = useState(false);
  const [keyPoolStatus, setKeyPoolStatus] = useState<GeminiPoolStatus | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await getGeminiKeysStatus();
        setKeyPoolStatus(res);
      } catch (e) {
        // quiet fallback
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Compute breadcrumbs for deep routes
  const getBreadcrumbs = () => {
    if (pathname === '/') return [];
    if (pathname === '/jobs') return [{ label: 'Jobs', href: '/jobs' }];
    if (pathname.includes('/campaign')) {
      const parts = pathname.split('/');
      const jobId = parts[2];
      return [
        { label: 'Jobs', href: '/jobs' },
        { label: `#${jobId.slice(0, 6)}`, href: `/jobs/${jobId}` },
        { label: 'AI Outreach', href: pathname },
      ];
    }
    if (pathname.startsWith('/jobs/')) {
      const parts = pathname.split('/');
      const jobId = parts[2];
      return [
        { label: 'Jobs', href: '/jobs' },
        { label: `#${jobId.slice(0, 6)}`, href: pathname },
      ];
    }
    return [];
  };

  const breadcrumbs = getBreadcrumbs();

  const isExtractionActive = pathname === '/';
  const isHistoryActive = pathname.startsWith('/jobs') && !pathname.includes('/campaign');
  const isCampaignActive = pathname.includes('/campaign');

  const handleCampaignNav = () => {
    if (pathname.includes('/jobs/')) {
      const parts = pathname.split('/');
      const jobId = parts[2];
      router.push(`/jobs/${jobId}/campaign`);
    } else {
      router.push('/jobs');
    }
  };

  return (
    <div className="min-h-screen bg-matte-900 text-gray-100 flex flex-col antialiased selection:bg-firebase-600/30 selection:text-firebase-200">
      
      {/* ------------------------------------------------------------- */}
      {/* COMPACT TOP NAVBAR (Firebase Console Clean Matte Black)        */}
      {/* ------------------------------------------------------------- */}
      {/* COMPACT TOP NAVBAR (Firebase Console Clean Matte Black)        */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 h-13 sm:h-14 bg-matte-850/95 backdrop-blur-md border-b border-matte-700/80 px-2.5 sm:px-5 flex items-center justify-between gap-2 sm:gap-3">
        
        {/* LEFT: ONLY LOGO & WORKSPACE PILL */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <Link 
            href="/" 
            className="flex items-center gap-2 group p-1 -ml-1 rounded-lg hover:bg-matte-800 transition-colors" 
            title="ReachBot Lead Extraction Studio"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-matte-800 hover:bg-matte-750 border border-matte-700/80 flex items-center justify-center p-1 group-hover:border-firebase-500 transition-colors shadow-sm">
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-full h-full object-contain"
              />
            </div>
          </Link>

          {/* Project Pill */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold text-gray-200 hover:bg-matte-800 border border-transparent hover:border-matte-700/60 cursor-pointer transition-colors">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-bold text-white">SplitGrow</span>
            <ChevronDown className="w-3 h-3 text-gray-400 hidden sm:inline" />
          </div>
        </div>

        {/* MIDDLE: COMPACT HORIZONTAL TABS (Desktop & Tablet Landscape) */}
        <nav className="hidden lg:flex items-center gap-0.5 bg-matte-900/90 p-0.5 rounded-lg border border-matte-700/80 shadow-inner">
          
          {/* Tab 1: Studio */}
          <Link
            href="/"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              isExtractionActive
                ? 'bg-matte-800 text-white border border-matte-700 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-matte-800/50'
            }`}
            title="Target Website Extraction Studio"
          >
            <Zap className={`w-3.5 h-3.5 ${isExtractionActive ? 'text-firebase-400' : 'text-gray-400'}`} />
            <span>Studio</span>
          </Link>

          {/* Tab 2: History */}
          <Link
            href="/jobs"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              isHistoryActive
                ? 'bg-matte-800 text-white border border-matte-700 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-matte-800/50'
            }`}
            title="Scrape Jobs History"
          >
            <History className={`w-3.5 h-3.5 ${isHistoryActive ? 'text-firebase-400' : 'text-gray-400'}`} />
            <span>History</span>
          </Link>

          {/* Tab 3: Outreach */}
          <button
            type="button"
            onClick={handleCampaignNav}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              isCampaignActive
                ? 'bg-matte-800 text-white border border-matte-700 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-matte-800/50'
            }`}
            title="AI Email Cold Outreach"
          >
            <Mail className={`w-3.5 h-3.5 ${isCampaignActive ? 'text-firebase-400' : 'text-gray-400'}`} />
            <span>Outreach</span>
          </button>

          {/* Tab 4: Keys */}
          <button
            type="button"
            onClick={() => setShowKeysModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-gray-400 hover:text-white hover:bg-matte-800/50 transition-all"
            title="Gemini Key Rotator & Diagnostics"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Keys</span>
            {keyPoolStatus && (
              <span className="text-[10px] font-mono font-bold px-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {keyPoolStatus.active_keys}
              </span>
            )}
          </button>

        </nav>

        {/* RIGHT: CONTROLS & MOBILE TOGGLE */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          
          {/* Key Pool Status Pill */}
          <button
            type="button"
            onClick={() => setShowKeysModal(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-matte-800 hover:bg-matte-750 border border-matte-700/80 text-[11px] text-gray-300 hover:text-white transition-colors"
            title="Manage Gemini Key Pool"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px]">
              {keyPoolStatus ? `${keyPoolStatus.active_keys} Keys` : 'Keys'}
            </span>
          </button>

          {/* New Extraction CTA */}
          <Link
            href="/"
            className="firebase-btn-primary px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-semibold flex items-center gap-1 shadow-sm"
            title="New Extraction Scan"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New</span>
          </Link>

          {/* Mobile & Tablet Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg bg-matte-800 border border-matte-700 text-gray-300 hover:text-white touch-target flex items-center justify-center transition-colors"
            title="Toggle Navigation Menu"
            aria-label="Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

        </div>

      </header>

      {/* ------------------------------------------------------------- */}
      {/* MOBILE / TABLET SLIDE-DOWN DRAWER WITH BACKDROP               */}
      {/* ------------------------------------------------------------- */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[52px] sm:top-[56px] z-40 lg:hidden">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu Drawer Content */}
          <div className="relative bg-matte-850 border-b border-matte-700/80 p-3 sm:p-4 space-y-1.5 shadow-2xl animate-in slide-in-from-top-2 duration-150">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 pb-1 font-mono">
              Quick Navigation
            </div>

            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isExtractionActive 
                  ? 'bg-firebase-600/20 text-white border border-firebase-500/50 shadow-sm' 
                  : 'text-gray-300 hover:bg-matte-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-firebase-400" />
                <span>Extraction Studio</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </Link>

            <Link
              href="/jobs"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isHistoryActive 
                  ? 'bg-firebase-600/20 text-white border border-firebase-500/50 shadow-sm' 
                  : 'text-gray-300 hover:bg-matte-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <History className="w-4 h-4 text-firebase-400" />
                <span>Scrape Jobs History</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </Link>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleCampaignNav();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                isCampaignActive 
                  ? 'bg-firebase-600/20 text-white border border-firebase-500/50 shadow-sm' 
                  : 'text-gray-300 hover:bg-matte-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-firebase-400" />
                <span>AI Outreach Dispatcher</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-firebase-600/30 text-firebase-300 border border-firebase-500/30">
                Outreach
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setShowKeysModal(true);
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left text-gray-300 hover:bg-matte-800 hover:text-white transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Gemini API Key Rotator</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {keyPoolStatus ? `${keyPoolStatus.active_keys} Active Keys` : 'Keys'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* BREADCRUMB STRIP (Touch-scrolling for deep routes)             */}
      {/* ------------------------------------------------------------- */}
      {breadcrumbs.length > 0 && (
        <div className="bg-matte-900 border-b border-matte-700/60 px-3 sm:px-5 py-2 flex items-center gap-1.5 text-xs overflow-x-auto whitespace-nowrap smooth-scroll">
          <Link href="/" className="text-gray-400 hover:text-white font-medium transition-colors flex-shrink-0">
            Console
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <div key={idx} className="flex items-center gap-1.5 flex-shrink-0">
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
              {idx === breadcrumbs.length - 1 ? (
                <span className="font-semibold text-white truncate max-w-[160px] sm:max-w-md">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="text-gray-400 hover:text-white font-medium transition-colors">
                  {crumb.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MAIN VIEWPORT BODY (Space-Efficient & Responsive)             */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 p-2.5 sm:p-4 md:p-6 max-w-6xl w-full mx-auto min-w-0">
        {children}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* COMPACT MINIMAL FOOTER                                        */}
      {/* ------------------------------------------------------------- */}
      <footer className="border-t border-matte-700/80 py-2 px-4 bg-matte-950 text-[11px] text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-1">
        <div className="flex items-center gap-2">
          <span>&copy; {new Date().getFullYear()} Console</span>
          <span>•</span>
          <span>Multi-Site Deduplication</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span className="text-emerald-400">✓ 100% Deliverable</span>
          <span>•</span>
          <span className="text-firebase-400">Gemini Rotator Active</span>
        </div>
      </footer>

      {/* Global Key Manager Modal */}
      <GeminiKeyManagerModal
        isOpen={showKeysModal}
        onClose={() => setShowKeysModal(false)}
        onKeysChanged={() => {
          getGeminiKeysStatus().then(setKeyPoolStatus).catch(() => {});
        }}
      />

    </div>
  );
}
