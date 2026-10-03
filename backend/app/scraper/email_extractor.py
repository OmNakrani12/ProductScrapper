import re
from urllib.parse import unquote
from bs4 import BeautifulSoup

EMAIL_REGEX = re.compile(
    r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', re.IGNORECASE
)

MAILTO_REGEX = re.compile(
    r'mailto:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', re.IGNORECASE
)

IGNORED_PATTERNS = [
    r'example\.com$', r'domain\.com$', r'yourdomain\.com$', r'company\.com$',
    r'email\.com$', r'test\.com$', r'sentry\.io$', r'w3\.org$', r'schema\.org$',
    r'github\.com$', r'fontawesome\.com$', r'google\.com$', r'bootstrap\.com$',
    r'wordpress\.org$', r'gravatar\.com$'
]

IGNORED_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.css', '.js')

def extract_emails(html_text: str, plain_text: str = "") -> list[str]:
    """
    Extracts, normalizes, and filters valid public email addresses from HTML & text.
    """
    found_emails = set()
    
    if html_text and not plain_text:
        try:
            soup = BeautifulSoup(html_text, "lxml")
            plain_text = soup.get_text(separator=" ")
        except Exception:
            plain_text = ""
            
    combined_content = (html_text or "") + "\n" + (plain_text or "")
    
    # 1. Search mailto: links
    for match in MAILTO_REGEX.findall(combined_content):
        cleaned = unquote(match).strip().lower()
        if is_valid_email_candidate(cleaned):
            found_emails.add(cleaned)
            
    # 2. De-obfuscate common text obfuscations (handling spaces around at/dot)
    deobfuscated = re.sub(r'\s*(\[\s*at\s*\]|\(\s*at\s*\)|\{\s*at\s*\})\s*', '@', combined_content, flags=re.IGNORECASE)
    deobfuscated = re.sub(r'\s*(\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\})\s*', '.', deobfuscated, flags=re.IGNORECASE)
    
    # 3. Regex search on deobfuscated text
    for match in EMAIL_REGEX.findall(deobfuscated):
        cleaned = match.strip().lower()
        if is_valid_email_candidate(cleaned):
            found_emails.add(cleaned)
            
    return sorted(list(found_emails))

def is_valid_email_candidate(email: str) -> bool:
    if not email or len(email) > 100:
        return False
        
    if any(email.endswith(ext) for ext in IGNORED_EXTENSIONS):
        return False
        
    parts = email.split('@')
    if len(parts) != 2:
        return False
        
    username, domain = parts
    if not username or not domain:
        return False
        
    for pattern in IGNORED_PATTERNS:
        if re.search(pattern, domain, re.IGNORECASE):
            return False
            
    return True
