import re
import json
import logging
import asyncio
from urllib.parse import urlparse, parse_qs, unquote, urljoin
from bs4 import BeautifulSoup
import httpx

from app.config import settings
from app.utils.security import is_ssrf_safe
from app.utils.url_utils import normalize_url, is_valid_url

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}

# Generic subpages or system paths on directory sites to ignore
IGNORED_PATH_SUBSTRINGS = [
    "/login", "/register", "/signup", "/signin", "/signout", "/auth",
    "/privacy", "/terms", "/about", "/contact", "/pricing", "/faq",
    "/blog", "/news", "/category", "/tag", "/search", "/user/", "/profile/",
    "/settings", "/dashboard", "/docs", "/api", "/assets/", "/static/"
]

# Major non-product social, search, utility, and AI assistant domains to exclude from directory product lists
IGNORED_DOMAINS = {
    "facebook.com", "twitter.com", "x.com", "linkedin.com", "instagram.com",
    "youtube.com", "github.com", "google.com", "apple.com", "microsoft.com",
    "stripe.com", "vercel.com", "netlify.com", "cloudflare.com", "amazon.com",
    "duckduckgo.com", "bing.com", "wikipedia.org", "reddit.com", "medium.com",
    "jina.ai", "schema.org", "w3.org", "typeform.com", "intercom.com", "drift.com",
    # AI Chatbots & Assistants to exclude
    "chatgpt.com", "openai.com", "claude.ai", "anthropic.com", "grok.com", "x.ai",
    "perplexity.ai", "poe.com", "character.ai", "huggingface.co"
}

def is_ignored_domain(domain: str) -> bool:
    """Check if a domain or its parent domain is in the IGNORED_DOMAINS set."""
    if not domain:
        return True
    dom_clean = domain.lower().replace("www.", "").strip()
    if dom_clean in IGNORED_DOMAINS:
        return True
    return any(dom_clean.endswith("." + ign) for ign in IGNORED_DOMAINS)

COMMON_TLDS = [".com", ".ai", ".io", ".app", ".dev", ".co", ".net", ".org", ".sh"]

def extract_redirect_target(href: str) -> str | None:
    """Extract destination URL if link is an outbound redirect like /out?url=https://target.com."""
    try:
        parsed = urlparse(href)
        query_params = parse_qs(parsed.query)

        for param in ["url", "target", "dest", "link", "redirect", "u", "to", "site", "uddg"]:
            if param in query_params and query_params[param]:
                cand = unquote(query_params[param][0]).strip()
                if cand.startswith("http://") or cand.startswith("https://"):
                    return cand
    except Exception:
        pass
    return None

def extract_urls_from_text(text: str) -> list[str]:
    """Find all http/https URLs in text or JSON blobs."""
    url_pattern = re.compile(r'https?://[^\s<>""\'{}|\^\[\]`\\]+')
    return url_pattern.findall(text)

async def check_domain_exists(client: httpx.AsyncClient, candidate_url: str) -> str | None:
    """Fast check if a candidate domain is live and returns a non-directory URL."""
    try:
        r = await client.head(candidate_url, headers=HEADERS, follow_redirects=True, timeout=3.5)
        if r.status_code in [200, 301, 302, 307, 308, 403]:
            final_domain = urlparse(str(r.url)).netloc.lower().replace("www.", "")
            if final_domain and not any(ign in final_domain for ign in ["producthunt", "godaddy", "namecheap", "domain", "parking"]):
                return f"https://{final_domain}"
    except Exception:
        pass
    return None

