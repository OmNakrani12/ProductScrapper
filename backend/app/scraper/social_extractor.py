import re
import json
from urllib.parse import urlparse, parse_qs, urlunparse
from bs4 import BeautifulSoup

SOCIAL_PLATFORMS = {
    "github": [r"github\.com"],
    "linkedin": [r"linkedin\.com", r"linkedin\.cn"],
    "facebook": [r"facebook\.com", r"fb\.com", r"fb\.watch"],
    "twitter": [r"twitter\.com", r"x\.com"],
    "instagram": [r"instagram\.com", r"instagr\.am"],
    "youtube": [r"youtube\.com", r"youtu\.be"],
    "discord": [r"discord\.gg", r"discord\.com"],
    "telegram": [r"t\.me", r"telegram\.me", r"telegram\.org"],
    "tiktok": [r"tiktok\.com"],
    "pinterest": [r"pinterest\.com", r"pin\.it"],
    "reddit": [r"reddit\.com"],
    "medium": [r"medium\.com"],
    "whatsapp": [r"wa\.me", r"whatsapp\.com"],
    "other": [
        r"threads\.net", r"twitch\.tv", r"behance\.net", r"dribbble\.com",
        r"gitlab\.com", r"bitbucket\.org", r"patreon\.com", r"substack\.com"
    ]
}

# Ignore share/intent links e.g. facebook.com/sharer, twitter.com/intent/tweet, etc.
IGNORE_PATH_PATTERNS = [
    r"/sharer", r"/share", r"/intent/", r"/home\b", r"/login", r"/signup",
    r"/privacy", r"/terms", r"/hashtag/", r"/search"
]

def clean_social_url(url: str) -> str | None:
    """Clean and normalize a social media URL, removing tracking parameters."""
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        if url.startswith("//"):
            url = "https:" + url
        elif url.startswith("www."):
            url = "https://" + url
        else:
            return None

    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        path = parsed.path

        # Ignore share/intent URLs
        for pattern in IGNORE_PATH_PATTERNS:
            if re.search(pattern, path, re.IGNORECASE) or re.search(pattern, parsed.query, re.IGNORECASE):
                return None

        # Strip tracking query params
        # Keep clean URL path without trailing slash unless path is empty
        clean_path = path.rstrip("/")
        if not clean_path:
            clean_path = ""

        # Reconstruct canonical URL
        clean_url = urlunparse((parsed.scheme, domain, clean_path, "", "", ""))
        return clean_url
    except Exception:
        return None

def detect_platform(url: str) -> str | None:
    """Identify platform key for a social URL."""
    try:
        domain = urlparse(url).netloc.lower()
        for platform, patterns in SOCIAL_PLATFORMS.items():
            for pat in patterns:
                if re.search(pat, domain, re.IGNORECASE):
                    return platform
    except Exception:
        pass
    return None

def extract_social_links(html_text: str, base_url: str = "") -> dict[str, list[str]]:
    """
    Extracts social media links from HTML content.
    Returns a dictionary mapping platform name -> list of unique profile URLs.
    """
    social_dict: dict[str, set[str]] = {p: set() for p in SOCIAL_PLATFORMS.keys()}
    if not html_text:
        return {p: [] for p in SOCIAL_PLATFORMS.keys()}

    soup = BeautifulSoup(html_text, "lxml")

    # 1. Inspect all <a> tags
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        cleaned = clean_social_url(href)
        if cleaned:
            platform = detect_platform(cleaned)
            if platform:
                social_dict[platform].add(cleaned)

    # 2. Inspect meta tags (og:see_also, twitter:site, twitter:creator, etc.)
    for meta in soup.find_all("meta"):
        prop = (meta.get("property") or meta.get("name") or "").lower()
        content = (meta.get("content") or "").strip()
        if not content:
            continue

        if prop in ("og:see_also", "twitter:site", "twitter:creator") or "social" in prop:
            cleaned = clean_social_url(content)
            if cleaned:
                platform = detect_platform(cleaned)
                if platform:
                    social_dict[platform].add(cleaned)
            elif content.startswith("@") and ("twitter" in prop or "x" in prop):
                handle = content[1:]
                tw_url = f"https://x.com/{handle}"
                social_dict["twitter"].add(tw_url)

    # 3. Inspect JSON-LD Schema (sameAs property)
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            if not script.string:
                continue
            data = json.loads(script.string)
            _extract_same_as_json_ld(data, social_dict)
        except Exception:
            continue

    # Convert sets to sorted lists
    result = {}
    for platform, urls in social_dict.items():
        if urls:
            result[platform] = sorted(list(urls))

    return result

def _extract_same_as_json_ld(data, social_dict: dict[str, set[str]]):
    """Recursively extract sameAs URLs from JSON-LD data."""
    if isinstance(data, dict):
        same_as = data.get("sameAs")
        if isinstance(same_as, str):
            cleaned = clean_social_url(same_as)
            if cleaned:
                platform = detect_platform(cleaned)
                if platform:
                    social_dict[platform].add(cleaned)
        elif isinstance(same_as, list):
            for item in same_as:
                if isinstance(item, str):
                    cleaned = clean_social_url(item)
                    if cleaned:
                        platform = detect_platform(cleaned)
                        if platform:
                            social_dict[platform].add(cleaned)
        for val in data.values():
            _extract_same_as_json_ld(val, social_dict)
    elif isinstance(data, list):
        for item in data:
            _extract_same_as_json_ld(item, social_dict)

def merge_social_links(dict_a: dict[str, list[str]], dict_b: dict[str, list[str]]) -> dict[str, list[str]]:
    """Merge two social links dictionaries and remove duplicates."""
    merged = {}
    all_keys = set(dict_a.keys()).union(set(dict_b.keys()))
    for key in all_keys:
        urls_a = set(dict_a.get(key, []))
        urls_b = set(dict_b.get(key, []))
        combined = sorted(list(urls_a.union(urls_b)))
        if combined:
            merged[key] = combined
    return merged
