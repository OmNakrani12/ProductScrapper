import re
from urllib.parse import urlparse

# Generic business email username prefixes
GENERIC_EMAIL_PREFIXES = {
    "info", "contact", "sales", "support", "admin", "help", "office", "billing",
    "jobs", "careers", "press", "media", "inquiries", "team", "hello", "service",
    "marketing", "privacy", "legal", "security", "abuse", "hr", "general",
    "customerservice", "desk", "inquiry", "enquiry", "reception", "contactus",
    "supportus", "webmaster", "postmaster", "compliance", "accounts", "sales-team",
    "info-us", "info-uk", "feedback", "newsletter", "events", "editor", "subscriptions"
}

# Personal Webmail Provider Domains
PERSONAL_WEBMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
    "protonmail.com", "proton.me", "aol.com", "zoho.com", "gmx.com", "live.com",
    "me.com", "msn.com", "rediffmail.com", "yandex.com", "mail.com",
    "comcast.net", "verizon.net", "sbcglobal.net", "fastmail.com"
}

# Disposable / Temporary Email Domains (Dummy & Trash Mails)
DISPOSABLE_DOMAINS = {
    "mailinator.com", "tempmail.com", "temp-mail.org", "yopmail.com", "10minutemail.com",
    "guerrillamail.com", "trashmail.com", "dispostable.com", "getnada.com", "throwawaymail.com",
    "sharklasers.com", "fakeinbox.com", "maildrop.cc", "inboxkitten.com", "mytemp.email",
    "tempmail.net", "tempail.com", "mohmal.com", "generator.email", "crazymailing.com",
    "mailnesia.com", "mailcatch.com", "anonymbox.com", "yopmail.net", "yopmail.fr",
    "cool.fr.nf", "jetable.fr.nf", "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj",
    "speed.1s.fr", "courriel.jp.net", "emailondeck.com", "getairmail.com", "temp-mail.io"
}

# Dummy, Placeholder & Template Domains
DUMMY_DOMAINS = {
    "example.com", "example.org", "example.net", "domain.com", "yourdomain.com",
    "mycompany.com", "site.com", "yoursite.com", "email.com",
    "test.com", "test.org", "sentry.io", "w3.org", "schema.org", "github.com",
    "fontawesome.com", "google.com", "bootstrap.com", "wordpress.org", "gravatar.com",
    "localhost", "invalid", "local", "mysite.com", "sample.com"
}

# Dummy / Non-Working / System Usernames
DUMMY_USERNAMES = {
    "noreply", "no-reply", "no_reply", "donotreply", "do_not_reply", "do-not-reply",
    "bounce", "mailer-daemon", "null", "undefined", "none", "placeholder", "random",
    "xxx", "xxxx", "123456", "abc", "qwerty", "fake", "invalid"
}

# Executive & Individual Title Keywords in Email Usernames
EXECUTIVE_EMAIL_KEYWORDS = {
    "ceo", "founder", "co-founder", "cofounder", "owner", "president",
    "director", "vp", "cto", "cfo", "coo", "managingdirector", "principal", "head"
}

# Toll-Free Phone Prefixes (International & Regional)
TOLL_FREE_PATTERNS = [
    r'^\+?1?[-.\s]?(800|888|877|866|855|844|833)[-.\s]?\d{3}[-.\s]?\d{4}$',
    r'^\+?44[-.\s]?(800|808)[-.\s]?\d+',
    r'^\+?91[-.\s]?1800[-.\s]?\d+',
    r'^\+?61[-.\s]?(1800|1300)[-.\s]?\d+',
    r'^1800[-.\s]?\d+',
    r'^0800[-.\s]?\d+',
]

