'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
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

  // Fetch progress stats
  const fetchProgress = useCallback(async () => {
    if (!jobId) return;
    try {
      const data = await getJobProgress(jobId);
      setProgress(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch job status');
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
      console.error(err);
    }
  }, [jobId, currentPage, searchQuery, statusFilter, hasPersonalEmail, hasBusinessEmail, hasPrimaryEmail, hasContactInfo, hasSocialLinks, onlySuccess]);

  // Polling effect while job is pending/processing
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const loadData = async () => {
      setIsLoading(true);
      const prog = await fetchProgress();
      await fetchResultsData(1, searchQuery, statusFilter, hasPersonalEmail, hasBusinessEmail, hasPrimaryEmail, hasContactInfo, hasSocialLinks, onlySuccess);
      setIsLoading(false);

      if (prog && (prog.status === 'processing' || prog.status === 'pending')) {
        interval = setInterval(async () => {
          const updated = await fetchProgress();
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
    <div className="space-y-6">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <button
            onClick={() => router.push('/jobs')}
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Jobs</span>
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight font-mono">
              {progress.filename}
            </h1>
            <StatusBadge status={progress.status} />
          </div>
          <p className="text-xs text-gray-400">
            Job ID: <span className="font-mono text-gray-300">{progress.job_id}</span> • Created {formatDate(progress.created_at)}
          </p>
        </div>

        {/* Export Buttons */}
        <ExportButtons jobId={progress.job_id} />
      </div>

      {/* Live Progress Bar */}
      <ProgressBar progress={progress} />

      {/* Summary Stats Grid */}
      <DashboardStats stats={progress} />

      {/* Main Results Table */}
      <div className="pt-2">
        <ResultsTable
          results={results}
          totalResults={totalResults}
          currentPage={currentPage}
          pageSize={25}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
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
        />
      </div>

      {/* Detail Drawer */}
      <ResultDetails
        result={selectedResult}
        onClose={() => setSelectedResult(null)}
      />
    </div>
  );
}
