import { useState } from 'react';
import { 
  Mail, Sparkles, Copy, Check, ExternalLink, RefreshCw, 
  Edit3, Save, X, Send, ChevronDown, ChevronUp, Globe, Key, AlertCircle 
} from 'lucide-react';
import { WebsiteResult } from '@/types';
import { generateAIEmail, updateResultAIEmail } from '@/lib/api';
import GeminiKeyManagerModal from './GeminiKeyManagerModal';

export interface AssociatedWebsiteItem {
  result_id?: string;
  website_url: string;
  domain?: string;
  company_name?: string;
}

interface AIEmailBoxProps {
  result: WebsiteResult;
  associatedWebsites?: AssociatedWebsiteItem[];
  jobId?: string;
  onClose?: () => void;
  onUpdated?: (updatedResult: WebsiteResult) => void;
  defaultPrompt?: string;
  compact?: boolean;
}

const GEMINI_MODELS = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', badge: 'Recommended • Reasoning & Agents' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', badge: 'General-purpose & Multimodal' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', badge: 'Fast, Cost-Efficient, High-Volume' },
  { id: 'gemini-4-argon', name: 'Gemini 4 Argon', badge: 'Complex Reasoning & Math' },
];

export default function AIEmailBox({
  result,
  associatedWebsites = [],
  jobId,
  onClose,
  onUpdated,
  defaultPrompt = 'Visit this website and invite that website host to host platform. Highlight our 99.99% uptime, ultra-low latency, and free migration assistance.',
  compact = false,
}: AIEmailBoxProps) {
  const [subject, setSubject] = useState<string>(result.ai_email_subject || '');
  const [body, setBody] = useState<string>(result.ai_email_body || '');
  const [instruction, setInstruction] = useState<string>(result.ai_email_prompt || defaultPrompt);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editSubject, setEditSubject] = useState<string>(result.ai_email_subject || '');
  const [editBody, setEditBody] = useState<string>(result.ai_email_body || '');
  
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState<boolean>(!result.ai_email_body);
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);

  const recipientEmail = result.primary_email || (result.emails && result.emails[0]) || '';
  const domain = result.website_url.replace(/^https?:\/\//i, '').split('/')[0] || result.website_url;

  // Aggregate multi-site list
  const allWebsites = [result.website_url];
  const allCompanies = result.company_name ? [result.company_name] : [];
  const allResultIds = result.id ? [result.id] : [];

  if (associatedWebsites && associatedWebsites.length > 0) {
    associatedWebsites.forEach((w) => {
      if (w.website_url && !allWebsites.includes(w.website_url)) {
        allWebsites.push(w.website_url);
      }
      if (w.company_name && !allCompanies.includes(w.company_name)) {
        allCompanies.push(w.company_name);
      }
      if (w.result_id && !allResultIds.includes(w.result_id)) {
        allResultIds.push(w.result_id);
      }
    });
  }

  const isMultiSite = allWebsites.length > 1;

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg(null);

    // Retrieve saved keys if any
    let savedKeys: string[] | undefined;
    try {
      const stored = localStorage.getItem('reachbot_gemini_keys');
      if (stored) savedKeys = JSON.parse(stored);
    } catch (e) {}

    try {
      const resp = await generateAIEmail({
        user_instruction: instruction,
        website_url: result.website_url,
        websites: isMultiSite ? allWebsites : undefined,
        company_name: result.company_name,
        companies: isMultiSite ? allCompanies : undefined,
        recipient_email: recipientEmail,
        gemini_api_keys: savedKeys,
        model: selectedModel,
        result_id: result.id,
        result_ids: allResultIds.length > 1 ? allResultIds : undefined,
        lead_context: {
          about: result.about_page,
          contact_page: result.contact_page,
          pages_scanned: result.pages_scanned,
        },
      });

      setSubject(resp.subject);
      setBody(resp.body);
      setEditSubject(resp.subject);
      setEditBody(resp.body);
      setShowConfig(false);

      if (onUpdated) {
        onUpdated({
          ...result,
          ai_email_subject: resp.subject,
          ai_email_body: resp.body,
          ai_email_prompt: instruction,
          ai_email_generated_at: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'AI generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      const currentJobId = jobId || result.job_id;
      if (currentJobId) {
        const targetIds = allResultIds.length > 0 ? allResultIds : (result.id ? [result.id] : []);
        await Promise.all(targetIds.map(rid => updateResultAIEmail(currentJobId, rid, editSubject, editBody)));
      }
      setSubject(editSubject);
      setBody(editBody);
      setIsEditing(false);

      if (onUpdated) {
        onUpdated({
          ...result,
          ai_email_subject: editSubject,
          ai_email_body: editBody,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Mailto link for 1-click external client opening
  const mailtoHref = recipientEmail
    ? `mailto:${recipientEmail}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`
    : '';

  return (
    <div className="rounded-2xl border-2 border-purple-500/50 bg-[#060a14] shadow-2xl overflow-hidden space-y-0 text-left transition-all">
      {/* Box Header Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border-b border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-inner">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-white font-display tracking-tight">
                AI Response Email Box
              </h3>
              {isMultiSite && (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {allWebsites.length} Sites Combined
                </span>
              )}
              {body ? (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Ready
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Not Generated
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400">
              {isMultiSite 
                ? `Unified multi-platform pitch covering ${allWebsites.length} websites for this host`
                : <>Personalized pitch for <span className="text-white font-semibold">{result.company_name || domain}</span></>
              }
            </p>
          </div>
        </div>

        {/* Right actions: Model badge and close */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded-lg bg-black/50 border border-purple-500/30 text-purple-200">
            {selectedModel}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close Box"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metadata Info Strip */}
      <div className="px-5 py-3 bg-[#0a0f1d] border-b border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="flex items-center gap-2 truncate">
          <span className="text-gray-400 font-semibold text-[11px]">To:</span>
          {recipientEmail ? (
            <div className="inline-flex items-center gap-1.5 font-mono text-cyan-300 font-medium truncate">
              <span className="truncate">{recipientEmail}</span>
              <button
                onClick={() => handleCopy(recipientEmail, 'recipient')}
                className="text-cyan-400 hover:text-white transition-colors"
                title="Copy Email"
              >
                {copiedKey === 'recipient' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          ) : (
            <span className="text-gray-500 italic">No email found</span>
          )}
        </div>

        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-gray-400 font-semibold text-[11px]">
              {isMultiSite ? `Target Websites (${allWebsites.length}):` : 'Target Website:'}
            </span>
            {isMultiSite && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-500/30 text-purple-200 border border-purple-500/40">
                1 Consolidated Email
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {allWebsites.map((siteUrl, sIdx) => {
              const siteDomain = siteUrl.replace(/^https?:\/\//i, '').split('/')[0] || siteUrl;
              return (
                <a
                  key={sIdx}
                  href={siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 hover:text-white bg-purple-950/40 border border-purple-500/30 px-1.5 py-0.5 rounded text-[10px] hover:underline inline-flex items-center gap-0.5 font-mono"
                >
                  <span className="truncate max-w-[130px]">{siteDomain}</span>
                  <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                </a>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-start sm:justify-end gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="text-[11px] text-purple-300 hover:text-purple-200 flex items-center gap-1 font-medium transition-colors"
          >
            <span>{showConfig ? 'Hide Generator Settings' : 'Generator Settings & Prompt'}</span>
            {showConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Generator Settings & Custom Instruction Accordion */}
      {showConfig && (
        <div className="p-4 sm:p-5 bg-purple-950/20 border-b border-purple-500/20 space-y-3 animate-in fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Model Selector */}
            <div className="sm:col-span-1 space-y-1">
              <label className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block">
                Gemini Model:
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-purple-500/40 text-xs text-white font-mono focus:border-purple-400 focus:outline-none"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#090d18] text-white">
                    {m.name} ({m.badge})
                  </option>
                ))}
              </select>
            </div>

            {/* Instruction prompt */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block">
                Custom Prompt / Objective:
              </label>
              <textarea
                rows={2}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="e.g. visit all websites and invite that website host to host platform..."
                className="w-full p-2.5 rounded-xl bg-black/60 border border-purple-500/40 text-xs text-white font-sans focus:border-purple-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-500/20">
            <button
              type="button"
              onClick={() => setShowKeyModal(true)}
              className="text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
              title="Test all Gemini API keys to identify 429 quota exhaustion or errors"
            >
              <Key className="w-3.5 h-3.5 text-cyan-400" />
              <span>Inspect &amp; Test Keys (429 Detector)</span>
            </button>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 rounded-xl shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating with Key Rotator...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{body ? 'Regenerate Email with Prompt' : 'Generate AI Email Response'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error message banner */}
      {errorMsg && (
        <div className="mx-5 my-3 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span className="font-mono">{errorMsg}</span>
        </div>
      )}

      {/* Main Email Box Content */}
      <div className="p-5 sm:p-6 space-y-5 bg-[#050811]/95">
        {body ? (
          <>
            {/* SUBJECT BOX */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Email Subject Line:
                </span>
                {!isEditing && (
                  <button
                    onClick={() => handleCopy(subject, 'subject')}
                    className="text-[11px] font-mono text-cyan-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'subject' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'subject' ? 'Copied!' : 'Copy Subject'}</span>
                  </button>
                )}
              </div>

              {isEditing ? (
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full p-3 rounded-xl bg-black/60 border border-purple-500/50 text-sm font-semibold text-white focus:outline-none focus:border-purple-400"
                />
              ) : (
                <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/40 text-sm font-bold text-white shadow-inner font-sans">
                  {subject}
                </div>
              )}
            </div>

            {/* MESSAGE BODY BOX */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Email Message Body:
                </span>
                {!isEditing && (
                  <button
                    onClick={() => handleCopy(body, 'body')}
                    className="text-[11px] font-mono text-cyan-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    {copiedKey === 'body' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'body' ? 'Copied!' : 'Copy Body'}</span>
                  </button>
                )}
              </div>

              {isEditing ? (
                <textarea
                  rows={8}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full p-4 rounded-xl bg-black/60 border border-purple-500/50 text-xs sm:text-sm font-mono text-gray-200 focus:outline-none focus:border-purple-400 leading-relaxed"
                />
              ) : (
                <div className="p-4 sm:p-5 rounded-xl bg-black/70 border border-white/10 text-xs sm:text-sm text-gray-200 font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto shadow-inner border-l-4 border-l-purple-500">
                  {body}
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                {/* Copy Full Email */}
                <button
                  onClick={() => {
                    const full = `Subject: ${subject}\n\n${body}`;
                    handleCopy(full, 'full');
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-gray-200 bg-white/5 border border-white/10 hover:border-white/20 rounded-xl flex items-center gap-1.5 transition-all"
                >
                  {copiedKey === 'full' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'full' ? 'Full Email Copied!' : 'Copy Full Email'}</span>
                </button>

                {/* Mailto App Launcher */}
                {recipientEmail && (
                  <a
                    href={mailtoHref}
                    className="px-3.5 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950/30 border border-cyan-500/30 hover:border-cyan-500/50 rounded-xl flex items-center gap-1.5 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Open in Email Client</span>
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white rounded-xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
                    >
                      {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>Save Changes</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setEditSubject(subject);
                      setEditBody(body);
                      setIsEditing(true);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-950/40 border border-purple-500/30 hover:border-purple-400 rounded-xl flex items-center gap-1.5 transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Draft</span>
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Empty State when no email generated yet */
          <div className="p-8 text-center rounded-xl bg-white/[0.02] border border-dashed border-white/10 space-y-3">
            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 w-fit mx-auto border border-purple-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">No AI Response Email Generated Yet</p>
              <p className="text-xs text-gray-400 max-w-md mx-auto mt-1">
                Click below to generate a tailored outreach email using Gemini {selectedModel} and our Key Rotator pool.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 rounded-xl shadow-xl inline-flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating with Gemini {selectedModel}...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate AI Email Response Now</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Gemini Key Rotator & 429 Quota Health Inspector Modal */}
      <GeminiKeyManagerModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        initialModel={selectedModel}
      />
    </div>
  );
}
