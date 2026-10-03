'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { History, FileText, ArrowRight, Trash2, Globe, Mail, Phone, RefreshCw, AlertCircle, Plus } from 'lucide-react';
import { getJobs, deleteJob } from '@/lib/api';
import { Job } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import Pagination from '@/components/Pagination';
import { formatDate } from '@/lib/utils';

export default function JobsHistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchJobsList = useCallback(async (page = currentPage) => {
    setIsLoading(true);
    try {
      const res = await getJobs(page, 15);
      setJobs(res.items);
      setTotalJobs(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchJobsList(currentPage);
  }, [currentPage, fetchJobsList]);

  const handleDelete = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this job and all its extracted contacts?")) {
      return;
    }
    setDeletingId(jobId);
    try {
      await deleteJob(jobId);
      await fetchJobsList(currentPage);
    } catch (err) {
      alert("Failed to delete job");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-accent" />
            <span>Job History</span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            View all previous website extraction sessions and download contact results.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-accent to-amber-500 hover:opacity-95 text-white font-semibold text-xs rounded-xl shadow-lg shadow-accent/20 transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4" />
          <span>New Scraping Job</span>
        </Link>
      </div>

      {/* Jobs Table Container */}
      <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-7 h-7 text-accent animate-spin mx-auto" />
            <p className="text-xs font-semibold text-gray-400">Loading Job History...</p>
          </div>
        ) : jobs.length > 0 ? (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface/70 text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                    <th className="py-3 px-4">File Name</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-center">Total Sites</th>
                    <th className="py-3 px-4 text-center">Successful</th>
                    <th className="py-3 px-4 text-center">Failed</th>
                    <th className="py-3 px-4 text-center">Emails Found</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs">
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => router.push(`/jobs/${job.id}`)}
                      className="hover:bg-card-hover/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-white group-hover:text-accent transition-colors">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-accent flex-shrink-0" />
                          <span className="truncate max-w-xs">{job.filename}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-400">
                        {formatDate(job.created_at)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-medium text-gray-200">
                        {job.total_websites}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-medium text-emerald-400">
                        {job.successful_websites}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-medium text-rose-400">
                        {job.failed_websites}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-medium text-accent">
                        {job.emails_found}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={job.status} size="sm" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/jobs/${job.id}`}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-card border border-border transition-colors text-xs flex items-center gap-1"
                          >
                            <span>Results</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={(e) => handleDelete(job.id, e)}
                            disabled={deletingId === job.id}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-950/40 border border-border hover:border-rose-500/30 transition-colors"
                            title="Delete job"
                          >
                            {deletingId === job.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalJobs / 15)}
              totalItems={totalJobs}
              pageSize={15}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        ) : (
          <div className="py-16 px-4 text-center max-w-sm mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center mx-auto text-gray-500">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">No Scraping Jobs Yet</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Upload a list of website URLs in CSV, XLSX, or TXT format to start discovering public contacts.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white font-semibold text-xs rounded-xl shadow-md hover:opacity-95 transition-all"
              >
                <span>Upload First Website List</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
