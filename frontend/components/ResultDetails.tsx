import { useState } from 'react';
import { X, ExternalLink, Mail, Phone, Building2, Layers, Clock, AlertTriangle, Check, Copy, UserCheck, Smartphone, Briefcase, Share2 } from 'lucide-react';
import { WebsiteResult } from '@/types';
import StatusBadge from './StatusBadge';
import { formatDuration } from '@/lib/utils';

interface ResultDetailsProps {
  result: WebsiteResult | null;
  onClose: () => void;
}

export default function ResultDetails({ result, onClose }: ResultDetailsProps) {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  if (!result) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(text);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const personalEmails = result.personal_emails || [];
  const businessEmails = result.business_emails || result.emails?.filter(e => !personalEmails.includes(e)) || [];
  const personalPhones = result.personal_phones || [];
  const businessPhones = result.business_phones || result.phone_numbers?.filter(p => !personalPhones.includes(p)) || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-lg bg-surface border-l border-border h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={result.status} />
                <span className="text-xs text-gray-500 font-mono">ID: {result.id.slice(0, 8)}</span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {result.company_name || 'Website Detail'}
              </h2>
              <a
                href={result.website_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline font-mono mt-1"
              >
                <span>{result.website_url}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-card transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-card border border-border text-xs">
            <div>
              <span className="text-gray-400 block mb-0.5">Pages Scanned</span>
              <div className="flex items-center gap-1.5 font-semibold text-gray-200">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
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
                    className="flex items-center justify-between p-2.5 rounded-lg bg-purple-950/20 border border-purple-500/30 group hover:border-purple-400/50 transition-colors"
                  >
                    <span className="font-mono text-sm text-purple-200 select-all">{email}</span>
                    <button
                      onClick={() => copyToClipboard(email)}
                      className="p-1 rounded text-purple-400 hover:text-white transition-colors"
                      title="Copy personal email"
                    >
                      {copiedItem === email ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center rounded-lg bg-card/40 border border-border text-xs text-gray-500">
                No personal/named email addresses detected.
              </div>
            )}
          </div>

          {/* Personal Phone Numbers Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Personal Mobile & Direct Phone Numbers ({personalPhones.length})</span>
            </h3>
            {personalPhones.length > 0 ? (
              <div className="space-y-2">
                {personalPhones.map((phone, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 group hover:border-emerald-400/50 transition-colors"
                  >
                    <span className="font-mono text-sm text-emerald-200 select-all">{phone}</span>
                    <button
                      onClick={() => copyToClipboard(phone)}
                      className="p-1 rounded text-emerald-400 hover:text-white transition-colors"
                      title="Copy personal phone"
                    >
                      {copiedItem === phone ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center rounded-lg bg-card/40 border border-border text-xs text-gray-500">
                No personal mobile or direct phone numbers detected.
              </div>
            )}
          </div>

          {/* General Business Contacts */}
          <div className="space-y-2 pt-2 border-t border-border">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-gray-400" />
              <span>General Business Contacts</span>
            </h3>
            
            <div className="space-y-2">
              {businessEmails.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[11px] text-gray-400 font-medium">Business Email Aliases:</span>
                  {businessEmails.map((email, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border text-xs font-mono text-gray-300">
                      <span>{email}</span>
                      <button onClick={() => copyToClipboard(email)} className="text-gray-400 hover:text-white">
                        {copiedItem === email ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {businessPhones.length > 0 && (
                <div className="space-y-1 mt-2">
                  <span className="text-[11px] text-gray-400 font-medium">Switchboards & Toll-Free:</span>
                  {businessPhones.map((phone, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border text-xs font-mono text-gray-300">
                      <span>{phone}</span>
                      <button onClick={() => copyToClipboard(phone)} className="text-gray-400 hover:text-white">
                        {copiedItem === phone ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {businessEmails.length === 0 && businessPhones.length === 0 && (
                <div className="p-3 text-center rounded-lg bg-card/20 border border-border text-xs text-gray-500">
                  No generic business contact channels found.
                </div>
              )}
            </div>
          </div>

          {/* Social Media Profiles Section */}
          <div className="space-y-2 pt-2 border-t border-border">
            <h3 className="text-xs font-semibold text-sky-300 uppercase tracking-wider flex items-center gap-2">
              <Share2 className="w-4 h-4 text-sky-400" />
              <span>Social Media Profiles</span>
            </h3>

            {result.social_links && Object.keys(result.social_links).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(result.social_links).map(([platform, urls]) => {
                  if (!urls || urls.length === 0) return null;
                  return (
                    <div key={platform} className="p-3 rounded-xl bg-card border border-border space-y-1.5">
                      <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-accent inline-block"></span>
                        {platform} ({urls.length})
                      </span>
                      <div className="space-y-1">
                        {urls.map((url, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-surface/60 border border-border/80 text-xs">
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-accent hover:underline truncate max-w-[260px] flex items-center gap-1"
                            >
                              <span className="truncate">{url}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
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
              <div className="p-3 text-center rounded-lg bg-card/20 border border-border text-xs text-gray-500">
                No social media profiles detected for this website.
              </div>
            )}
          </div>

          {/* Internal Links */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-400" />
              <span>Discovered Internal Pages</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-lg bg-card border border-border">
                <span className="text-gray-400 block mb-1">Contact Page:</span>
                {result.contact_page ? (
                  <a
                    href={result.contact_page}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline font-mono break-all inline-flex items-center gap-1"
                  >
                    <span>{result.contact_page}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ) : (
                  <span className="text-gray-500 italic">Not found</span>
                )}
              </div>

              <div className="p-3 rounded-lg bg-card border border-border">
                <span className="text-gray-400 block mb-1">About Page:</span>
                {result.about_page ? (
                  <a
                    href={result.about_page}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:underline font-mono break-all inline-flex items-center gap-1"
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

        <div className="pt-6 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-card border border-border hover:border-gray-600 text-gray-200 text-sm font-medium rounded-xl transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
