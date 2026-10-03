import re

# Regex for tel: links
TEL_REGEX = re.compile(
    r'tel:\s*([+\d\s\-\(\)\.]{7,25})', re.IGNORECASE
)

# Regex for phone patterns in text (international format or standard regional formats)
PHONE_REGEX = re.compile(
    r'(?:\+\d{1,3}[\s.-]?)?\(?\d{2,5}\)?[\s.-]?\d{3,5}[\s.-]?\d{3,5}'
)

def extract_phone_numbers(html_text: str, plain_text: str = "") -> list[str]:
    """
    Extracts and normalizes phone numbers from HTML & text.
    Returns deduplicated list of formatted phone numbers.
    """
    found_phones = set()
    combined_content = (html_text or "") + "\n" + (plain_text or "")
    
    # 1. Search tel: hrefs
    for match in TEL_REGEX.findall(combined_content):
        cleaned = re.sub(r'[^\d+]', '', match.strip())
        if is_valid_phone_length(cleaned):
            formatted = format_phone(match.strip())
            if formatted:
                found_phones.add(formatted)
                
    # 2. Search regex in text
    for match in PHONE_REGEX.findall(combined_content):
        candidate = match.strip()
        digits_only = re.sub(r'\D', '', candidate)
        if is_valid_phone_length(digits_only):
            if not is_likely_year_or_zip(digits_only, candidate):
                formatted = format_phone(candidate)
                if formatted:
                    found_phones.add(formatted)
                    
    return sorted(list(found_phones))

def is_valid_phone_length(digits: str) -> bool:
    """Phone digits length check (7 to 15 digits)."""
    clean_digits = re.sub(r'\D', '', digits)
    return 7 <= len(clean_digits) <= 15

def is_likely_year_or_zip(digits: str, raw: str) -> bool:
    """Filter out 4-digit years, timestamps or zip code artifacts."""
    if len(digits) < 7:
        return True
    if len(digits) == 8 and digits.startswith("20") and (digits.endswith("00") or digits.endswith("12")):
        return True
    return False

def format_phone(raw_phone: str) -> str:
    """Format and clean phone number for presentation."""
    cleaned = raw_phone.strip()
    cleaned = re.sub(r'\s+', ' ', cleaned)
    cleaned = re.sub(r'^[^\d+]+|[^\d]+$', '', cleaned)
    if len(cleaned) < 7:
        return ""
    return cleaned
