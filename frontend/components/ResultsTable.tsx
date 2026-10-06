import { useState } from 'react';
import { Search, ExternalLink, Mail, Phone, ChevronRight, UserCheck, Smartphone, Info, Share2, CheckCircle2, Filter, Star, Copy, Check, Sparkles } from 'lucide-react';
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
    <div className="glass-card rounded-2xl shadow-2xl overflow-hidden border border-white/10 space-y-0">
      {/* Search & Checkbox Filters Bar */}
      <div className="p-4 sm:p-5 border-b border-white/10 space-y-4 bg-slate-950/60 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by personal email, mobile phone, domain..."
              className="w-full pl-10 pr-4 py-2.5 glass-input text-xs text-white placeholder-gray-500 rounded-xl transition-all font-sans"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-[#090d16] p-1.5 rounded-xl border border-white/10 self-start md:self-auto overflow-x-auto">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onStatusFilterChange(tab.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                  statusFilter === tab.id
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Checkbox Filter Toggles */}
        {onCheckboxFilterChange && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5 text-xs">
            <span className="text-gray-400 font-semibold flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-cyan-400" /> Filter Leads:
            </span>

            <button
              onClick={() => onCheckboxFilterChange('hasPrimaryEmail', !hasPrimaryEmail)}
              className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${
                hasPrimaryEmail
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold shadow-sm'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${hasPrimaryEmail ? 'fill-cyan-400 text-cyan-400' : ''}`} />
              <span>Primary Outreach Email</span>
            </button>

            <button
              onClick={() => onCheckboxFilterChange('hasPersonalEmail', !hasPersonalEmail)}
              className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${
                hasPersonalEmail
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 font-bold shadow-sm'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Executive / Personal Email</span>
            </button>

            <button
              onClick={() => onCheckboxFilterChange('hasBusinessEmail', !hasBusinessEmail)}
              className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${
                hasBusinessEmail
                  ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 font-bold shadow-sm'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
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

      {/* Table Data */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-[#090d18]/80 text-[11px] font-bold text-gray-400 uppercase tracking-wider font-display">
              <th className="py-3.5 px-4">Domain / Website</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Primary Outreach Email</th>
              <th className="py-3.5 px-4 hidden md:table-cell">Personal / Mobile</th>
              <th className="py-3.5 px-4 hidden lg:table-cell">Social Links</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs text-gray-300 font-sans">
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
                const personalPhones = row.personal_phones || [];

                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelectRow(row)}
                    className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                  >
                    {/* Domain & Company Name */}
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm font-display group-hover:text-cyan-300 transition-colors">
                            {row.website_url.replace(/^https?:\/\//i, '').split('/')[0] || row.website_url}
                          </span>
                          <a
                            href={row.website_url.startsWith('http') ? row.website_url : `https://${row.website_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-gray-500 hover:text-cyan-400 transition-colors"
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
                    <td className="py-4 px-4">
                      <StatusBadge status={row.status} />
                    </td>

                    {/* Primary Email */}
                    <td className="py-4 px-4">
                      {primaryMail ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-200 text-xs font-mono font-medium shadow-sm group/btn">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 flex-shrink-0" />
                          <span className="font-bold">{primaryMail}</span>
                          <button
                            onClick={(e) => handleCopyEmail(primaryMail, e)}
                            className="ml-1 text-cyan-400 hover:text-white transition-colors"
                            title="Copy email to clipboard"
                          >
                            {copiedEmail === primaryMail ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs font-mono">—</span>
                      )}
                    </td>

                    {/* Personal Mails & Mobiles */}
                    <td className="py-4 px-4 hidden md:table-cell">
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

                        {personalPhones.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-mono">
                            <Smartphone className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                            <span>{personalPhones[0]}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Social Links */}
                    <td className="py-4 px-4 hidden lg:table-cell">
                      {row.social_links && Object.keys(row.social_links).length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          {Object.keys(row.social_links).map((platform) => (
                            <span
                              key={platform}
                              className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-gray-300 capitalize font-medium"
                            >
                              {platform}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">—</span>
                      )}
                    </td>

                    {/* Action Arrow */}
                    <td className="py-4 px-4 text-right">
                      <button className="p-2 rounded-xl bg-white/5 group-hover:bg-cyan-500/20 text-gray-400 group-hover:text-cyan-300 transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-white/10 bg-[#090d18]">
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
