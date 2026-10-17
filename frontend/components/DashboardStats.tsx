import { Globe, Mail, UserCheck, CheckCircle2 } from 'lucide-react';
import { JobProgress } from '@/types';

interface DashboardStatsProps {
  stats: JobProgress;
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
  const cards = [
    {
      title: "Target Websites",
      value: stats.total_websites,
      icon: Globe,
      color: "bg-firebase-600/10 text-firebase-400 border-firebase-500/30",
      sub: `${stats.processed_websites} processed (${Math.round((stats.processed_websites / (stats.total_websites || 1)) * 100)}%)`
    },
    {
      title: "Decision-Maker Emails",
      value: stats.personal_emails_found ?? 0,
      icon: UserCheck,
      color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
      sub: "CEO, Founder & Named IDs"
    },
    {
      title: "Total Valid Emails",
      value: stats.emails_found,
      icon: Mail,
      color: "bg-firebase-500/10 text-firebase-300 border-firebase-500/30",
      sub: "100% Verified Deliverable"
    },
    {
      title: "Scraped Successfully",
      value: stats.successful_websites,
      icon: CheckCircle2,
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      sub: `${Math.round((stats.successful_websites / (stats.total_websites || 1)) * 100)}% Success Rate`
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div 
            key={i}
            className="p-2.5 sm:p-3 rounded-xl bg-matte-800 hover:bg-matte-750 border border-matte-700/80 transition-all group"
          >
            <div className="flex items-center justify-between mb-1 sm:mb-1.5">
              <span className="text-[10px] sm:text-[11px] font-medium text-gray-400 truncate">{c.title}</span>
              <div className={`p-1 rounded-md border ${c.color} shadow-sm`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="font-mono text-xl font-bold text-white tracking-tight">
              {c.value.toLocaleString()}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{c.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
