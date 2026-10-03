import time
import logging
import httpx
from bs4 import BeautifulSoup

from app.config import settings
from app.utils.security import is_ssrf_safe
from app.scraper.email_extractor import extract_emails
from app.scraper.phone_extractor import extract_phone_numbers
from app.scraper.social_extractor import extract_social_links, merge_social_links
from app.scraper.contact_page import discover_internal_pages
from app.scraper.extractor import extract_company_name

from app.scraper.classifier import classify_emails_batch, classify_phones_batch

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

async def fetch_page_httpx(client: httpx.AsyncClient, url: str) -> tuple[str, str, int]:
    """Fetch page via HTTPX. Returns (html, text, status_code)."""
    response = await client.get(url, headers=HEADERS, follow_redirects=True, timeout=settings.REQUEST_TIMEOUT)
    response.raise_for_status()
    html = response.text
    soup = BeautifulSoup(html, "lxml")
    # Remove script and style elements for clean plain text extraction
    for script in soup(["script", "style", "noscript"]):
        script.decompose()
    plain_text = soup.get_text(separator=" ")
    return html, plain_text, response.status_code

async def fetch_page_playwright(url: str) -> tuple[str, str]:
    """Fallback fetch page using Playwright headless browser."""
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.set_extra_http_headers(HEADERS)
            await page.goto(url, wait_until="networkidle", timeout=settings.REQUEST_TIMEOUT * 1000)
            html = await page.content()
            plain_text = await page.inner_text("body")
            await browser.close()
            return html, plain_text
    except Exception as e:
        logger.warning(f"Playwright fallback failed for {url}: {e}")
        return "", ""

async def crawl_website(url: str) -> dict:
    """
    Complete scanning flow for a single website:
    1. Validate SSRF safety.
    2. Fetch Homepage via HTTPX (with Playwright fallback if needed).
    3. Discover internal pages (contact, about, etc.).
    4. Crawl internal pages up to MAX_PAGES_PER_SITE.
    5. Aggregate emails, phone numbers, metadata, and classify Personal vs Business contacts.
    """
    start_time = time.time()
    
    # 1. SSRF Safety Check
    is_safe, reason = is_ssrf_safe(url)
    if not is_safe:
        return {
            "website_url": url,
            "company_name": None,
            "emails": [],
            "personal_emails": [],
            "business_emails": [],
            "phone_numbers": [],
            "personal_phones": [],
            "business_phones": [],
            "social_links": {},
            "contact_page": None,
            "about_page": None,
            "pages_scanned": 0,
            "duration_seconds": 0,
            "status": "failed",
            "error_message": f"Security restriction: {reason}"
        }

    emails_all = set()
    phones_all = set()
    social_links_all = {}
    pages_scanned_count = 0
    company_name = None
    contact_page_url = None
    about_page_url = None
    
    try:
        async with httpx.AsyncClient(verify=False) as client:
            # Step 1: Fetch Homepage
            try:
                html, plain_text, status_code = await fetch_page_httpx(client, url)
                pages_scanned_count += 1
            except Exception as e:
                # Attempt Playwright fallback if HTTPX fails or blocked
                if settings.USE_PLAYWRIGHT_FALLBACK:
                    html, plain_text = await fetch_page_playwright(url)
                    if html:
                        pages_scanned_count += 1
                    else:
                        raise e
                else:
                    raise e
            
            # Extract company name from Homepage
            company_name = extract_company_name(url, html)
            
            # Extract emails, phones & social links from Homepage
            emails_all.update(extract_emails(html, plain_text))
            phones_all.update(extract_phone_numbers(html, plain_text))
            social_links_all = merge_social_links(social_links_all, extract_social_links(html, url))
            
            # Step 2: Discover internal contact & about pages
            discovery = discover_internal_pages(url, html, max_pages=settings.MAX_PAGES_PER_SITE)
            contact_page_url = discovery.get("contact_page")
            about_page_url = discovery.get("about_page")
            internal_urls = discovery.get("pages_to_crawl", [])
            
            # Step 3: Crawl internal pages
            for sub_url in internal_urls:
                if pages_scanned_count >= settings.MAX_PAGES_PER_SITE:
                    break
                try:
                    # Validate sub_url SSRF safety
                    sub_safe, _ = is_ssrf_safe(sub_url)
                    if not sub_safe:
                        continue
                        
                    sub_html, sub_text, _ = await fetch_page_httpx(client, sub_url)
                    pages_scanned_count += 1
                    emails_all.update(extract_emails(sub_html, sub_text))
                    phones_all.update(extract_phone_numbers(sub_html, sub_text))
                    social_links_all = merge_social_links(social_links_all, extract_social_links(sub_html, sub_url))
                except Exception as sub_e:
                    logger.debug(f"Failed to crawl internal page {sub_url}: {sub_e}")
                    
        duration = int(time.time() - start_time)
        final_emails = sorted(list(emails_all))
        final_phones = sorted(list(phones_all))
        
        # Classify Personal vs Business contacts
        personal_emails, business_emails = classify_emails_batch(final_emails)
        personal_phones, business_phones = classify_phones_batch(final_phones)
        
        status = "success" if (final_emails or final_phones or social_links_all or contact_page_url) else "no_contact_found"
        
        return {
            "website_url": url,
            "company_name": company_name,
            "emails": final_emails,
            "personal_emails": personal_emails,
            "business_emails": business_emails,
            "phone_numbers": final_phones,
            "personal_phones": personal_phones,
            "business_phones": business_phones,
            "social_links": social_links_all,
            "contact_page": contact_page_url,
            "about_page": about_page_url,
            "pages_scanned": pages_scanned_count,
            "duration_seconds": duration,
            "status": status,
            "error_message": None
        }

    except Exception as e:
        duration = int(time.time() - start_time)
        error_msg = str(e)
        if "Timeout" in error_msg:
            error_msg = "Request timed out after 15 seconds"
        elif "ConnectError" in error_msg or "gaierror" in error_msg:
            error_msg = "Could not resolve domain name (DNS failure)"
        elif "SSLError" in error_msg:
            error_msg = "SSL Certificate handshake failure"
        
        return {
            "website_url": url,
            "company_name": company_name,
            "emails": [],
            "personal_emails": [],
            "business_emails": [],
            "phone_numbers": [],
            "personal_phones": [],
            "business_phones": [],
            "social_links": {},
            "contact_page": None,
            "about_page": None,
            "pages_scanned": pages_scanned_count,
            "duration_seconds": duration,
            "status": "failed",
            "error_message": error_msg
        }
