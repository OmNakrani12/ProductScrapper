import { Globe, Mail, Phone, UserCheck, Smartphone, CheckCircle2, XCircle } from 'lucide-react';
import { JobProgress } from '@/types';

interface DashboardStatsProps {
  stats: JobProgress;
}

export default function DashboardStats({ stats }: DashboardStatsProps) {
  const cards = [
    {
      title: "Total Websites",
      value: stats.total_websites,
      icon: Globe,
      color: "from-blue-500/20 to-blue-600/10 text-blue-400 border-blue-500/30",
      sub: `${stats.processed_websites} processed`
    },
    {
      title: "Personal Emails",
      value: stats.personal_emails_found ?? 0,
      icon: UserCheck,
      color: "from-purple-500/20 to-indigo-600/10 text-purple-400 border-purple-500/30",
      sub: "Named & Executive IDs"
    },
    {
      title: "Personal Mobile / Direct",
      value: stats.personal_phones_found ?? 0,
      icon: Smartphone,
      color: "from-emerald-500/20 to-teal-600/10 text-emerald-400 border-emerald-500/30",
      sub: "Mobile & Direct Lines"
    },
    {
      title: "All Emails Found",
      value: stats.emails_found,
      icon: Mail,
      color: "from-accent/20 to-orange-600/10 text-accent border-accent/30",
      sub: "Personal + Business"
    },
    {
      title: "All Phones Found",
      value: stats.phones_found,
      icon: Phone,
      color: "from-cyan-500/20 to-blue-600/10 text-cyan-400 border-cyan-500/30",
      sub: "Mobile + Switchboards"
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div 
            key={i}
            className="p-4 rounded-xl bg-card border border-border hover:border-border-glow transition-all duration-200 group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-400">{c.title}</span>
              <div className={`p-2 rounded-lg bg-gradient-to-br border ${c.color} group-hover:scale-110 transition-transform`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {c.value.toLocaleString()}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">{c.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
