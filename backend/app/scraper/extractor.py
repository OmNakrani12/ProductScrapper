import json
import re
from urllib.parse import urlparse
from bs4 import BeautifulSoup

def extract_company_name(base_url: str, html_text: str) -> str:
    """
    Extract company/website name following priority rules:
    1. Schema.org JSON-LD (Organization)
    2. OpenGraph title
    3. HTML <title>
    4. Header/logo alt text
    5. Domain name fallback
    """
    if not html_text:
        return fallback_domain_name(base_url)
        
    soup = BeautifulSoup(html_text, "lxml")
    
    # 1. JSON-LD Organization
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            content = script.string
            if not content:
                continue
            data = json.loads(content)
            name = find_organization_name(data)
            if name:
                return clean_company_name(name)
        except Exception:
            continue
            
    # 2. OpenGraph title
    og_title = soup.find("meta", property="og:site_name") or soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        content = og_title.get("content").strip()
        if content:
            return clean_company_name(content)
            
    # 3. HTML <title>
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
        if title:
            return clean_company_name(title)
            
    # 4. Logo img alt text inside header / navbar
    header = soup.find("header") or soup.find("nav")
    if header:
        logo_img = header.find("img", alt=True)
        if logo_img and logo_img.get("alt"):
            alt_text = logo_img.get("alt").strip()
            if alt_text and len(alt_text) < 50:
                return clean_company_name(alt_text)
                
    # 5. Fallback to domain name
    return fallback_domain_name(base_url)

def find_organization_name(data) -> str | None:
    """Recursively search for Organization name in JSON-LD structure."""
    if isinstance(data, dict):
        if data.get("@type") in ("Organization", "Corporation", "LocalBusiness", "Website"):
            if "name" in data and isinstance(data["name"], str):
                return data["name"]
        for key, val in data.items():
            res = find_organization_name(val)
            if res:
                return res
    elif isinstance(data, list):
        for item in data:
            res = find_organization_name(item)
            if res:
                return res
    return None

def clean_company_name(raw_title: str) -> str:
    """Clean title string e.g. 'Stripe | Financial Infrastructure for the Web' -> 'Stripe'."""
    if not raw_title:
        return ""
    # Split common title separators like |, -, •, :
    parts = re.split(r'\s+[|\-•:]\s+', raw_title)
    candidate = parts[0].strip()
    if len(candidate) > 60:
        candidate = candidate[:60]
    return candidate

def fallback_domain_name(url: str) -> str:
    """Generate nice company name from domain URL, e.g. https://stripe.com -> Stripe."""
    try:
        domain = urlparse(url).netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        domain_name = domain.split(".")[0]
        return domain_name.capitalize()
    except Exception:
        return "Company"
