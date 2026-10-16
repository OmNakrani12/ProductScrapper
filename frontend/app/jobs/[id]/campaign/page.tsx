'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, Send, Play, Pause, RefreshCw, CheckCircle2, XCircle, Clock, 
  Trash2, Plus, Edit3, Sparkles, Mail, ShieldAlert, FileText, Check, AlertCircle, 
  ExternalLink, Globe, Key, Settings, CheckCircle, Flame, Eye, Save, X, RotateCcw,
  ChevronLeft, ChevronRight, Copy
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

  // Gemini Key Rotator State & Modal
  const [showKeysModal, setShowKeysModal] = useState<boolean>(false);
  const [customKeyInput, setCustomKeyInput] = useState<string>('');
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [geminiPoolStatus, setGeminiPoolStatus] = useState<GeminiPoolStatus | null>(null);
  const [testKeyStatus, setTestKeyStatus] = useState<{ testing: boolean; message?: string; valid?: boolean } | null>(null);

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
    // 1. Check local storage for keys
    try {
      const stored = localStorage.getItem('reachbot_gemini_keys');
      if (stored) {
        const keysArr = JSON.parse(stored);
        if (Array.isArray(keysArr) && keysArr.length > 0) {
          setSavedKeys(keysArr);
          setCustomKeyInput(keysArr.join('\n'));
          // Sync keys to backend rotator pool
          addGeminiKeys(keysArr).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Local storage keys error:', e);
    }

    refreshKeyStatus();
  }, []);

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

        // Fetch all results for this job (up to 2000 items)
        const data = await getJobResults(jobId, 1, 2000, '', 'all', false, false, false);

        // Extract primary emails from ALL scraped website results and group multi-site hosts
        const recipientMap = new Map<string, CampaignRecipient>();

        data.items.forEach((item, index) => {
          // Resolve best primary working email with fallbacks
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
              useAiDraft: Boolean(item.ai_email_body && item.ai_email_subject)
            });
          }
        });

        const recipientList = Array.from(recipientMap.values());
        setRecipients(recipientList);
        const multiSiteCount = recipientList.filter(r => (r.websites?.length || 1) > 1).length;
        const aiDraftCount = recipientList.filter(r => r.ai_body).length;
        const firstWithAi = recipientList.find(r => r.ai_body);
        if (firstWithAi) {
          setPreviewLeadId(firstWithAi.id);
        } else if (recipientList.length > 0) {
          setPreviewLeadId(recipientList[0].id);
        }
        addLog(`Loaded ${recipientList.length} unique host recipients (${data.items.length} total scraped websites, ${multiSiteCount} multi-site hosts operating 2+ domains, ${aiDraftCount} AI drafts ready).`);
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
    const companyName = newCompanyInput.trim() || domain;
    const cleanEmail = newEmailInput.trim();
    const emailLower = cleanEmail.toLowerCase();

    // Check if host with this email already exists in recipients
    const existingIdx = recipients.findIndex(r => r.email.toLowerCase() === emailLower);
    if (existingIdx !== -1) {
      setRecipients((prev) =>
        prev.map((r, idx) => {
          if (idx === existingIdx) {
            const alreadyHas = r.websites?.some(w => w.website_url.toLowerCase() === rawWebsite.toLowerCase());
            const updatedWebsites = alreadyHas 
              ? r.websites 
              : [...(r.websites || [{ website_url: r.website_url, domain: r.domain, company_name: r.company_name }]), { website_url: rawWebsite, domain, company_name: companyName }];
            return {
              ...r,
              websites: updatedWebsites
            };
          }
          return r;
        })
      );
      setNewEmailInput('');
      setNewCompanyInput('');
      setNewWebsiteInput('');
      addLog(`Added website ${rawWebsite} to existing host recipient ${cleanEmail}.`);
      return;
    }

    const newRec: CampaignRecipient = {
      id: `custom_${Date.now()}`,
      email: cleanEmail,
      website_url: rawWebsite,
      domain: domain,
      company_name: companyName,
      websites: [{ website_url: rawWebsite, domain, company_name: companyName }],
      isSelected: true,
      status: 'pending',
      useAiDraft: false
    };

    setRecipients((prev) => [...prev, newRec]);
    setNewEmailInput('');
    setNewCompanyInput('');
    setNewWebsiteInput('');
    addLog(`Manually added ${newRec.email} (${newRec.website_url}) to campaign list.`);
  };

  // Save Gemini Keys to localStorage & sync with backend rotator
  const handleSaveGeminiKeys = async () => {
    const rawLines = customKeyInput.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean);
    if (rawLines.length === 0) {
      alert('Please enter at least one Gemini API key.');
      return;
    }

    try {
      localStorage.setItem('reachbot_gemini_keys', JSON.stringify(rawLines));
      setSavedKeys(rawLines);
      await addGeminiKeys(rawLines);
      await refreshKeyStatus();
      addLog(`Gemini Key Rotator: registered ${rawLines.length} keys in pool with auto-failover.`);
      setShowKeysModal(false);
    } catch (e: any) {
      alert(`Error saving Gemini keys: ${e.message}`);
    }
  };

  // Test single Gemini key
  const handleTestKey = async (key: string) => {
    if (!key.trim()) return;
    setTestKeyStatus({ testing: true });
    try {
      const res = await testGeminiKey(key.trim(), selectedModel);
      setTestKeyStatus({
        testing: false,
        valid: res.valid,
        message: res.message
      });
      refreshKeyStatus();
    } catch (e: any) {
      setTestKeyStatus({
        testing: false,
        valid: false,
        message: e.message || 'Verification failed.'
      });
    }
  };

  // -------------------------------------------------------------
  // AI Email Generator: Batch Generation with Key Rotator
  // -------------------------------------------------------------
  const handleGenerateAllAiEmails = async () => {
    const selected = recipients.filter(r => r.isSelected);
    if (selected.length === 0) {
      alert('Please select at least one recipient to generate AI email responses.');
      return;
    }

    if (!aiInstruction.trim()) {
      alert('Please enter an instruction/prompt for the AI (e.g. "Invite website host to host platform").');
      return;
    }

    setIsBatchAiGenerating(true);
    addLog(`✨ AI Email Generator started for ${selected.length} leads with instruction: "${aiInstruction.slice(0, 70)}..."`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selected.length; i++) {
      const rec = selected[i];
      setAiProgressText(`Generating lead ${i + 1} of ${selected.length} (${rec.domain})...`);

      // Mark single generating indicator
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

        // Auto-switch preview box to the latest generated lead
        setPreviewLeadId(rec.id);

        successCount++;
        addLog(`🟢 [AI ${i + 1}/${selected.length}] Generated personalized pitch for ${rec.domain}${allSites.length > 1 ? ` (${allSites.length} websites)` : ''} using key ${aiResponse.key_used}.`);
      } catch (err: any) {
        failCount++;
        setRecipients(prev => prev.map(r => r.id === rec.id ? { ...r, isAiGenerating: false } : r));
        addLog(`❌ [AI ${i + 1}/${selected.length}] Failed for ${rec.domain}: ${err.message}`);
      }

      // Short delay between generations to be polite
      await new Promise(r => setTimeout(r, 400));
    }

    setIsBatchAiGenerating(false);
    setAiProgressText('');
    refreshKeyStatus();
    addLog(`🎉 AI Generator completed! Successfully generated ${successCount} tailored emails (${failCount} failed).`);
  };

  // -------------------------------------------------------------
  // AI Email Generator: Single Lead Regeneration
  // -------------------------------------------------------------
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

      // Update in recipients list
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

      addLog(`✨ Regenerated custom AI pitch for ${editingRecipient.domain}${allSites.length > 1 ? ` (${allSites.length} websites)` : ''} using key ${aiResponse.key_used}.`);
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

    // Check if recipient has a custom AI draft enabled
    let formattedSubject: string;
    let formattedBody: string;

    if (currentRec.useAiDraft && currentRec.ai_subject && currentRec.ai_body) {
      formattedSubject = currentRec.ai_subject;
      formattedBody = currentRec.ai_body;
      addLog(`✉️ [${index + 1}/${activeList.length}] Using AI-personalized pitch for ${currentRec.email} (${currentRec.domain})...`);
    } else {
      // Fallback template placeholders
      formattedSubject = subject
        .replace(/{company_name}/g, currentRec.company_name)
        .replace(/{domain}/g, currentRec.domain)
        .replace(/{website}/g, currentRec.website_url)
        .replace(/{website_url}/g, currentRec.website_url)
        .replace(/{email}/g, currentRec.email);

      formattedBody = body
        .replace(/{company_name}/g, currentRec.company_name)
        .replace(/{domain}/g, currentRec.domain)
        .replace(/{website}/g, currentRec.website_url)
        .replace(/{website_url}/g, currentRec.website_url)
        .replace(/{email}/g, currentRec.email);
    }

    addLog(`✉️ [${index + 1}/${activeList.length}] Connecting to SMTP ${smtpHost}... Sending to ${currentRec.email}...`);

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
  const aiReadyCount = recipients.filter((r) => r.ai_body && r.useAiDraft).length;

  if (isLoading) {
    return (
      <div className="py-20 text-center space-y-4">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
        <p className="text-sm font-semibold text-gray-300">Loading Campaign Email Dispatcher...</p>
      </div>
    );
  }

  const activeKeysCount = geminiPoolStatus?.active_keys ?? (savedKeys.length > 0 ? savedKeys.length : 0);

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
            Target Job: <span className="font-mono text-gray-300">{progress?.filename || jobId}</span> • {recipients.length} Leads
          </p>
        </div>

        {/* Start / Pause Controller & Gemini Key Manager Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowKeysModal(true)}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all ${
              activeKeysCount > 0
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 shadow-sm'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 animate-pulse'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{activeKeysCount > 0 ? `${activeKeysCount} Gemini Keys Active (Rotator ON)` : 'Configure Gemini Keys'}</span>
          </button>

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
          <span className="text-xs font-medium text-gray-400">AI Tailored Email Responses</span>
          <div className="text-2xl font-extrabold text-purple-400 font-display mt-1 flex items-center gap-2">
            <span>{aiReadyCount} Ready</span>
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-400">Delivered via SMTP</span>
          <div className="text-2xl font-extrabold text-emerald-400 font-display mt-1 flex items-center gap-2">
            <span>{sentCount}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-400">Next Dispatch Timer</span>
          <div className="text-2xl font-extrabold text-cyan-400 font-mono mt-1 flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <span>{isCampaignRunning ? `${countdownSeconds}s` : 'Idle'}</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* FEATURE: GEMINI AI OUTREACH EMAIL GENERATOR WITH ROTATOR      */}
      {/* ------------------------------------------------------------- */}
      <div className="p-6 rounded-2xl glass-card border border-purple-500/40 space-y-5 shadow-2xl relative overflow-hidden bg-gradient-to-br from-purple-950/20 via-slate-900/60 to-cyan-950/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-md">
                <Sparkles className="w-4 h-4" />
              </span>
              <h3 className="text-base font-extrabold text-white font-display tracking-tight">
                Gemini AI Personalized Email Generator
              </h3>
              <span className="px-2.5 py-0.5 text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full font-mono">
                Auto Key Rotator Enabled
              </span>
            </div>
            <p className="text-xs text-gray-300 max-w-2xl">
              Tell Gemini what to say to each website host (e.g. invite to host platform, pitch services, propose collaboration).
              Gemini crafts a custom personalized email subject and body for each lead using resilient key failover.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeysModal(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-cyan-400/50 flex items-center gap-1.5 transition-all"
            >
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span>Keys Rotator ({activeKeysCount})</span>
            </button>
            <button
              onClick={handleGenerateAllAiEmails}
              disabled={isBatchAiGenerating || selectedRecipients.length === 0}
              className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 rounded-xl shadow-lg shadow-purple-500/25 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {isBatchAiGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>{aiProgressText || 'Generating with Gemini Rotator...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-white" />
                  <span>Generate AI Emails for Selected ({selectedRecipients.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Gemini Model Selector Grid */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center justify-between">
            <span>Select Gemini AI Model:</span>
            <span className="text-purple-300 font-mono text-[10px]">Active Model: {selectedModel}</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {GEMINI_MODELS.map((m) => {
              const isSelected = selectedModel === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModel(m.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                    isSelected
                      ? 'bg-purple-950/60 border-purple-500 shadow-md shadow-purple-500/20 ring-1 ring-purple-500/50'
                      : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                      {m.name}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      isSelected ? 'bg-purple-500 text-white' : 'bg-white/10 text-gray-400'
                    }`}>
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">
                    {m.useCase}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Prompt Input & Quick Suggestion Chips */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>User Objective / AI Instruction:</span>
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-gray-400 mr-1 font-medium">Quick Suggestions:</span>
              <button
                type="button"
                onClick={() => applyPromptPreset('host')}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all flex items-center gap-1"
              >
                🚀 Invite Host to Platform
              </button>
              <button
                type="button"
                onClick={() => applyPromptPreset('partner')}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 transition-all flex items-center gap-1"
              >
                🤝 Partnership Pitch
              </button>
              <button
                type="button"
                onClick={() => applyPromptPreset('audit')}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all flex items-center gap-1"
              >
                🔍 Free Audit Outreach
              </button>
              <button
                type="button"
                onClick={() => applyPromptPreset('pitch')}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 transition-all flex items-center gap-1"
              >
                💼 Custom Pitch
              </button>
            </div>
          </div>

          <textarea
            rows={3}
            value={aiInstruction}
            onChange={(e) => setAiInstruction(e.target.value)}
            placeholder="e.g. visit all websites and invite that website host to host platform..."
            className="w-full p-3.5 glass-input text-xs text-white rounded-xl font-sans leading-relaxed focus:border-purple-400"
          />

          {isBatchAiGenerating && (
            <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-200 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
                <span className="font-semibold">{aiProgressText}</span>
              </div>
              <span className="font-mono text-[11px] text-purple-300">Rotator actively balancing requests</span>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* DEDICATED AI RESPONSE EMAIL BOX                               */}
          {/* ------------------------------------------------------------- */}
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
              <div id="ai-response-box" className="mt-4 rounded-2xl border-2 border-purple-500/50 bg-[#060a14] shadow-2xl overflow-hidden space-y-0">
                {/* Email Box Header Bar */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 border-b border-purple-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-inner">
                      <Mail className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-extrabold text-white font-display tracking-tight">
                          AI Response Email Box
                        </h4>
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                          Live Inspection Box
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        View, copy, or edit the AI email response generated by Gemini {selectedModel}.
                      </p>
                    </div>
                  </div>

                  {/* Lead Navigator Selector */}
                  {recipients.length > 0 && (
                    <div className="flex items-center gap-2 self-start md:self-auto">
                      <button
                        type="button"
                        onClick={handlePrev}
                        disabled={currentIdx <= 0}
                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Previous Lead"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <select
                        value={previewLeadId || (recipients[0]?.id ?? '')}
                        onChange={(e) => setPreviewLeadId(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-black/60 border border-purple-500/40 text-xs font-mono text-purple-200 focus:outline-none focus:border-purple-400 max-w-xs truncate"
                      >
                        {recipients.map((r, idx) => (
                          <option key={r.id} value={r.id} className="bg-[#090d18] text-white">
                            {idx + 1}. {r.company_name} ({r.email}) {r.ai_body ? '✨ AI Ready' : '— Template'}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleNext}
                        disabled={currentIdx >= recipients.length - 1}
                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Next Lead"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Email Box Body */}
                {currentPreviewLead ? (
                  <div className="p-5 sm:p-6 space-y-4 font-sans bg-[#050811]/95">
                    
                    {/* Metadata Header Card */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs">
                      <div>
                        <span className="text-gray-400 block text-[10px] font-bold uppercase tracking-wider">Recipient To:</span>
                        <span className="font-mono text-cyan-300 font-semibold">{currentPreviewLead.email}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px] font-bold uppercase tracking-wider">Target Website:</span>
                        <a
                          href={currentPreviewLead.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-purple-300 hover:underline truncate inline-flex items-center gap-1"
                        >
                          <span>{currentPreviewLead.website_url}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px] font-bold uppercase tracking-wider">AI Model & Status:</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[11px] text-white font-semibold">{selectedModel}</span>
                          {currentPreviewLead.ai_body ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Generated
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30">
                              Template Fallback
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Subject Line Inside Box */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                          Email Subject Line:
                        </span>
                        {currentPreviewLead.ai_subject && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(currentPreviewLead.ai_subject || '', 'subject')}
                            className="text-[11px] font-mono text-cyan-400 hover:text-white flex items-center gap-1 transition-colors"
                          >
                            {copiedField === 'subject' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedField === 'subject' ? 'Copied!' : 'Copy Subject'}</span>
                          </button>
                        )}
                      </div>
                      <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/40 text-sm font-bold text-white shadow-inner font-sans">
                        {currentPreviewLead.ai_subject || (
                          <span className="text-gray-400 font-normal italic">
                            {subject.replace(/{company_name}/g, currentPreviewLead.company_name)} (Using Campaign Fallback Template)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Email Message Content Inside Box */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                          Email Message Body:
                        </span>
                        {currentPreviewLead.ai_body && (
                          <button
                            type="button"
                            onClick={() => handleCopyText(currentPreviewLead.ai_body || '', 'body')}
                            className="text-[11px] font-mono text-cyan-400 hover:text-white flex items-center gap-1 transition-colors"
                          >
                            {copiedField === 'body' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedField === 'body' ? 'Copied!' : 'Copy Body'}</span>
                          </button>
                        )}
                      </div>

                      {currentPreviewLead.ai_body ? (
                        <div className="p-4 sm:p-5 rounded-xl bg-black/60 border border-white/10 text-xs text-gray-200 font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto shadow-inner border-l-4 border-l-purple-500">
                          {currentPreviewLead.ai_body}
                        </div>
                      ) : (
                        <div className="p-6 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center space-y-3">
                          <p className="text-xs text-gray-400">
                            No AI response email generated for <span className="text-white font-semibold">{currentPreviewLead.company_name}</span> yet.
                          </p>
                          <button
                            type="button"
                            onClick={handleGenerateForPreviewLead}
                            disabled={isSingleRegenerating}
                            className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-md inline-flex items-center gap-2 transition-all disabled:opacity-50"
                          >
                            {isSingleRegenerating ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Generating with Gemini {selectedModel}...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Generate AI Response for {currentPreviewLead.domain}</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Action Bar Inside Box */}
                    {currentPreviewLead.ai_body && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const full = `Subject: ${currentPreviewLead.ai_subject}\n\n${currentPreviewLead.ai_body}`;
                              handleCopyText(full, 'full');
                            }}
                            className="px-3.5 py-1.5 text-xs font-semibold text-gray-200 bg-white/5 border border-white/10 hover:border-white/20 rounded-lg flex items-center gap-1.5 transition-all"
                          >
                            {copiedField === 'full' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedField === 'full' ? 'Full Email Copied!' : 'Copy Full Email'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(currentPreviewLead)}
                            className="px-3.5 py-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 rounded-lg flex items-center gap-1.5 transition-all"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit in Modal</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleGenerateForPreviewLead}
                          disabled={isSingleRegenerating}
                          className="px-3.5 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          {isSingleRegenerating ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Regenerating...</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Regenerate with Gemini {selectedModel}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400 space-y-2">
                    <Mail className="w-8 h-8 text-gray-600 mx-auto" />
                    <p className="text-xs">No email recipients loaded yet.</p>
                  </div>
                )}
              </div>
            );
          })()}
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

      {/* Fallback Campaign Settings: Template & Time Interval */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Email Template Composer (2 cols) */}
        <div className="lg:col-span-2 space-y-4 p-6 rounded-2xl glass-card border border-white/10">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-400" />
              <span>Default Fallback Template (Used if AI Draft is not active)</span>
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
                rows={5}
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

            <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-200 leading-relaxed">
              <p className="font-semibold text-purple-300 mb-1">✨ AI Outreach Priority</p>
              When an AI email is generated for a lead, the dispatcher automatically sends their unique personalized AI pitch instead of the generic template!
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
              Each lead can have their own custom Gemini AI email response. Click &ldquo;View/Edit Pitch&rdquo; to customize before sending.
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
                <th className="py-3 px-3">Company / Domain</th>
                <th className="py-3 px-3">Website URL</th>
                <th className="py-3 px-3">Recipient Email</th>
                <th className="py-3 px-3">AI Outreach Draft</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
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
                      <div className="space-y-0.5">
                        <span className="block">{rec.company_name}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{rec.domain}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <input
                          type="text"
                          value={rec.website_url}
                          onChange={(e) => handleUpdateWebsite(rec.id, e.target.value)}
                          className="w-48 px-2 py-1 glass-input text-xs font-mono text-cyan-300 rounded-lg focus:border-cyan-500"
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
                          className="w-full px-2 py-1 glass-input text-xs font-mono text-purple-200 rounded-lg focus:border-purple-500"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {rec.isAiGenerating ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-500/30 animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Generating...
                        </span>
                      ) : rec.ai_body ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setPreviewLeadId(rec.id);
                              const el = document.getElementById('ai-response-box');
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-200 bg-purple-500/20 hover:bg-purple-500/30 px-2.5 py-1 rounded-lg border border-purple-500/40 transition-all shadow-sm"
                            title="Inspect in AI Response Email Box"
                          >
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span>View in Box</span>
                            <Eye className="w-3 h-3 ml-0.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setPreviewLeadId(rec.id);
                            const el = document.getElementById('ai-response-box');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="text-[11px] text-gray-400 hover:text-purple-300 transition-colors flex items-center gap-1 font-mono"
                          title="Open this lead in AI Response Email Box"
                        >
                          <span>Template</span>
                          <Edit3 className="w-3 h-3 text-gray-500" />
                        </button>
                      )}
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
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditModal(rec)}
                          className="p-1.5 text-gray-400 hover:text-purple-300 transition-colors"
                          title="View / Edit Custom Email"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecipient(rec.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-400 transition-colors"
                          title="Remove recipient"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
            <span>Live Dispatcher & AI Rotator Activity Logs</span>
          </span>
          <span className="text-[10px] text-gray-500">Auto-scrolling stream</span>
        </div>

        <div className="h-44 overflow-y-auto space-y-1.5 text-gray-300 pr-2">
          {logs.length === 0 ? (
            <p className="text-gray-500 italic">Ready to start email campaign dispatch or AI generation...</p>
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

      {/* ------------------------------------------------------------- */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl bg-[#090d18] border border-purple-500/40 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white font-display">
                    Tailored AI Email Draft for {editingRecipient.company_name}
                  </h3>
                  <p className="text-xs text-cyan-300 font-mono">
                    {editingRecipient.website_url} • {editingRecipient.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingRecipient(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subject Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-300">
                Email Subject Line:
              </label>
              <input
                type="text"
                value={editAiSubject}
                onChange={(e) => setEditAiSubject(e.target.value)}
                className="w-full px-3.5 py-2 glass-input text-xs text-white rounded-xl font-sans focus:border-purple-400"
              />
            </div>

            {/* Body Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-300">
                Personalized Email Body:
              </label>
              <textarea
                rows={9}
                value={editAiBody}
                onChange={(e) => setEditAiBody(e.target.value)}
                className="w-full p-4 glass-input text-xs text-white rounded-xl font-mono leading-relaxed focus:border-purple-400"
              />
            </div>

            {/* Footer with Regenerate & Save */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={handleRegenerateSingleAiEmail}
                disabled={isSingleRegenerating}
                className="px-4 py-2 text-xs font-semibold text-purple-300 bg-purple-950/40 border border-purple-500/30 hover:bg-purple-500/20 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isSingleRegenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Regenerating with Gemini Rotator...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Regenerate with AI</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRecipient(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditedDraft}
                  className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg transition-all flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Draft</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