async def resolve_product_website(client: httpx.AsyncClient, product_name: str) -> str | None:
    """Smart resolution engine: checks embedded domain in name, TLD candidate checks, & Clearbit suggest."""
    clean_name = product_name.split(" - ")[0].split(" – ")[0].split(" | ")[0].strip()
    clean_name = re.sub(r'^\d+[\.\)]\s*', '', clean_name).strip()
    if not clean_name or len(clean_name) < 2:
        return None

    # 1. Direct domain check inside product name (e.g., "Customer.io", "Yedric.ai", "saasapp.co")
    if "." in clean_name and not clean_name.endswith("."):
        parts = clean_name.split()
        for p in parts:
            p_clean = re.sub(r'[^a-zA-Z0-9\.\-]', '', p).lower()
            if "." in p_clean and len(p_clean.split(".")[-1]) in [2, 3, 4]:
                tld = "." + p_clean.split(".")[-1]
                if tld in COMMON_TLDS or tld in [".io", ".ai", ".co", ".app", ".dev", ".com", ".net", ".org", ".sh", ".me", ".so", ".to"]:
                    return f"https://{p_clean}"

    # 2. Clearbit Autocomplete API
    try:
        cb_url = f"https://autocomplete.clearbit.com/v1/companies/suggest?query={clean_name}"
        cb_resp = await client.get(cb_url, timeout=3.5)
        if cb_resp.status_code == 200:
            cb_data = cb_resp.json()
            if cb_data and isinstance(cb_data, list):
                found_domain = cb_data[0].get("domain")
                if found_domain:
                    dom_clean = found_domain.lower().replace("www.", "")
                    if not is_ignored_domain(dom_clean) and not any(ign in dom_clean for ign in ["producthunt", "betalist"]):
                        return f"https://{dom_clean}"
    except Exception:
        pass

    # 3. Parallel TLD candidate checking
    clean_slug = re.sub(r'[^a-zA-Z0-9]', '', clean_name.lower())
    if len(clean_slug) >= 2:
        tasks = [check_domain_exists(client, f"https://{clean_slug}{tld}") for tld in COMMON_TLDS]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for res in results:
            if isinstance(res, str) and res:
                return res

    return None

def create_async_client(**kwargs) -> httpx.AsyncClient:
    """Creates an httpx.AsyncClient with automatic HTTP/2 fallback if h2 package is missing."""
    try:
        return httpx.AsyncClient(**kwargs)
    except (ImportError, TypeError):
        if kwargs.get("http2"):
            kwargs_no_h2 = dict(kwargs)
            kwargs_no_h2["http2"] = False
            return httpx.AsyncClient(**kwargs_no_h2)
        raise

async def fetch_directory_content(norm_dir_url: str) -> tuple[str, bool]:
    """
    Multi-tier fetcher with anti-bot protection fallbacks:
    Tier 1: Direct HTTPX with modern browser headers
    Tier 2: RSS / Atom feeds (/feed, /rss, /feed.xml, etc.)
    Tier 3: Playwright headless browser
    Tier 4: Jina AI proxy reader (r.jina.ai/<url>)
    Returns (content_text, is_xml_feed)
    """
    html_content = ""
    is_xml_feed = False
    parsed_base = urlparse(norm_dir_url)
    base_origin = f"{parsed_base.scheme}://{parsed_base.netloc}"

    # Tier 1: Direct HTTPX fetch
    try:
        async with create_async_client(http2=True, verify=False, timeout=settings.REQUEST_TIMEOUT) as client:
            resp = await client.get(norm_dir_url, headers=HEADERS, follow_redirects=True)
            if resp.status_code == 200 and "Just a moment..." not in resp.text and "Security verification" not in resp.text:
                html_content = resp.text
                if "<rss" in html_content.lower() or "<feed" in html_content.lower():
                    is_xml_feed = True
                return html_content, is_xml_feed
    except Exception as e:
        logger.warning(f"Tier 1 HTTPX direct fetch failed for {norm_dir_url}: {e}")

    # Tier 2: RSS / Atom Feed Fallback
    try:
        feed_endpoints = ["/feed", "/feed.xml", "/rss", "/rss.xml", "/atom.xml", "/index.xml"]
        async with create_async_client(http2=True, verify=False, timeout=settings.REQUEST_TIMEOUT) as client:
            for endpoint in feed_endpoints:
                feed_url = urljoin(base_origin, endpoint)
                try:
                    feed_resp = await client.get(feed_url, headers=HEADERS, follow_redirects=True)
                    if feed_resp.status_code == 200 and len(feed_resp.text) > 500 and ("<rss" in feed_resp.text.lower() or "<feed" in feed_resp.text.lower()):
                        logger.info(f"Tier 2 RSS feed fallback succeeded for {norm_dir_url} via {feed_url}")
                        return feed_resp.text, True
                except Exception:
                    pass
    except Exception as e:
        logger.warning(f"Tier 2 RSS feed fallback failed for {norm_dir_url}: {e}")

    # Tier 3: Playwright Fallback
    if settings.USE_PLAYWRIGHT_FALLBACK:
        try:
            from playwright.async_api import async_playwright
            async with async_playwright() as p:
                browser = None
                for launch_kwargs in [
                    {"headless": True, "args": ["--disable-blink-features=AutomationControlled", "--no-sandbox"]},
                    {"headless": True, "channel": "chrome", "args": ["--disable-blink-features=AutomationControlled", "--no-sandbox"]},
                    {"headless": True, "channel": "msedge", "args": ["--disable-blink-features=AutomationControlled", "--no-sandbox"]}
                ]:
                    try:
                        browser = await p.chromium.launch(**launch_kwargs)
                        break
                    except Exception:
                        continue

                if browser:
                    context = await browser.new_context(
                        user_agent=HEADERS["User-Agent"],
                        viewport={"width": 1366, "height": 768}
                    )
                    page = await context.new_page()
                    await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});")
                    await page.goto(norm_dir_url, wait_until="domcontentloaded", timeout=settings.REQUEST_TIMEOUT * 1000)
                    await page.wait_for_timeout(2500)
                    pw_content = await page.content()
                    await browser.close()

                    if pw_content and "Just a moment..." not in pw_content and "Security verification" not in pw_content:
                        logger.info(f"Tier 3 Playwright fetch succeeded for {norm_dir_url}")
                        return pw_content, False
        except Exception as pw_e:
            logger.warning(f"Tier 3 Playwright fetch failed for {norm_dir_url}: {pw_e}")

    # Tier 4: Jina AI Proxy Reader Fallback (bypasses Cloudflare anti-bot on ProductHunt, G2, Capterra, etc.)
    try:
        jina_target = f"https://r.jina.ai/{norm_dir_url}"
        logger.info(f"Tier 4 Jina AI Proxy fetch attempting for {jina_target}")
        async with httpx.AsyncClient(timeout=20.0) as client:
            jina_resp = await client.get(jina_target, headers={"x-with-links-summary": "true", "User-Agent": HEADERS["User-Agent"]})
            if jina_resp.status_code == 200 and len(jina_resp.text) > 200:
                logger.info(f"Tier 4 Jina AI Proxy fetch succeeded for {norm_dir_url}")
                return jina_resp.text, False
    except Exception as jina_e:
        logger.warning(f"Tier 4 Jina AI Proxy fetch failed for {norm_dir_url}: {jina_e}")

    return html_content, is_xml_feed

