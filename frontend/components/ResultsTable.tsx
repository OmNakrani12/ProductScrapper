import { useState, Fragment } from 'react';
import { Search, ExternalLink, Mail, ChevronRight, UserCheck, Info, Share2, CheckCircle2, Filter, Star, Copy, Check, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { WebsiteResult } from '@/types';
import StatusBadge from './StatusBadge';
import Pagination from './Pagination';
import AIEmailBox from './AIEmailBox';

interface ResultsTableProps {
  results: WebsiteResult[];
  totalResults: number;
  currentPage: number;
  pageSize: number;
  searchQuery: string;
  statusFilter: string;
  jobId?: string;
  hasPersonalEmail?: boolean;
  hasBusinessEmail?: boolean;
  hasPrimaryEmail?: boolean;
  hasContactInfo?: boolean;
  hasSocialLinks?: boolean;
  onlySuccess?: boolean;
  onPageChange: (page: number) => void;
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (status: string) => void;
  onCheckboxFilterChange?: (filterKey: string, checked: boolean) => void;
  onClearAllFilters?: () => void;
  onSelectRow: (result: WebsiteResult) => void;
  onResultUpdated?: (updated: WebsiteResult) => void;
}

export default function ResultsTable({
  results,
  totalResults,
  currentPage,
  pageSize,
  searchQuery,
  statusFilter,
  jobId,
  hasPersonalEmail = false,
  hasBusinessEmail = false,
  hasPrimaryEmail = false,
  hasContactInfo = false,
  hasSocialLinks = false,
  onlySuccess = false,
  onPageChange,
  onSearchChange,
  onStatusFilterChange,
  onCheckboxFilterChange,
  onClearAllFilters,
  onSelectRow,
  onResultUpdated,
}: ResultsTableProps) {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [expandedAiRowId, setExpandedAiRowId] = useState<string | null>(null);

  const handleCopyEmail = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const filterTabs = [
    { id: 'all', label: 'All Results' },
    { id: 'success', label: 'Success' },
    { id: 'no_contact_found', label: 'No Contact' },
    { id: 'failed', label: 'Failed' },
  ];

  const hasActiveFilters = hasPersonalEmail || hasBusinessEmail || hasPrimaryEmail || hasContactInfo || hasSocialLinks || onlySuccess;

  return (
    <div className="bg-matte-850 rounded-2xl shadow-xl overflow-hidden border border-matte-700/80 space-y-0">
      {/* Search & Checkbox Filters Bar */}
      <div className="p-4 sm:p-5 border-b border-matte-700/80 space-y-4 bg-matte-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-firebase-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by personal email, domain, company..."
              className="w-full pl-10 pr-4 py-2 firebase-input text-xs text-white placeholder-gray-500 rounded-xl transition-all font-sans"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-matte-950 p-1 rounded-xl border border-matte-700 self-start md:self-auto overflow-x-auto w-full md:w-auto smooth-scroll whitespace-nowrap">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onStatusFilterChange(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all touch-target sm:min-h-0 flex items-center justify-center ${
                  statusFilter === tab.id
                    ? 'bg-firebase-600 text-white font-bold shadow-sm shadow-firebase-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-matte-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Checkbox Filter Toggles */}
        {onCheckboxFilterChange && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-matte-800 text-xs">
            <span className="text-gray-400 font-semibold flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-firebase-400" /> Filter:
            </span>

            <button
              onClick={() => onCheckboxFilterChange('hasPrimaryEmail', !hasPrimaryEmail)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 touch-target sm:min-h-0 ${
                hasPrimaryEmail
                  ? 'bg-firebase-500/20 border-firebase-500/50 text-firebase-300 font-bold shadow-sm'
                  : 'bg-matte-950 border-matte-700 text-gray-400 hover:text-white hover:bg-matte-800'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${hasPrimaryEmail ? 'fill-firebase-400 text-firebase-400' : ''}`} />
              <span>Primary Email</span>
            </button>

            <button
              onClick={() => onCheckboxFilterChange('hasPersonalEmail', !hasPersonalEmail)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 touch-target sm:min-h-0 ${
                hasPersonalEmail
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 font-bold shadow-sm'
                  : 'bg-matte-950 border-matte-700 text-gray-400 hover:text-white hover:bg-matte-800'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Personal Email</span>
            </button>

            <button
              onClick={() => onCheckboxFilterChange('hasBusinessEmail', !hasBusinessEmail)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 touch-target sm:min-h-0 ${
                hasBusinessEmail
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 font-bold shadow-sm'
                  : 'bg-matte-950 border-matte-700 text-gray-400 hover:text-white hover:bg-matte-800'
              }`}
            >
              <Mail className="w-3.5 h-3.5 text-indigo-400" />
              <span>Business Alias</span>
            </button>

            {hasActiveFilters && onClearAllFilters && (
              <button
                onClick={onClearAllFilters}
                className="px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 font-medium underline underline-offset-2 ml-auto"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* MOBILE / TABLET CARD VIEW (Visible < md) */}
      <div className="md:hidden divide-y divide-matte-800">
        {results.length === 0 ? (
          <div className="py-12 px-4 text-center text-gray-400 space-y-2">
            <Info className="w-8 h-8 text-gray-500 mx-auto" />
            <p className="text-sm font-semibold text-gray-300">No matching leads found</p>
            <p className="text-xs text-gray-500">Try adjusting your search query or filter pills.</p>
          </div>
        ) : (
          results.map((row) => {
            const primaryMail = row.primary_email;
            const personalMails = row.personal_emails || [];
            const isAiBoxExpanded = expandedAiRowId === row.id;

            return (
              <div 
                key={`mobile-${row.id}`}
                className={`p-3.5 space-y-3 transition-colors ${
                  isAiBoxExpanded ? 'bg-matte-900 border-l-4 border-l-firebase-500' : 'hover:bg-matte-800/40'
                }`}
              >
                {/* Header: Domain, Company, Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-white text-sm font-display truncate max-w-[200px]">
                        {row.website_url.replace(/^https?:\/\//i, '').split('/')[0] || row.website_url}
                      </span>
                      <a
                        href={row.website_url.startsWith('http') ? row.website_url : `https://${row.website_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-500 hover:text-firebase-400 transition-colors p-0.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    {row.company_name && (
                      <p className="text-[11px] text-gray-400 truncate">{row.company_name}</p>
                    )}
                  </div>
                  <StatusBadge status={row.status} size="sm" />
                </div>

                {/* Primary Email */}
                {primaryMail ? (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-matte-950 border border-firebase-500/30">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 flex-shrink-0" />
                      <span className="font-mono text-xs font-semibold text-firebase-200 truncate">
                        {primaryMail}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleCopyEmail(primaryMail, e)}
                      className="p-1.5 rounded-lg bg-matte-800 hover:bg-matte-700 text-firebase-400 hover:text-white transition-colors flex-shrink-0 touch-target flex items-center justify-center"
                      title="Copy email"
                    >
                      {copiedEmail === primaryMail ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 italic font-mono">
                    No primary email found
                  </div>
                )}

                {/* Personal Emails tag if present */}
                {personalMails.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-purple-300">
                    <UserCheck className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                    <span className="truncate">{personalMails[0]}</span>
                    {personalMails.length > 1 && (
                      <span className="text-[10px] text-gray-500">+{personalMails.length - 1}</span>
                    )}
                  </div>
                )}

                {/* Mobile Actions: AI Box Toggle & View Details */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedAiRowId(isAiBoxExpanded ? null : row.id);
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all touch-target shadow-sm ${
                      row.ai_email_body
                        ? 'bg-firebase-500/15 border-firebase-500/30 text-firebase-300 hover:bg-firebase-500/25'
                        : 'bg-matte-800 border-matte-700 text-gray-300 hover:text-white hover:bg-matte-750'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-firebase-400" />
                    <span>{row.ai_email_body ? (isAiBoxExpanded ? 'Close AI Draft' : 'View AI Pitch') : 'AI Pitch'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectRow(row)}
                    className="py-2 px-3.5 rounded-lg bg-matte-700/60 hover:bg-matte-700 text-gray-200 hover:text-white border border-matte-650 text-xs font-semibold flex items-center justify-center gap-1 touch-target shadow-sm"
                  >
                    <span>Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Expandable AI Box on Mobile */}
                {isAiBoxExpanded && (
                  <div className="pt-2 animate-in fade-in">
                    <AIEmailBox
                      result={row}
                      jobId={jobId}
                      onClose={() => setExpandedAiRowId(null)}
                      onUpdated={(updated) => {
                        if (onResultUpdated) onResultUpdated(updated);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP TABLE DATA (Visible md+) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-matte-700/80 bg-matte-900/90 text-[11px] font-bold text-gray-400 uppercase tracking-wider font-display">
              <th className="py-3.5 px-4">Domain / Website</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Primary Outreach Email</th>
              <th className="py-3.5 px-4 hidden md:table-cell">Executive / Personal Email</th>
              <th className="py-3.5 px-4 hidden lg:table-cell">Social Links</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-matte-800 text-xs text-gray-300 font-sans">
            {results.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-400 space-y-2">
                  <Info className="w-8 h-8 text-gray-500 mx-auto" />
                  <p className="text-sm font-semibold text-gray-300">No matching website contact results found</p>
                  <p className="text-xs text-gray-500">Try adjusting your search query or quick filter pills.</p>
                </td>
              </tr>
            ) : (
              results.map((row) => {
                const primaryMail = row.primary_email;
                const personalMails = row.personal_emails || [];
                const businessMails = row.business_emails || [];
                const isAiBoxExpanded = expandedAiRowId === row.id;

                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => onSelectRow(row)}
                      className={`hover:bg-matte-800/60 transition-colors cursor-pointer group ${
                        isAiBoxExpanded ? 'bg-matte-900 border-l-2 border-l-firebase-500' : ''
                      }`}
                    >
                      {/* Domain & Company Name */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm font-display group-hover:text-firebase-400 transition-colors">
                              {row.website_url.replace(/^https?:\/\//i, '').split('/')[0] || row.website_url}
                            </span>
                            <a
                              href={row.website_url.startsWith('http') ? row.website_url : `https://${row.website_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-gray-500 hover:text-firebase-400 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                          {row.company_name && (
                            <p className="text-[11px] text-gray-400 line-clamp-1 max-w-xs">{row.company_name}</p>
                          )}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={row.status} />
                      </td>

                      {/* Primary Email & AI Box Trigger */}
                      <td className="py-3.5 px-4">
                        {primaryMail ? (
                          <div className="space-y-1.5">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-matte-950 border border-firebase-500/30 text-firebase-200 text-xs font-mono font-medium shadow-sm group/btn">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 flex-shrink-0" />
                              <span className="font-bold">{primaryMail}</span>
                              <button
                                onClick={(e) => handleCopyEmail(primaryMail, e)}
                                className="ml-1 text-firebase-400 hover:text-white transition-colors"
                                title="Copy email to clipboard"
                              >
                                {copiedEmail === primaryMail ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>

                            {/* View AI Response inside box trigger */}
                            {row.ai_email_body ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedAiRowId(isAiBoxExpanded ? null : row.id);
                                }}
                                className="flex items-center gap-1.5 text-[10px] text-firebase-300 font-medium hover:text-white transition-colors group/ai"
                                title="Click to view AI Response Email inside box"
                              >
                                <span className="p-0.5 rounded bg-firebase-500/20 text-firebase-400">
                                  <Sparkles className="w-3 h-3 text-firebase-400" />
                                </span>
                                <span className="font-semibold underline underline-offset-2">View in AI Box</span>
                                <span className="text-gray-400 truncate max-w-[120px]">
                                  • {row.ai_email_subject || 'Ready'}
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedAiRowId(isAiBoxExpanded ? null : row.id);
                                }}
                                className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-firebase-400 transition-colors"
                                title="Open AI Response Email Box"
                              >
                                <Sparkles className="w-3 h-3 text-firebase-400/70" />
                                <span>Generate AI Box</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs font-mono">—</span>
                        )}
                      </td>

                      {/* Personal Mails */}
                      <td className="py-3.5 px-4 hidden md:table-cell">
                        <div className="space-y-1">
                          {personalMails.length > 0 ? (
                            <div className="flex items-center gap-1.5 text-xs text-purple-300 font-mono">
                              <UserCheck className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                              <span className="truncate max-w-[180px]">{personalMails[0]}</span>
                              {personalMails.length > 1 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                                  +{personalMails.length - 1}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-xs font-mono">—</span>
                          )}
                        </div>
                      </td>

                      {/* Social Links */}
                      <td className="py-3.5 px-4 hidden lg:table-cell">
                        {row.social_links && Object.keys(row.social_links).length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            {Object.keys(row.social_links).map((platform) => (
                              <span
                                key={platform}
                                className="px-2 py-0.5 rounded bg-matte-950 border border-matte-700 text-[10px] text-gray-300 capitalize font-medium"
                              >
                                {platform}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>

                      {/* Actions: AI Box Toggle + Drawer chevron */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedAiRowId(isAiBoxExpanded ? null : row.id);
                            }}
                            className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                              isAiBoxExpanded
                                ? 'bg-firebase-600 text-white border-firebase-500 shadow-sm shadow-firebase-600/30'
                                : row.ai_email_body
                                ? 'bg-firebase-950/60 border-firebase-500/40 text-firebase-300 hover:text-white hover:border-firebase-400'
                                : 'bg-matte-950 border-matte-700 text-gray-400 hover:text-firebase-300 hover:bg-matte-800'
                            }`}
                            title="Open AI Response Email Box"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">AI Box</span>
                            {isAiBoxExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          <button 
                            type="button"
                            className="p-2 rounded-xl bg-matte-950 group-hover:bg-firebase-600/20 text-gray-400 group-hover:text-firebase-300 transition-all border border-transparent group-hover:border-firebase-500/30"
                            title="View all website details"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* EXPANDABLE AI RESPONSE EMAIL BOX */}
                    {isAiBoxExpanded && (
                      <tr key={`${row.id}-expanded-box`} className="bg-matte-950/95 border-b border-firebase-500/30">
                        <td colSpan={6} className="p-3 sm:p-5">
                          <AIEmailBox
                            result={row}
                            jobId={jobId}
                            onClose={() => setExpandedAiRowId(null)}
                            onUpdated={(updated) => {
                              if (onResultUpdated) onResultUpdated(updated);
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-matte-700/80 bg-matte-900">
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalResults / pageSize) || 1}
          totalItems={totalResults}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