# Mobile Phone Regex Patterns (Country Specific & General)
MOBILE_PHONE_PATTERNS = [
    # UK Mobile (+44 7xxx or 07xxx)
    r'^\+?44[-.\s]?7\d{3}[-.\s]?\d{6}$',
    r'^07\d{3}[-.\s]?\d{6}$',
    # India Mobile (+91 6/7/8/9xxxxxxxx)
    r'^\+?91[-.\s]?[6789]\d{9}$',
    r'^[6789]\d{9}$',
    # Australia Mobile (+61 4xx xxx xxx or 04xx xxx xxx)
    r'^\+?61[-.\s]?4\d{2}[-.\s]?\d{3}[-.\s]?\d{3}$',
    r'^04\d{2}[-.\s]?\d{3}[-.\s]?\d{3}$',
    # European Mobile (+49 15/16/17, +33 6/7, +34 6/7, +39 3xx, +41 7x, +31 6)
    r'^\+?49[-.\s]?1[567]\d[-.\s]?\d{7,8}$',
    r'^\+?33[-.\s]?[67]\d{8}$',
    r'^\+?34[-.\s]?[67]\d{8}$',
    r'^\+?39[-.\s]?3\d{2}[-.\s]?\d{6,7}$',
    r'^\+?41[-.\s]?7[6789]\d[-.\s]?\d{6}$',
    r'^\+?31[-.\s]?6[-.\s]?\d{8}$',
]

def is_working_email(email: str, verify_dns: bool = False) -> bool:
    """
    Checks if an email address is a legitimate, working candidate email address
    WITHOUT sending an actual email.
    Filters out dummy, placeholder, disposable, and system emails.
    """
    if not email or not isinstance(email, str) or "@" not in email or len(email) > 100:
        return False
        
    parts = email.strip().lower().split("@", 1)
    if len(parts) != 2:
        return False
        
    username, domain = parts
    if not username or not domain:
        return False
        
    # 1. Reject dummy / non-working usernames & prefixes
    if username in DUMMY_USERNAMES:
        return False
    if username.startswith(("noreply", "no-reply", "donotreply", "do-not-reply", "dummy-", "test-")):
        return False
        
    # 2. Reject disposable temp mail domains
    if domain in DISPOSABLE_DOMAINS:
        return False
        
    # 3. Reject dummy / placeholder domains
    if domain in DUMMY_DOMAINS or any(domain.endswith("." + d) for d in DUMMY_DOMAINS):
        return False
        
    # 4. Optional DNS host verification (without sending an email)
    if verify_dns:
        import socket
        try:
            socket.gethostbyname(domain)
        except Exception:
            return False
            
    return True

def classify_email(email: str) -> str:
    """
    Classifies an email address into 'personal' or 'business'.
    - Personal: Named individual emails (e.g. john.doe@company.com), personal webmail (@gmail.com), executive emails (ceo@...).
    - Business: Generic corporate contact aliases (info@, support@, sales@...).
    """
    if not email or "@" not in email:
        return "business"
        
    username, domain = email.strip().lower().split("@", 1)
    
    # 1. Personal Webmail check
    if domain in PERSONAL_WEBMAIL_DOMAINS:
        return "personal"
        
    # 2. Check generic business prefix
    # Extract root prefix (e.g., info.sales -> info)
    clean_prefix = re.split(r'[._-]', username)[0]
    if username in GENERIC_EMAIL_PREFIXES or clean_prefix in GENERIC_EMAIL_PREFIXES:
        return "business"
        
    # 3. Check executive title prefix
    if username in EXECUTIVE_EMAIL_KEYWORDS or clean_prefix in EXECUTIVE_EMAIL_KEYWORDS:
        return "personal"
        
    # 4. Check for first.last or named structure (e.g. john.smith, sarah_m, d.miller)
    if re.search(r'[._-]', username) or len(username) > 3:
        # Named individual employee or executive
        return "personal"
        
    return "business"

def classify_phone(phone: str, context: str = "") -> str:
    """
    Classifies a phone number into 'personal' (mobile/cell, direct dial) or 'business' (toll-free, main switchboard, fax).
    """
    if not phone:
        return "business"
        
    clean_phone = phone.strip()
    digits_only = re.sub(r'\D', '', clean_phone)
    context_lower = (context or "").lower()
    
    # 1. Context keywords check
    personal_keywords = ["mobile", "cell", "cellular", "direct", "whatsapp", "personal", "direct line", "cell phone"]
    business_keywords = ["toll-free", "toll free", "fax", "office", "main", "reception", "switchboard", "hq", "headquarters"]
    
    for kw in personal_keywords:
        if kw in context_lower:
            return "personal"
            
    for kw in business_keywords:
        if kw in context_lower:
            return "business"
            
    # 2. Check Toll-Free patterns
    for pattern in TOLL_FREE_PATTERNS:
        if re.search(pattern, clean_phone):
            return "business"
            
    # 3. Check Mobile patterns
    for pattern in MOBILE_PHONE_PATTERNS:
        if re.search(pattern, clean_phone):
            return "personal"
            
    # 4. General Mobile Heuristics for North American (10-digit) & International numbers
    # US 10-digit: If not toll-free, check if it has mobile context or direct dial formatting
    if len(digits_only) == 10 and digits_only[:3] in {"800", "888", "877", "866", "855", "844", "833"}:
        return "business"
        
    # If phone is formatted as tel: link or standalone mobile format without extensions (e.g., ext. 101)
    if "ext" in clean_phone.lower() or "x" in clean_phone.lower():
        return "business"
        
    # Default to personal if it looks like a direct 10-12 digit mobile line without company switchboard indicators
    if 10 <= len(digits_only) <= 13 and not clean_phone.startswith("1800") and not clean_phone.startswith("0800"):
        return "personal"
        
    return "business"

