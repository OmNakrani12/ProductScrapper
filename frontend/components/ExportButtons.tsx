import { FileSpreadsheet, FileText, Code2, Download } from 'lucide-react';
import { downloadCSV, downloadXLSX, downloadJSON } from '@/lib/api';

interface ExportButtonsProps {
  jobId: string;
}

export default function ExportButtons({ jobId }: ExportButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => downloadCSV(jobId)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-200 bg-surface border border-border hover:border-accent/40 hover:text-white rounded-lg transition-colors shadow-sm"
      >
        <FileText className="w-3.5 h-3.5 text-emerald-400" />
        <span>Export CSV</span>
      </button>

      <button
        onClick={() => downloadXLSX(jobId)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-200 bg-surface border border-border hover:border-accent/40 hover:text-white rounded-lg transition-colors shadow-sm"
      >
        <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" />
        <span>Export XLSX</span>
      </button>

      <button
        onClick={() => downloadJSON(jobId)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-200 bg-surface border border-border hover:border-accent/40 hover:text-white rounded-lg transition-colors shadow-sm"
      >
        <Code2 className="w-3.5 h-3.5 text-sky-400" />
        <span>Export JSON</span>
      </button>
    </div>
  );
}