async def extract_directory_products(directory_url: str) -> dict:
    """
    Extracts external product website links from ANY directory/showcase page (e.g. ProductHunt, ScrollLaunch, BetaList, etc.).
    Uses multi-tier fetching (HTTPX, RSS feeds, Playwright, Jina Reader anti-bot proxy) and smart product resolution.
    Returns dict with directory_url, total_products_found, and products list.
    """
    # Clean up formatting typos like https:///www.producthunt.com/
    clean_input = directory_url.strip().replace("https:///", "https://").replace("http:///", "http://")
    norm_dir_url = normalize_url(clean_input)
    if not norm_dir_url:
        return {
            "directory_url": directory_url,
            "total_products_found": 0,
            "products": [],
            "error": "Invalid directory URL provided."
        }

    is_safe, reason = is_ssrf_safe(norm_dir_url)
    if not is_safe:
        return {
            "directory_url": norm_dir_url,
            "total_products_found": 0,
            "products": [],
            "error": f"Security restriction: {reason}"
        }

    dir_domain = urlparse(norm_dir_url).netloc.lower().replace("www.", "")

    html_content, is_xml_feed = await fetch_directory_content(norm_dir_url)

    if not html_content or "Just a moment..." in html_content and len(html_content) < 3000:
        return {
            "directory_url": norm_dir_url,
            "total_products_found": 0,
            "products": [],
            "error": "Could not fetch content from directory website due to anti-bot protection."
        }

    discovered_dict = {}
    pending_resolution_names = []

    # Case A: XML / RSS / Atom Feed Parsing
    if is_xml_feed or "<rss" in html_content.lower() or "<feed" in html_content.lower() or "<item" in html_content.lower():
        soup = BeautifulSoup(html_content, "xml")
        items = soup.find_all(["entry", "item"])

        for item in items[:60]:
            title_elem = item.find("title")
            title = title_elem.get_text(strip=True) if title_elem else "Product"

            content_elem = item.find("content") or item.find("description") or item.find("summary")
            content_text = content_elem.get_text() if content_elem else ""

            # Check for direct external links inside item description
            ext_urls = extract_urls_from_text(content_text)
            found_target = None
            for ext in ext_urls:
                dom = urlparse(ext).netloc.lower().replace("www.", "")
                if dom and not is_ignored_domain(dom) and dir_domain not in dom and not ext.endswith((".png", ".jpg", ".jpeg", ".gif", ".svg", ".css", ".js")):
                    found_target = ext
                    break

            if found_target:
                norm_target = normalize_url(found_target)
                if norm_target and norm_target not in discovered_dict:
                    dom = urlparse(norm_target).netloc.lower().replace("www.", "")
                    discovered_dict[norm_target] = {
                        "url": norm_target,
                        "title": title,
                        "domain": dom
                    }
            else:
                clean_t = re.sub(r'^\d+[\.\)]\s*', '', title).strip()
                if clean_t and clean_t not in pending_resolution_names:
                    pending_resolution_names.append(clean_t)

    # Case B: Standard HTML & Markdown Parsing
    else:
        soup = BeautifulSoup(html_content, "lxml")

        # 1. Parse JSON-LD or embedded Next.js JSON state (__NEXT_DATA__)
        for script_tag in soup.find_all("script"):
            script_text = script_tag.string or script_tag.get_text() or ""
            if "__NEXT_DATA__" in script_text or "application/json" in script_tag.get("type", ""):
                urls_found = extract_urls_from_text(script_text)
                for u in urls_found:
                    dom = urlparse(u).netloc.lower().replace("www.", "")
                    if dom and not is_ignored_domain(dom) and dir_domain not in dom and not u.endswith((".png", ".jpg", ".jpeg", ".gif", ".svg", ".css", ".js")):
                        norm_u = normalize_url(u)
                        if norm_u and norm_u not in discovered_dict:
                            title = dom.rsplit(".", 1)[0].capitalize()
                            discovered_dict[norm_u] = {
                                "url": norm_u,
                                "title": title,
                                "domain": dom
                            }

        # 2. Parse <a> tags and Markdown links [Title](URL) for direct external & redirect links
        # Extract markdown links if present (e.g. from Jina Reader)
        md_link_pattern = re.compile(r'\[([^\]]+)\]\((https?://[^\)]+)\)')
        for m_title, m_url in md_link_pattern.findall(html_content):
            target_dom = urlparse(m_url).netloc.lower().replace("www.", "")
            if target_dom and not is_ignored_domain(target_dom) and dir_domain not in target_dom:
                norm_m = normalize_url(m_url)
                if norm_m and norm_m not in discovered_dict:
                    clean_title = re.sub(r'^\d+[\.\)]\s*', '', m_title).strip()
                    discovered_dict[norm_m] = {
                        "url": norm_m,
                        "title": clean_title[:80],
                        "domain": target_dom
                    }
            elif dir_domain in target_dom and ("/products/" in m_url or "/posts/" in m_url):
                clean_title = re.sub(r'^\d+[\.\)]\s*', '', m_title).strip()
                if clean_title and len(clean_title) >= 2 and clean_title not in pending_resolution_names:
                    pending_resolution_names.append(clean_title)

        # Parse standard <a> tags
        for a_tag in soup.find_all("a", href=True):
            raw_href = a_tag["href"].strip()
            if not raw_href or raw_href.startswith("#") or raw_href.startswith("javascript:") or raw_href.startswith("mailto:") or raw_href.startswith("tel:"):
                continue

            target_url = extract_redirect_target(raw_href)
            if not target_url:
                target_url = urljoin(norm_dir_url, raw_href)

            normalized_target = normalize_url(target_url)
            if not normalized_target:
                continue

            valid, _ = is_valid_url(normalized_target)
            if not valid:
                continue

            parsed_target = urlparse(normalized_target)
            target_domain = parsed_target.netloc.lower().replace("www.", "")

            # Check anchor text
            anchor_text = a_tag.get_text(strip=True)
            if not anchor_text or len(anchor_text) < 2:
                img = a_tag.find("img", alt=True)
                if img and img.get("alt"):
                    anchor_text = img.get("alt").strip()
                else:
                    anchor_text = a_tag.get("title") or target_domain.split(".")[0].capitalize()

            # If target link is on directory domain itself (e.g. /products/slug or /posts/slug)
            if target_domain == dir_domain or target_domain.endswith("." + dir_domain):
                if ("/products/" in parsed_target.path or "/posts/" in parsed_target.path) and anchor_text:
                    clean_t = re.sub(r'^\d+[\.\)]\s*', '', anchor_text).strip()
                    if clean_t and len(clean_t) >= 2 and clean_t not in pending_resolution_names:
                        pending_resolution_names.append(clean_t)
                continue

            # Ignore generic social media/utility/AI chatbot domains
            if is_ignored_domain(target_domain):
                continue

            # Check path patterns
            path_lower = parsed_target.path.lower()
            if any(ign in path_lower for ign in IGNORED_PATH_SUBSTRINGS):
                continue

            if len(anchor_text) > 80:
                anchor_text = anchor_text[:80] + "..."

            if normalized_target not in discovered_dict:
                discovered_dict[normalized_target] = {
                    "url": normalized_target,
                    "title": anchor_text,
                    "domain": target_domain
                }

    # Case C: Smart Product Website Resolution for pending product names (ProductHunt / BetaList feed entries & post links)
    if pending_resolution_names and len(discovered_dict) < 40:
        logger.info(f"Resolving websites for {len(pending_resolution_names)} directory items...")
        async with httpx.AsyncClient(verify=False) as client:
            resolve_tasks = [resolve_product_website(client, name) for name in pending_resolution_names[:30]]
            resolved_urls = await asyncio.gather(*resolve_tasks, return_exceptions=True)

            for i, res_url in enumerate(resolved_urls):
                if isinstance(res_url, str) and res_url:
                    norm_res = normalize_url(res_url)
                    if norm_res and norm_res not in discovered_dict:
                        title_clean = pending_resolution_names[i]
                        dom_res = urlparse(norm_res).netloc.lower().replace("www.", "")
                        if not is_ignored_domain(dom_res):
                            discovered_dict[norm_res] = {
                                "url": norm_res,
                                "title": title_clean,
                                "domain": dom_res
                            }

    products_list = [p for p in discovered_dict.values() if not is_ignored_domain(p.get("domain"))]
    return {
        "directory_url": norm_dir_url,
        "total_products_found": len(products_list),
        "products": products_list,
        "error": None
    }

