import { CheckCircle2, XCircle, AlertCircle, Loader2, Clock } from 'lucide-react';
import { ResultStatus, JobStatus } from '@/types';

interface StatusBadgeProps {
  status: ResultStatus | JobStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const isSm = size === 'sm';
  const sizeClasses = isSm ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';
  const iconSize = isSm ? 'w-3 h-3' : 'w-3.5 h-3.5';

  switch (status) {
    case 'success':
    case 'completed':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 ${sizeClasses}`}>
          <CheckCircle2 className={iconSize} />
          <span className="capitalize">{status === 'completed' ? 'Completed' : 'Success'}</span>
        </span>
      );

    case 'no_contact_found':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-500/30 ${sizeClasses}`}>
          <AlertCircle className={iconSize} />
          <span>No Contact</span>
        </span>
      );

    case 'processing':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-sky-950/60 text-sky-400 border border-sky-500/30 ${sizeClasses}`}>
          <Loader2 className={`${iconSize} animate-spin`} />
          <span>Processing</span>
        </span>
      );

    case 'pending':
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700 ${sizeClasses}`}>
          <Clock className={iconSize} />
          <span>Queued</span>
        </span>
      );

    case 'failed':
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-rose-950/60 text-rose-400 border border-rose-500/30 ${sizeClasses}`}>
          <XCircle className={iconSize} />
          <span>Failed</span>
        </span>
      );
  }
}
