import { Loader2, Zap, CheckCircle2 } from 'lucide-react';
import { JobProgress } from '@/types';

interface ProgressBarProps {
  progress: JobProgress;
}

export default function ProgressBar({ progress }: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, progress.progress_percent || 0));
  const isComplete = progress.status === 'completed';

  return (
    <div className="p-5 rounded-xl bg-card/90 border border-border space-y-3 relative overflow-hidden">
      {/* Background ambient glow effect */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-accent/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {isComplete ? (
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="p-1.5 rounded-lg bg-accent/20 text-accent">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-white">
              {isComplete ? "Job Crawl Completed" : "Scanning Websites in Background..."}
            </h3>
            <p className="text-xs text-gray-400">
              {progress.processed_websites} / {progress.total_websites} websites processed ({percent}%)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-accent tracking-tight">{percent}%</span>
        </div>
      </div>

      {/* Bar container */}
      <div className="w-full h-3 bg-surface rounded-full overflow-hidden p-0.5 border border-border/80">
        <div 
          className="h-full bg-gradient-to-r from-accent-600 via-accent to-amber-400 rounded-full transition-all duration-500 ease-out relative"
          style={{ width: `${percent}%` }}
        >
          {/* Subtle light shimmer animation */}
          {!isComplete && (
            <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
          )}
        </div>
      </div>

      {/* Currently scanning indicator */}
      {!isComplete && progress.current_website && (
        <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
          <Zap className="w-3.5 h-3.5 text-accent animate-bounce" />
          <span>Current Target:</span>
          <span className="font-mono text-gray-200 truncate max-w-md">{progress.current_website}</span>
        </div>
      )}
    </div>
  );
}
