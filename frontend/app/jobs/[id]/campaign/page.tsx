'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Send, Play, Pause, RefreshCw, CheckCircle2, XCircle, Clock,
  Trash2, Plus, Edit3, Sparkles, Mail, ShieldAlert, FileText, Check, AlertCircle,
  ExternalLink, Globe, Key, Settings, CheckCircle, Flame, Eye, Save, X, RotateCcw,
  ChevronLeft, ChevronRight, Copy, Users, Search, Filter, CheckSquare, Square,
  Layers, Sliders, Terminal, ShieldCheck, HelpCircle, EyeOff, LayoutGrid, ListFilter
} from 'lucide-react';
import {
  getJobProgress,
  getJobResults,
  sendCampaignEmail,
  generateAIEmail,
  getGeminiKeysStatus,
  addGeminiKeys,
  testGeminiKey,
  updateResultAIEmail
} from '@/lib/api';
import { JobProgress, WebsiteResult, GeminiPoolStatus } from '@/types';
import GeminiKeyManagerModal from '@/components/GeminiKeyManagerModal';

export interface AssociatedWebsite {
  result_id?: string;
  website_url: string;
  domain: string;
  company_name: string;
}

interface CampaignRecipient {
  id: string;
  result_id?: string;
  result_ids?: string[];
  email: string;
  website_url: string;
  domain: string;
  company_name: string;
  websites?: AssociatedWebsite[];
  isSelected: boolean;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  error?: string;
  sentAt?: string;
  // AI Email fields
  ai_subject?: string;
  ai_body?: string;
  ai_prompt?: string;
  isAiGenerating?: boolean;
  useAiDraft?: boolean;
}

type TabType = 'recipients' | 'ai_studio' | 'smtp_config' | 'dispatch_console' | 'all';
type RecipientFilterType = 'all' | 'selected' | 'ai_ready' | 'pending' | 'sent' | 'failed';

