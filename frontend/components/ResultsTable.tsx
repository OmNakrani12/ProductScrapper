import { useState } from 'react';
import { Search, ExternalLink, Mail, Phone, ChevronRight, UserCheck, Smartphone, Info, Share2, CheckCircle2, Filter, Star, Copy, Check } from 'lucide-react';
import { WebsiteResult } from '@/types';
import StatusBadge from './StatusBadge';
import Pagination from './Pagination';

interface ResultsTableProps {
  results: WebsiteResult[];
  totalResults: number;
  currentPage: number;
  pageSize: number;
  searchQuery: string;
  statusFilter: string;
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
}

export default function ResultsTable({
  results,
  totalResults,
  currentPage,
  pageSize,
  searchQuery,
  statusFilter,
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
}: ResultsTableProps) {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

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
    <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden space-y-0">
      {/* Search & Checkbox Filters Bar */}
      <div className="p-4 border-b border-border space-y-3 bg-surface/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by personal email, mobile phone, website, company..."
              className="w-full pl-9 pr-4 py-2 bg-card border border-border focus:border-accent focus:outline-none text-xs text-white placeholder-gray-500 rounded-xl transition-all shadow-inner"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border self-start md:self-auto overflow-x-auto">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onStatusFilterChange(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                  statusFilter === tab.id
                    ? 'bg-accent text-white shadow-md font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-card'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Checkbox Filter Bar */}
        <div className="pt-3 border-t border-border/50 flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-gray-400 font-semibold uppercase tracking-wider text-[11px] mr-1">
            <Filter className="w-3.5 h-3.5 text-accent" />
            <span>Data Filters:</span>
          </div>

          {/* 0. Primary Outreach Email Found */}
          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer select-none transition-all ${
            hasPrimaryEmail ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 font-semibold shadow-sm ring-1 ring-amber-400/30' : 'bg-surface border-border text-gray-300 hover:border-gray-500'
          }`}>
            <input
              type="checkbox"
              checked={hasPrimaryEmail}
              onChange={(e) => onCheckboxFilterChange && onCheckboxFilterChange('primary_email', e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-amber-400 cursor-pointer"
            />
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30" />
            <span>Primary Email Found</span>
          </label>

          {/* 1. Personal Email Found */}
          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer select-none transition-all ${
            hasPersonalEmail ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-semibold' : 'bg-surface border-border text-gray-300 hover:border-gray-500'
          }`}>
            <input
              type="checkbox"
              checked={hasPersonalEmail}
              onChange={(e) => onCheckboxFilterChange && onCheckboxFilterChange('personal_email', e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
            />
            <Mail className="w-3.5 h-3.5 text-amber-400" />
            <span>Personal Email Found</span>
          </label>

          {/* 2. Business Email Found */}
          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer select-none transition-all ${
            hasBusinessEmail ? 'bg-blue-500/15 border-blue-500/50 text-blue-300 font-semibold' : 'bg-surface border-border text-gray-300 hover:border-gray-500'
          }`}>
            <input
              type="checkbox"
              checked={hasBusinessEmail}
              onChange={(e) => onCheckboxFilterChange && onCheckboxFilterChange('business_email', e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-blue-500 cursor-pointer"
            />
            <Mail className="w-3.5 h-3.5 text-blue-400" />
            <span>Business Email Found</span>
          </label>

          {/* 3. Phone / Contact Page Found */}
          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer select-none transition-all ${
            hasContactInfo ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300 font-semibold' : 'bg-surface border-border text-gray-300 hover:border-gray-500'
          }`}>
            <input
              type="checkbox"
              checked={hasContactInfo}
              onChange={(e) => onCheckboxFilterChange && onCheckboxFilterChange('contact_info', e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-cyan-500 cursor-pointer"
            />
            <Phone className="w-3.5 h-3.5 text-cyan-400" />
            <span>Phone / Contact Page Found</span>
          </label>

          {/* 4. Social Media Links Found */}
          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer select-none transition-all ${
            hasSocialLinks ? 'bg-purple-500/15 border-purple-500/50 text-purple-300 font-semibold' : 'bg-surface border-border text-gray-300 hover:border-gray-500'
          }`}>
            <input
              type="checkbox"
              checked={hasSocialLinks}
              onChange={(e) => onCheckboxFilterChange && onCheckboxFilterChange('social_links', e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-purple-500 cursor-pointer"
            />
            <Share2 className="w-3.5 h-3.5 text-purple-400" />
            <span>Social Media Links Found</span>
          </label>

          {/* 5. Status Success */}
          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer select-none transition-all ${
            onlySuccess ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 font-semibold' : 'bg-surface border-border text-gray-300 hover:border-gray-500'
          }`}>
            <input
              type="checkbox"
              checked={onlySuccess}
              onChange={(e) => onCheckboxFilterChange && onCheckboxFilterChange('status_success', e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
            />
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Status: Success</span>
          </label>

          {/* Clear Filters Button */}
          {hasActiveFilters && onClearAllFilters && (
            <button
              onClick={onClearAllFilters}
              className="px-2.5 py-1 text-[11px] text-gray-400 hover:text-white underline transition-colors ml-auto"
            >
              Clear All Checkboxes
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface/70 text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
              <th className="py-3 px-4">Company & Website</th>
              <th className="py-3 px-4 text-amber-400 flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400/30" />
                <span>Primary Email (Best Outreach)</span>
              </th>
              <th className="py-3 px-4">Personal Emails</th>
              <th className="py-3 px-4">Business Emails</th>
              <th className="py-3 px-4">Contact Phones & Pages</th>
              <th className="py-3 px-4">Social Media Links</th>
              <th className="py-3 px-4 text-center">Pages</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 text-xs">
            {results.length > 0 ? (
              results.map((r) => {
                const personalEmails = r.personal_emails || [];
                const businessEmails = r.business_emails || r.emails?.filter(e => !personalEmails.includes(e)) || [];
                const personalPhones = r.personal_phones || [];
                const businessPhones = r.business_phones || r.phone_numbers?.filter(p => !personalPhones.includes(p)) || [];
                
                const primaryEmail = r.primary_email || personalEmails[0] || businessEmails[0] || r.emails?.[0] || null;

                return (
                  <tr
                    key={r.id}
                    onClick={() => onSelectRow(r)}
                    className="hover:bg-card-hover/80 transition-colors cursor-pointer group"
                  >
                    {/* Company & Website */}
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-semibold text-white group-hover:text-accent transition-colors flex items-center gap-1.5">
                          <span>{r.company_name || 'Website'}</span>
                        </div>
                        <a
                          href={r.website_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] text-gray-400 hover:text-accent font-mono truncate max-w-xs block mt-0.5"
                        >
                          {r.website_url}
                        </a>
                      </div>
                    </td>

                    {/* Primary Email (Best Outreach) */}
                    <td className="py-3.5 px-4">
                      {primaryEmail ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 font-mono text-amber-200 bg-amber-950/60 border border-amber-500/50 px-2.5 py-1 rounded-lg w-fit shadow-sm">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20 flex-shrink-0" />
                            <span className="font-semibold">{primaryEmail}</span>
                          </div>
                          <button
                            onClick={(e) => handleCopyEmail(primaryEmail, e)}
                            title="Copy primary email for cold outreach"
                            className="p-1 hover:bg-surface border border-border/60 rounded-md text-gray-400 hover:text-amber-300 transition-colors"
                          >
                            {copiedEmail === primaryEmail ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic text-[11px]">No email found</span>
                      )}
                    </td>

                    {/* Personal Emails */}
                    <td className="py-3.5 px-4">
                      {personalEmails.length > 0 ? (
                        <div className="space-y-1">
                          {personalEmails.slice(0, 2).map((email, i) => (
                            <div key={i} className="flex items-center gap-1.5 font-mono text-purple-200 bg-purple-950/40 border border-purple-500/30 px-2 py-0.5 rounded-md w-fit">
                              <UserCheck className="w-3 h-3 text-purple-400 flex-shrink-0" />
                              <span className="truncate max-w-[180px]">{email}</span>
                            </div>
                          ))}
                          {personalEmails.length > 2 && (
                            <span className="text-[10px] text-purple-400 font-medium">
                              +{personalEmails.length - 2} more personal
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 italic text-[11px]">None detected</span>
                      )}
                    </td>

                    {/* Business Email IDs */}
                    <td className="py-3.5 px-4">
                      {businessEmails.length > 0 ? (
                        <div className="space-y-1">
                          {businessEmails.slice(0, 2).map((email, i) => (
                            <div key={i} className="flex items-center gap-1.5 font-mono text-blue-200 bg-blue-950/40 border border-blue-500/30 px-2 py-0.5 rounded-md w-fit">
                              <Mail className="w-3 h-3 text-blue-400 flex-shrink-0" />
                              <span className="truncate max-w-[170px]">{email}</span>
                            </div>
                          ))}
                          {businessEmails.length > 2 && (
                            <span className="text-[10px] text-blue-400 font-medium">
                              +{businessEmails.length - 2} more business
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 italic text-[11px]">None detected</span>
                      )}
                    </td>

                    {/* Contact Phones & Pages */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1 text-gray-300">
                        {businessPhones.length > 0 && (
                          <div className="flex items-center gap-1.5 font-mono text-xs text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded-md w-fit">
                            <Phone className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                            <span className="truncate max-w-[160px]">{businessPhones[0]}</span>
                          </div>
                        )}
                        {r.contact_page && (
                          <a
                            href={r.contact_page}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 font-mono text-[11px] text-accent hover:underline w-fit block"
                          >
                            <Info className="w-3 h-3 text-accent flex-shrink-0" />
                            <span className="truncate max-w-[150px]">Contact Page</span>
                          </a>
                        )}
                        {businessPhones.length === 0 && !r.contact_page && (
                          <span className="text-gray-500 italic text-[11px]">None detected</span>
                        )}
                      </div>
                    </td>

                    {/* Social Media Links */}
                    <td className="py-3.5 px-4">
                      {r.social_links && Object.keys(r.social_links).length > 0 ? (
                        <div className="flex items-center flex-wrap gap-1.5 max-w-[200px]">
                          {Object.entries(r.social_links).map(([platform, urls]) => {
                            if (!urls || urls.length === 0) return null;
                            const firstUrl = urls[0];
                            const getPlatformStyle = (p: string) => {
                              switch (p.toLowerCase()) {
                                case 'github':
                                  return 'bg-zinc-800 text-zinc-100 border-zinc-700 hover:bg-zinc-700';
                                case 'linkedin':
                                  return 'bg-sky-950/80 text-sky-300 border-sky-600/40 hover:bg-sky-900/80';
                                case 'facebook':
                                  return 'bg-blue-950/80 text-blue-300 border-blue-600/40 hover:bg-blue-900/80';
                                case 'twitter':
                                  return 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800';
                                case 'youtube':
                                  return 'bg-rose-950/80 text-rose-300 border-rose-600/40 hover:bg-rose-900/80';
                                case 'instagram':
                                  return 'bg-pink-950/80 text-pink-300 border-pink-600/40 hover:bg-pink-900/80';
                                case 'discord':
                                  return 'bg-indigo-950/80 text-indigo-300 border-indigo-600/40 hover:bg-indigo-900/80';
                                case 'telegram':
                                  return 'bg-cyan-950/80 text-cyan-300 border-cyan-600/40 hover:bg-cyan-900/80';
                                default:
                                  return 'bg-card text-gray-300 border-border hover:bg-card-hover';
                              }
                            };

                            return (
                              <a
                                key={platform}
                                href={firstUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title={`${platform.toUpperCase()} (${urls.length} link${urls.length > 1 ? 's' : ''}): ${firstUrl}`}
                                className={`px-2 py-0.5 text-[10px] font-medium font-mono border rounded-md transition-colors flex items-center gap-1 ${getPlatformStyle(platform)}`}
                              >
                                <span>{platform}</span>
                                {urls.length > 1 && (
                                  <span className="opacity-75 text-[9px]">({urls.length})</span>
                                )}
                              </a>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-gray-500 italic text-[11px]">None detected</span>
                      )}
                    </td>

                    {/* Pages Scanned */}
                    <td className="py-3.5 px-4 text-center font-mono font-medium text-gray-300">
                      {r.pages_scanned}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={r.status} size="sm" />
                    </td>

                    {/* Details Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onSelectRow(r)}
                        className="p-1.5 rounded-lg text-gray-400 group-hover:text-white group-hover:bg-card transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-12 px-4 text-center">
                  <div className="max-w-xs mx-auto space-y-2">
                    <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center mx-auto text-gray-500">
                      <Info className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-medium text-gray-300">No contact information found</p>
                    <p className="text-xs text-gray-500">
                      {searchQuery ? "Try adjusting your search query or filter criteria." : "Waiting for scan process or results to populate."}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(totalResults / pageSize)}
        totalItems={totalResults}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </div>
  );
}
