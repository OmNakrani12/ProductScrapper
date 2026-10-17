'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, AlertCircle, Sparkles, Mail } from 'lucide-react';
import { getJobProgress, getJobResults } from '@/lib/api';
import { JobProgress, WebsiteResult } from '@/types';
import ProgressBar from '@/components/ProgressBar';
import DashboardStats from '@/components/DashboardStats';
import ResultsTable from '@/components/ResultsTable';
import ResultDetails from '@/components/ResultDetails';
import ExportButtons from '@/components/ExportButtons';
import StatusBadge from '@/components/StatusBadge';
import { formatDate } from '@/lib/utils';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [results, setResults] = useState<WebsiteResult[]>([]);
  const [totalResults, setTotalResults] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hasPersonalEmail, setHasPersonalEmail] = useState<boolean>(false);
  const [hasBusinessEmail, setHasBusinessEmail] = useState<boolean>(false);
  const [hasPrimaryEmail, setHasPrimaryEmail] = useState<boolean>(false);
  const [hasContactInfo, setHasContactInfo] = useState<boolean>(false);
  const [hasSocialLinks, setHasSocialLinks] = useState<boolean>(false);
  const [onlySuccess, setOnlySuccess] = useState<boolean>(false);

  const [selectedResult, setSelectedResult] = useState<WebsiteResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync updated result across state
  const handleResultUpdated = (updated: WebsiteResult) => {
    setResults((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    if (selectedResult && selectedResult.id === updated.id) {
      setSelectedResult(updated);
    }
  };

  // Fetch progress stats
  const fetchProgress = useCallback(async (isInitial = false) => {
    if (!jobId) return;
    try {
      const data = await getJobProgress(jobId);
      setProgress(data);
      setError(null);
      return data;
    } catch (err: any) {
      console.warn('Polling status warning:', err);
      if (isInitial) {
        setError(err.message || 'Failed to fetch job status');
      }
    }
  }, [jobId]);

  // Fetch results table data
  const fetchResultsData = useCallback(async (
    page = currentPage,
    search = searchQuery,
    status = statusFilter,
    pEmail = hasPersonalEmail,
    bEmail = hasBusinessEmail,
    primEmail = hasPrimaryEmail,
    cInfo = hasContactInfo,
    sLinks = hasSocialLinks,
    oSuccess = onlySuccess
  ) => {
    if (!jobId) return;
    try {
      const data = await getJobResults(jobId, page, 25, search, status, pEmail, bEmail, primEmail, cInfo, sLinks, oSuccess);
      setResults(data.items);
      setTotalResults(data.total);
    } catch (err: any) {
      console.warn('Polling results warning:', err);
    }
  }, [jobId, currentPage, searchQuery, statusFilter, hasPersonalEmail, hasBusinessEmail, hasPrimaryEmail, hasContactInfo, hasSocialLinks, onlySuccess]);

  // Polling effect while job is pending/processing
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const loadData = async () => {
      setIsLoading(true);
      const prog = await fetchProgress(true);
      await fetchResultsData(1, searchQuery, statusFilter, hasPersonalEmail, hasBusinessEmail, hasPrimaryEmail, hasContactInfo, hasSocialLinks, onlySuccess);
      setIsLoading(false);

      if (prog && (prog.status === 'processing' || prog.status === 'pending')) {
        interval = setInterval(async () => {
          const updated = await fetchProgress(false);
          await fetchResultsData(currentPage, searchQuery, statusFilter, hasPersonalEmail, hasBusinessEmail, hasPrimaryEmail, hasContactInfo, hasSocialLinks, onlySuccess);
          if (updated && (updated.status === 'completed' || updated.status === 'failed')) {
            clearInterval(interval);
          }
        }, 1500);
      }
    };

    loadData();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobId, fetchProgress, fetchResultsData]);

  // Handle Search input change
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    fetchResultsData(1, query, statusFilter, hasPersonalEmail, hasBusinessEmail, hasPrimaryEmail, hasContactInfo, hasSocialLinks, onlySuccess);
  };

  // Handle Status filter change
  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
    fetchResultsData(1, searchQuery, status, hasPersonalEmail, hasBusinessEmail, hasPrimaryEmail, hasContactInfo, hasSocialLinks, onlySuccess);
  };

  // Handle Checkbox filter changes
  const handleCheckboxFilterChange = (filterKey: string, checked: boolean) => {
    let pEmail = hasPersonalEmail;
    let bEmail = hasBusinessEmail;
    let primEmail = hasPrimaryEmail;
    let cInfo = hasContactInfo;
    let sLinks = hasSocialLinks;
    let oSuccess = onlySuccess;

    if (filterKey === 'personal_email') {
      setHasPersonalEmail(checked);
      pEmail = checked;
    } else if (filterKey === 'business_email') {
      setHasBusinessEmail(checked);
      bEmail = checked;
    } else if (filterKey === 'primary_email') {
      setHasPrimaryEmail(checked);
      primEmail = checked;
    } else if (filterKey === 'contact_info') {
      setHasContactInfo(checked);
      cInfo = checked;
    } else if (filterKey === 'social_links') {
      setHasSocialLinks(checked);
      sLinks = checked;
    } else if (filterKey === 'status_success') {
      setOnlySuccess(checked);
      oSuccess = checked;
    }

    setCurrentPage(1);
    fetchResultsData(1, searchQuery, statusFilter, pEmail, bEmail, primEmail, cInfo, sLinks, oSuccess);
  };

  const handleClearAllFilters = () => {
    setHasPersonalEmail(false);
    setHasBusinessEmail(false);
    setHasPrimaryEmail(false);
    setHasContactInfo(false);
    setHasSocialLinks(false);
    setOnlySuccess(false);
    setCurrentPage(1);
    fetchResultsData(1, searchQuery, statusFilter, false, false, false, false, false, false);
  };

  // Handle Page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchResultsData(page, searchQuery, statusFilter, hasPersonalEmail, hasBusinessEmail, hasPrimaryEmail, hasContactInfo, hasSocialLinks, onlySuccess);
  };

  if (error) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto space-y-4">
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <p>{error}</p>
        </div>
        <button
          onClick={() => router.push('/jobs')}
          className="px-4 py-2 bg-card border border-border text-gray-200 text-xs font-semibold rounded-xl"
        >
          Return to Jobs History
        </button>
      </div>
    );
  }

  if (isLoading || !progress) {
    return (
      <div className="py-20 text-center space-y-4">
        <RefreshCw className="w-8 h-8 text-accent animate-spin mx-auto" />
        <p className="text-sm font-semibold text-gray-300">Loading Job Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-6xl mx-auto py-1">
      {/* Top Header Card - Compact */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-matte-800 border border-matte-700/80 shadow-sm">
        <div className="space-y-0.5">
          <button
            onClick={() => router.push('/jobs')}
            className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3 h-3 text-firebase-400" />
            <span>&larr; Jobs</span>
          </button>
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight font-mono truncate max-w-[180px] sm:max-w-md">
              {progress.filename}
            </h1>
            <StatusBadge status={progress.status} size="sm" />
          </div>
          <p className="text-[11px] text-gray-400 font-mono">
            ID: <span className="text-gray-300">{progress.job_id.slice(0, 8)}</span> • {formatDate(progress.created_at)}
          </p>
        </div>

        {/* Action Buttons: AI Campaign & Export */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto w-full sm:w-auto">
          <button
            onClick={() => router.push(`/jobs/${jobId}/campaign`)}
            className="flex-1 sm:flex-initial firebase-btn-primary px-3.5 py-2 sm:py-1.5 text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5 touch-target sm:min-h-0"
          >
            <Mail className="w-3.5 h-3.5 text-white" />
            <span>AI Campaign</span>
          </button>
          <div className="flex-1 sm:flex-initial">
            <ExportButtons jobId={progress.job_id} />
          </div>
        </div>
      </div>

      {/* Live Progress Bar */}
      <ProgressBar progress={progress} />

      {/* Summary Stats Grid */}
      <DashboardStats stats={progress} />

      {/* Main Results Table with Expandable AI Response Email Box */}
      <div className="pt-2">
        <ResultsTable
          results={results}
          totalResults={totalResults}
          currentPage={currentPage}
          pageSize={25}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          jobId={jobId}
          hasPersonalEmail={hasPersonalEmail}
          hasBusinessEmail={hasBusinessEmail}
          hasPrimaryEmail={hasPrimaryEmail}
          hasContactInfo={hasContactInfo}
          hasSocialLinks={hasSocialLinks}
          onlySuccess={onlySuccess}
          onPageChange={handlePageChange}
          onSearchChange={handleSearchChange}
          onStatusFilterChange={handleStatusFilterChange}
          onCheckboxFilterChange={handleCheckboxFilterChange}
          onClearAllFilters={handleClearAllFilters}
          onSelectRow={(row) => setSelectedResult(row)}
          onResultUpdated={handleResultUpdated}
        />
      </div>

      {/* Detail Drawer with AI Response Email Box */}
      <ResultDetails
        result={selectedResult}
        jobId={jobId}
        onClose={() => setSelectedResult(null)}
        onUpdated={handleResultUpdated}
      />
    </div>
  );
}
