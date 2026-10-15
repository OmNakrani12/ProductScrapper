import time
import logging
import asyncio
import gc
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

# Concurrency gate: at most ONE Playwright Chromium instance allowed in the entire process.
# This prevents parallel browser instances from exhausting Render's 512MB RAM ceiling.
_PLAYWRIGHT_SEMAPHORE = asyncio.Semaphore(1)

async def fetch_page_httpx(client: httpx.AsyncClient, url: str) -> tuple[str, str, int]:
    """Fetch page via HTTPX with response body size cap to prevent memory spikes."""
    response = await client.get(url, headers=HEADERS, follow_redirects=True, timeout=settings.REQUEST_TIMEOUT)
    response.raise_for_status()
    html = response.text
    max_len = getattr(settings, "MAX_RESPONSE_BODY_BYTES", 2500000)
    if len(html) > max_len:
        html = html[:max_len]

    soup = BeautifulSoup(html, "lxml")
    for script in soup(["script", "style", "noscript"]):
        script.decompose()
    plain_text = soup.get_text(separator=" ")
    return html, plain_text, response.status_code

async def fetch_page_jina(client: httpx.AsyncClient, url: str) -> tuple[str, str]:
    """
    Lightweight zero-RAM fallback using Jina AI Reader.
    Renders JavaScript-heavy SPAs and bypasses anti-bot/Cloudflare on Jina's cloud servers,
    returning markdown/text over simple HTTP with zero local browser overhead.
    """
    try:
        jina_url = f"https://r.jina.ai/{url}"
        resp = await client.get(
            jina_url,
            headers={
                "User-Agent": HEADERS["User-Agent"],
                "x-with-generated-alt": "true",
            },
            timeout=float(min(settings.REQUEST_TIMEOUT, 15))
        )
        if resp.status_code == 200 and len(resp.text) > 100:
            text = resp.text
            max_len = getattr(settings, "MAX_RESPONSE_BODY_BYTES", 2500000)
            if len(text) > max_len:
                text = text[:max_len]
            return text, text
    except Exception as e:
        logger.debug(f"Jina AI Reader fallback failed for {url}: {e}")
    return "", ""

async def fetch_page_playwright(url: str) -> tuple[str, str]:
    """
    Fallback fetch page using Playwright headless browser with strict memory controls:
    - Single-instance lock to prevent concurrent browser memory spikes
    - Aggressive blocking of images, fonts, styles, and media
    - Low-RAM Chromium flags (--single-process, --disable-dev-shm-usage, 128MB heap limit)
    """
    async with _PLAYWRIGHT_SEMAPHORE:
        browser = None
        context = None
        try:
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-dev-shm-usage",
                        "--disable-gpu",
                        "--disable-software-rasterizer",
                        "--disable-extensions",
                        "--disable-background-networking",
                        "--disable-default-apps",
                        "--disable-sync",
                        "--disable-translate",
                        "--metrics-recording-only",
                        "--mute-audio",
                        "--no-first-run",
                        "--single-process",
                        "--no-zygote",
                        "--disable-setuid-sandbox",
                        "--js-flags=--max-old-space-size=128",
                    ]
                )
                context = await browser.new_context(
                    user_agent=HEADERS["User-Agent"],
                    viewport={"width": 1280, "height": 720}
                )
                page = await context.new_page()

                # Block heavy assets (images, fonts, stylesheets, media) to keep memory usage under 75MB
                async def route_filter(route):
                    req = route.request
                    if req.resource_type in ["image", "media", "font", "stylesheet"] or any(
                        req.url.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".woff", ".woff2", ".ttf", ".css", ".mp4", ".avi"]
                    ):
                        await route.abort()
                    else:
                        await route.continue_()

                await page.route("**/*", route_filter)
                await page.goto(url, wait_until="domcontentloaded", timeout=min(settings.REQUEST_TIMEOUT, 12) * 1000)
                await asyncio.sleep(1.0)
                html = await page.content()
                plain_text = await page.inner_text("body")
                await page.close()
                await context.close()
                await browser.close()
                return html, plain_text
        except Exception as e:
            logger.warning(f"Playwright fallback failed for {url}: {e}")
            return "", ""
        finally:
            gc.collect()

async def crawl_website(url: str) -> dict:
    """
    Complete scanning flow for a single website:
    1. Validate SSRF safety.
    2. Fetch Homepage via HTTPX (with Jina AI zero-RAM & Playwright fallback if needed).
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
                # 1st Fallback: Jina AI Reader (Zero local RAM overhead, renders JS and bypasses Cloudflare)
                html, plain_text = await fetch_page_jina(client, url)
                if html:
                    pages_scanned_count += 1
                elif settings.USE_PLAYWRIGHT_FALLBACK:
                    # 2nd Fallback: Playwright (only if explicitly enabled in env)
                    html, plain_text = await fetch_page_playwright(url)
                    if html:
                        pages_scanned_count += 1
                    else:
                        raise e
                else:
                    raise e
            
            # Extract company name from Homepage
            company_name = extract_company_name(url, html)
            
            # Extract emails & social links from Homepage (skip phones if disabled for performance)
            emails_all.update(extract_emails(html, plain_text))
            if getattr(settings, "EXTRACT_PHONES", False):
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
                        
                    try:
                        sub_html, sub_text, _ = await fetch_page_httpx(client, sub_url)
                    except Exception:
                        sub_html, sub_text = await fetch_page_jina(client, sub_url)

                    if sub_html:
                        pages_scanned_count += 1
                        emails_all.update(extract_emails(sub_html, sub_text))
                        if getattr(settings, "EXTRACT_PHONES", False):
                            phones_all.update(extract_phone_numbers(sub_html, sub_text))
                        social_links_all = merge_social_links(social_links_all, extract_social_links(sub_html, sub_url))
                except Exception as sub_e:
                    logger.debug(f"Failed to crawl internal page {sub_url}: {sub_e}")
                    
        duration = int(time.time() - start_time)
        gc.collect()
        final_emails = sorted(list(emails_all))
        final_phones = sorted(list(phones_all)) if getattr(settings, "EXTRACT_PHONES", False) else []
        
        # Classify Personal vs Business contacts
        personal_emails, business_emails = classify_emails_batch(final_emails)
        if getattr(settings, "EXTRACT_PHONES", False) and final_phones:
            personal_phones, business_phones = classify_phones_batch(final_phones)
        else:
            personal_phones, business_phones = [], []
        
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
