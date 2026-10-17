import { Loader2, Zap, CheckCircle2 } from 'lucide-react';
import { JobProgress } from '@/types';

interface ProgressBarProps {
  progress: JobProgress;
}

export default function ProgressBar({ progress }: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, progress.progress_percent || 0));
  const isComplete = progress.status === 'completed';

  return (
    <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-matte-800 border border-matte-700 space-y-3 relative overflow-hidden shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {isComplete ? (
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="p-1.5 rounded-lg bg-firebase-600/20 text-firebase-400 border border-firebase-600/30 flex-shrink-0">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white font-display truncate">
              {isComplete ? "Job Crawl Completed" : "Scanning Websites in Background..."}
            </h3>
            <p className="text-xs text-gray-400">
              {progress.processed_websites} / {progress.total_websites} websites processed ({percent}%)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <span className="text-xl sm:text-2xl font-extrabold text-firebase-400 font-display tracking-tight">{percent}%</span>
        </div>
      </div>

      {/* Bar container */}
      <div className="w-full h-2.5 bg-matte-900 rounded-full overflow-hidden p-0.5 border border-matte-700">
        <div 
          className="h-full bg-firebase-600 rounded-full transition-all duration-500 ease-out relative shadow-sm"
          style={{ width: `${percent}%` }}
        >
          {!isComplete && (
            <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
          )}
        </div>
      </div>

      {/* Currently scanning indicator */}
      {!isComplete && progress.current_website && (
        <div className="flex items-center gap-2 text-xs text-gray-400 pt-1 min-w-0">
          <Zap className="w-3.5 h-3.5 text-firebase-400 flex-shrink-0" />
          <span className="flex-shrink-0">Current Target:</span>
          <span className="font-mono text-gray-200 truncate max-w-[160px] sm:max-w-md">{progress.current_website}</span>
        </div>
      )}
    </div>
  );
}
