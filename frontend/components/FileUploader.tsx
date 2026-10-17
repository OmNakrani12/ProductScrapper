import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, Play, Sparkles, FileCode, RefreshCw, Compass, ExternalLink, Search, CheckSquare, Square, Download, Hash, Layers } from 'lucide-react';
import { uploadJob, createJobDirect, extractDirectoryProducts, extractDirectoryProductsRange, scrapeDiscoveredProducts, DiscoveredProduct, DirectoryExtractResponse } from '@/lib/api';
import { UploadResponse } from '@/types';

interface FileUploaderProps {
  onJobCreated: (jobId: string) => void;
}

export default function FileUploader({ onJobCreated }: FileUploaderProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'manual' | 'directory'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [manualText, setManualText] = useState('');
  
  // Directory Finder state
  const [directoryUrl, setDirectoryUrl] = useState('https://www.scrolllaunch.com/week/2026/{number}');
  const [dirMode, setDirMode] = useState<'range' | 'single'>('range');
  const [startNumber, setStartNumber] = useState<number>(1);
  const [endNumber, setEndNumber] = useState<number>(38);
  const [isExtractingDir, setIsExtractingDir] = useState(false);
  const [discoveredProducts, setDiscoveredProducts] = useState<DiscoveredProduct[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [dirSearchQuery, setDirSearchQuery] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (selectedFile: File) => {
    const ext = selectedFile.name.toLowerCase().split('.').pop();
    if (!['csv', 'xlsx', 'xls', 'txt'].includes(ext || '')) {
      setError('Unsupported file type. Please upload CSV, XLSX, or TXT file.');
      return;
    }
    setError(null);
    setFile(selectedFile);
    setUploadResult(null);
  };

  const handleDiscoverDirectoryProducts = async () => {
    if (!directoryUrl.trim()) {
      setError('Please enter a directory website URL (e.g. https://www.scrolllaunch.com/week/2026/38)');
      return;
    }

    // Auto-fix triple slashes or formatting typos e.g. https:///www.scrolllaunch.com/
    let cleanTarget = directoryUrl.trim().replace(/^(https?):\/+/, '$1://');
    if (!/^https?:\/\//i.test(cleanTarget)) {
      cleanTarget = `https://${cleanTarget}`;
    }

    setIsExtractingDir(true);
    setError(null);
    setDiscoveredProducts([]);
    setSelectedUrls(new Set());

    try {
      let res: DirectoryExtractResponse;
      if (dirMode === 'range') {
        res = await extractDirectoryProductsRange(cleanTarget, startNumber, endNumber);
      } else {
        res = await extractDirectoryProducts(cleanTarget);
      }

      if (res.error && res.total_products_found === 0) {
        setError(res.error);
      } else if (res.products.length === 0) {
        setError('No external product links found on the specified directory page(s).');
      } else {
        setDiscoveredProducts(res.products);
        setSelectedUrls(new Set(res.products.map(p => p.url)));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to discover product links from directory');
    } finally {
      setIsExtractingDir(false);
    }
  };

  const handleExportDiscoveredCSV = () => {
    if (discoveredProducts.length === 0) return;
    const header = 'Title,Domain,URL\n';
    const rows = discoveredProducts
      .map(p => `"${(p.title || '').replace(/"/g, '""')}","${(p.domain || '').replace(/"/g, '""')}","${p.url}"`)
      .join('\n');
    
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', dirMode === 'range' ? `discovered_products_${startNumber}_to_${endNumber}.csv` : 'discovered_products.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelectUrl = (url: string) => {
    const updated = new Set(selectedUrls);
    if (updated.has(url)) {
      updated.delete(url);
    } else {
      updated.add(url);
    }
    setSelectedUrls(updated);
  };

  const toggleSelectAll = () => {
    if (selectedUrls.size === filteredDiscoveredProducts.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(filteredDiscoveredProducts.map(p => p.url)));
    }
  };

  const filteredDiscoveredProducts = discoveredProducts.filter(p => 
    p.title.toLowerCase().includes(dirSearchQuery.toLowerCase()) ||
    p.domain.toLowerCase().includes(dirSearchQuery.toLowerCase()) ||
    p.url.toLowerCase().includes(dirSearchQuery.toLowerCase())
  );

  const handleStartScan = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (activeTab === 'upload' && file) {
        const res = await uploadJob(file);
        setUploadResult(res);
        onJobCreated(res.job_id);
      } else if (activeTab === 'manual' && manualText.trim()) {
        const urls = manualText
          .split('\n')
          .map((u) => u.trim())
          .filter(Boolean);

        if (urls.length === 0) {
          setError('Please enter at least one URL');
          setIsLoading(false);
          return;
        }

        const res = await createJobDirect(urls, 'manual_urls.txt');
        setUploadResult(res);
        onJobCreated(res.job_id);
      } else if (activeTab === 'directory' && selectedUrls.size > 0) {
        const urlsToScrape = Array.from(selectedUrls);
        const dirDomain = directoryUrl.replace(/^https?:\/\//i, '').split('/')[0];
        const res = await scrapeDiscoveredProducts(urlsToScrape, `directory_${dirDomain}.txt`);
        setUploadResult(res);
        onJobCreated(res.job_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start scraping job');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Upload Header Tabs (Compact Firebase Console Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-matte-700/80 pb-2.5 gap-2">
        <div className="flex items-center flex-wrap gap-1 p-1 rounded-lg bg-matte-900 border border-matte-700/80 w-full sm:w-auto">
          <button
            onClick={() => { setActiveTab('upload'); setError(null); }}
            className={`flex-1 sm:flex-initial px-3 py-2 sm:py-1 text-xs font-semibold rounded-md transition-all text-center touch-target sm:min-h-0 flex items-center justify-center ${
              activeTab === 'upload'
                ? 'bg-firebase-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            File Upload
          </button>
          <button
            onClick={() => { setActiveTab('manual'); setError(null); }}
            className={`flex-1 sm:flex-initial px-3 py-2 sm:py-1 text-xs font-semibold rounded-md transition-all text-center touch-target sm:min-h-0 flex items-center justify-center ${
              activeTab === 'manual'
                ? 'bg-firebase-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Direct URLs
          </button>
          <button
            onClick={() => { setActiveTab('directory'); setError(null); }}
            className={`w-full sm:w-auto px-3 py-2 sm:py-1 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 touch-target sm:min-h-0 ${
              activeTab === 'directory'
                ? 'bg-firebase-600 text-white shadow-sm font-bold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Directory Finder</span>
          </button>
        </div>
        <span className="text-[11px] text-firebase-400 font-medium flex items-center gap-1 font-mono self-end sm:self-auto">
          <Sparkles className="w-3 h-3" /> MX & DNS Deliverability
        </span>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'upload' ? (
        <div>
          {/* Dropzone Card - Compact */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative p-5 sm:p-6 rounded-xl border-2 border-dashed transition-all duration-150 cursor-pointer text-center group ${
              isDragging
                ? 'border-firebase-500 bg-firebase-600/10'
                : file
                ? 'border-emerald-500/50 bg-emerald-950/20'
                : 'border-matte-700 hover:border-firebase-500/60 bg-matte-850 hover:bg-matte-800'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="max-w-sm mx-auto space-y-2">
              <div className="w-10 h-10 rounded-xl bg-firebase-600/15 border border-firebase-500/30 flex items-center justify-center mx-auto text-firebase-400">
                <UploadCloud className="w-5 h-5" />
              </div>

              {file ? (
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-mono">{file.name}</span>
                    <span className="text-[10px] text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <p className="text-[11px] text-gray-400">Click to change file</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-white">
                    Drop CSV, XLSX, or TXT file here, or click to browse
                  </div>
                  <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-gray-400">
                    <span className="px-1.5 py-0.5 rounded bg-surface border border-border">CSV</span>
                    <span className="px-1.5 py-0.5 rounded bg-surface border border-border">XLSX</span>
                    <span className="px-1.5 py-0.5 rounded bg-surface border border-border">TXT</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'manual' ? (
        /* Manual URL Textarea */
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-300">
            Target website URLs (one per line):
          </label>
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            rows={4}
            placeholder={`https://stripe.com\nhttps://openai.com\nexample.com`}
            className="w-full p-2.5 bg-matte-900 border border-matte-700 focus:border-firebase-500 focus:outline-none text-xs text-white font-mono rounded-lg placeholder-gray-600 transition-all shadow-inner"
          />
        </div>
      ) : (
        /* Directory Product Finder Tab */
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-card border border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-accent uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-accent" />
                <span>Extract Product Links from Directory / Showcase</span>
              </label>

              {/* Mode Selector */}
              <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setDirMode('range')}
                  className={`px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                    dirMode === 'range'
                      ? 'bg-accent text-white font-semibold shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                  <span>Batch Sequence Range</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDirMode('single')}
                  className={`px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                    dirMode === 'single'
                      ? 'bg-accent text-white font-semibold shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Single Page</span>
                </button>
              </div>
            </div>

            {/* Input & Discover Action */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={directoryUrl}
                  onChange={(e) => setDirectoryUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDiscoverDirectoryProducts()}
                  placeholder={
                    dirMode === 'range'
                      ? "Directory Pattern with {number} (e.g. https://www.scrolllaunch.com/week/2026/{number})"
                      : "Directory URL (e.g. https://producthunt.com)"
                  }
                  className="flex-1 px-3.5 py-2.5 bg-surface border border-border focus:border-accent focus:outline-none text-xs text-white rounded-xl placeholder-gray-500 font-mono shadow-inner min-w-0"
                />
                <button
                  onClick={handleDiscoverDirectoryProducts}
                  disabled={isExtractingDir || !directoryUrl.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold text-xs rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2 flex-shrink-0 touch-target"
                >
                  {isExtractingDir ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{dirMode === 'range' ? `Scanning ${startNumber}..${endNumber}...` : 'Extracting...'}</span>
                    </>
                  ) : (
                    <>
                      <Compass className="w-3.5 h-3.5" />
                      <span>{dirMode === 'range' ? 'Batch Extract Links' : 'Discover Links'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Range Inputs */}
              {dirMode === 'range' && (
                <div className="p-3 bg-surface/50 rounded-xl border border-border/80 space-y-2">
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-300 font-medium">Start Number:</span>
                      <input
                        type="number"
                        min={1}
                        max={9999}
                        value={startNumber}
                        onChange={(e) => setStartNumber(parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-1.5 bg-card border border-border rounded-lg text-white font-mono text-xs text-center focus:border-accent"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-300 font-medium">End Number:</span>
                      <input
                        type="number"
                        min={1}
                        max={9999}
                        value={endNumber}
                        onChange={(e) => setEndNumber(parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-1.5 bg-card border border-border rounded-lg text-white font-mono text-xs text-center focus:border-accent"
                      />
                    </div>

                    <div className="text-[11px] text-accent font-mono">
                      Scanning {Math.max(1, endNumber - startNumber + 1)} pages (week {startNumber} to {endNumber})
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Write <code className="text-amber-400 font-bold">{'{number}'}</code> in your URL pattern (e.g. <code className="text-amber-400">https://www.scrolllaunch.com/week/2026/{'{number}'}</code>). Only <code className="text-amber-400 font-bold">{'{number}'}</code> will be replaced from <code className="text-white font-bold">{startNumber}</code> to <code className="text-white font-bold">{endNumber}</code>.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Discovered Products List */}
          {discoveredProducts.length > 0 && (
            <div className="p-4 rounded-xl bg-card border border-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Discovered Products</span>
                    <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs font-mono font-semibold">
                      {discoveredProducts.length} Unique Websites
                    </span>
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {selectedUrls.size} of {discoveredProducts.length} selected for contact scraping
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportDiscoveredCSV}
                    className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs text-emerald-400 font-medium rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>

                  <button
                    onClick={toggleSelectAll}
                    className="px-3 py-1.5 bg-surface border border-border hover:border-gray-500 text-xs text-gray-300 font-medium rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {selectedUrls.size === filteredDiscoveredProducts.length ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-accent" />
                        <span>Deselect All</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5 text-gray-400" />
                        <span>Select All</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Search Bar inside Discovered Products */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={dirSearchQuery}
                  onChange={(e) => setDirSearchQuery(e.target.value)}
                  placeholder="Filter discovered products by name or domain..."
                  className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border focus:border-accent text-xs text-white rounded-lg placeholder-gray-500"
                />
              </div>

              {/* Products Table */}
              <div className="max-h-60 overflow-y-auto border border-border/80 rounded-xl divide-y divide-border/60">
                {filteredDiscoveredProducts.map((prod, idx) => {
                  const isSelected = selectedUrls.has(prod.url);
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleSelectUrl(prod.url)}
                      className={`p-3 flex items-center justify-between text-xs cursor-pointer transition-colors ${
                        isSelected ? 'bg-accent/10' : 'hover:bg-surface/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded accent-accent"
                        />
                        <div>
                          <div className="font-semibold text-white">{prod.title}</div>
                          <span className="font-mono text-[11px] text-gray-400">{prod.domain}</span>
                        </div>
                      </div>

                      <a
                        href={prod.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-accent hover:underline flex items-center gap-1 font-mono text-[11px]"
                      >
                        <span>Visit</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action CTA Button */}
      <div className="pt-1">
        <button
          onClick={handleStartScan}
          disabled={
            isLoading ||
            (activeTab === 'upload' && !file) ||
            (activeTab === 'manual' && !manualText.trim()) ||
            (activeTab === 'directory' && selectedUrls.size === 0)
          }
          className="w-full py-3 sm:py-2.5 px-4 firebase-btn-primary text-white font-semibold text-xs sm:text-sm rounded-lg shadow-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all touch-target"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Starting Extraction Job...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {activeTab === 'directory'
                  ? `Extract Contacts for ${selectedUrls.size} Products`
                  : 'Start Contact Extraction'}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