async def extract_directory_products_range(url_pattern: str, start_num: int, end_num: int) -> dict:
    """
    Crawls a sequence of directory pages by substituting numbers in a range [start_num, end_num].
    e.g. url_pattern = "https://www.scrolllaunch.com/week/2026/38" or "https://www.scrolllaunch.com/week/2026/{number}"
    """
    if start_num > end_num:
        start_num, end_num = end_num, start_num

    # Cap maximum pages per batch request to 100 to prevent timeout
    max_pages = 100
    if (end_num - start_num + 1) > max_pages:
        end_num = start_num + max_pages - 1

    clean_pattern = url_pattern.strip().replace("https:///", "https://").replace("http:///", "http://")

    # Check if explicit placeholder is present (e.g. {number}, {num}, {n}, {i})
    has_placeholder = any(p in clean_pattern for p in ["{number}", "{num}", "{n}", "{i}"])

    target_urls = []
    for num in range(start_num, end_num + 1):
        if has_placeholder:
            formatted = clean_pattern
            for p in ["{number}", "{num}", "{n}", "{i}"]:
                formatted = formatted.replace(p, str(num))
            target_urls.append(formatted)
        else:
            # If no {number} placeholder was supplied in URL, append /{num} to the end
            target_urls.append(f"{clean_pattern.rstrip('/')}/{num}")

    discovered_all = {}
    sem = asyncio.Semaphore(5)  # Concurrency limit for page fetches

    async def fetch_single(url: str):
        async with sem:
            try:
                res = await extract_directory_products(url)
                return res.get("products", [])
            except Exception as e:
                logger.warning(f"Batch extraction failed for {url}: {e}")
                return []

    results = await asyncio.gather(*[fetch_single(u) for u in target_urls], return_exceptions=True)

    for res in results:
        if isinstance(res, list):
            for prod in res:
                url_norm = prod.get("url")
                if url_norm and url_norm not in discovered_all:
                    discovered_all[url_norm] = prod

    all_products = [p for p in discovered_all.values() if not is_ignored_domain(p.get("domain"))]
    return {
        "url_pattern": url_pattern,
        "start_number": start_num,
        "end_number": end_num,
        "pages_scanned": len(target_urls),
        "total_products_found": len(all_products),
        "products": all_products,
        "error": None
    }
