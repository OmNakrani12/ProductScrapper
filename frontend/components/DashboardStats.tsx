import { Globe, Mail, Phone, UserCheck, Smartphone, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
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
      color: "from-cyan-500/20 to-blue-600/10 text-cyan-400 border-cyan-500/30",
      sub: `${stats.processed_websites} processed (${Math.round((stats.processed_websites / (stats.total_websites || 1)) * 100)}%)`
    },
    {
      title: "Decision-Maker Emails",
      value: stats.personal_emails_found ?? 0,
      icon: UserCheck,
      color: "from-purple-500/20 to-indigo-600/10 text-purple-300 border-purple-500/30",
      sub: "CEO, Founder & Named IDs"
    },
    {
      title: "Direct Mobiles",
      value: stats.personal_phones_found ?? 0,
      icon: Smartphone,
      color: "from-emerald-500/20 to-teal-600/10 text-emerald-300 border-emerald-500/30",
      sub: "Cellular & Direct Dials"
    },
    {
      title: "Total Valid Emails",
      value: stats.emails_found,
      icon: Mail,
      color: "from-amber-500/20 to-orange-600/10 text-amber-300 border-amber-500/30",
      sub: "No Dummy / Disposable Mails"
    },
    {
      title: "All Phone Lines",
      value: stats.phones_found,
      icon: Phone,
      color: "from-sky-500/20 to-blue-600/10 text-sky-300 border-sky-500/30",
      sub: "Mobiles + Switchboards"
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div 
            key={i}
            className="p-4 rounded-2xl glass-card glass-card-hover border border-white/10 group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-300 font-display">{c.title}</span>
              <div className={`p-2 rounded-xl bg-gradient-to-br border ${c.color} group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {c.value.toLocaleString()}
            </div>
            <p className="text-[11px] text-gray-400 mt-1 font-sans">{c.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
