import Link from 'next/link';
import { FileSpreadsheet, FileText, Code2, Send, Sparkles } from 'lucide-react';
import { downloadCSV, downloadXLSX, downloadJSON } from '@/lib/api';

interface ExportButtonsProps {
  jobId: string;
}

export default function ExportButtons({ jobId }: ExportButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/jobs/${jobId}/campaign`}
        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-xl shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all duration-300 transform hover:-translate-y-0.5"
      >
        <Send className="w-3.5 h-3.5 text-white" />
        <span>Send Campaign Emails</span>
        <Sparkles className="w-3 h-3 text-cyan-200" />
      </Link>

      <button
        onClick={() => downloadCSV(jobId)}
        className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-200 bg-white/5 border border-white/10 hover:border-white/20 hover:text-white rounded-xl transition-all shadow-sm"
      >
        <FileText className="w-3.5 h-3.5 text-emerald-400" />
        <span>Export CSV</span>
      </button>

      <button
        onClick={() => downloadXLSX(jobId)}
        className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-200 bg-white/5 border border-white/10 hover:border-white/20 hover:text-white rounded-xl transition-all shadow-sm"
      >
        <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" />
        <span>Export XLSX</span>
      </button>

      <button
        onClick={() => downloadJSON(jobId)}
        className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-200 bg-white/5 border border-white/10 hover:border-white/20 hover:text-white rounded-xl transition-all shadow-sm"
      >
        <Code2 className="w-3.5 h-3.5 text-sky-400" />
        <span>Export JSON</span>
      </button>
    </div>
  );
}
