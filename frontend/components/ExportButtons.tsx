import { FileSpreadsheet, FileText, Code2 } from 'lucide-react';
import { downloadCSV, downloadXLSX, downloadJSON } from '@/lib/api';

interface ExportButtonsProps {
  jobId: string;
}

export default function ExportButtons({ jobId }: ExportButtonsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => downloadCSV(jobId)}
        className="firebase-btn-secondary px-2.5 py-2 sm:py-1.5 text-xs font-semibold text-gray-200 flex items-center gap-1 touch-target sm:min-h-0 shadow-sm"
        title="Download CSV"
      >
        <FileText className="w-3.5 h-3.5 text-emerald-400" />
        <span>CSV</span>
      </button>

      <button
        onClick={() => downloadXLSX(jobId)}
        className="firebase-btn-secondary px-2.5 py-2 sm:py-1.5 text-xs font-semibold text-gray-200 flex items-center gap-1 touch-target sm:min-h-0 shadow-sm"
        title="Download XLSX Excel"
      >
        <FileSpreadsheet className="w-3.5 h-3.5 text-green-400" />
        <span>XLSX</span>
      </button>

      <button
        onClick={() => downloadJSON(jobId)}
        className="firebase-btn-secondary px-2.5 py-2 sm:py-1.5 text-xs font-semibold text-gray-200 flex items-center gap-1 touch-target sm:min-h-0 shadow-sm"
        title="Download JSON"
      >
        <Code2 className="w-3.5 h-3.5 text-firebase-400" />
        <span>JSON</span>
      </button>
    </div>
  );
}
