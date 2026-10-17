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
    <div className="space-y-3 max-w-6xl mx-auto py-1">
      {/* Header - Compact */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-matte-800 border border-matte-700/80 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-firebase-600/20 text-firebase-400 border border-firebase-600/30">
            <History className="w-4 h-4 text-firebase-400" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
              Scraping Job History
            </h1>
            <p className="text-[11px] text-gray-400">
              Past scrape runs & verified primary contact lists
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="firebase-btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Job</span>
        </Link>
      </div>

      {/* Jobs Table Container - Compact */}
      <div className="bg-matte-800 border border-matte-700 rounded-xl shadow-md overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center space-y-2">
            <RefreshCw className="w-5 h-5 text-firebase-400 animate-spin mx-auto" />
            <p className="text-xs font-semibold text-gray-400">Loading Job History...</p>
          </div>
        ) : jobs.length > 0 ? (
          <div>
            {/* MOBILE & TABLET CARD VIEW */}
            <div className="md:hidden divide-y divide-matte-700/60">
              {jobs.map((job) => (
                <div 
                  key={job.id} 
                  onClick={() => router.push(`/jobs/${job.id}`)}
                  className="p-3.5 space-y-3 hover:bg-matte-750 transition-colors cursor-pointer mobile-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-firebase-400 flex-shrink-0" />
                        <span className="font-mono font-bold text-white text-xs truncate block">{job.filename}</span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono">
                        {formatDate(job.created_at)}
                      </div>
                    </div>
                    <StatusBadge status={job.status} size="sm" />
                  </div>

                  {/* 4 Stats Chips */}
                  <div className="grid grid-cols-4 gap-1.5 bg-matte-900 p-2 rounded-xl text-center font-mono text-[11px] border border-matte-750">
                    <div>
                      <span className="text-[10px] text-gray-400 block">Sites</span>
                      <span className="font-bold text-white">{job.total_websites}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">Success</span>
                      <span className="font-bold text-emerald-400">{job.successful_websites}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">Failed</span>
                      <span className="font-bold text-rose-400">{job.failed_websites}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">Emails</span>
                      <span className="font-bold text-firebase-300">{job.emails_found}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-0.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 flex-1">
                      <Link
                        href={`/jobs/${job.id}/campaign`}
                        className="flex-1 py-2 px-3 rounded-lg bg-firebase-600/20 hover:bg-firebase-600 text-firebase-300 hover:text-white border border-firebase-600/30 text-xs font-semibold flex items-center justify-center gap-1.5 touch-target shadow-sm"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>AI Outreach</span>
                      </Link>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="flex-1 py-2 px-3 rounded-lg bg-matte-700/70 hover:bg-matte-700 text-gray-200 hover:text-white border border-matte-650 text-xs font-semibold flex items-center justify-center gap-1.5 touch-target shadow-sm"
                      >
                        <span>Leads</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                    <button
                      onClick={(e) => handleDelete(job.id, e)}
                      disabled={deletingId === job.id}
                      className="p-2 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-950/30 border border-transparent hover:border-rose-500/30 touch-target flex items-center justify-center"
                      title="Delete job"
                    >
                      {deletingId === job.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-matte-700 bg-matte-850 text-[10px] uppercase tracking-wider text-gray-400 font-semibold font-mono">
                    <th className="py-2.5 px-3">Dataset / Target</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-center">Sites</th>
                    <th className="py-2.5 px-3 text-center">Success</th>
                    <th className="py-2.5 px-3 text-center">Failed</th>
                    <th className="py-2.5 px-3 text-center">Primary Emails</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-matte-700/60 text-xs">
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => router.push(`/jobs/${job.id}`)}
                      className="hover:bg-matte-750 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-3 font-mono font-semibold text-white group-hover:text-firebase-400 transition-colors">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-firebase-400 flex-shrink-0" />
                          <span className="truncate max-w-xs">{job.filename}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-gray-400 text-[11px] font-mono">
                        {formatDate(job.created_at)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-medium text-gray-200">
                        {job.total_websites}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-medium text-emerald-400">
                        {job.successful_websites}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-medium text-rose-400">
                        {job.failed_websites}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-firebase-300">
                        {job.emails_found}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={job.status} size="sm" />
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/jobs/${job.id}/campaign`}
                            className="px-2 py-1 rounded-md bg-firebase-600/20 hover:bg-firebase-600 text-firebase-300 hover:text-white border border-firebase-600/30 transition-all text-xs font-semibold flex items-center gap-1 shadow-sm"
                            title="Launch AI Outreach Campaign"
                          >
                            <span>Outreach</span>
                          </Link>
                          <Link
                            href={`/jobs/${job.id}`}
                            className="px-2.5 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-matte-700 border border-matte-700 transition-colors text-xs font-medium flex items-center gap-1"
                          >
                            <span>Leads</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={(e) => handleDelete(job.id, e)}
                            disabled={deletingId === job.id}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-950/30 border border-transparent hover:border-rose-500/30 transition-colors"
                            title="Delete job"
                          >
                            {deletingId === job.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
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
          <div className="py-20 px-4 text-center max-w-sm mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-matte-850 border border-matte-700 flex items-center justify-center mx-auto text-gray-400">
              <History className="w-6 h-6 text-firebase-400" />
            </div>
            <h3 className="text-sm font-bold text-white">No Scraping Jobs Yet</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Upload a list of website URLs in CSV, XLSX, or TXT format to start discovering public contacts.
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="firebase-btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs"
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
