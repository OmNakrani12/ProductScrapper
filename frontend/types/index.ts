export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ResultStatus = 'success' | 'failed' | 'no_contact_found' | 'processing' | 'pending';

export interface Job {
  id: string;
  filename: string;
  total_websites: number;
  processed_websites: number;
  successful_websites: number;
  failed_websites: number;
  emails_found: number;
  personal_emails_found?: number;
  phones_found: number;
  personal_phones_found?: number;
  status: JobStatus;
  error_message?: string | null;
  created_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface WebsiteResult {
  id: string;
  job_id: string;
  website_url: string;
  company_name: string | null;
  emails: string[];
  personal_emails?: string[];
  business_emails?: string[];
  primary_email?: string | null;
  phone_numbers: string[];
  personal_phones?: string[];
  business_phones?: string[];
  social_links?: Record<string, string[]>;
  contact_page: string | null;
  about_page: string | null;
  pages_scanned: number;
  duration_seconds: number;
  status: ResultStatus;
  error_message: string | null;
  created_at?: string | null;
}

export interface JobProgress {
  job_id: string;
  filename: string;
  status: JobStatus;
  total_websites: number;
  processed_websites: number;
  successful_websites: number;
  failed_websites: number;
  emails_found: number;
  personal_emails_found?: number;
  phones_found: number;
  personal_phones_found?: number;
  progress_percent: number;
  current_website: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface InvalidUrlDetail {
  raw_url: string;
  reason: string;
}

export interface UploadResponse {
  job_id: string;
  filename: string;
  total_urls_detected?: number;
  valid_urls_count: number;
  invalid_urls: InvalidUrlDetail[];
  duplicates_removed?: number;
  status: JobStatus;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