def classify_emails_batch(emails: list[str]) -> tuple[list[str], list[str]]:
    """Separates a list of emails into (personal_emails, business_emails)."""
    personal = []
    business = []
    for e in emails:
        if not is_working_email(e):
            continue
        if classify_email(e) == "personal":
            personal.append(e)
        else:
            business.append(e)
    return sorted(list(set(personal))), sorted(list(set(business)))

def classify_phones_batch(phones: list[str], context: str = "") -> tuple[list[str], list[str]]:
    """Separates a list of phone numbers into (personal_phones, business_phones)."""
    personal = []
    business = []
    for p in phones:
        if classify_phone(p, context) == "personal":
            personal.append(p)
        else:
            business.append(p)
    return sorted(list(set(personal))), sorted(list(set(business)))

def select_primary_email(emails: list[str], personal_emails: list[str] = None, business_emails: list[str] = None, verify_dns: bool = False) -> str | None:
    """
    Selects the single best email ID with highest response & decision-maker probability for cold outreach.
    FIRST filters out any dummy, disposable, or invalid emails so ONLY working emails are considered.
    
    Priority order among working emails:
    1. Executive / Founder / Named Personal emails (ceo@, founder@, john.doe@, personal webmail @gmail.com)
    2. Direct Outreach Business Emails (hello@, hi@, team@, admin@, office@)
    3. General Business Emails (info@, contact@, sales@, support@)
    4. Any remaining valid email
    """
    all_candidates = []
    if personal_emails:
        all_candidates.extend(personal_emails)
    if business_emails:
        all_candidates.extend(business_emails)
    if emails:
        all_candidates.extend(emails)

    if not all_candidates:
        return None

    # Step 1: Filter to ONLY working, non-dummy emails
    working_emails = []
    seen = set()
    for e in all_candidates:
        if e and isinstance(e, str):
            clean_e = e.strip()
            clean_lower = clean_e.lower()
            if clean_lower not in seen and is_working_email(clean_e, verify_dns=verify_dns):
                seen.add(clean_lower)
                working_emails.append(clean_e)

    if not working_emails:
        return None

    # Step 2: Score and rank the remaining working emails
    scored = []
    for email in working_emails:
        score = 0
        parts = email.lower().split("@", 1)
        if len(parts) == 2:
            username, domain = parts
        else:
            username, domain = email.lower(), ""

        clean_prefix = re.split(r'[._-]', username)[0]

        # 1. Executive / Founder title username (highest score: 100)
        if username in EXECUTIVE_EMAIL_KEYWORDS or clean_prefix in EXECUTIVE_EMAIL_KEYWORDS:
            score += 100
        # 2. Personal webmail domain (@gmail.com, etc. - score 95)
        elif domain in PERSONAL_WEBMAIL_DOMAINS:
            score += 95
        # 3. Named individual employee username (e.g. john.smith, sarah_m - score 85)
        elif re.search(r'[._-]', username) or (len(username) > 3 and clean_prefix not in GENERIC_EMAIL_PREFIXES):
            score += 85
        # 4. Direct outreach generic prefix (score 70)
        elif username in {"hello", "hi", "team", "office", "admin", "founder", "owner"}:
            score += 70
        # 5. Standard business prefix (score 50)
        elif username in {"info", "contact", "sales", "support", "inquiries"}:
            score += 50
        else:
            score += 30

        # Preference if it was classified in personal_emails
        if personal_emails and email in personal_emails:
            score += 15

        scored.append((score, email))

    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1]

