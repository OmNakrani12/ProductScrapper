from urllib.parse import urlparse, urljoin
from bs4 import BeautifulSoup

CONTACT_KEYWORDS = [
    "contact", "contact-us", "contactus", "reach-us", "get-in-touch", "support", "help"
]

ABOUT_KEYWORDS = [
    "about", "about-us", "aboutus", "company", "team", "who-we-are"
]

def discover_internal_pages(base_url: str, html_text: str, max_pages: int = 5) -> dict:
    """
    Finds relevant internal pages (contact, about, support) belonging to the same domain.
    Returns:
    {
       "contact_page": str | None,
       "about_page": str | None,
       "pages_to_crawl": list[str]
    }
    """
    if not html_text:
        return {"contact_page": None, "about_page": None, "pages_to_crawl": []}

    base_parsed = urlparse(base_url)
    base_domain = base_parsed.netloc.lower()
    
    soup = BeautifulSoup(html_text, "lxml")
    
    contact_url = None
    about_url = None
    candidate_urls = set()
    
    for a in soup.find_all("a", href=True):
        href = a.get("href", "").strip()
        if not href or href.startswith("#") or href.startswith("javascript:") or href.startswith("mailto:") or href.startswith("tel:"):
            continue
            
        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)
        
        # Must be same domain
        if parsed.netloc.lower() != base_domain:
            continue
            
        path_lower = parsed.path.lower()
        anchor_text = a.get_text().lower().strip()
        link_target = path_lower + " " + anchor_text
        
        # Check contact match
        if any(kw in link_target for kw in CONTACT_KEYWORDS):
            if not contact_url:
                contact_url = full_url
            candidate_urls.add(full_url)
            
        # Check about match
        elif any(kw in link_target for kw in ABOUT_KEYWORDS):
            if not about_url:
                about_url = full_url
            candidate_urls.add(full_url)
            
    # Combine candidate URLs up to max_pages (excluding base homepage itself)
    crawl_list = []
    for u in candidate_urls:
        if u != base_url and len(crawl_list) < max_pages - 1:
            crawl_list.append(u)
            
    return {
        "contact_page": contact_url,
        "about_page": about_url,
        "pages_to_crawl": crawl_list
    }
