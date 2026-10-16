import { useState, useEffect } from 'react';
import { 
  X, Key, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, 
  Trash2, Plus, Copy, Check, Eye, EyeOff, Play, ShieldAlert, Sparkles, Clock, RotateCcw
} from 'lucide-react';
import { 
  getGeminiKeysStatus, 
  addGeminiKeys, 
  testGeminiKey, 
  testAllGeminiKeys, 
  resetGeminiKeyCooldown, 
  removeGeminiKey 
} from '@/lib/api';
import { GeminiPoolStatus } from '@/types';

interface GeminiKeyManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeysChanged?: (keys: string[]) => void;
  initialModel?: string;
}

const GEMINI_MODELS = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Recommended)', badge: 'Reasoning & Agents' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', badge: 'General Purpose' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', badge: 'High Volume' },
  { id: 'gemini-4-argon', name: 'Gemini 4 Argon', badge: 'Deep Reasoning' },
];

interface KeyTestResult {
  index: number;
  key: string;
  masked_key: string;
  valid: boolean;
  status: 'active' | 'cooldown' | 'invalid' | 'error';
  status_code?: number;
  error_type?: string;
  latency_ms?: number;
  message: string;
}

export default function GeminiKeyManagerModal({
  isOpen,
  onClose,
  onKeysChanged,
  initialModel = 'gemini-3.8-flash',
}: GeminiKeyManagerModalProps) {
  const [keysInput, setKeysInput] = useState<string>('');
  const [savedKeysList, setSavedKeysList] = useState<string[]>([]);
  const [poolStatus, setPoolStatus] = useState<GeminiPoolStatus | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(initialModel);
  
  // Testing States
  const [isTestingAll, setIsTestingAll] = useState<boolean>(false);
  const [testingSingleIndex, setTestingSingleIndex] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<string, KeyTestResult>>({});
  
  // UI states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [alertBanner, setAlertBanner] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Load keys from localStorage & Backend Status
  const loadKeysAndStatus = async () => {
    try {
      const stored = localStorage.getItem('reachbot_gemini_keys');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedKeysList(parsed);
          setKeysInput(parsed.join('\n'));
        }
      }
      const status = await getGeminiKeysStatus();
      setPoolStatus(status);
    } catch (e: any) {
      console.warn('Failed to load rotator status:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadKeysAndStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleReveal = (key: string) => {
    setRevealedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 1. SAVE KEYS TO LOCALSTORAGE & ROTATOR POOL
  const handleSaveKeys = async () => {
    const rawKeys = keysInput
      .split(/[\n,;]+/)
      .map(k => k.trim())
      .filter(k => k.length > 5);

    // Deduplicate
    const uniqueKeys = Array.from(new Set(rawKeys));

    try {
      localStorage.setItem('reachbot_gemini_keys', JSON.stringify(uniqueKeys));
      setSavedKeysList(uniqueKeys);

      if (uniqueKeys.length > 0) {
        await addGeminiKeys(uniqueKeys);
      }

      const updated = await getGeminiKeysStatus();
      setPoolStatus(updated);

      if (onKeysChanged) {
        onKeysChanged(uniqueKeys);
      }

      setAlertBanner({
        type: 'success',
        message: `Saved ${uniqueKeys.length} Gemini API keys into the rotator pool!`
      });
      setTimeout(() => setAlertBanner(null), 4000);
    } catch (err: any) {
      setAlertBanner({
        type: 'error',
        message: `Failed to save keys: ${err.message}`
      });
    }
  };

  // 2. TEST A SINGLE KEY MANUALLY
  const handleTestSingleKey = async (rawKey: string, index: number) => {
    setTestingSingleIndex(index);
    try {
      const res = await testGeminiKey(rawKey, selectedModel);
      setTestResults(prev => ({
        ...prev,
        [rawKey]: {
          index,
          key: rawKey,
          masked_key: res.masked_key || rawKey.slice(0, 6) + '...' + rawKey.slice(-4),
          valid: res.valid,
          status: res.status || (res.valid ? 'active' : (res.status_code === 429 ? 'cooldown' : 'error')),
          status_code: res.status_code,
          error_type: res.error_type,
          latency_ms: res.latency_ms,
          message: res.message
        }
      }));

      // Refresh pool status to reflect change in DB/rotator
      const updated = await getGeminiKeysStatus();
      setPoolStatus(updated);
    } catch (err: any) {
      setTestResults(prev => ({
        ...prev,
        [rawKey]: {
          index,
          key: rawKey,
          masked_key: rawKey.slice(0, 6) + '...' + rawKey.slice(-4),
          valid: false,
          status: 'error',
          status_code: 500,
          error_type: 'NETWORK_ERROR',
          message: err.message || 'Key verification failed'
        }
      }));
    } finally {
      setTestingSingleIndex(null);
    }
  };

  // 3. TEST ALL KEYS RESPECTIVELY IN SEQUENCE
  const handleTestAllKeys = async () => {
    const keysToTest = savedKeysList.length > 0 
      ? savedKeysList 
      : keysInput.split(/[\n,;]+/).map(k => k.trim()).filter(k => k.length > 5);

    if (keysToTest.length === 0) {
      alert('Please enter at least one Gemini API key in the input box first.');
      return;
    }

    setIsTestingAll(true);
    setAlertBanner({
      type: 'info',
      message: `Testing all ${keysToTest.length} keys respectively against model "${selectedModel}"...`
    });

    try {
      const report = await testAllGeminiKeys(keysToTest, selectedModel);
      
      const newResultsMap: Record<string, KeyTestResult> = {};
      if (report && report.results) {
        for (const item of report.results) {
          newResultsMap[item.key] = item;
        }
      }
      setTestResults(newResultsMap);

      const updated = await getGeminiKeysStatus();
      setPoolStatus(updated);

      if (report.rate_limited_count > 0) {
        setAlertBanner({
          type: 'error',
          message: `Testing finished! Detected ${report.rate_limited_count} key(s) hitting HTTP 429 Rate Limit (Quota Exceeded). See details below.`
        });
      } else if (report.invalid_count > 0) {
        setAlertBanner({
          type: 'error',
          message: `Testing finished! ${report.active_count} active, ${report.invalid_count} invalid key(s).`
        });
      } else {
        setAlertBanner({
          type: 'success',
          message: `All ${report.active_count} keys tested successfully! Quota is healthy.`
        });
      }
    } catch (err: any) {
      setAlertBanner({
        type: 'error',
        message: `Bulk test error: ${err.message}`
      });
    } finally {
      setIsTestingAll(false);
    }
  };

  // 4. RESET COOLDOWN FOR A KEY OR ALL
  const handleResetCooldown = async (key?: string) => {
    try {
      await resetGeminiKeyCooldown(key);
      const updated = await getGeminiKeysStatus();
      setPoolStatus(updated);
      setAlertBanner({
        type: 'success',
        message: key ? 'Cooldown cleared for this key.' : 'Cleared cooldown on all keys!'
      });
      setTimeout(() => setAlertBanner(null), 3000);
    } catch (e: any) {
      alert(`Could not reset cooldown: ${e.message}`);
    }
  };

  // 5. REMOVE KEY
  const handleRemoveKey = async (rawKey: string) => {
    const filtered = savedKeysList.filter(k => k !== rawKey);
    setSavedKeysList(filtered);
    setKeysInput(filtered.join('\n'));
    localStorage.setItem('reachbot_gemini_keys', JSON.stringify(filtered));

    try {
      await removeGeminiKey(rawKey);
      const updated = await getGeminiKeysStatus();
      setPoolStatus(updated);
    } catch (e) {}

    if (onKeysChanged) {
      onKeysChanged(filtered);
    }
  };

  // Combined key items from saved list or backend pool
  const allKnownKeys = Array.from(new Set([
    ...savedKeysList,
    ...(poolStatus?.keys?.map(k => k.masked_key) || [])
  ]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-3xl bg-[#070b16] border-2 border-purple-500/50 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border-b border-purple-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
              <Key className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white font-display">
                  Gemini Key Rotator & Quota Health Inspector
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  429 Failover Ready
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Test each key individually to detect exactly which key is hitting a 429 quota error.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto font-sans flex-1">

          {/* Alert Banner */}
          {alertBanner && (
            <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 font-medium border animate-in fade-in ${
              alertBanner.type === 'success' ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200' :
              alertBanner.type === 'error' ? 'bg-rose-950/50 border-rose-500/40 text-rose-200' :
              'bg-cyan-950/50 border-cyan-500/40 text-cyan-200'
            }`}>
              {alertBanner.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> :
               alertBanner.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" /> :
               <RefreshCw className="w-4 h-4 animate-spin text-cyan-400 flex-shrink-0" />}
              <span>{alertBanner.message}</span>
            </div>
          )}

          {/* Top Pool Statistics Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Total Keys</span>
              <span className="text-xl font-mono font-extrabold text-white">
                {poolStatus?.total_keys ?? savedKeysList.length}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">🟢 Active / Healthy</span>
              <span className="text-xl font-mono font-extrabold text-emerald-400">
                {poolStatus?.active_keys ?? (savedKeysList.length > 0 ? savedKeysList.length : 0)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40">
              <span className="text-[10px] uppercase font-bold text-rose-400 block tracking-wider">🔴 429 Rate Limited</span>
              <span className="text-xl font-mono font-extrabold text-rose-300">
                {poolStatus?.cooldown_keys ?? 0}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30">
              <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">⚠️ Invalid</span>
              <span className="text-xl font-mono font-extrabold text-amber-300">
                {poolStatus?.invalid_keys ?? 0}
              </span>
            </div>
          </div>

          {/* Model Selector & Master Test Button Bar */}
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-300 whitespace-nowrap">Testing Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-black/60 border border-purple-500/40 text-xs font-mono text-purple-200 focus:outline-none focus:border-purple-400"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#090d18] text-white">
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {poolStatus && poolStatus.cooldown_keys > 0 && (
                <button
                  type="button"
                  onClick={() => handleResetCooldown()}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/30 hover:bg-amber-500/20 rounded-lg flex items-center gap-1.5 transition-all"
                  title="Clear cooldown for all rate-limited keys"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All Cooldowns</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleTestAllKeys}
                disabled={isTestingAll || (savedKeysList.length === 0 && !keysInput.trim())}
                className="px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 rounded-xl shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isTestingAll ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing All Keys Respectively...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>⚡ Test All Keys Respectively</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Respective Keys Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>Respective Key Diagnostic Health Table:</span>
              </h4>
              <span className="text-[11px] text-gray-400">
                Click &quot;Test Key&quot; on any key to inspect its exact response
              </span>
            </div>

            {savedKeysList.length === 0 ? (
              <div className="p-6 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center text-xs text-gray-400 space-y-2">
                <Key className="w-6 h-6 text-gray-500 mx-auto" />
                <p>No keys saved yet. Paste your Gemini API keys below and click &quot;Save Keys to Rotator&quot;.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {savedKeysList.map((rawKey, index) => {
                  const masked = rawKey.slice(0, 6) + '...' + rawKey.slice(-4);
                  const isRevealed = revealedKeys[rawKey] || false;
                  
                  // Match with backend status if available
                  const backendStat = poolStatus?.keys?.find(
                    k => k.masked_key === masked || k.masked_key.includes(rawKey.slice(0, 4))
                  );
                  
                  // Latest test result if ran during this session
                  const testRes = testResults[rawKey];
                  const isTestingThis = testingSingleIndex === index;

                  const is429 = (backendStat?.status === 'cooldown') || (testRes?.status_code === 429);
                  const isInvalid = (backendStat?.status === 'invalid') || (testRes?.status === 'invalid');
                  const isActive = (testRes?.valid) || (!is429 && !isInvalid && backendStat?.status === 'active');

                  return (
                    <div
                      key={index}
                      className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                        is429
                          ? 'bg-rose-950/30 border-rose-500/50 shadow-md shadow-rose-950/40'
                          : isInvalid
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : 'bg-[#090e1c] border-white/10 hover:border-purple-500/40'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        {/* Key Identifier */}
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-mono text-xs font-bold text-gray-300">
                            {index + 1}
                          </span>
                          <span className="font-mono text-xs text-cyan-300 font-semibold">
                            {isRevealed ? rawKey : masked}
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => toggleReveal(rawKey)}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                            title={isRevealed ? 'Hide full key' : 'Reveal full key'}
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => copyToClipboard(rawKey, `key-${index}`)}
                            className="p-1 text-gray-400 hover:text-cyan-300 transition-colors"
                            title="Copy key"
                          >
                            {copiedKey === `key-${index}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Status Badges & Quick Stats */}
                        <div className="flex items-center gap-2">
                          {backendStat && (
                            <span className="text-[11px] text-gray-400 font-mono hidden sm:inline">
                              {backendStat.requests_count} calls ({backendStat.success_count} ok, {backendStat.error_count} err)
                            </span>
                          )}

                          {is429 ? (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold font-mono uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                              <span>429 Quota Exceeded</span>
                              {backendStat?.cooldown_remaining_sec ? (
                                <span className="opacity-80">({backendStat.cooldown_remaining_sec}s)</span>
                              ) : null}
                            </span>
                          ) : isInvalid ? (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>Invalid Key</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Active</span>
                            </span>
                          )}

                          {/* Individual Key Actions */}
                          <button
                            type="button"
                            onClick={() => handleTestSingleKey(rawKey, index)}
                            disabled={isTestingThis || isTestingAll}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-purple-600/80 hover:bg-purple-500 rounded-lg flex items-center gap-1 transition-all disabled:opacity-50"
                            title="Test this single key now"
                          >
                            {isTestingThis ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3 fill-white" />
                            )}
                            <span>Test Key</span>
                          </button>

                          {is429 && (
                            <button
                              type="button"
                              onClick={() => handleResetCooldown(rawKey)}
                              className="p-1 rounded text-amber-400 hover:text-white hover:bg-amber-500/20 transition-all"
                              title="Reset cooldown for this key"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveKey(rawKey)}
                            className="p-1 rounded text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Remove key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Diagnostic Error / Result Detail Strip */}
                      {(testRes || backendStat?.last_error) && (
                        <div className={`p-2.5 rounded-lg text-[11px] font-mono leading-relaxed border flex items-start gap-2 ${
                          is429
                            ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                            : testRes?.valid
                            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                            : 'bg-black/50 border-white/10 text-gray-300'
                        }`}>
                          {is429 ? (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                          ) : testRes?.valid ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Key className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            {testRes ? (
                              <div>
                                <span className="font-bold">{testRes.message}</span>
                                {testRes.latency_ms && (
                                  <span className="text-gray-400 ml-1.5 font-normal">
                                    (Latency: {testRes.latency_ms}ms)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div>
                                <span className="font-bold">Last Recorded Error: </span>
                                <span>{backendStat?.last_error}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Paste & Add Multiple Keys Section */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">
                Paste / Manage Raw Gemini API Keys:
              </label>
              <span className="text-[11px] text-gray-500">One key per line or comma-separated</span>
            </div>
            <textarea
              rows={4}
              value={keysInput}
              onChange={(e) => setKeysInput(e.target.value)}
              placeholder="AIzaSyA123456789...&#10;AIzaSyB987654321..."
              className="w-full p-3.5 glass-input text-xs text-white rounded-xl font-mono leading-relaxed focus:border-purple-400"
            />
            <p className="text-[11px] text-gray-400">
              🛡️ The key rotator automatically catches HTTP 429 quota limits, places the exhausted key on a 60-second cooldown, and switches immediately to the next healthy key in your pool.
            </p>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 bg-[#050811] border-t border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveKeys}
              className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save &amp; Sync Keys</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
