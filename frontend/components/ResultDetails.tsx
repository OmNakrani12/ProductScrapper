import { useState, useEffect } from 'react';
import { 
  X, ExternalLink, Mail, Building2, Layers, Clock, AlertTriangle, 
  Check, Copy, UserCheck, Briefcase, Share2, Sparkles, RefreshCw, Send, Globe, Key 
} from 'lucide-react';
import { WebsiteResult } from '@/types';
import StatusBadge from './StatusBadge';
import { formatDuration } from '@/lib/utils';
import AIEmailBox from './AIEmailBox';

interface ResultDetailsProps {
  result: WebsiteResult | null;
  jobId?: string;
  onClose: () => void;
  onUpdated?: (updated: WebsiteResult) => void;
}

export default function ResultDetails({ result, jobId, onClose, onUpdated }: ResultDetailsProps) {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  if (!result) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(text);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const personalEmails = result.personal_emails || [];
  const businessEmails = result.business_emails || result.emails?.filter(e => !personalEmails.includes(e)) || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      <div className="relative z-10 w-full sm:max-w-lg bg-matte-900 border-l border-matte-700/80 h-full overflow-y-auto p-4 sm:p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        <div className="space-y-5 sm:space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between pb-3.5 sm:pb-4 border-b border-matte-700/80 gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <StatusBadge status={result.status} />
                <span className="text-xs text-gray-500 font-mono">ID: {result.id.slice(0, 8)}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight font-display truncate">
                {result.company_name || 'Website Detail'}
              </h2>
              <a
                href={result.website_url.startsWith('http') ? result.website_url : `https://${result.website_url}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-firebase-400 hover:underline font-mono mt-1 truncate max-w-full"
              >
                <span className="truncate">{result.website_url}</span>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
              </a>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-matte-800 transition-colors touch-target flex items-center justify-center flex-shrink-0"
              aria-label="Close Details Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-matte-850 border border-matte-700/80 text-xs">
            <div>
              <span className="text-gray-400 block mb-0.5">Pages Scanned</span>
              <div className="flex items-center gap-1.5 font-semibold text-gray-200">
                <Layers className="w-3.5 h-3.5 text-firebase-400" />
                <span>{result.pages_scanned} pages</span>
              </div>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Duration</span>
              <div className="flex items-center gap-1.5 font-semibold text-gray-200">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{formatDuration(result.duration_seconds)}</span>
              </div>
            </div>
          </div>

          {/* Error Banner if any */}
          {result.error_message && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-rose-400">
                <AlertTriangle className="w-4 h-4" />
                <span>Processing Issue</span>
              </div>
              <p className="font-mono text-[11px] leading-relaxed opacity-90">{result.error_message}</p>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* FEATURE: UNIFIED DEDICATED AI RESPONSE EMAIL BOX              */}
          {/* ------------------------------------------------------------- */}
          <div className="space-y-1.5">
            <AIEmailBox
              result={result}
              jobId={jobId}
              onUpdated={onUpdated}
            />
          </div>

          {/* Personal Emails Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-purple-400" />
              <span>Personal Email Addresses ({personalEmails.length})</span>
            </h3>
            {personalEmails.length > 0 ? (
              <div className="space-y-2">
                {personalEmails.map((email, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-matte-850 border border-purple-500/30 group hover:border-purple-400/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 font-mono text-xs text-purple-200 font-medium truncate max-w-[340px]">
                      <Mail className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                      <span className="truncate">{email}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(email)}
                      className="p-1 rounded text-purple-400 hover:text-white transition-colors"
                      title="Copy email"
                    >
                      {copiedItem === email ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center rounded-lg bg-matte-850/50 border border-matte-800 text-xs text-gray-500">
                No personal executive emails found.
              </div>
            )}
          </div>

          {/* Business Emails Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Mail className="w-4 h-4 text-firebase-400" />
              <span>Business & General Emails ({businessEmails.length})</span>
            </h3>
            {businessEmails.length > 0 ? (
              <div className="space-y-2">
                {businessEmails.map((email, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-matte-850 border border-matte-700/80 group hover:border-firebase-500/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 font-mono text-xs text-gray-200 truncate max-w-[340px]">
                      <Mail className="w-3.5 h-3.5 text-firebase-400 flex-shrink-0" />
                      <span className="truncate">{email}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(email)}
                      className="p-1 rounded text-gray-400 hover:text-white transition-colors"
                      title="Copy email"
                    >
                      {copiedItem === email ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center rounded-lg bg-matte-850/50 border border-matte-800 text-xs text-gray-500">
                No general business emails found.
              </div>
            )}
          </div>

          {/* Social Profiles */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Share2 className="w-4 h-4 text-firebase-400" />
              <span>Social Media Profiles</span>
            </h3>
            {result.social_links && Object.keys(result.social_links).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(result.social_links).map(([platform, urls]) => {
                  if (!urls || urls.length === 0) return null;
                  return (
                    <div key={platform} className="p-2.5 rounded-lg bg-matte-850 border border-matte-700/80 space-y-1.5">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        {platform}
                      </span>
                      <div className="space-y-1">
                        {urls.map((url, i) => (
                          <div key={i} className="flex items-center justify-between text-xs font-mono">
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-firebase-400 hover:underline truncate max-w-[320px]"
                            >
                              {url}
                            </a>
                            <button
                              onClick={() => copyToClipboard(url)}
                              className="p-1 rounded text-gray-400 hover:text-white transition-colors"
                              title={`Copy ${platform} profile URL`}
                            >
                              {copiedItem === url ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 text-center rounded-lg bg-matte-850/50 border border-matte-800 text-xs text-gray-500">
                No social media profiles detected for this website.
              </div>
            )}
          </div>

          {/* Internal Links */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-firebase-400" />
              <span>Discovered Internal Pages</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-lg bg-matte-850 border border-matte-700/80">
                <span className="text-gray-400 block mb-1">Contact Page:</span>
                {result.contact_page ? (
                  <a
                    href={result.contact_page}
                    target="_blank"
                    rel="noreferrer"
                    className="text-firebase-400 hover:underline font-mono break-all inline-flex items-center gap-1"
                  >
                    <span>{result.contact_page}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ) : (
                  <span className="text-gray-500 italic">Not found</span>
                )}
              </div>

              <div className="p-3 rounded-lg bg-matte-850 border border-matte-700/80">
                <span className="text-gray-400 block mb-1">About Page:</span>
                {result.about_page ? (
                  <a
                    href={result.about_page}
                    target="_blank"
                    rel="noreferrer"
                    className="text-firebase-400 hover:underline font-mono break-all inline-flex items-center gap-1"
                  >
                    <span>{result.about_page}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ) : (
                  <span className="text-gray-500 italic">Not found</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-matte-700/80">
          <button
            onClick={onClose}
            className="w-full firebase-btn-secondary py-2.5 px-4 text-gray-200 text-sm font-medium"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