export default function EmailCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  // Pipeline Navigation State
  const [activeTab, setActiveTab] = useState<TabType>('recipients');

  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);

  // Filtering & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RecipientFilterType>('all');

  // Custom Recipient Manual Add State
  const [newEmailInput, setNewEmailInput] = useState('');
  const [newCompanyInput, setNewCompanyInput] = useState('');
  const [newWebsiteInput, setNewWebsiteInput] = useState('');

  // Fallback Campaign Template State
  const [subject, setSubject] = useState('Exclusive Partnership Inquiry for {company_name}');
  const [body, setBody] = useState(
    `Hello {company_name} Team,\n\nI am reaching out regarding your website at {website}.\n\nWe noticed your platform and would love to discuss a potential collaboration with {company_name}.\n\nWould you be open to a quick 5-minute call this week?\n\nBest regards,\nOutreach Manager`
  );

  // Gemini AI Email Generator State
  const GEMINI_MODELS = [
    {
      id: 'gemini-3.8-flash',
      name: 'Gemini 3.8 Flash',
      badge: 'Recommended',
      useCase: 'Coding, chatbots, reasoning, and AI agents'
    },
    {
      id: 'gemini-3.6-flash',
      name: 'Gemini 3.6 Flash',
      badge: 'Multimodal',
      useCase: 'General-purpose tasks and multimodal applications'
    },
    {
      id: 'gemini-3.5-flash-lite',
      name: 'Gemini 3.5 Flash Lite',
      badge: 'High-Volume',
      useCase: 'Fast, cost-efficient, high-volume requests'
    },
    {
      id: 'gemini-4-argon',
      name: 'Gemini 4 Argon',
      badge: 'Deep Reasoning',
      useCase: 'Complex coding, mathematics, and advanced reasoning'
    }
  ];

  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [aiInstruction, setAiInstruction] = useState<string>(
    'Visit all websites and invite that website host to host platform. Highlight our 99.99% uptime, ultra-low latency, and free migration assistance.'
  );
  const [isBatchAiGenerating, setIsBatchAiGenerating] = useState<boolean>(false);
  const [aiProgressText, setAiProgressText] = useState<string>('');
  const abortAiGenerationRef = useRef<boolean>(false);

  // Gemini Key Rotator State & Modal
  const [showKeysModal, setShowKeysModal] = useState<boolean>(false);
  const [customKeyInput, setCustomKeyInput] = useState<string>('');
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [geminiPoolStatus, setGeminiPoolStatus] = useState<GeminiPoolStatus | null>(null);

  // Recipient AI Draft View / Edit Modal & Box State
  const [editingRecipient, setEditingRecipient] = useState<CampaignRecipient | null>(null);
  const [editAiSubject, setEditAiSubject] = useState<string>('');
  const [editAiBody, setEditAiBody] = useState<string>('');
  const [isSingleRegenerating, setIsSingleRegenerating] = useState<boolean>(false);

  // Dedicated AI Response Email Box State
  const [previewLeadId, setPreviewLeadId] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopyText = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Real SMTP Email Server Credentials
  const [smtpHost, setSmtpHost] = useState<string>('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [smtpUser, setSmtpUser] = useState<string>('');
  const [smtpPassword, setSmtpPassword] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('WebContact Outreach');
  const [senderEmail, setSenderEmail] = useState<string>('');
  const [showSmtpPassword, setShowSmtpPassword] = useState<boolean>(false);

  // Test Email Verification State
  const [testEmailAddress, setTestEmailAddress] = useState<string>('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState<boolean>(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);

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

  // Load Saved SMTP Config from LocalStorage
  useEffect(() => {
    try {
      const storedSmtp = localStorage.getItem('reachbot_smtp_config');
      if (storedSmtp) {
        const parsed = JSON.parse(storedSmtp);
        if (parsed.smtpHost) setSmtpHost(parsed.smtpHost);
        if (parsed.smtpPort) setSmtpPort(parsed.smtpPort);
        if (parsed.smtpUser) {
          setSmtpUser(parsed.smtpUser);
          if (!testEmailAddress) setTestEmailAddress(parsed.smtpUser);
        }
        if (parsed.smtpPassword) setSmtpPassword(parsed.smtpPassword);
        if (parsed.senderName) setSenderName(parsed.senderName);
        if (parsed.senderEmail) setSenderEmail(parsed.senderEmail);
      }
    } catch (e) {
      console.warn('Failed to load stored SMTP config:', e);
    }
  }, []);

  // Save SMTP Config to LocalStorage whenever it updates
  const saveSmtpToStorage = (updates: Partial<{
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    senderName: string;
    senderEmail: string;
  }>) => {
    try {
      const current = {
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword,
        senderName,
        senderEmail,
        ...updates
      };
      localStorage.setItem('reachbot_smtp_config', JSON.stringify(current));
    } catch (e) {
      console.warn('Failed to persist SMTP config:', e);
    }
  };

  // Load Gemini Keys from localStorage and Backend Key Rotator Status
  const refreshKeyStatus = async () => {
    try {
      const status = await getGeminiKeysStatus();
      setGeminiPoolStatus(status);
    } catch (e) {
      console.warn('Could not fetch Gemini key status:', e);
    }
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('reachbot_gemini_keys');
      if (stored) {
        const keysArr = JSON.parse(stored);
        if (Array.isArray(keysArr) && keysArr.length > 0) {
          setSavedKeys(keysArr);
          setCustomKeyInput(keysArr.join('\n'));
          addGeminiKeys(keysArr).catch(() => { });
        }
      }
    } catch (e) {
      console.warn('Local storage keys error:', e);
    }

    refreshKeyStatus();
  }, []);

  // Quick SMTP Server Presets
  const applySmtpPreset = (provider: 'gmail' | 'outlook' | 'mailtrap') => {
    let newHost = smtpHost;
    let newPort = smtpPort;
    if (provider === 'gmail') {
      newHost = 'smtp.gmail.com';
      newPort = 587;
    } else if (provider === 'outlook') {
      newHost = 'smtp.office365.com';
      newPort = 587;
    } else if (provider === 'mailtrap') {
      newHost = 'sandbox.smtp.mailtrap.io';
      newPort = 2525;
    }
    setSmtpHost(newHost);
    setSmtpPort(newPort);
    saveSmtpToStorage({ smtpHost: newHost, smtpPort: newPort });
    addLog(`Configured SMTP preset: ${provider.toUpperCase()} (${newHost}:${newPort})`);
  };

  // Quick AI Prompt Presets
  const applyPromptPreset = (preset: string) => {
    if (preset === 'host') {
      setAiInstruction(
        'Visit this website and invite that website host to host their platform with us. Highlight our 99.99% uptime, ultra-low latency, 24/7 dedicated migration assistance, and special welcome credits.'
      );
    } else if (preset === 'partner') {
      setAiInstruction(
        'Explore this website and craft an authentic B2B strategic partnership and collaboration pitch tailored to their core services.'
      );
    } else if (preset === 'audit') {
      setAiInstruction(
        'Review this website and offer a complimentary performance, security, and SEO audit with actionable optimization findings.'
      );
    } else if (preset === 'pitch') {
      setAiInstruction(
        'Write a persuasive B2B cold outreach pitch introducing our software platform and asking for a short 5-minute exploratory chat this week.'
      );
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

        const data = await getJobResults(jobId, 1, 2000, '', 'all', false, false, false);
        const recipientMap = new Map<string, CampaignRecipient>();

        data.items.forEach((item, index) => {
          const primaryEmail = item.primary_email ||
            (item.personal_emails && item.personal_emails.length > 0 ? item.personal_emails[0] : null) ||
            (item.business_emails && item.business_emails.length > 0 ? item.business_emails[0] : null) ||
            (item.emails && item.emails.length > 0 ? item.emails[0] : null);

          if (!primaryEmail || !primaryEmail.trim()) return;

          const cleanEmail = primaryEmail.trim();
          const emailKey = cleanEmail.toLowerCase();

          const rawWebsite = item.website_url || '';
          const websiteUrl = rawWebsite.startsWith('http') ? rawWebsite : `https://${rawWebsite}`;
          const domain = rawWebsite.replace(/^https?:\/\//i, '').split('/')[0] || rawWebsite;
          const companyName = item.company_name || domain;

          const currentSite: AssociatedWebsite = {
            result_id: item.id,
            website_url: websiteUrl,
            domain: domain,
            company_name: companyName,
          };

          if (recipientMap.has(emailKey)) {
            const existing = recipientMap.get(emailKey)!;
            const alreadyHasSite = existing.websites?.some(w => w.website_url.toLowerCase() === websiteUrl.toLowerCase());
            if (!alreadyHasSite) {
              existing.websites = [...(existing.websites || []), currentSite];
            }
            if (item.id && !existing.result_ids?.includes(item.id)) {
              existing.result_ids = [...(existing.result_ids || []), item.id];
            }
            if (!existing.ai_body && item.ai_email_body) {
              existing.ai_subject = item.ai_email_subject || undefined;
              existing.ai_body = item.ai_email_body || undefined;
              existing.ai_prompt = item.ai_email_prompt || undefined;
              existing.useAiDraft = true;
            }
          } else {
            recipientMap.set(emailKey, {
              id: `rec_${index}_${Date.now()}`,
              result_id: item.id,
              result_ids: item.id ? [item.id] : [],
              email: cleanEmail,
              website_url: websiteUrl,
              domain: domain,
              company_name: companyName,
              websites: [currentSite],
              isSelected: true,
              status: 'pending',
              ai_subject: item.ai_email_subject || undefined,
              ai_body: item.ai_email_body || undefined,
              ai_prompt: item.ai_email_prompt || undefined,
              useAiDraft: Boolean(item.ai_email_body?.trim() || item.ai_email_subject?.trim())
            });
          }
        });

        const recipientList = Array.from(recipientMap.values());
        setRecipients(recipientList);
        const multiSiteCount = recipientList.filter(r => (r.websites?.length || 1) > 1).length;
        const aiDraftCount = recipientList.filter(r => Boolean(r.ai_body?.trim() || r.ai_subject?.trim())).length;
        const firstWithAi = recipientList.find(r => Boolean(r.ai_body?.trim() || r.ai_subject?.trim()));
        if (firstWithAi) {
          setPreviewLeadId(firstWithAi.id);
        } else if (recipientList.length > 0) {
          setPreviewLeadId(recipientList[0].id);
        }
        addLog(`Loaded ${recipientList.length} unique primary leads (${data.items.length} total websites, ${multiSiteCount} multi-site owners, ${aiDraftCount} AI drafts ready).`);
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

  const selectAll = () => setRecipients(prev => prev.map(r => ({ ...r, isSelected: true })));
  const deselectAll = () => setRecipients(prev => prev.map(r => ({ ...r, isSelected: false })));
  const selectOnlyAiReady = () => setRecipients(prev => prev.map(r => ({ ...r, isSelected: Boolean(r.ai_body?.trim() || r.ai_subject?.trim()) })));
  const invertSelection = () => setRecipients(prev => prev.map(r => ({ ...r, isSelected: !r.isSelected })));

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

  // Add Custom Recipient
  const handleAddCustomRecipient = () => {
    if (!newEmailInput.trim()) {
      alert('Please enter a recipient email address.');
      return;
    }
    const cleanEmail = newEmailInput.trim();
    const rawWebsite = newWebsiteInput.trim() || 'manual-entry.com';
    const websiteUrl = rawWebsite.startsWith('http') ? rawWebsite : `https://${rawWebsite}`;
    const domain = rawWebsite.replace(/^https?:\/\//i, '').split('/')[0];
    const company = newCompanyInput.trim() || domain;

    const newRec: CampaignRecipient = {
      id: `custom_${Date.now()}`,
      email: cleanEmail,
      website_url: websiteUrl,
      domain: domain,
      company_name: company,
      websites: [{
        website_url: websiteUrl,
        domain: domain,
        company_name: company,
      }],
      isSelected: true,
      status: 'pending',
    };

    setRecipients((prev) => [newRec, ...prev]);
    setNewEmailInput('');
    setNewCompanyInput('');
    setNewWebsiteInput('');
    addLog(`Added manual lead: ${cleanEmail} (${domain})`);
  };

  // Filtered Recipients for Search & Status
  const filteredRecipients = useMemo(() => {
    return recipients.filter((rec) => {
      // 1. Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesEmail = rec.email.toLowerCase().includes(q);
        const matchesDomain = rec.domain.toLowerCase().includes(q);
        const matchesCompany = rec.company_name.toLowerCase().includes(q);
        const matchesWebsites = rec.websites?.some(w => w.domain.toLowerCase().includes(q) || w.website_url.toLowerCase().includes(q));
        if (!matchesEmail && !matchesDomain && !matchesCompany && !matchesWebsites) {
          return false;
        }
      }
      // 2. Status Filter
      if (statusFilter === 'selected') return rec.isSelected;
      if (statusFilter === 'ai_ready') return Boolean(rec.ai_body?.trim() || rec.ai_subject?.trim());
      if (statusFilter === 'pending') return rec.status === 'pending';
      if (statusFilter === 'sent') return rec.status === 'sent';
      if (statusFilter === 'failed') return rec.status === 'failed';
      return true;
    });
  }, [recipients, searchQuery, statusFilter]);

  // Stop AI Generation requested by user
  const handleStopAiGeneration = () => {
    abortAiGenerationRef.current = true;
    addLog(`⏹️ Stopping AI Generation... Waiting for current lead to complete and saving all progress.`);
  };

  // Reset All AI Pitches to empty (revert to default template)
  const handleResetAllAiPitches = async () => {
    const readyCount = recipients.filter(r => Boolean(r.ai_body?.trim() || r.ai_subject?.trim() || r.useAiDraft)).length;
    if (readyCount === 0) {
      alert('All leads are already empty or using default template. There are no AI generated pitches to reset.');
      return;
    }

    const confirmReset = window.confirm(
      `Are you sure you want to RESET all ${readyCount} AI generated email pitches?\n\nThis will clear all personalized subjects and message bodies, reverting all leads back to the default template fallback.`
    );
    if (!confirmReset) return;

    // Clear in local state
    setRecipients(prev => prev.map(r => ({
      ...r,
      ai_subject: '',
      ai_body: '',
      ai_prompt: '',
      useAiDraft: false,
      isAiGenerating: false
    })));

    // Clear editing modal if open
    if (editingRecipient) {
      setEditingRecipient(prev => prev ? {
        ...prev,
        ai_subject: '',
        ai_body: '',
        ai_prompt: '',
        useAiDraft: false
      } : null);
      setEditAiSubject('');
      setEditAiBody('');
    }

    // Persist clearance to backend if jobId is present
    if (jobId) {
      try {
        const allResultIds = recipients.flatMap(r => 
          r.result_ids && r.result_ids.length > 0 
            ? r.result_ids 
            : (r.result_id ? [r.result_id] : [])
        );
        if (allResultIds.length > 0) {
          await Promise.all(allResultIds.map(rid => updateResultAIEmail(jobId, rid, '', '')));
        }
      } catch (e) {
        console.warn('Could not reset drafts in DB:', e);
      }
    }

    addLog(`🧹 Reset all AI drafts! Cleared ${readyCount} email pitches. All recipients reverted to empty default template.`);
  };

  // Reset Single AI Pitch for one specific lead
  const handleResetSingleAiPitch = async (recipientId: string) => {
    const rec = recipients.find(r => r.id === recipientId);
    if (!rec) return;

    const confirmReset = window.confirm(
      `Reset AI pitch for "${rec.company_name || rec.domain}"?\n\nThis will clear the personalized AI response for this lead and revert it to the default template fallback.`
    );
    if (!confirmReset) return;

    // 1. Immediately update recipient in local state
    setRecipients(prev => prev.map(r => r.id === recipientId ? {
      ...r,
      ai_subject: '',
      ai_body: '',
      ai_prompt: '',
      useAiDraft: false,
      isAiGenerating: false
    } : r));

    // 2. If editing modal is open for this recipient, close it
    if (editingRecipient && editingRecipient.id === recipientId) {
      setEditingRecipient(null);
    }

    // 3. Persist clearance to backend database
    const targetIds = rec.result_ids && rec.result_ids.length > 0
      ? rec.result_ids
      : (rec.result_id ? [rec.result_id] : []);

    if (targetIds.length > 0 && jobId) {
      try {
        await Promise.all(targetIds.map(rid => updateResultAIEmail(jobId, rid, '', '')));
      } catch (e) {
        console.warn('Could not reset single lead draft in DB:', e);
      }
    }

    addLog(`🧹 Reset AI pitch for ${rec.email} (${rec.domain}). Reverted to default template.`);
  };

  // AI Email Generator: Batch Generation with Rotator & Resume Support
  const handleGenerateAllAiEmails = async (onlyMissing: boolean = true) => {
    const selected = recipients.filter(r => r.isSelected);
    if (selected.length === 0) {
      alert('Please select at least one recipient lead to generate AI emails.');
      return;
    }

    // Filter to only leads that do not have an AI pitch yet if onlyMissing is true
    const targets = onlyMissing 
      ? selected.filter(r => !r.ai_body?.trim() && !r.ai_subject?.trim())
      : selected;

    if (targets.length === 0) {
      const overwrite = window.confirm(`All ${selected.length} selected leads already have personalized AI pitches generated!\n\nDo you want to re-generate them all from scratch with the current prompt?`);
      if (!overwrite) return;
      return handleGenerateAllAiEmails(false);
    }

    abortAiGenerationRef.current = false;
    setIsBatchAiGenerating(true);
    setAiProgressText(`Starting Gemini rotator for ${targets.length} leads...`);
    addLog(`🚀 Starting AI Email Generator for ${targets.length} leads (${onlyMissing ? 'starting from ungenerated leads' : 'all selected'}) using ${selectedModel}...`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targets.length; i++) {
      if (abortAiGenerationRef.current) {
        addLog(`⏸️ AI Generation stopped by user. Progress saved (${successCount} generated, ${targets.length - i} remaining).`);
        break;
      }

      const rec = targets[i];
      setAiProgressText(`Generating (${i + 1}/${targets.length}): ${rec.domain}...`);

      setRecipients(prev => prev.map(r => r.id === rec.id ? { ...r, isAiGenerating: true } : r));

      try {
        const allSites = rec.websites && rec.websites.length > 0
          ? rec.websites.map(w => w.website_url)
          : [rec.website_url];
        const allCompanies = rec.websites && rec.websites.length > 0
          ? rec.websites.map(w => w.company_name)
          : [rec.company_name];
        const resultIds = rec.result_ids && rec.result_ids.length > 0
          ? rec.result_ids
          : (rec.result_id ? [rec.result_id] : undefined);

        const aiResponse = await generateAIEmail({
          user_instruction: aiInstruction,
          website_url: rec.website_url,
          websites: allSites.length > 1 ? allSites : undefined,
          company_name: rec.company_name,
          companies: allCompanies.length > 1 ? allCompanies : undefined,
          recipient_email: rec.email,
          gemini_api_keys: savedKeys.length > 0 ? savedKeys : undefined,
          model: selectedModel,
          result_id: rec.result_id,
          result_ids: resultIds
        });

        setRecipients(prev => prev.map(r => r.id === rec.id ? {
          ...r,
          isAiGenerating: false,
          ai_subject: aiResponse.subject,
          ai_body: aiResponse.body,
          ai_prompt: aiInstruction,
          useAiDraft: true
        } : r));

        setPreviewLeadId(rec.id);
        successCount++;
        addLog(`🟢 [AI ${i + 1}/${targets.length}] Generated personalized pitch for ${rec.domain}${allSites.length > 1 ? ` (${allSites.length} websites)` : ''} using key ${aiResponse.key_used}.`);
      } catch (err: any) {
        failCount++;
        setRecipients(prev => prev.map(r => r.id === rec.id ? { ...r, isAiGenerating: false } : r));
        addLog(`❌ [AI ${i + 1}/${targets.length}] Failed for ${rec.domain}: ${err.message}`);
      }

      if (abortAiGenerationRef.current) {
        addLog(`⏸️ AI Generation stopped by user. Progress saved (${successCount} generated).`);
        break;
      }

      await new Promise(r => setTimeout(r, 400));
    }

    setIsBatchAiGenerating(false);
    setAiProgressText('');
    refreshKeyStatus();
    if (!abortAiGenerationRef.current) {
      addLog(`🎉 AI Generator completed! Successfully generated ${successCount} tailored emails (${failCount} failed).`);
    }
  };

  // Single Lead Regeneration
  const handleRegenerateSingleAiEmail = async () => {
    if (!editingRecipient) return;
    setIsSingleRegenerating(true);
    try {
      const allSites = editingRecipient.websites && editingRecipient.websites.length > 0
        ? editingRecipient.websites.map(w => w.website_url)
        : [editingRecipient.website_url];
      const allCompanies = editingRecipient.websites && editingRecipient.websites.length > 0
        ? editingRecipient.websites.map(w => w.company_name)
        : [editingRecipient.company_name];
      const resultIds = editingRecipient.result_ids && editingRecipient.result_ids.length > 0
        ? editingRecipient.result_ids
        : (editingRecipient.result_id ? [editingRecipient.result_id] : undefined);

      const aiResponse = await generateAIEmail({
        user_instruction: aiInstruction,
        website_url: editingRecipient.website_url,
        websites: allSites.length > 1 ? allSites : undefined,
        company_name: editingRecipient.company_name,
        companies: allCompanies.length > 1 ? allCompanies : undefined,
        recipient_email: editingRecipient.email,
        gemini_api_keys: savedKeys.length > 0 ? savedKeys : undefined,
        model: selectedModel,
        result_id: editingRecipient.result_id,
        result_ids: resultIds
      });

      setEditAiSubject(aiResponse.subject);
      setEditAiBody(aiResponse.body);

      setRecipients(prev => prev.map(r => r.id === editingRecipient.id ? {
        ...r,
        ai_subject: aiResponse.subject,
        ai_body: aiResponse.body,
        ai_prompt: aiInstruction,
        useAiDraft: true
      } : r));

      setEditingRecipient(prev => prev ? {
        ...prev,
        ai_subject: aiResponse.subject,
        ai_body: aiResponse.body,
        useAiDraft: true
      } : null);

      addLog(`✨ Regenerated custom AI pitch for ${editingRecipient.domain} using key ${aiResponse.key_used}.`);
      refreshKeyStatus();
    } catch (err: any) {
      alert(`AI generation error: ${err.message}`);
    } finally {
      setIsSingleRegenerating(false);
    }
  };

  // Save manual edit of AI Draft
  const handleSaveEditedDraft = async () => {
    if (!editingRecipient) return;

    setRecipients(prev => prev.map(r => r.id === editingRecipient.id ? {
      ...r,
      ai_subject: editAiSubject,
      ai_body: editAiBody,
      useAiDraft: true
    } : r));

    const targetIds = editingRecipient.result_ids && editingRecipient.result_ids.length > 0
      ? editingRecipient.result_ids
      : (editingRecipient.result_id ? [editingRecipient.result_id] : []);

    if (targetIds.length > 0 && jobId) {
      try {
        await Promise.all(targetIds.map(rid => updateResultAIEmail(jobId, rid, editAiSubject, editAiBody)));
      } catch (e) {
        console.warn('Could not persist edited draft to DB:', e);
      }
    }

    addLog(`Updated AI draft for ${editingRecipient.email}.`);
    setEditingRecipient(null);
  };

  // Open modal for editing recipient
  const handleOpenEditModal = (rec: CampaignRecipient) => {
    setEditingRecipient(rec);
    const allWebsites = rec.websites && rec.websites.length > 0
      ? rec.websites.map(w => w.website_url).join(' and ')
      : rec.website_url;
    const allCompanies = rec.websites && rec.websites.length > 0
      ? rec.websites.map(w => w.company_name).filter(Boolean).join(' & ')
      : rec.company_name;

    setEditAiSubject(rec.ai_subject || subject.replace(/{company_name}/g, allCompanies).replace(/{website}/g, allWebsites));
    setEditAiBody(rec.ai_body || body.replace(/{company_name}/g, allCompanies).replace(/{website}/g, allWebsites));
  };

  // Switch to AI studio and select lead
  const handleInspectLeadInStudio = (leadId: string) => {
    setPreviewLeadId(leadId);
    setActiveTab('ai_studio');
  };

  // Send Test Email Verification
  const handleSendTestEmail = async () => {
    const targetEmail = testEmailAddress.trim() || smtpUser.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      alert('Please enter a valid recipient email address to receive the test email.');
      return;
    }
    if (!smtpHost.trim() || !smtpUser.trim() || !smtpPassword.trim()) {
      alert('Please fill in your SMTP Host, Username, and Password first.');
      return;
    }

    setIsSendingTestEmail(true);
    setTestEmailResult(null);
    addLog(`🧪 Testing SMTP delivery (${smtpHost}:${smtpPort}) to ${targetEmail}...`);

    try {
      await sendCampaignEmail({
        recipient_email: targetEmail,
        subject: `[ReachBot Verification] SMTP Delivery Test`,
        body: `Hello!\n\nThis is a verified test email from ReachBot AI Scraper.\n\nYour SMTP server connection (${smtpHost}:${smtpPort}) is ACTIVE and authenticated!\n\nSender Name: ${senderName}\nSender Email: ${senderEmail || smtpUser}\nTimestamp: ${new Date().toLocaleString()}`,
        company_name: 'ReachBot Test Platform',
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_password: smtpPassword,
        sender_name: senderName,
        sender_email: senderEmail || smtpUser,
      });

      setTestEmailResult({ success: true, message: `Delivered successfully to ${targetEmail}!` });
      addLog(`🟢 Verified! Test email delivered via SMTP to ${targetEmail}.`);
    } catch (err: any) {
      const msg = err.message || 'SMTP Authentication / Connection Error';
      setTestEmailResult({ success: false, message: msg });
      addLog(`❌ Test email failed: ${msg}`);
    } finally {
      setIsSendingTestEmail(false);
    }
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
      setActiveTab('smtp_config');
      return;
    }

    setIsCampaignRunning(true);
    setActiveTab('dispatch_console');
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

    setRecipients((prev) =>
      prev.map((r) => (r.id === currentRec.id ? { ...r, status: 'sending' } : r))
    );

    const allWebsites = currentRec.websites && currentRec.websites.length > 0
      ? currentRec.websites.map(w => w.website_url)
      : [currentRec.website_url];
    const allDomains = currentRec.websites && currentRec.websites.length > 0
      ? currentRec.websites.map(w => w.domain)
      : [currentRec.domain];
    const allCompanies = currentRec.websites && currentRec.websites.length > 0
      ? currentRec.websites.map(w => w.company_name).filter(Boolean)
      : [currentRec.company_name];

    const websitesJoined = allWebsites.join(' and ');
    const domainsJoined = allDomains.join(' and ');
    const companiesJoined = allCompanies.join(' & ');

    let formattedSubject: string;
    let formattedBody: string;

    if (currentRec.useAiDraft && currentRec.ai_subject && currentRec.ai_body) {
      formattedSubject = currentRec.ai_subject;
      formattedBody = currentRec.ai_body;
      addLog(`✉️ [${index + 1}/${activeList.length}] Using AI pitch for ${currentRec.email} (${domainsJoined})...`);
    } else {
      formattedSubject = subject
        .replace(/{company_name}/g, companiesJoined)
        .replace(/{companies}/g, companiesJoined)
        .replace(/{domain}/g, domainsJoined)
        .replace(/{domains}/g, domainsJoined)
        .replace(/{website}/g, websitesJoined)
        .replace(/{websites}/g, websitesJoined)
        .replace(/{website_url}/g, websitesJoined)
        .replace(/{email}/g, currentRec.email);

      formattedBody = body
        .replace(/{company_name}/g, companiesJoined)
        .replace(/{companies}/g, companiesJoined)
        .replace(/{domain}/g, domainsJoined)
        .replace(/{domains}/g, domainsJoined)
        .replace(/{website}/g, websitesJoined)
        .replace(/{websites}/g, websitesJoined)
        .replace(/{website_url}/g, websitesJoined)
        .replace(/{email}/g, currentRec.email);
    }

    addLog(`✉️ [${index + 1}/${activeList.length}] Connecting to SMTP ${smtpHost}... Sending to ${currentRec.email}...`);

    try {
      await sendCampaignEmail({
        recipient_email: currentRec.email,
        subject: formattedSubject,
        body: formattedBody,
        company_name: companiesJoined || currentRec.company_name,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_password: smtpPassword,
        sender_name: senderName,
        sender_email: senderEmail || smtpUser,
      });

      setRecipients((prev) =>
        prev.map((r) =>
          r.id === currentRec.id
            ? { ...r, status: 'sent', sentAt: new Date().toLocaleTimeString() }
            : r
        )
      );
      addLog(`🟢 [${index + 1}/${activeList.length}] SUCCESS! Delivered single consolidated outreach to ${currentRec.email} for ${allWebsites.length} website(s) (${domainsJoined}).`);
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
  const aiReadyCount = recipients.filter((r) => Boolean(r.ai_body?.trim() || r.ai_subject?.trim())).length;
  const selectedUngeneratedCount = selectedRecipients.filter(r => !r.ai_body?.trim() && !r.ai_subject?.trim()).length;
  const totalUngeneratedCount = recipients.filter(r => !r.ai_body?.trim() && !r.ai_subject?.trim()).length;
  const multiSiteCount = recipients.filter((r) => (r.websites?.length || 1) > 1).length;
  const totalWebsitesCovered = recipients.reduce((acc, r) => acc + (r.websites?.length || 1), 0);
  const activeKeysCount = geminiPoolStatus?.active_keys ?? (savedKeys.length > 0 ? savedKeys.length : 0);
  const isSmtpConfigured = Boolean(smtpHost.trim() && smtpUser.trim() && smtpPassword.trim());

  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-4">
        <RefreshCw className="w-8 h-8 text-firebase-400 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-gray-300">Loading Structured Outreach Campaign...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 py-1">

      {/* ------------------------------------------------------------- */}
      {/* 1. MASTER CAMPAIGN HEADER & PERSISTENT CONTROLLER             */}
      {/* ------------------------------------------------------------- */}
      <div className="p-3 sm:p-3.5 rounded-xl bg-matte-850 border border-matte-700/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/jobs/${jobId}`)}
            className="p-2 rounded-lg bg-matte-900 border border-matte-700 text-gray-400 hover:text-white transition-colors"
            title="Back to Results"
          >
            <ArrowLeft className="w-4 h-4 text-firebase-400" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-firebase-400" />
                <span>Outreach Pipeline Studio</span>
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-firebase-500/15 text-firebase-300 border border-firebase-500/30 rounded font-mono">
                {isCampaignRunning ? 'Live Sending' : 'Ready'}
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              {progress?.filename || jobId.slice(0, 8)} • <span className="text-white font-semibold">{recipients.length}</span> Primary Hosts • <span className="text-firebase-300 font-semibold">{totalWebsitesCovered}</span> Sites Covered
            </p>
          </div>
        </div>

        {/* Global Controls: Key Rotator & Launch/Pause */}
        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          <button
            onClick={() => setShowKeysModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${activeKeysCount > 0
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 shadow-sm'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
              }`}
            title="Manage Gemini AI Keys"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>{activeKeysCount > 0 ? `${activeKeysCount} Keys Active` : 'Configure Keys'}</span>
          </button>

          {isCampaignRunning ? (
            <button
              onClick={pauseCampaign}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-lg shadow-md transition-all animate-pulse"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause Sending</span>
            </button>
          ) : (
            <button
              onClick={startCampaign}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white firebase-btn-primary shadow-md transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch Outreach</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. STRUCTURED PIPELINE STEPPER / WORKFLOW TABS                */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-1.5 p-1.5 rounded-xl bg-matte-850 border border-matte-700/80 shadow-sm">
        {/* Horizontal Scrollable Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setActiveTab('recipients')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${activeTab === 'recipients'
                ? 'bg-firebase-600 text-white shadow-sm font-bold'
                : 'text-gray-400 hover:text-white hover:bg-matte-800'
              }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>1. Leads & Audience</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'recipients' ? 'bg-black/30 text-white' : 'bg-matte-900 text-gray-400'}`}>
              {selectedRecipients.length}/{recipients.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai_studio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${activeTab === 'ai_studio'
                ? 'bg-purple-600 text-white shadow-sm font-bold'
                : 'text-gray-400 hover:text-white hover:bg-matte-800'
              }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>2. AI Pitch Studio</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'ai_studio' ? 'bg-black/30 text-white' : 'bg-matte-900 text-gray-400'}`}>
              {aiReadyCount} Ready
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('smtp_config')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${activeTab === 'smtp_config'
                ? 'bg-emerald-600 text-white shadow-sm font-bold'
                : 'text-gray-400 hover:text-white hover:bg-matte-800'
              }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>3. Delivery & SMTP</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${isSmtpConfigured ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-amber-950/60 text-amber-300'}`}>
              {isSmtpConfigured ? '✓ Configured' : '! Setup'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dispatch_console')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${activeTab === 'dispatch_console'
                ? 'bg-blue-600 text-white shadow-sm font-bold'
                : 'text-gray-400 hover:text-white hover:bg-matte-800'
              }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>4. Live Dispatch & Logs</span>
            {isCampaignRunning && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            )}
          </button>
        </div>

        {/* View Mode Toggle: Single Stage vs All-in-One */}
        <div className="flex items-center flex-shrink-0 pl-1 border-l border-matte-700/80">
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'all' ? 'recipients' : 'all')}
            className={`p-1.5 sm:px-2 sm:py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${activeTab === 'all'
                ? 'bg-matte-750 text-white font-bold border border-matte-600'
                : 'text-gray-400 hover:text-white'
              }`}
            title="Toggle All-in-One view showing all 4 stages"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{activeTab === 'all' ? 'Show Tabs' : 'All Sections'}</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: RECIPIENTS & AUDIENCE MANAGER                          */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === 'recipients' || activeTab === 'all') && (
        <div className="p-3 sm:p-4 rounded-xl bg-matte-850 border border-matte-700/80 space-y-3.5 shadow-sm">
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-matte-700/80 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-firebase-400" />
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Lead Audience & Host Contacts
                </h3>
                {multiSiteCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-firebase-500/15 text-firebase-300 border border-firebase-500/30 font-semibold" title="Multiple websites owned by same email bundled into 1 consolidated outreach email">
                    {multiSiteCount} Multi-Site Hosts Deduplicated
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Review primary extracted recipients. Verify email addresses and select targets for dispatch.
              </p>
            </div>

            {/* Quick Add Custom Lead */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 w-full md:w-auto">
              <input
                type="email"
                placeholder="Email (required)"
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
                className="px-2.5 py-1.5 firebase-input text-xs text-white rounded-lg flex-1 sm:w-40 font-mono"
              />
              <input
                type="text"
                placeholder="Website URL"
                value={newWebsiteInput}
                onChange={(e) => setNewWebsiteInput(e.target.value)}
                className="px-2.5 py-1.5 firebase-input text-xs text-white rounded-lg flex-1 sm:w-44 font-mono"
              />
              <input
                type="text"
                placeholder="Company"
                value={newCompanyInput}
                onChange={(e) => setNewCompanyInput(e.target.value)}
                className="px-2.5 py-1.5 firebase-input text-xs text-white rounded-lg sm:w-28 font-sans"
              />
              <button
                onClick={handleAddCustomRecipient}
                className="firebase-btn-primary px-3 py-1.5 text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
                title="Add recipient"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Lead</span>
              </button>
            </div>
          </div>

          {/* Active AI Prompt Banner - Always Visible in Stage 1 */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-purple-950/40 via-matte-900 to-matte-950 border border-purple-500/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 flex-shrink-0 mt-0.5 sm:mt-0">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-purple-300">
                    Active AI Outreach Prompt ({selectedModel})
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-500/15 text-purple-300">
                    Will pitch {selectedRecipients.length} leads
                  </span>
                </div>
                <p className="text-xs text-gray-200 line-clamp-1 italic font-sans">
                  "{aiInstruction}"
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-auto flex-shrink-0">
              {isBatchAiGenerating ? (
                <button
                  type="button"
                  onClick={handleStopAiGeneration}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md animate-pulse transition-all"
                  title="Stop AI pitch generation"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop AI</span>
                </button>
              ) : (
                <>
                  {selectedUngeneratedCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleGenerateAllAiEmails(true)}
                      disabled={selectedRecipients.length === 0}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                      title="Generate pitches for leads that do not have one yet"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Missing ({selectedUngeneratedCount})</span>
                    </button>
                  ) : (
                    selectedRecipients.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleGenerateAllAiEmails(false)}
                        className="px-3 py-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                        title="Re-generate all selected leads from scratch"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Regen All ({selectedRecipients.length})</span>
                      </button>
                    )
                  )}

                  {aiReadyCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetAllAiPitches}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 font-semibold text-xs flex items-center gap-1 transition-all"
                      title="Reset all generated AI pitches to empty"
                    >
                      <RotateCcw className="w-3 h-3 text-rose-400" />
                      <span>Reset All AI ({aiReadyCount})</span>
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('ai_studio')}
                className="px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Customize Prompt</span>
              </button>
            </div>
          </div>

          {/* Search, Filter & Bulk Selection Action Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 p-2 rounded-lg bg-matte-900 border border-matte-750">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search leads by domain, company, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-matte-950 border border-matte-700 text-xs text-white rounded-lg focus:outline-none focus:border-firebase-500 font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1 flex-wrap text-xs">
              <span className="text-[10px] text-gray-400 font-mono mr-1">Filter:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${statusFilter === 'all'
                    ? 'bg-firebase-600 text-white font-bold'
                    : 'bg-matte-950 text-gray-400 hover:text-white border border-matte-700'
                  }`}
              >
                All ({recipients.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('selected')}
                className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${statusFilter === 'selected'
                    ? 'bg-firebase-600 text-white font-bold'
                    : 'bg-matte-950 text-gray-400 hover:text-white border border-matte-700'
                  }`}
              >
                Selected ({selectedRecipients.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ai_ready')}
                className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${statusFilter === 'ai_ready'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-matte-950 text-purple-300 hover:text-white border border-matte-700'
                  }`}
              >
                AI Ready ({aiReadyCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${statusFilter === 'pending'
                    ? 'bg-matte-700 text-white font-bold'
                    : 'bg-matte-950 text-gray-400 hover:text-white border border-matte-700'
                  }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('sent')}
                className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${statusFilter === 'sent'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-matte-950 text-emerald-400 hover:text-white border border-matte-700'
                  }`}
              >
                Sent ({sentCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('failed')}
                className={`px-2 py-0.5 rounded text-xs font-mono transition-all ${statusFilter === 'failed'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'bg-matte-950 text-rose-400 hover:text-white border border-matte-700'
                  }`}
              >
                Failed ({failedCount})
              </button>
            </div>

            {/* Quick Bulk Selection Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={selectAll}
                className="px-2 py-1 rounded bg-matte-950 border border-matte-700 text-[11px] text-gray-300 hover:text-white hover:border-matte-600"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="px-2 py-1 rounded bg-matte-950 border border-matte-700 text-[11px] text-gray-300 hover:text-white hover:border-matte-600"
              >
                Deselect All
              </button>
              <button
                type="button"
                onClick={selectOnlyAiReady}
                className="px-2 py-1 rounded bg-matte-950 border border-matte-700 text-[11px] text-purple-300 hover:text-white hover:border-purple-500"
              >
                Only AI Ready
              </button>
            </div>
          </div>

          {/* MOBILE & TABLET RECIPIENT CARDS (< md) */}
          <div className="md:hidden divide-y divide-matte-700/60 border border-matte-700/80 rounded-xl overflow-hidden">
            {filteredRecipients.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                No recipients match your search or filter criteria.
              </div>
            ) : (
              filteredRecipients.map((rec) => {
                const hasMultiSites = (rec.websites?.length || 1) > 1;
                return (
                  <div key={rec.id} className="p-3 bg-matte-900/60 space-y-2.5 mobile-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={rec.isSelected}
                          onChange={() => toggleSelectRecipient(rec.id)}
                          className="rounded bg-matte-950 border-matte-700 text-firebase-600 focus:ring-firebase-500/20 w-4 h-4 touch-target flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="font-bold text-white text-xs block truncate">{rec.company_name}</span>
                          {hasMultiSites ? (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-firebase-500/15 text-firebase-300 border border-firebase-500/30 inline-flex items-center gap-1 font-mono">
                              <Globe className="w-2.5 h-2.5 text-firebase-400" />
                              <span>{rec.websites?.length} sites bundled</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-mono block truncate">{rec.domain}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {rec.status === 'sent' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Sent
                          </span>
                        )}
                        {rec.status === 'sending' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-firebase-300 bg-firebase-950/40 px-2 py-0.5 rounded border border-firebase-500/30 font-mono">
                            <RefreshCw className="w-2.5 h-2.5 animate-spin text-firebase-400" /> Sending
                          </span>
                        )}
                        {rec.status === 'failed' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/30 font-mono">
                            <XCircle className="w-2.5 h-2.5" /> Failed
                          </span>
                        )}
                        {rec.status === 'pending' && (
                          <span className="text-gray-400 text-[10px] font-mono px-2 py-0.5 bg-matte-800 rounded border border-matte-700">Pending</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 w-12 flex-shrink-0 font-mono">Site:</span>
                        <input
                          type="text"
                          value={rec.website_url}
                          onChange={(e) => handleUpdateWebsite(rec.id, e.target.value)}
                          className="flex-1 px-2.5 py-1.5 firebase-input text-xs font-mono text-firebase-300 rounded-lg min-w-0"
                        />
                        <a
                          href={rec.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-firebase-400 p-1.5"
                          title="Open website"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400 w-12 flex-shrink-0 font-mono">Email:</span>
                        <input
                          type="email"
                          value={rec.email}
                          onChange={(e) => handleUpdateEmail(rec.id, e.target.value)}
                          className="flex-1 px-2.5 py-1.5 firebase-input text-xs font-mono text-purple-200 rounded-lg min-w-0"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-matte-800">
                      <div>
                        {rec.isAiGenerating ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-firebase-300 bg-firebase-950/40 px-2 py-1 rounded border border-firebase-500/30 animate-pulse font-mono">
                            <RefreshCw className="w-3 h-3 animate-spin text-firebase-400" /> Generating...
                          </span>
                        ) : rec.ai_body ? (
                          <button
                            type="button"
                            onClick={() => handleInspectLeadInStudio(rec.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-firebase-200 bg-firebase-500/20 hover:bg-firebase-500/30 px-2.5 py-1 rounded border border-firebase-500/30 transition-all font-mono"
                          >
                            <Sparkles className="w-3 h-3 text-firebase-400" />
                            <span>View AI Pitch</span>
                            <Eye className="w-3 h-3 ml-0.5 text-gray-400" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInspectLeadInStudio(rec.id)}
                            className="text-[11px] text-gray-400 hover:text-firebase-300 transition-colors flex items-center gap-1 font-mono py-1"
                          >
                            <span>Template Fallback</span>
                            <Edit3 className="w-3 h-3 text-gray-500" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(rec)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-matte-800 hover:bg-matte-700 transition-colors flex items-center justify-center"
                          title="Edit Draft"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {Boolean(rec.ai_body?.trim() || rec.ai_subject?.trim()) && (
                          <button
                            type="button"
                            onClick={() => handleResetSingleAiPitch(rec.id)}
                            className="p-1.5 rounded-lg text-rose-300 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 transition-colors flex items-center justify-center"
                            title="Reset AI pitch for this lead"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteRecipient(rec.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 bg-matte-800 hover:bg-rose-950/30 transition-colors flex items-center justify-center"
                          title="Remove Lead"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* DESKTOP TABLE (>= md) */}
          <div className="hidden md:block overflow-x-auto border border-matte-700/80 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-matte-900 text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono border-b border-matte-700/80">
                  <th className="py-2.5 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      checked={filteredRecipients.length > 0 && filteredRecipients.every((r) => r.isSelected)}
                      onChange={toggleSelectAll}
                      className="rounded bg-matte-950 border-matte-700 text-firebase-600 focus:ring-firebase-500/20"
                    />
                  </th>
                  <th className="py-2.5 px-3">Company / Host</th>
                  <th className="py-2.5 px-3">Target Website(s)</th>
                  <th className="py-2.5 px-3">Recipient Email</th>
                  <th className="py-2.5 px-3">AI Pitch Status</th>
                  <th className="py-2.5 px-3">Delivery Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-matte-800 font-sans">
                {filteredRecipients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 text-xs">
                      No recipients match your search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRecipients.map((rec) => {
                    const hasMultiSites = (rec.websites?.length || 1) > 1;
                    return (
                      <tr key={rec.id} className="hover:bg-matte-800/60 transition-colors">
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={rec.isSelected}
                            onChange={() => toggleSelectRecipient(rec.id)}
                            className="rounded bg-matte-950 border-matte-700 text-firebase-600 focus:ring-firebase-500/20"
                          />
                        </td>
                        <td className="py-2 px-3 font-semibold text-white">
                          <div className="space-y-0.5">
                            <span className="block truncate max-w-[170px]">{rec.company_name}</span>
                            {hasMultiSites ? (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-firebase-500/15 text-firebase-300 border border-firebase-500/30 inline-flex items-center gap-1 font-mono">
                                <Globe className="w-2.5 h-2.5 text-firebase-400" />
                                <span>{rec.websites?.length} sites bundled</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-500 font-mono block truncate max-w-[170px]">{rec.domain}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={rec.website_url}
                                onChange={(e) => handleUpdateWebsite(rec.id, e.target.value)}
                                className="w-44 px-2 py-1 firebase-input text-xs font-mono text-firebase-300 rounded"
                              />
                              <a
                                href={rec.website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-500 hover:text-firebase-400 p-0.5"
                                title="Open website"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            {hasMultiSites && rec.websites && (
                              <div className="flex flex-wrap items-center gap-1">
                                {rec.websites.slice(1).map((w, idx) => (
                                  <a
                                    key={idx}
                                    href={w.website_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[9px] font-mono px-1 py-0.2 rounded bg-matte-900 border border-matte-700 text-firebase-300 hover:underline"
                                    title={w.domain}
                                  >
                                    {w.domain}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <input
                              type="email"
                              value={rec.email}
                              onChange={(e) => handleUpdateEmail(rec.id, e.target.value)}
                              className="w-48 px-2 py-1 firebase-input text-xs font-mono text-purple-200 rounded"
                            />
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          {rec.isAiGenerating ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-firebase-300 bg-firebase-950/40 px-2 py-0.5 rounded border border-firebase-500/30 animate-pulse font-mono">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin text-firebase-400" /> Generating...
                            </span>
                          ) : rec.ai_body ? (
                            <button
                              type="button"
                              onClick={() => handleInspectLeadInStudio(rec.id)}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-firebase-200 bg-firebase-500/15 hover:bg-firebase-500/25 px-2.5 py-0.5 rounded border border-firebase-500/30 transition-all font-mono"
                              title="Inspect in AI Pitch Studio"
                            >
                              <Sparkles className="w-2.5 h-2.5 text-firebase-400" />
                              <span>View Draft</span>
                              <Eye className="w-2.5 h-2.5 ml-0.5 text-gray-400" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleInspectLeadInStudio(rec.id)}
                              className="text-[10px] text-gray-400 hover:text-firebase-300 transition-colors flex items-center gap-1 font-mono"
                              title="Open in AI Pitch Studio"
                            >
                              <span>Template</span>
                              <Edit3 className="w-2.5 h-2.5 text-gray-500" />
                            </button>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {rec.status === 'sent' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30 font-mono">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Sent
                            </span>
                          )}
                          {rec.status === 'sending' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-firebase-300 bg-firebase-950/40 px-2 py-0.5 rounded border border-firebase-500/30 font-mono">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin text-firebase-400" /> Sending
                            </span>
                          )}
                          {rec.status === 'failed' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/30 font-mono">
                              <XCircle className="w-2.5 h-2.5" /> Failed
                            </span>
                          )}
                          {rec.status === 'pending' && (
                            <span className="text-gray-400 text-[10px] font-mono">Pending</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(rec)}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                              title="Edit Custom Pitch"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {Boolean(rec.ai_body?.trim() || rec.ai_subject?.trim()) && (
                              <button
                                type="button"
                                onClick={() => handleResetSingleAiPitch(rec.id)}
                                className="p-1 text-gray-400 hover:text-rose-400 transition-colors"
                                title="Reset AI pitch for this lead"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteRecipient(rec.id)}
                              className="p-1 text-gray-400 hover:text-rose-400 transition-colors"
                              title="Remove Lead"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: AI PITCH STUDIO & LIVE PREVIEW BOX                     */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === 'ai_studio' || activeTab === 'all') && (
        <div className="p-3 sm:p-4 rounded-xl bg-matte-850 border border-matte-700/80 space-y-3.5 shadow-sm">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-matte-700/80 pb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Gemini AI Personalized Pitch Studio
                </h3>
                <span className="px-2 py-0.2 text-[9px] font-mono font-bold rounded bg-firebase-600/20 text-firebase-400 border border-firebase-600/30">
                  Rotator Active
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Generate tailored, high-converting cold outreach pitches utilizing live site context and key rotation.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setShowKeysModal(true)}
                className="firebase-btn-secondary px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
                title="Configure Gemini API Keys"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Keys ({activeKeysCount})</span>
              </button>

              {/* Reset All AI Pitches Button */}
              <button
                type="button"
                onClick={handleResetAllAiPitches}
                disabled={isBatchAiGenerating}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-sm ${
                  aiReadyCount > 0
                    ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 hover:border-rose-400'
                    : 'bg-matte-900 text-gray-500 border border-matte-700 hover:text-gray-400'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                title="Reset all generated AI pitches to empty (revert to default template)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All AI ({aiReadyCount})</span>
              </button>

              {isBatchAiGenerating ? (
                /* STOP BUTTON */
                <button
                  type="button"
                  onClick={handleStopAiGeneration}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-md flex items-center gap-1.5 animate-pulse transition-all"
                  title="Halt active AI pitch generation and save progress"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Generation</span>
                </button>
              ) : (
                /* START / RESUME FROM UNGENERATED BUTTONS */
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleGenerateAllAiEmails(true)}
                    disabled={selectedRecipients.length === 0}
                    className="firebase-btn-primary px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-md disabled:opacity-50 transition-all"
                    title={selectedUngeneratedCount > 0 ? `Generate only missing AI pitches (${selectedUngeneratedCount} remaining)` : `All selected leads already have AI pitches`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {selectedUngeneratedCount > 0
                        ? `Generate Missing (${selectedUngeneratedCount})`
                        : `All AI Ready (${selectedRecipients.length})`}
                    </span>
                  </button>

                  {/* Secondary: Regenerate All if some already have drafts */}
                  {selectedRecipients.length > 0 && aiReadyCount > 0 && (
                    <button
                      type="button"
                      onClick={() => handleGenerateAllAiEmails(false)}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-matte-900 hover:bg-matte-800 text-gray-300 hover:text-white border border-matte-700/80 transition-all"
                      title="Force regenerate all selected leads with current prompt"
                    >
                      <span>Regen All</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Gemini Model Selector */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider block font-mono">
              Select Gemini Model Engine:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {GEMINI_MODELS.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModel(m.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${isSelected
                        ? 'bg-firebase-950/60 border-firebase-500 text-white shadow-sm ring-1 ring-firebase-500/50'
                        : 'bg-matte-900 border-matte-700/80 text-gray-300 hover:border-matte-600'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-xs font-mono">{m.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${isSelected ? 'bg-firebase-600 text-white' : 'bg-matte-800 text-gray-400'}`}>
                        {m.badge}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 line-clamp-1">{m.useCase}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* HIGH-VISIBILITY DEDICATED AI PROMPT STUDIO CARD */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-matte-900 to-matte-950 border-2 border-purple-500/60 shadow-[0_0_25px_rgba(168,85,247,0.15)] space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-purple-500/30 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </span>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <span>AI Prompt & Value Proposition Instructions</span>
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-purple-500/25 text-purple-300 border border-purple-500/40">
                      Central Prompt
                    </span>
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Direct Gemini on what angle, offer, or service to pitch to each website lead.
                  </p>
                </div>
              </div>

              {/* Quick Preset Selector Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-auto">
                <span className="text-[11px] text-purple-300 font-mono font-semibold mr-0.5">Presets:</span>
                <button
                  type="button"
                  onClick={() => applyPromptPreset('host')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/50 hover:border-purple-400 transition-all font-semibold flex items-center gap-1 shadow-sm"
                >
                  <span>🚀 Invite Host</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPromptPreset('partner')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/50 hover:border-purple-400 transition-all font-semibold flex items-center gap-1 shadow-sm"
                >
                  <span>🤝 Partner</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPromptPreset('audit')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/50 hover:border-emerald-400 transition-all font-semibold flex items-center gap-1 shadow-sm"
                >
                  <span>🔍 Audit</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPromptPreset('pitch')}
                  className="px-2.5 py-1 text-xs rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-500/50 hover:border-blue-400 transition-all font-semibold flex items-center gap-1 shadow-sm"
                >
                  <span>💼 Pitch</span>
                </button>
              </div>
            </div>

            {/* Prompt Textarea */}
            <div className="space-y-1.5">
              <textarea
                rows={4}
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
                placeholder="Tell Gemini what angle, benefit, or service to pitch to each website owner..."
                className="w-full p-3.5 rounded-xl bg-matte-950/90 border-2 border-purple-500/50 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 text-sm text-white font-sans placeholder-gray-500 shadow-inner leading-relaxed transition-all focus:outline-none"
              />

              {/* Prompt Actions & Status Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 text-xs font-mono text-purple-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  <span>{aiInstruction.length} characters</span>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-400">{aiInstruction.trim().split(/\s+/).filter(Boolean).length} words</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyText(aiInstruction, 'prompt')}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono text-gray-300 hover:text-white bg-matte-900 border border-matte-700 hover:border-purple-500 transition-colors flex items-center gap-1"
                  >
                    {copiedField === 'prompt' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedField === 'prompt' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPromptPreset('host')}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono text-gray-400 hover:text-purple-300 bg-matte-900 border border-matte-700 hover:border-purple-500 transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiInstruction('')}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono text-gray-400 hover:text-rose-400 bg-matte-900 border border-matte-700 hover:border-rose-500 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {isBatchAiGenerating && (
              <div className="p-3 rounded-xl bg-purple-950/60 border-2 border-purple-500/40 text-xs text-purple-200 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2.5">
                  <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
                  <span className="font-semibold">{aiProgressText}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-purple-300 hidden sm:inline">Key Rotator Active</span>
                  <button
                    type="button"
                    onClick={handleStopAiGeneration}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-all"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* LIVE AI RESPONSE EMAIL BOX */}
          {(() => {
            const currentPreviewLead = recipients.find(r => r.id === previewLeadId) || (recipients.length > 0 ? recipients[0] : null);
            const currentIdx = recipients.findIndex(r => r.id === (currentPreviewLead?.id || ''));

            const handlePrev = () => {
              if (currentIdx > 0) setPreviewLeadId(recipients[currentIdx - 1].id);
            };
            const handleNext = () => {
              if (currentIdx < recipients.length - 1) setPreviewLeadId(recipients[currentIdx + 1].id);
            };

            const handleGenerateForPreviewLead = async () => {
              if (!currentPreviewLead) return;
              setIsSingleRegenerating(true);
              try {
                const aiResponse = await generateAIEmail({
                  user_instruction: aiInstruction,
                  website_url: currentPreviewLead.website_url,
                  company_name: currentPreviewLead.company_name,
                  recipient_email: currentPreviewLead.email,
                  gemini_api_keys: savedKeys.length > 0 ? savedKeys : undefined,
                  model: selectedModel,
                  result_id: currentPreviewLead.result_id
                });

                setRecipients(prev => prev.map(r => r.id === currentPreviewLead.id ? {
                  ...r,
                  ai_subject: aiResponse.subject,
                  ai_body: aiResponse.body,
                  ai_prompt: aiInstruction,
                  useAiDraft: true
                } : r));

                addLog(`✨ Generated AI email response for ${currentPreviewLead.domain} using ${selectedModel} (Key: ${aiResponse.key_used}).`);
                refreshKeyStatus();
              } catch (err: any) {
                alert(`AI Generation error: ${err.message}`);
              } finally {
                setIsSingleRegenerating(false);
              }
            };

            return (
              <div id="ai-response-box" className="mt-3 rounded-xl border border-matte-700/80 bg-matte-950 shadow-md overflow-hidden space-y-0">
                {/* Header Bar */}
                <div className="px-3.5 py-2.5 bg-matte-900 border-b border-matte-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-firebase-400" />
                    <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                      Live Draft Preview Box
                    </h4>
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-firebase-500/15 text-firebase-300">
                      {currentPreviewLead?.ai_body ? '✨ AI Personalized' : 'Template Fallback'}
                    </span>
                  </div>

                  {/* Lead Navigator Selector */}
                  {recipients.length > 0 && (
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={handlePrev}
                        disabled={currentIdx <= 0}
                        className="p-1 rounded bg-matte-950 border border-matte-700 text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Previous Lead"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>

                      <select
                        value={previewLeadId || (recipients[0]?.id ?? '')}
                        onChange={(e) => setPreviewLeadId(e.target.value)}
                        className="px-2 py-1 rounded bg-matte-950 border border-matte-700 text-xs font-mono text-firebase-200 focus:outline-none focus:border-firebase-500 max-w-[220px] sm:max-w-xs truncate"
                      >
                        {recipients.map((r, idx) => (
                          <option key={r.id} value={r.id} className="bg-matte-950 text-white">
                            {idx + 1}. {r.company_name} ({r.domain}) {r.ai_body ? '✨' : '—'}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleNext}
                        disabled={currentIdx >= recipients.length - 1}
                        className="p-1 rounded bg-matte-950 border border-matte-700 text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Next Lead"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Email Box Body */}
                {currentPreviewLead ? (
                  <div className="p-3 sm:p-4 space-y-3 font-sans bg-matte-950">
                    {/* Multi-Site Combined Alert Ribbon */}
                    {currentPreviewLead.websites && currentPreviewLead.websites.length > 1 && (
                      <div className="px-3 py-2 rounded-lg bg-firebase-950/40 border border-firebase-500/30 text-xs text-firebase-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-firebase-600 text-white font-mono">
                            {currentPreviewLead.websites.length} Sites
                          </span>
                          <span className="font-semibold text-white">1 Consolidated Single Pitch</span>
                        </div>
                        <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                          {currentPreviewLead.websites.map((w, idx) => (
                            <a
                              key={idx}
                              href={w.website_url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-1.5 py-0.2 rounded bg-matte-900 border border-matte-700 text-firebase-300 hover:underline"
                            >
                              {w.domain}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metadata Header Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-matte-900 border border-matte-700/80 text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400">To:</span>
                        <span className="text-firebase-300 font-semibold">{currentPreviewLead.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400">Website:</span>
                        <a
                          href={currentPreviewLead.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-firebase-400 hover:underline inline-flex items-center gap-1"
                        >
                          <span>{currentPreviewLead.domain}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400">Engine:</span>
                        <span className="text-white font-semibold">{selectedModel}</span>
                      </div>
                    </div>

                    {/* Subject Line Inside Box */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                          Subject Line:
                        </span>
                        {currentPreviewLead.ai_subject && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(currentPreviewLead.ai_subject || '', 'subject')}
                            className="text-[10px] font-mono text-firebase-400 hover:text-white flex items-center gap-1 transition-colors"
                          >
                            {copiedField === 'subject' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedField === 'subject' ? 'Copied' : 'Copy Subject'}</span>
                          </button>
                        )}
                      </div>
                      <div className="px-3 py-2 rounded-lg bg-matte-900 border border-matte-700/80 text-xs font-bold text-white shadow-inner font-sans">
                        {currentPreviewLead.ai_subject || (
                          <span className="text-gray-400 font-normal italic">
                            {subject.replace(/{company_name}/g, currentPreviewLead.company_name)} (Default Fallback)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Email Message Content Inside Box */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                          Message Body:
                        </span>
                        {currentPreviewLead.ai_body && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(currentPreviewLead.ai_body || '', 'body')}
                            className="text-[10px] font-mono text-firebase-400 hover:text-white flex items-center gap-1 transition-colors"
                          >
                            {copiedField === 'body' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedField === 'body' ? 'Copied' : 'Copy Body'}</span>
                          </button>
                        )}
                      </div>

                      {currentPreviewLead.ai_body ? (
                        <div className="p-3.5 rounded-lg bg-matte-900 border border-matte-700/80 text-xs text-gray-200 font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto shadow-inner border-l-4 border-l-purple-500">
                          {currentPreviewLead.ai_body}
                        </div>
                      ) : (
                        <div className="p-6 rounded-lg bg-matte-900/50 border border-dashed border-matte-700 text-center space-y-2.5">
                          <p className="text-xs text-gray-400">
                            No AI pitch generated for <span className="text-white font-semibold">{currentPreviewLead.company_name}</span>.
                          </p>
                          <button
                            type="button"
                            onClick={handleGenerateForPreviewLead}
                            disabled={isSingleRegenerating}
                            className="firebase-btn-primary px-3.5 py-1.5 text-xs font-semibold shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isSingleRegenerating ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Generating Pitch...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Generate Custom AI Pitch</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Action Bar Inside Box */}
                    {Boolean(currentPreviewLead.ai_body || currentPreviewLead.ai_subject) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-matte-700/80">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              const full = `Subject: ${currentPreviewLead.ai_subject}\n\n${currentPreviewLead.ai_body}`;
                              handleCopyText(full, 'full');
                            }}
                            className="firebase-btn-secondary px-3 py-1.5 text-xs font-semibold text-gray-200 flex items-center gap-1.5"
                          >
                            {copiedField === 'full' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedField === 'full' ? 'Full Pitch Copied' : 'Copy Full'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(currentPreviewLead)}
                            className="firebase-btn-secondary px-3 py-1.5 text-xs font-semibold text-firebase-300 flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-firebase-400" />
                            <span>Edit Custom Pitch</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleResetSingleAiPitch(currentPreviewLead.id)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 hover:border-rose-400 flex items-center gap-1.5 transition-all shadow-sm"
                            title="Reset only this personalized pitch back to default template"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                            <span>Reset Pitch</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleGenerateForPreviewLead}
                          disabled={isSingleRegenerating}
                          className="firebase-btn-secondary px-3 py-1.5 text-xs font-semibold text-firebase-300 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isSingleRegenerating ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Regenerating...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                              <span>Regenerate Single Pitch</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center text-gray-400 space-y-1">
                    <Mail className="w-6 h-6 text-gray-600 mx-auto" />
                    <p className="text-xs">No email recipients loaded.</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: SMTP DELIVERY SETTINGS & TEST SENDER                   */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === 'smtp_config' || activeTab === 'all') && (
        <div className="space-y-3.5">
          {/* SMTP Credentials Card */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-matte-850 border border-matte-700/80 space-y-3 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-matte-700/80 pb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    SMTP Email Server Configuration
                  </h3>
                  <span className="px-2 py-0.5 text-[9px] font-mono bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 font-bold">
                    Direct Inbox Delivery
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Configure your genuine SMTP credentials to dispatch emails directly from your domain.
                </p>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <span className="text-[11px] text-gray-400 font-mono">Presets:</span>
                <button
                  type="button"
                  onClick={() => applySmtpPreset('gmail')}
                  className="px-2 py-1 text-xs rounded bg-matte-900 text-gray-300 border border-matte-700 hover:border-firebase-500 hover:text-white transition-all font-mono"
                >
                  Gmail (587)
                </button>
                <button
                  type="button"
                  onClick={() => applySmtpPreset('outlook')}
                  className="px-2 py-1 text-xs rounded bg-matte-900 text-gray-300 border border-matte-700 hover:border-firebase-500 hover:text-white transition-all font-mono"
                >
                  Outlook
                </button>
                <button
                  type="button"
                  onClick={() => applySmtpPreset('mailtrap')}
                  className="px-2 py-1 text-xs rounded bg-matte-900 text-gray-300 border border-matte-700 hover:border-emerald-500 hover:text-white transition-all font-mono"
                >
                  Mailtrap (Sandbox)
                </button>
              </div>
            </div>

            {/* 6 Responsive Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1 font-mono">SMTP Host:</label>
                <input
                  type="text"
                  placeholder="smtp.gmail.com"
                  value={smtpHost}
                  onChange={(e) => {
                    setSmtpHost(e.target.value);
                    saveSmtpToStorage({ smtpHost: e.target.value });
                  }}
                  className="w-full px-2.5 py-1.5 firebase-input text-xs text-white rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1 font-mono">Port:</label>
                <input
                  type="number"
                  placeholder="587"
                  value={smtpPort}
                  onChange={(e) => {
                    const p = parseInt(e.target.value) || 587;
                    setSmtpPort(p);
                    saveSmtpToStorage({ smtpPort: p });
                  }}
                  className="w-full px-2.5 py-1.5 firebase-input text-xs text-white rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1 font-mono">Username / Email:</label>
                <input
                  type="email"
                  placeholder="yourname@gmail.com"
                  value={smtpUser}
                  onChange={(e) => {
                    setSmtpUser(e.target.value);
                    saveSmtpToStorage({ smtpUser: e.target.value });
                  }}
                  className="w-full px-2.5 py-1.5 firebase-input text-xs text-white rounded-lg font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-semibold text-gray-400 font-mono">App Password:</label>
                  <button
                    type="button"
                    onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                    className="text-[10px] text-gray-400 hover:text-white"
                  >
                    {showSmtpPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                </div>
                <input
                  type={showSmtpPassword ? 'text' : 'password'}
                  placeholder="16-character app key"
                  value={smtpPassword}
                  onChange={(e) => {
                    setSmtpPassword(e.target.value);
                    saveSmtpToStorage({ smtpPassword: e.target.value });
                  }}
                  className="w-full px-2.5 py-1.5 firebase-input text-xs text-white rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1 font-mono">Sender Name:</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={senderName}
                  onChange={(e) => {
                    setSenderName(e.target.value);
                    saveSmtpToStorage({ senderName: e.target.value });
                  }}
                  className="w-full px-2.5 py-1.5 firebase-input text-xs text-white rounded-lg font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1 font-mono">Sender Email:</label>
                <input
                  type="email"
                  placeholder="outreach@company.com"
                  value={senderEmail}
                  onChange={(e) => {
                    setSenderEmail(e.target.value);
                    saveSmtpToStorage({ senderEmail: e.target.value });
                  }}
                  className="w-full px-2.5 py-1.5 firebase-input text-xs text-white rounded-lg font-mono"
                />
              </div>
            </div>

            {/* Test Email Dispatch Sandbox */}
            <div className="p-3 rounded-lg bg-matte-900 border border-matte-750 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Verify SMTP Connection Before Dispatch</span>
                </span>
                <p className="text-[11px] text-gray-400">
                  Send a single real test email to your personal address to verify credentials and spam deliverability.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="email"
                  placeholder="Your personal email..."
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  className="px-2.5 py-1.5 bg-matte-950 border border-matte-700 text-xs text-white rounded-lg font-mono w-56"
                />
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={isSendingTestEmail}
                  className="firebase-btn-secondary px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:text-white border-emerald-500/40 hover:bg-emerald-500/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSendingTestEmail ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Test...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Test Email</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {testEmailResult && (
              <div className={`p-2.5 rounded-lg text-xs font-mono flex items-center gap-2 ${testEmailResult.success
                  ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/60 border border-rose-500/40 text-rose-200'
                }`}>
                {testEmailResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                <span>{testEmailResult.message}</span>
              </div>
            )}
          </div>

          {/* Fallback Template & Delay Limiter Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
            {/* Fallback Template Composer (2 cols) */}
            <div className="lg:col-span-2 space-y-2.5 p-3.5 rounded-xl bg-matte-850 border border-matte-700/80 shadow-md">
              <div className="flex items-center justify-between flex-wrap gap-1.5 border-b border-matte-700/80 pb-2">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-firebase-400" />
                    <span>Default Fallback Template</span>
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Used if a lead has no personalized AI pitch generated.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                  <span className="px-1.5 py-0.2 rounded bg-firebase-500/20 text-firebase-300 font-bold">{`{company_name}`}</span>
                  <span className="px-1.5 py-0.2 rounded bg-matte-900 border border-matte-700">{`{website}`}</span>
                  <span className="px-1.5 py-0.2 rounded bg-matte-900 border border-matte-700">{`{email}`}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-1 font-mono">Subject Line:</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-2.5 py-1.5 firebase-input text-xs text-white rounded-lg font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-1 font-mono">Email Body Message:</label>
                  <textarea
                    rows={4}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full p-2.5 firebase-input text-xs text-white rounded-lg font-mono leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Automated Drip Timer & Interval Settings (1 col) */}
            <div className="space-y-3 p-3.5 rounded-xl bg-matte-850 border border-matte-700/80 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-matte-700/80 pb-2">
                  <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Dispatch Delay & Rate Limiter</span>
                  </h3>
                  <span className="text-[10px] font-mono text-amber-400">Anti-Spam</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1 mb-3">
                  Enforces natural pauses between successive outgoing SMTP connections to protect sender domain reputation.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 mb-1 font-mono">
                      Delay Between Emails (Seconds):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={3600}
                        value={intervalSeconds}
                        onChange={(e) => setIntervalSeconds(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 px-2 py-1.5 firebase-input text-sm font-mono font-bold text-white rounded-lg text-center"
                      />
                      <span className="text-xs text-gray-300 font-mono">seconds per email</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-gray-400 font-mono">Quick Rate Presets:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[2, 5, 10, 30, 60].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setIntervalSeconds(sec)}
                          className={`px-2.5 py-1 text-xs rounded-lg border font-mono transition-all ${intervalSeconds === sec
                              ? 'bg-firebase-600 border-firebase-500 text-white font-bold shadow-sm'
                              : 'bg-matte-900 border-matte-700 text-gray-400 hover:text-white'
                            }`}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-matte-900 border border-matte-750 text-[11px] text-gray-400 font-mono">
                Total Estimated Time: <span className="text-white font-bold">{Math.round((selectedRecipients.length * intervalSeconds) / 60)} min</span> for {selectedRecipients.length} recipients.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: LIVE DISPATCH CONSOLE & ANALYTICS                      */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === 'dispatch_console' || activeTab === 'all') && (
        <div className="space-y-3.5">
          {/* Readiness Checklist & Big Action Banner */}
          <div className="p-4 rounded-xl bg-matte-850 border border-matte-700/80 shadow-md space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-matte-700/80 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-firebase-400" />
                  <span>Outreach Dispatch Commander</span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Launch automated sequential email outreach with real-time SMTP feedback.
                </p>
              </div>

              <div>
                {isCampaignRunning ? (
                  <button
                    type="button"
                    onClick={pauseCampaign}
                    className="firebase-btn-secondary px-4 py-2 text-xs font-bold text-amber-300 border-amber-500/40 hover:bg-amber-500/20 flex items-center gap-2 shadow-sm"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pause Campaign</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startCampaign}
                    className="firebase-btn-primary px-5 py-2 text-xs font-bold flex items-center gap-2 shadow-lg"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Start Outgoing Dispatch ({selectedRecipients.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Campaign Readiness Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className={`p-2.5 rounded-lg border flex items-center gap-2.5 ${selectedRecipients.length > 0
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                }`}>
                {selectedRecipients.length > 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
                <div className="min-w-0">
                  <div className="text-xs font-bold font-mono">{selectedRecipients.length} Selected</div>
                  <div className="text-[10px] text-gray-400">Recipients Ready</div>
                </div>
              </div>

              <div className={`p-2.5 rounded-lg border flex items-center gap-2.5 ${aiReadyCount > 0
                  ? 'bg-purple-950/20 border-purple-500/30 text-purple-200'
                  : 'bg-matte-900 border-matte-700 text-gray-300'
                }`}>
                <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold font-mono">{aiReadyCount} / {recipients.length} Pitches</div>
                  <div className="text-[10px] text-gray-400">AI Personalization</div>
                </div>
              </div>

              <div className={`p-2.5 rounded-lg border flex items-center gap-2.5 ${isSmtpConfigured
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                }`}>
                {isSmtpConfigured ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                <div className="min-w-0">
                  <div className="text-xs font-bold font-mono truncate">{isSmtpConfigured ? smtpHost : 'Unconfigured'}</div>
                  <div className="text-[10px] text-gray-400">SMTP Server</div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-matte-900/60 border border-matte-750 flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold font-mono text-amber-300">{isCampaignRunning ? `${countdownSeconds}s Countdown` : `${intervalSeconds}s Interval`}</div>
                  <div className="text-[10px] text-gray-400">Dispatch Speed</div>
                </div>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-gray-400">Delivery Progress:</span>
                <span className="text-white font-bold">
                  {sentCount + failedCount} / {selectedRecipients.length} ({selectedRecipients.length > 0 ? Math.round(((sentCount + failedCount) / selectedRecipients.length) * 100) : 0}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-matte-900 rounded-full overflow-hidden border border-matte-700/80">
                <div
                  className="h-full bg-gradient-to-r from-firebase-500 to-emerald-500 transition-all duration-300 rounded-full"
                  style={{
                    width: `${selectedRecipients.length > 0 ? Math.min(100, Math.round(((sentCount + failedCount) / selectedRecipients.length) * 100)) : 0}%`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Live Campaign Terminal Console Log */}
          <div className="p-3 sm:p-4 rounded-xl bg-matte-950 border border-matte-700/80 font-mono text-xs space-y-2 shadow-md">
            <div className="flex items-center justify-between border-b border-matte-800 pb-2">
              <span className="font-bold text-firebase-400 flex items-center gap-2 text-xs">
                <Terminal className="w-4 h-4 text-firebase-400" />
                <span>Live Activity Console Log</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="text-[10px] text-gray-500 hover:text-gray-300 font-mono"
                >
                  Clear Console
                </button>
                <span className="text-[10px] text-gray-500">• Auto-scroll</span>
              </div>
            </div>

            <div className="h-44 overflow-y-auto space-y-1 text-gray-300 pr-2 text-[11px]">
              {logs.length === 0 ? (
                <p className="text-gray-500 italic text-[11px]">Ready for campaign launch...</p>
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
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: GEMINI KEY ROTATOR & 429 QUOTA HEALTH INSPECTOR      */}
      {/* ------------------------------------------------------------- */}
      <GeminiKeyManagerModal
        isOpen={showKeysModal}
        onClose={() => setShowKeysModal(false)}
        initialModel={selectedModel}
        onKeysChanged={(updatedKeys) => {
          setSavedKeys(updatedKeys);
          refreshKeyStatus();
        }}
      />

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: RECIPIENT AI DRAFT VIEW & EDIT MODAL                 */}
      {/* ------------------------------------------------------------- */}
      {editingRecipient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl bg-matte-850 border border-matte-700/80 rounded-xl p-4 sm:p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-matte-700/80 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-firebase-500/10 text-firebase-400 border border-firebase-500/30">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white font-display">
                    Customize AI Pitch: {editingRecipient.company_name}
                  </h3>
                  <p className="text-[11px] text-firebase-300 font-mono">
                    {editingRecipient.website_url} • {editingRecipient.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecipient(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-matte-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Subject Input */}
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider font-mono">
                Subject Line:
              </label>
              <input
                type="text"
                value={editAiSubject}
                onChange={(e) => setEditAiSubject(e.target.value)}
                className="w-full px-3 py-1.5 firebase-input text-xs text-white rounded-lg font-sans"
              />
            </div>

            {/* Body Input */}
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider font-mono">
                Message Body:
              </label>
              <textarea
                rows={7}
                value={editAiBody}
                onChange={(e) => setEditAiBody(e.target.value)}
                className="w-full p-3 firebase-input text-xs text-white rounded-lg font-mono leading-relaxed"
              />
            </div>

            {/* Footer with Regenerate, Reset & Save */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-matte-700/80">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleRegenerateSingleAiEmail}
                  disabled={isSingleRegenerating}
                  className="firebase-btn-secondary px-3 py-1.5 text-xs font-semibold text-firebase-300 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSingleRegenerating ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Regenerating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>Regenerate Pitch</span>
                    </>
                  )}
                </button>

                {editingRecipient && Boolean(editingRecipient.ai_body?.trim() || editingRecipient.ai_subject?.trim()) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (editingRecipient) {
                        handleResetSingleAiPitch(editingRecipient.id);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 transition-all"
                    title="Reset this AI pitch back to default template"
                  >
                    <RotateCcw className="w-3 h-3 text-rose-400" />
                    <span>Reset to Default</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecipient(null)}
                  className="firebase-btn-secondary px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditedDraft}
                  className="firebase-btn-primary px-3.5 py-1.5 text-xs font-bold flex items-center gap-1 shadow-sm"
                >
                  <Save className="w-3 h-3" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
