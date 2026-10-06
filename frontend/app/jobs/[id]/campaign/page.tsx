'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Send, Play, Pause, RefreshCw, CheckCircle2, XCircle, Clock, 
  Trash2, Plus, Edit3, Sparkles, Mail, ShieldAlert, FileText, Check, AlertCircle, ExternalLink, Globe 
} from 'lucide-react';
import { getJobProgress, getJobResults, sendCampaignEmail } from '@/lib/api';
import { JobProgress, WebsiteResult } from '@/types';

interface CampaignRecipient {
  id: string;
  email: string;
  website_url: string;
  domain: string;
  company_name: string;
  isSelected: boolean;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  error?: string;
  sentAt?: string;
}

export default function EmailCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  
  // Custom Recipient Manual Add State
  const [newEmailInput, setNewEmailInput] = useState('');
  const [newCompanyInput, setNewCompanyInput] = useState('');
  const [newWebsiteInput, setNewWebsiteInput] = useState('');

  // Email Content State
  const [subject, setSubject] = useState('Exclusive Partnership Inquiry for {company_name}');
  const [body, setBody] = useState(
    `Hello {company_name} Team,\n\nI am reaching out regarding your website at {website}.\n\nWe noticed your platform and would love to discuss a potential collaboration with {company_name}.\n\nWould you be open to a quick 5-minute call this week?\n\nBest regards,\nOutreach Manager`
  );

  // Real SMTP Email Server Credentials
  const [smtpHost, setSmtpHost] = useState<string>('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [smtpUser, setSmtpUser] = useState<string>('');
  const [smtpPassword, setSmtpPassword] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('WebContact Outreach');
  const [senderEmail, setSenderEmail] = useState<string>('');

  // Interval & Timer Settings
  const [intervalSeconds, setIntervalSeconds] = useState<number>(5);
  const [isCampaignRunning, setIsCampaignRunning] = useState<boolean>(false);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);

  // Logs & UI State
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const campaignTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll log window
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Quick SMTP Server Presets
  const applySmtpPreset = (provider: 'gmail' | 'outlook' | 'mailtrap') => {
    if (provider === 'gmail') {
      setSmtpHost('smtp.gmail.com');
      setSmtpPort(587);
    } else if (provider === 'outlook') {
      setSmtpHost('smtp.office365.com');
      setSmtpPort(587);
    } else if (provider === 'mailtrap') {
      setSmtpHost('sandbox.smtp.mailtrap.io');
      setSmtpPort(2525);
    }
  };

  // Load Primary Emails from Job Results
  useEffect(() => {
    if (!jobId) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const prog = await getJobProgress(jobId);
        setProgress(prog);

        // Fetch all results for this job (up to 2000 items)
        const data = await getJobResults(jobId, 1, 2000, '', 'all', false, false, false);

        // Extract primary emails from ALL scraped website results
        const recipientList: CampaignRecipient[] = [];
        const seen = new Set<string>();

        data.items.forEach((item, index) => {
          // Resolve best primary working email with fallbacks
          const primaryEmail = item.primary_email || 
            (item.personal_emails && item.personal_emails.length > 0 ? item.personal_emails[0] : null) || 
            (item.business_emails && item.business_emails.length > 0 ? item.business_emails[0] : null) || 
            (item.emails && item.emails.length > 0 ? item.emails[0] : null);

          if (primaryEmail && primaryEmail.trim() && !seen.has(primaryEmail.trim().toLowerCase())) {
            const cleanEmail = primaryEmail.trim();
            seen.add(cleanEmail.toLowerCase());

            const rawWebsite = item.website_url || '';
            const websiteUrl = rawWebsite.startsWith('http') ? rawWebsite : `https://${rawWebsite}`;
            const domain = rawWebsite.replace(/^https?:\/\//i, '').split('/')[0];

            recipientList.push({
              id: `rec_${index}_${Date.now()}`,
              email: cleanEmail,
              website_url: websiteUrl,
              domain: domain,
              company_name: item.company_name || domain,
              isSelected: true,
              status: 'pending',
            });
          }
        });

        setRecipients(recipientList);
        addLog(`Successfully loaded ${recipientList.length} primary working email recipients from scraped dataset.`);
      } catch (err: any) {
        addLog(`Error loading recipients: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [jobId]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
  };

  // Toggle selection
  const toggleSelectRecipient = (id: string) => {
    setRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isSelected: !r.isSelected } : r))
    );
  };

  const toggleSelectAll = () => {
    const allSelected = recipients.every((r) => r.isSelected);
    setRecipients((prev) => prev.map((r) => ({ ...r, isSelected: !allSelected })));
  };

  // Edit Email Directly
  const handleUpdateEmail = (id: string, newEmail: string) => {
    setRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, email: newEmail } : r))
    );
  };

  // Edit Website URL Directly
  const handleUpdateWebsite = (id: string, newWebsite: string) => {
    const domain = newWebsite.replace(/^https?:\/\//i, '').split('/')[0];
    setRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, website_url: newWebsite, domain: domain } : r))
    );
  };

  // Remove Recipient
  const handleDeleteRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  // Add Custom Email (with Website URL)
  const handleAddCustomRecipient = () => {
    if (!newEmailInput.trim() || !newEmailInput.includes('@')) {
      alert('Please enter a valid recipient email address.');
      return;
    }

    let rawWebsite = newWebsiteInput.trim();
    if (!rawWebsite) {
      const domainPart = newEmailInput.split('@')[1] || 'custom.com';
      rawWebsite = `https://${domainPart}`;
    } else if (!/^https?:\/\//i.test(rawWebsite)) {
      rawWebsite = `https://${rawWebsite}`;
    }

    const domain = rawWebsite.replace(/^https?:\/\//i, '').split('/')[0];
    const newRec: CampaignRecipient = {
      id: `custom_${Date.now()}`,
      email: newEmailInput.trim(),
      website_url: rawWebsite,
      domain: domain,
      company_name: newCompanyInput.trim() || domain,
      isSelected: true,
      status: 'pending',
    };

    setRecipients((prev) => [...prev, newRec]);
    setNewEmailInput('');
    setNewCompanyInput('');
    setNewWebsiteInput('');
    addLog(`Manually added ${newRec.email} (${newRec.website_url}) to campaign list.`);
  };

  // Campaign Dispatch Logic
  const selectedRecipients = recipients.filter((r) => r.isSelected);

  const startCampaign = () => {
    if (selectedRecipients.length === 0) {
      alert('Please select at least one recipient email.');
      return;
    }
    if (!smtpHost.trim() || !smtpUser.trim() || !smtpPassword.trim()) {
      alert('Please enter your SMTP Host, Username, and Password in the SMTP Settings section to send real emails.');
      return;
    }

    setIsCampaignRunning(true);
    addLog(`🚀 Campaign Started via SMTP (${smtpHost}:${smtpPort})! Sending emails every ${intervalSeconds} seconds...`);
    dispatchNextEmail(0);
  };

  const pauseCampaign = () => {
    setIsCampaignRunning(false);
    if (campaignTimerRef.current) clearTimeout(campaignTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setCountdownSeconds(0);
    addLog(`⏸️ Campaign Paused by user.`);
  };

  const dispatchNextEmail = async (index: number) => {
    const activeList = recipients.filter((r) => r.isSelected);

    if (index >= activeList.length) {
      setIsCampaignRunning(false);
      setCountdownSeconds(0);
      addLog(`🎉 Campaign Completed! All ${activeList.length} emails dispatched via SMTP.`);
      return;
    }

    const currentRec = activeList[index];

    // Mark current sending status
    setRecipients((prev) =>
      prev.map((r) => (r.id === currentRec.id ? { ...r, status: 'sending' } : r))
    );

    // Replace placeholders including {website} & {website_url}
    const formattedSubject = subject
      .replace(/{company_name}/g, currentRec.company_name)
      .replace(/{domain}/g, currentRec.domain)
      .replace(/{website}/g, currentRec.website_url)
      .replace(/{website_url}/g, currentRec.website_url)
      .replace(/{email}/g, currentRec.email);

    const formattedBody = body
      .replace(/{company_name}/g, currentRec.company_name)
      .replace(/{domain}/g, currentRec.domain)
      .replace(/{website}/g, currentRec.website_url)
      .replace(/{website_url}/g, currentRec.website_url)
      .replace(/{email}/g, currentRec.email);

    addLog(`✉️ [${index + 1}/${activeList.length}] Connecting to SMTP ${smtpHost}... Sending to ${currentRec.email} (${currentRec.website_url})...`);

    try {
      await sendCampaignEmail({
        recipient_email: currentRec.email,
        subject: formattedSubject,
        body: formattedBody,
        company_name: currentRec.company_name,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_password: smtpPassword,
        sender_name: senderName,
        sender_email: senderEmail || smtpUser,
      });

      // Update success
      setRecipients((prev) =>
        prev.map((r) =>
          r.id === currentRec.id
            ? { ...r, status: 'sent', sentAt: new Date().toLocaleTimeString() }
            : r
        )
      );
      addLog(`🟢 [${index + 1}/${activeList.length}] SUCCESS! Delivered to ${currentRec.email} for website ${currentRec.website_url}.`);
    } catch (err: any) {
      setRecipients((prev) =>
        prev.map((r) =>
          r.id === currentRec.id
            ? { ...r, status: 'failed', error: err.message || 'SMTP Error' }
            : r
        )
      );
      addLog(`❌ [${index + 1}/${activeList.length}] FAILED to ${currentRec.email}: ${err.message}`);
    }

    // Schedule next dispatch if still running
    const nextIndex = index + 1;
    if (nextIndex < activeList.length) {
      setCountdownSeconds(intervalSeconds);

      let remaining = intervalSeconds;
      countdownTimerRef.current = setInterval(() => {
        remaining -= 1;
        setCountdownSeconds(remaining);
        if (remaining <= 0) {
          clearInterval(countdownTimerRef.current!);
        }
      }, 1000);

      campaignTimerRef.current = setTimeout(() => {
        dispatchNextEmail(nextIndex);
      }, intervalSeconds * 1000);
    } else {
      setIsCampaignRunning(false);
      setCountdownSeconds(0);
      addLog(`🎉 Campaign Completed! All emails processed via SMTP.`);
    }
  };

  const sentCount = recipients.filter((r) => r.status === 'sent').length;
  const failedCount = recipients.filter((r) => r.status === 'failed').length;

  if (isLoading) {
    return (
      <div className="py-20 text-center space-y-4">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-gray-300">Loading Campaign Email Dispatcher...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-2">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="space-y-1">
          <button
            onClick={() => router.push(`/jobs/${jobId}`)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Scraped Results</span>
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white tracking-tight font-display">
              Automated Email Outreach Campaign
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Live Dispatcher
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Target Job: <span className="font-mono text-gray-300">{progress?.filename || jobId}</span>
          </p>
        </div>

        {/* Start / Pause Controller */}
        <div className="flex items-center gap-3">
          {isCampaignRunning ? (
            <button
              onClick={pauseCampaign}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-lg transition-all"
            >
              <Pause className="w-4 h-4" />
              <span>Pause Campaign</span>
            </button>
          ) : (
            <button
              onClick={startCampaign}
              disabled={selectedRecipients.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white glow-button rounded-xl disabled:opacity-50 transition-all"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Automated Campaign ({selectedRecipients.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress & Countdown Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-2xl glass-card border border-white/10">
        <div>
          <span className="text-xs font-medium text-gray-400">Total Selected Recipients</span>
          <div className="text-2xl font-extrabold text-white font-display mt-1">
            {selectedRecipients.length} / {recipients.length}
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-400">Emails Delivered via SMTP</span>
          <div className="text-2xl font-extrabold text-emerald-400 font-display mt-1 flex items-center gap-2">
            <span>{sentCount}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-400">Failed / Rejected</span>
          <div className="text-2xl font-extrabold text-rose-400 font-display mt-1">
            {failedCount}
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-400">Next Dispatch Timer</span>
          <div className="text-2xl font-extrabold text-cyan-400 font-mono mt-1 flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400 animate-spin" />
            <span>{isCampaignRunning ? `${countdownSeconds}s` : 'Idle'}</span>
          </div>
        </div>
      </div>

      {/* Real SMTP Server Credentials Config Panel */}
      <div className="p-6 rounded-2xl glass-card border border-cyan-500/30 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white font-display">
              Real SMTP Email Server Configuration
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 font-bold">
              Real Delivery Mode
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">Quick Presets:</span>
            <button
              type="button"
              onClick={() => applySmtpPreset('gmail')}
              className="px-2.5 py-1 text-xs rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold hover:bg-rose-500/30 transition-all"
            >
              Gmail
            </button>
            <button
              type="button"
              onClick={() => applySmtpPreset('outlook')}
              className="px-2.5 py-1 text-xs rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold hover:bg-blue-500/30 transition-all"
            >
              Outlook
            </button>
            <button
              type="button"
              onClick={() => applySmtpPreset('mailtrap')}
              className="px-2.5 py-1 text-xs rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold hover:bg-emerald-500/30 transition-all"
            >
              Mailtrap
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">SMTP Host:</label>
            <input
              type="text"
              placeholder="e.g. smtp.gmail.com"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              className="w-full px-3 py-2 glass-input text-xs text-white rounded-xl font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">SMTP Port:</label>
            <input
              type="number"
              placeholder="587"
              value={smtpPort}
              onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
              className="w-full px-3 py-2 glass-input text-xs text-white rounded-xl font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">SMTP Username / Email:</label>
            <input
              type="email"
              placeholder="you@gmail.com"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              className="w-full px-3 py-2 glass-input text-xs text-white rounded-xl font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">SMTP Password / App Password:</label>
            <input
              type="password"
              placeholder="16-digit App Password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
              className="w-full px-3 py-2 glass-input text-xs text-white rounded-xl font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Sender Name (Optional):</label>
            <input
              type="text"
              placeholder="e.g. John Doe - Outreach Manager"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="w-full px-3 py-2 glass-input text-xs text-white rounded-xl font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1">Sender Email (Optional):</label>
            <input
              type="email"
              placeholder="e.g. outreach@yourcompany.com"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              className="w-full px-3 py-2 glass-input text-xs text-white rounded-xl font-mono"
            />
          </div>
        </div>
      </div>

      {/* Campaign Settings: Template & Time Interval */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Email Template Composer (2 cols) */}
        <div className="lg:col-span-2 space-y-4 p-6 rounded-2xl glass-card border border-white/10">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-400" />
              <span>Email Content & Placeholders</span>
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-300 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold">{`{website}`}</span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{`{company_name}`}</span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{`{domain}`}</span>
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">{`{email}`}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Subject Line:</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2.5 glass-input text-xs text-white rounded-xl font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Email Body Message:</label>
              <textarea
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full p-4 glass-input text-xs text-white rounded-xl font-mono"
              />
            </div>
          </div>
        </div>

        {/* Automated Drip Timer & Interval Settings (1 col) */}
        <div className="space-y-4 p-6 rounded-2xl glass-card border border-white/10">
          <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Automated Drip Delay Settings</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Delay Between Each Email (Seconds):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={3600}
                  value={intervalSeconds}
                  onChange={(e) => setIntervalSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 px-3 py-2 glass-input text-sm font-mono font-bold text-white rounded-xl text-center"
                />
                <span className="text-xs text-gray-400">seconds per email</span>
              </div>
            </div>

            {/* Interval Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-gray-400">Quick Delay Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {[2, 5, 10, 30, 60].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setIntervalSeconds(sec)}
                    className={`px-2.5 py-1 text-xs rounded-lg border font-mono transition-all ${
                      intervalSeconds === sec
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 leading-relaxed">
              <p className="font-semibold text-cyan-300 mb-1">⚡ Dynamic {`{website}`} Placeholder</p>
              Auto-replaces <code className="text-cyan-300 font-bold">{`{website}`}</code> with the exact website URL (e.g. <span className="font-mono underline">https://stripe.com</span>) of each recipient!
            </div>
          </div>
        </div>

      </div>

      {/* Recipient List Manager (Editable Table) */}
      <div className="p-6 rounded-2xl glass-card border border-white/10 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-400" />
              <span>Extracted Primary Email Recipients ({recipients.length})</span>
            </h3>
            <p className="text-xs text-gray-400">
              Edit recipient email addresses & website URLs directly inline, or add custom recipients below.
            </p>
          </div>

          {/* Quick Add Custom Email & Website */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              placeholder="Email address (required)"
              value={newEmailInput}
              onChange={(e) => setNewEmailInput(e.target.value)}
              className="px-3 py-1.5 glass-input text-xs text-white rounded-lg w-44 font-mono"
            />
            <input
              type="text"
              placeholder="Website URL (e.g. https://site.com)"
              value={newWebsiteInput}
              onChange={(e) => setNewWebsiteInput(e.target.value)}
              className="px-3 py-1.5 glass-input text-xs text-white rounded-lg w-52 font-mono"
            />
            <input
              type="text"
              placeholder="Company name"
              value={newCompanyInput}
              onChange={(e) => setNewCompanyInput(e.target.value)}
              className="px-3 py-1.5 glass-input text-xs text-white rounded-lg w-32 font-sans hidden xl:block"
            />
            <button
              onClick={handleAddCustomRecipient}
              className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-xs rounded-lg flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Recipient</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-white/10 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#090d18] text-[11px] font-bold text-gray-400 uppercase tracking-wider font-display border-b border-white/10">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={recipients.length > 0 && recipients.every((r) => r.isSelected)}
                    onChange={toggleSelectAll}
                    className="rounded bg-gray-900 border-gray-700 text-cyan-500 focus:ring-cyan-500/20"
                  />
                </th>
                <th className="py-3 px-3">Company Name</th>
                <th className="py-3 px-3">Scraped Website URL ({`{website}`})</th>
                <th className="py-3 px-3">Editable Primary Email Address ({`{email}`})</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    No primary working email recipients extracted for this job yet.
                  </td>
                </tr>
              ) : (
                recipients.map((rec) => (
                  <tr key={rec.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={rec.isSelected}
                        onChange={() => toggleSelectRecipient(rec.id)}
                        className="rounded bg-gray-900 border-gray-700 text-cyan-500 focus:ring-cyan-500/20"
                      />
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">
                      {rec.company_name}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <input
                          type="text"
                          value={rec.website_url}
                          onChange={(e) => handleUpdateWebsite(rec.id, e.target.value)}
                          className="w-52 px-2.5 py-1 glass-input text-xs font-mono text-cyan-300 rounded-lg focus:border-cyan-500"
                        />
                        <a
                          href={rec.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-cyan-400"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 max-w-sm">
                        <Edit3 className="w-3 h-3 text-purple-400 flex-shrink-0" />
                        <input
                          type="email"
                          value={rec.email}
                          onChange={(e) => handleUpdateEmail(rec.id, e.target.value)}
                          className="w-full px-2.5 py-1 glass-input text-xs font-mono text-purple-200 rounded-lg focus:border-purple-500"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {rec.status === 'sent' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Sent ({rec.sentAt})
                        </span>
                      )}
                      {rec.status === 'sending' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Dispatching...
                        </span>
                      )}
                      {rec.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/30">
                          <XCircle className="w-3 h-3" /> Failed
                        </span>
                      )}
                      {rec.status === 'pending' && (
                        <span className="text-gray-400 text-xs font-mono">Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleDeleteRecipient(rec.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-400 transition-colors"
                        title="Remove recipient"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Campaign Terminal Console Log */}
      <div className="p-5 rounded-2xl bg-[#060a14] border border-white/10 font-mono text-xs space-y-3 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <span className="font-bold text-cyan-400 flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Live Dispatcher Campaign Logs</span>
          </span>
          <span className="text-[10px] text-gray-500">Auto-scrolling stream</span>
        </div>

        <div className="h-44 overflow-y-auto space-y-1.5 text-gray-300 pr-2">
          {logs.length === 0 ? (
            <p className="text-gray-500 italic">Ready to start email campaign dispatch...</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="leading-relaxed">
                {log}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

    </div>
  );
}
