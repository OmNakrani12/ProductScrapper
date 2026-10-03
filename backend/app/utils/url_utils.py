import io
import re
from urllib.parse import urlparse, urlunparse
import pandas as pd
from app.utils.security import is_ssrf_safe

def normalize_url(raw_url: str) -> str:
    """Normalize user provided URL string."""
    if not raw_url or not isinstance(raw_url, str):
        return ""
    
    url = raw_url.strip()
    url = url.strip('"\'`')
    
    if not url:
        return ""
    
    # Fix common typos like https:/// or http:/// -> https://
    url = re.sub(r'^(https?):/{3,}', r'\1://', url, flags=re.IGNORECASE)
    
    # Prepend https:// if protocol missing
    if not re.match(r'^[a-zA-Z]+://', url):
        url = "https://" + url
    
    parsed = urlparse(url)
    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()
    path = parsed.path
    
    # If netloc is missing because of leading slashes in path
    if not netloc and path:
        clean_path = path.lstrip("/")
        if "/" in clean_path:
            netloc, path = clean_path.split("/", 1)
            path = "/" + path
        else:
            netloc = clean_path
            path = ""
    
    if path == "/":
        path = ""
        
    normalized = urlunparse((scheme, netloc, path, parsed.params, parsed.query, parsed.fragment))
    return normalized

def is_valid_url(url: str) -> tuple[bool, str]:
    """Validate format and security safety of URL."""
    if not url:
        return False, "Empty URL"
    
    norm = normalize_url(url)
    parsed = urlparse(norm)
    if not parsed.scheme or not parsed.netloc:
        return False, "Invalid URL format"
        
    # Check SSRF safety first
    is_safe, reason = is_ssrf_safe(norm)
    if not is_safe:
        return False, reason
        
    # Check domain dots
    if "." not in parsed.netloc:
        return False, "Invalid domain name format"
        
    return True, ""

def parse_url_file(file_content: bytes, filename: str) -> dict:
    """
    Parses file content (CSV, XLSX, TXT) and returns structured URL inspection results.
    """
    raw_urls: list[str] = []
    ext = filename.lower().split(".")[-1] if "." in filename else ""
    
    if ext == "csv":
        try:
            df = pd.read_csv(io.BytesIO(file_content))
            raw_urls = extract_urls_from_dataframe(df)
        except Exception:
            text = file_content.decode("utf-8", errors="ignore")
            raw_urls = [line.strip() for line in text.splitlines() if line.strip()]
            
    elif ext in ("xlsx", "xls"):
        try:
            df = pd.read_excel(io.BytesIO(file_content))
            raw_urls = extract_urls_from_dataframe(df)
        except Exception as e:
            raise ValueError(f"Failed to parse Excel file: {str(e)}")
            
    elif ext == "txt":
        text = file_content.decode("utf-8", errors="ignore")
        raw_urls = [line.strip() for line in text.splitlines() if line.strip()]
    else:
        text = file_content.decode("utf-8", errors="ignore")
        raw_urls = [line.strip() for line in text.splitlines() if line.strip()]

    seen = set()
    valid_urls = []
    invalid_urls = []
    duplicates_count = 0
    
    for raw in raw_urls:
        if not raw or not isinstance(raw, str):
            continue
        cleaned_raw = raw.strip()
        if not cleaned_raw:
            continue
            
        norm = normalize_url(cleaned_raw)
        if norm in seen:
            duplicates_count += 1
            continue
            
        valid, reason = is_valid_url(norm)
        if valid:
            seen.add(norm)
            valid_urls.append(norm)
        else:
            invalid_urls.append({"raw_url": cleaned_raw, "reason": reason})
            
    return {
        "total": len(raw_urls),
        "valid_urls": valid_urls,
        "invalid_urls": invalid_urls,
        "duplicates_removed": duplicates_count
    }

def extract_urls_from_dataframe(df: pd.DataFrame) -> list[str]:
    """Auto-detect column with URLs or flatten data."""
    if df.empty:
        return []
    
    url_cols = [c for c in df.columns if any(kw in str(c).lower() for kw in ["url", "website", "domain", "link", "site"])]
    if url_cols:
        col = url_cols[0]
        return [str(val) for val in df[col].dropna().tolist()]
    
    for col in df.columns:
        series_sample = df[col].dropna().astype(str).tolist()[:10]
        if any("." in s or "http" in s.lower() for s in series_sample):
            return [str(val) for val in df[col].dropna().tolist()]
            
    all_vals = df.values.flatten()
    return [str(v) for v in all_vals if pd.notna(v) and str(v).strip()]
