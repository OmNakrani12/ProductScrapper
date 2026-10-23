import { Job, JobProgress, WebsiteResult, UploadResponse, PaginatedResponse } from '@/types';

const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
const API_BASE = rawApiUrl ? `${rawApiUrl}/api` : '/api';

async function handleFetch(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || `Server returned error ${res.status}`);
    }
    return res.json();
  } catch (err: any) {
    if (err.name === 'TypeError' || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
      throw new Error('Cannot connect to FastAPI backend server. Please make sure the backend is running on http://localhost:8000 (uvicorn app.main:app --reload --port 8000)');
    }
    throw err;
  }
}

export async function uploadJob(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return handleFetch(`${API_BASE}/jobs/upload`, {
    method: 'POST',
    body: formData,
  });
}

export async function createJobDirect(urls: string[], filename: string = 'manual_input.txt'): Promise<UploadResponse> {
  return handleFetch(`${API_BASE}/jobs/direct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, filename }),
  });
}

export async function getJobs(page: number = 1, pageSize: number = 20): Promise<PaginatedResponse<Job>> {
  return handleFetch(`${API_BASE}/jobs?page=${page}&page_size=${pageSize}`);
}

export async function getJobProgress(jobId: string): Promise<JobProgress> {
  return handleFetch(`${API_BASE}/jobs/${jobId}/progress`, {
    cache: 'no-store'
  });
}

export async function getJobResults(
  jobId: string,
  page: number = 1,
  pageSize: number = 25,
  search: string = '',
  status: string = 'all',
  hasPersonalEmail: boolean = false,
  hasBusinessEmail: boolean = false,
  hasPrimaryEmail: boolean = false,
  hasContactInfo: boolean = false,
  hasSocialLinks: boolean = false,
  onlySuccess: boolean = false
): Promise<PaginatedResponse<WebsiteResult>> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  if (search) params.append('search', search);
  if (status && status !== 'all') params.append('status', status);
  if (hasPersonalEmail) params.append('has_personal_email', 'true');
  if (hasBusinessEmail) params.append('has_business_email', 'true');
  if (hasPrimaryEmail) params.append('has_primary_email', 'true');
  if (hasContactInfo) params.append('has_contact_info', 'true');
  if (hasSocialLinks) params.append('has_social_links', 'true');
  if (onlySuccess) params.append('only_success', 'true');

  return handleFetch(`${API_BASE}/jobs/${jobId}/results?${params.toString()}`);
}

export function downloadCSV(jobId: string): void {
  window.open(`${API_BASE}/jobs/${jobId}/export/csv`, '_blank');
}

export function downloadXLSX(jobId: string): void {
  window.open(`${API_BASE}/jobs/${jobId}/export/xlsx`, '_blank');
}

export function downloadJSON(jobId: string): void {
  window.open(`${API_BASE}/jobs/${jobId}/export/json`, '_blank');
}

export async function deleteJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Failed to delete job');
  }
}

export async function sendCampaignEmail(payload: {
  recipient_email: string;
  subject: string;
  body: string;
  company_name?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  sender_name?: string;
  sender_email?: string;
}): Promise<any> {
  return handleFetch(`${API_BASE}/jobs/campaign/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export interface DiscoveredProduct {
  url: string;
  title: string;
  domain: string;
}

export interface DirectoryExtractResponse {
  directory_url: string;
  total_products_found: number;
  products: DiscoveredProduct[];
  error?: string | null;
}

export async function extractDirectoryProducts(directoryUrl: string): Promise<DirectoryExtractResponse> {
  return handleFetch(`${API_BASE}/directory/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directory_url: directoryUrl }),
  });
}

export async function extractDirectoryProductsRange(
  urlPattern: string,
  startNumber: number,
  endNumber: number
): Promise<DirectoryExtractResponse> {
  return handleFetch(`${API_BASE}/directory/extract-range`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url_pattern: urlPattern,
      start_number: startNumber,
      end_number: endNumber,
    }),
  });
}

export async function scrapeDiscoveredProducts(urls: string[], filename: string = 'directory_products.txt'): Promise<UploadResponse> {
  return handleFetch(`${API_BASE}/directory/scrape-discovered`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, filename }),
  });
}

// -------------------------------------------------------------
// Gemini AI Email Generator & Key Rotator API Methods
// -------------------------------------------------------------

export async function generateAIEmail(payload: {
  user_instruction: string;
  website_url?: string;
  websites?: string[];
  company_name?: string | null;
  companies?: string[];
  recipient_email?: string | null;
  lead_context?: any;
  gemini_api_keys?: string[];
  model?: string;
  result_id?: string;
  result_ids?: string[];
}): Promise<any> {
  return handleFetch(`${API_BASE}/ai/generate-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function batchGenerateJobAIEmails(
  jobId: string,
  payload: {
    user_instruction: string;
    result_ids?: string[];
    overwrite_existing?: boolean;
    gemini_api_keys?: string[];
    model?: string;
  }
): Promise<any> {
  return handleFetch(`${API_BASE}/ai/jobs/${jobId}/batch-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getGeminiKeysStatus(): Promise<any> {
  return handleFetch(`${API_BASE}/ai/keys/status`, {
    cache: 'no-store'
  });
}

export async function addGeminiKeys(keys: string[]): Promise<any> {
  return handleFetch(`${API_BASE}/ai/keys/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  });
}

export async function testGeminiKey(key: string, model: string = 'gemini-3.8-flash'): Promise<any> {
  return handleFetch(`${API_BASE}/ai/keys/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, model }),
  });
}

export async function testAllGeminiKeys(keys?: string[], model: string = 'gemini-3.8-flash'): Promise<any> {
  return handleFetch(`${API_BASE}/ai/keys/test-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys, model }),
  });
}

export async function resetGeminiKeyCooldown(key?: string): Promise<any> {
  return handleFetch(`${API_BASE}/ai/keys/reset-cooldown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
}

export async function removeGeminiKey(key: string): Promise<any> {
  return handleFetch(`${API_BASE}/ai/keys/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
}

export async function updateResultAIEmail(
  jobId: string,
  resultId: string,
  subject: string,
  body: string
): Promise<any> {
  return handleFetch(`${API_BASE}/ai/jobs/${jobId}/results/${resultId}/ai-email`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, body }),
  });
}

