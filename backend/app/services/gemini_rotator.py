import os
import re
import json
import time
import logging
import asyncio
from typing import Optional, List, Dict, Any
import httpx

from app.config import settings

logger = logging.getLogger("gemini_rotator")

def mask_api_key(key: str) -> str:
    """Mask API key for safe display and logging (e.g., AIzaSy...7X9q)."""
    if not key:
        return ""
    clean = key.strip()
    if len(clean) <= 8:
        return clean[:2] + "..." + clean[-2:]
    return clean[:6] + "..." + clean[-4:]

class KeyState:
    def __init__(self, key: str):
        self.key = key.strip()
        self.masked = mask_api_key(self.key)
        self.status = "active"  # "active", "cooldown", "invalid"
        self.cooldown_until: float = 0.0
        self.requests_count: int = 0
        self.success_count: int = 0
        self.error_count: int = 0
        self.last_error: Optional[str] = None
        self.last_used_at: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        is_in_cooldown = self.status == "cooldown" and time.time() < self.cooldown_until
        current_status = "cooldown" if is_in_cooldown else ("active" if self.status != "invalid" else "invalid")
        return {
            "masked_key": self.masked,
            "status": current_status,
            "requests_count": self.requests_count,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "last_error": self.last_error,
            "last_used_at": self.last_used_at,
            "cooldown_remaining_sec": max(0, int(self.cooldown_until - time.time())) if is_in_cooldown else 0
        }

class GeminiKeyRotator:
    """
    Robust Gemini API Key Rotator with automatic failover, rate-limit cooldown,
    and round-robin distribution.
    """
    def __init__(self):
        self.lock = asyncio.Lock()
        self.key_states: Dict[str, KeyState] = {}
        self.current_index: int = 0
        self._load_env_keys()

    def _load_env_keys(self):
        """Loads configured keys from environment and settings."""
        keys: List[str] = []
        raw_keys = getattr(settings, "GEMINI_API_KEYS", os.getenv("GEMINI_API_KEYS", ""))
        single_key = getattr(settings, "GEMINI_API_KEY", os.getenv("GEMINI_API_KEY", ""))

        if raw_keys:
            # Supports comma, semicolon, space, or newline separation
            for k in re.split(r'[,;\n\r\t]+', raw_keys):
                k = k.strip()
                if k and k not in keys:
                    keys.append(k)

        if single_key and single_key.strip() and single_key.strip() not in keys:
            keys.append(single_key.strip())

        self.add_keys(keys)

    def add_keys(self, keys: List[str]):
        """Adds or updates keys in the pool without resetting existing stats."""
        for k in keys:
            k = k.strip()
            if k and k not in self.key_states:
                self.key_states[k] = KeyState(k)
                logger.info(f"[GeminiRotator] Registered Gemini key: {mask_api_key(k)}")

    def remove_key(self, key_or_masked: str) -> bool:
        """Removes a key from the pool matching raw key or masked key string."""
        target = key_or_masked.strip()
        matched_raw = None
        for raw, state in self.key_states.items():
            if raw == target or state.masked == target:
                matched_raw = raw
                break
        if matched_raw:
            del self.key_states[matched_raw]
            logger.info(f"[GeminiRotator] Removed key: {target}")
            return True
        return False

    def reset_cooldown(self, key_or_masked: Optional[str] = None) -> int:
        """Resets cooldown to 0 and restores status to active for a key or all keys."""
        reset_count = 0
        target = key_or_masked.strip() if key_or_masked else None
        for raw, state in self.key_states.items():
            if target is None or raw == target or state.masked == target:
                state.status = "active"
                state.cooldown_until = 0.0
                state.last_error = None
                reset_count += 1
        return reset_count

    def get_all_keys(self) -> List[str]:
        return list(self.key_states.keys())

    def get_pool_status(self) -> Dict[str, Any]:
        """Returns safe summary status of all managed keys."""
        items = [state.to_dict() for state in self.key_states.values()]
        active_count = sum(1 for item in items if item["status"] == "active")
        cooldown_count = sum(1 for item in items if item["status"] == "cooldown")
        invalid_count = sum(1 for item in items if item["status"] == "invalid")
        return {
            "total_keys": len(items),
            "active_keys": active_count,
            "cooldown_keys": cooldown_count,
            "invalid_keys": invalid_count,
            "keys": items
        }

    async def get_next_key_candidate(self, requested_keys: Optional[List[str]] = None) -> Optional[KeyState]:
        """
        Picks the next usable active key using round-robin logic.
        Recovers expired cooldown keys automatically.
        """
        async with self.lock:
            # If custom request keys provided, ensure they exist in pool
            if requested_keys:
                self.add_keys(requested_keys)
                candidate_pool = [self.key_states[k] for k in requested_keys if k in self.key_states]
            else:
                candidate_pool = list(self.key_states.values())

            if not candidate_pool:
                return None

            now = time.time()
            # Step 1: Recover any keys whose cooldown expired
            for state in candidate_pool:
                if state.status == "cooldown" and now >= state.cooldown_until:
                    state.status = "active"
                    state.last_error = None
                    logger.info(f"[GeminiRotator] Key {state.masked} cooldown expired; returned to active pool.")

            # Step 2: Find active keys
            active_keys = [s for s in candidate_pool if s.status == "active"]
            if active_keys:
                # Rotate index
                self.current_index = (self.current_index + 1) % len(active_keys)
                chosen = active_keys[self.current_index]
                chosen.requests_count += 1
                chosen.last_used_at = now
                return chosen

            # Step 3: If no active keys, pick the one with earliest cooldown expiry
            cooldown_keys = [s for s in candidate_pool if s.status == "cooldown"]
            if cooldown_keys:
                cooldown_keys.sort(key=lambda s: s.cooldown_until)
                chosen = cooldown_keys[0]
                wait_sec = max(0.5, chosen.cooldown_until - now)
                if wait_sec <= 5.0:
                    logger.warning(f"[GeminiRotator] All keys cooling down. Short wait of {wait_sec:.1f}s for {chosen.masked}...")
                    await asyncio.sleep(wait_sec)
                    chosen.status = "active"
                    chosen.requests_count += 1
                    chosen.last_used_at = time.time()
                    return chosen

            return None

    def mark_success(self, key_str: str):
        if key_str in self.key_states:
            state = self.key_states[key_str]
            state.success_count += 1
            state.status = "active"
            state.last_error = None

    def mark_error(self, key_str: str, status_code: int, error_msg: str):
        if key_str in self.key_states:
            state = self.key_states[key_str]
            state.error_count += 1
            state.last_error = f"HTTP {status_code}: {error_msg}"
            
            # Quota/Rate Limit (429) -> 60s cooldown
            if status_code == 429 or "RESOURCE_EXHAUSTED" in error_msg or "rate limit" in error_msg.lower():
                state.status = "cooldown"
                state.cooldown_until = time.time() + 60.0
                logger.warning(f"[GeminiRotator] Key {state.masked} rate limited (429). Put on cooldown for 60s.")
            # Invalid Key (400, 403) -> mark invalid
            elif status_code in (400, 403) and ("API_KEY_INVALID" in error_msg or "PERMISSION_DENIED" in error_msg or "not valid" in error_msg.lower()):
                state.status = "invalid"
                logger.error(f"[GeminiRotator] Key {state.masked} is invalid. Marked as invalid permanently.")
            else:
                # Temporary glitch -> short 10s backoff
                state.status = "cooldown"
                state.cooldown_until = time.time() + 10.0
                logger.warning(f"[GeminiRotator] Key {state.masked} error {status_code}. Short cooldown for 10s.")


# Global Singleton Rotator
rotator = GeminiKeyRotator()

# Models to attempt in order (User specified Gemini 3.8/3.6/3.5/4 models)
DEFAULT_MODELS = [
    getattr(settings, "GEMINI_MODEL", "gemini-3.8-flash"),
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-4-argon",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

async def call_gemini_api(
    prompt: str,
    api_key: str,
    model: str = "gemini-3.8-flash",
    system_instruction: Optional[str] = None
) -> str:
    """Direct HTTP REST call to Gemini generateContent endpoint."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    payload: Dict[str, Any] = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 1024,
            "responseMimeType": "application/json"
        }
    }

    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction}]
        }

    async with httpx.AsyncClient(timeout=25.0) as client:
        response = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
        
        if response.status_code != 200:
            error_text = response.text
            try:
                err_json = response.json()
                error_text = err_json.get("error", {}).get("message", error_text)
            except Exception:
                pass
            raise httpx.HTTPStatusError(
                f"Gemini API Error: {error_text}",
                request=response.request,
                response=response
            )

        data = response.json()
        candidates = data.get("candidates", [])
        if not candidates:
            raise ValueError("No text candidates returned by Gemini API")

        parts = candidates[0].get("content", {}).get("parts", [])
        if not parts:
            raise ValueError("Empty response parts from Gemini API")

        return parts[0].get("text", "").strip()

def clean_and_parse_json_response(raw_text: str) -> Dict[str, str]:
    """Extracts subject and body from Gemini output, with markdown/regex fallbacks."""
    clean = raw_text.strip()
    
    # Strip markdown code blocks if present
    if clean.startswith("```"):
        clean = re.sub(r"^```(?:json)?\s*", "", clean)
        clean = re.sub(r"\s*```$", "", clean)
        clean = clean.strip()

    try:
        parsed = json.loads(clean)
        if isinstance(parsed, dict) and "subject" in parsed and "body" in parsed:
            return {
                "subject": str(parsed["subject"]).strip(),
                "body": str(parsed["body"]).strip()
            }
    except Exception:
        pass

    # Regex fallback if json parsing failed
    subject_match = re.search(r'["\']?subject["\']?\s*:\s*["\']([^"\']+)["\']', raw_text, re.IGNORECASE)
    body_match = re.search(r'["\']?body["\']?\s*:\s*["\']([\s\S]+?)["\']\s*[,}]', raw_text, re.IGNORECASE)
    
    if subject_match and body_match:
        return {
            "subject": subject_match.group(1).strip(),
            "body": body_match.group(1).strip().replace("\\n", "\n")
        }

    # Line based fallback: Subject: ... \n\n Body ...
    sub_line_match = re.search(r'(?:Subject|Topic):\s*([^\n]+)', raw_text, re.IGNORECASE)
    if sub_line_match:
        subj = sub_line_match.group(1).strip()
        body_part = raw_text[sub_line_match.end():].strip()
        return {
            "subject": subj,
            "body": body_part
        }

    # Ultimate fallback
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    subj = lines[0][:80] if lines else "Exclusive Partnership Inquiry"
    body = "\n\n".join(lines[1:]) if len(lines) > 1 else raw_text
    return {"subject": subj, "body": body}

async def generate_ai_email(
    user_instruction: str,
    website_url: str,
    company_name: Optional[str] = None,
    recipient_email: Optional[str] = None,
    lead_context: Optional[Dict[str, Any]] = None,
    custom_keys: Optional[List[str]] = None,
    model: Optional[str] = None,
    websites: Optional[List[str]] = None,
    companies: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Generates a personalized AI email response based on user instructions and website context.
    Automatically rotates through Gemini API keys on failure/error.
    Seamlessly handles hosts managing multiple websites, generating a single consolidated email.
    """
    if custom_keys:
        rotator.add_keys(custom_keys)

    all_keys = rotator.get_all_keys()
    if not all_keys:
        raise ValueError(
            "No Gemini API keys configured. Please provide at least one Gemini API key in your request "
            "or set GEMINI_API_KEYS / GEMINI_API_KEY in your environment."
        )

    # Clean domain & multi-website list
    clean_url = website_url.strip() if website_url else ""
    all_sites: List[str] = []
    if websites:
        for w in websites:
            if w and w.strip() and w.strip() not in all_sites:
                all_sites.append(w.strip())
    if clean_url and clean_url not in all_sites:
        all_sites.insert(0, clean_url)

    is_multi_site = len(all_sites) > 1

    # System instruction
    system_instruction = (
        "You are an elite, highly persuasive B2B outreach specialist and copywriter. "
        "Your mission is to craft a hyper-personalized, authentic, concise, and compelling cold email pitch. "
        "Never sound robotic or like a generic template. Address the prospect directly and deliver immediate value. "
        "Always respond with a valid JSON object containing exactly two keys:\n"
        '{"subject": "...", "body": "..."}\n'
        "The subject must be punchy, curiosity-inducing, and under 9 words.\n"
        "The body must have a warm greeting, a concise personalized pitch, and a clear, low-friction call to action."
    )

    # Detailed prompt context
    context_info = []
    if lead_context:
        if lead_context.get("about"):
            context_info.append(f"About Website: {lead_context.get('about')[:300]}")
        if lead_context.get("contact_page"):
            context_info.append(f"Contact Page: {lead_context.get('contact_page')}")
        if lead_context.get("pages_scanned"):
            context_info.append(f"Pages Scanned: {lead_context.get('pages_scanned')}")

    context_str = "\n".join(context_info) if context_info else "Standard web domain"

    if is_multi_site:
        domains_list = [u.replace("https://", "").replace("http://", "").split("/")[0] for u in all_sites]
        domains_str = ", ".join(domains_list)
        sites_bullet = "\n".join([f"  - {u}" for u in all_sites])

        all_comp_names: List[str] = []
        if companies:
            for c in companies:
                if c and c.strip() and c.strip() not in all_comp_names:
                    all_comp_names.append(c.strip())
        if company_name and company_name.strip() and company_name.strip() not in all_comp_names:
            all_comp_names.insert(0, company_name.strip())
        display_company = " & ".join(all_comp_names) if all_comp_names else domains_str

        lead_section = f"""Target Host / Organization (Operates MULTIPLE websites under this single email):
- Websites Managed by this Host ({len(all_sites)} websites):
{sites_bullet}
- Domains: {domains_str}
- Organization / Brand Names: {display_company}
- Target Email Address: {recipient_email or "Not specified"}
- Additional Lead Context:
{context_str}

CRITICAL MULTI-SITE INSTRUCTION:
The prospect is the shared host / owner of all {len(all_sites)} websites ({domains_str}).
Do NOT send multiple separate emails.
Write ONE single, unified email addressing this person regarding ALL their websites together (e.g., inviting them to host their platforms with us, highlighting multi-site hosting consolidation, 99.99% uptime, unified migration assistance across all their domains, and volume benefits)."""
    else:
        domain = clean_url.replace("https://", "").replace("http://", "").split("/")[0]
        display_company = (company_name or "").strip() or domain or "your team"
        lead_section = f"""Target Website Lead:
- Website URL: {clean_url}
- Domain: {domain}
- Company / Organization Name: {display_company}
- Target Email Address: {recipient_email or "Not specified"}
- Additional Lead Context:
{context_str}"""

    prompt = f"""{lead_section}

User's Specific Objective & Instruction:
\"\"\"{user_instruction}\"\"\"

Task:
Write a personalized email to this website host / company matching the user's objective (e.g. inviting them to host platform, proposing collaboration, partnership, etc.).
Output JSON with "subject" and "body".
"""

    models_to_try = [model] if model else [m for m in DEFAULT_MODELS if m]
    # Deduplicate while preserving order
    seen_models = set()
    unique_models = []
    for m in models_to_try:
        if m and m not in seen_models:
            seen_models.add(m)
            unique_models.append(m)

    max_key_attempts = max(len(all_keys) * 2, 4)
    attempts = 0
    tried_keys = []
    last_error_details = []

    for attempt in range(max_key_attempts):
        key_state = await rotator.get_next_key_candidate(custom_keys)
        if not key_state:
            break

        attempts += 1
        current_key = key_state.key
        masked_key = key_state.masked
        tried_keys.append(masked_key)

        # Try models with this key
        for cur_model in unique_models:
            try:
                logger.info(f"[GeminiRotator] Attempt {attempts} using key {masked_key} with model {cur_model}...")
                raw_response = await call_gemini_api(
                    prompt=prompt,
                    api_key=current_key,
                    model=cur_model,
                    system_instruction=system_instruction
                )

                parsed = clean_and_parse_json_response(raw_response)
                rotator.mark_success(current_key)
                
                logger.info(f"[GeminiRotator] Successfully generated AI email using key {masked_key} (model: {cur_model}).")
                return {
                    "subject": parsed["subject"],
                    "body": parsed["body"],
                    "key_used": masked_key,
                    "model_used": cur_model,
                    "attempts": attempts,
                    "website_url": clean_url or (all_sites[0] if all_sites else ""),
                    "websites": all_sites,
                    "is_multi_site": is_multi_site,
                    "recipient_email": recipient_email
                }

            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code
                err_msg = str(e)
                try:
                    err_msg = e.response.json().get("error", {}).get("message", err_msg)
                except Exception:
                    pass

                rotator.mark_error(current_key, status_code, err_msg)
                last_error_details.append(f"Key {masked_key} (model {cur_model}): HTTP {status_code} - {err_msg}")
                logger.warning(
                    f"[GeminiRotator] Error on key {masked_key} (model {cur_model}): HTTP {status_code}. "
                    f"Rotator will switch to another key."
                )

                # If 404 model not found, try the next model with same key
                if status_code == 404:
                    continue
                # For 429 (rate limit) or 403 (invalid key) or 5xx, break to rotate key immediately
                break

            except Exception as e:
                rotator.mark_error(current_key, 500, str(e))
                last_error_details.append(f"Key {masked_key}: Exception - {str(e)}")
                logger.warning(f"[GeminiRotator] Exception with key {masked_key}: {e}. Rotating to next key...")
                break

    # If all keys failed
    err_summary = " | ".join(last_error_details[-3:]) if last_error_details else "All Gemini API keys failed or on cooldown."
    raise RuntimeError(
        f"Gemini Key Rotator failed after trying {attempts} keys ({', '.join(set(tried_keys))}). "
        f"Details: {err_summary}"
    )

async def test_single_key(
    api_key: str, 
    model: str = "gemini-3.8-flash",
    update_state: bool = True
) -> Dict[str, Any]:
    """
    Tests a single Gemini API key with a ping prompt to verify valid credentials and quota.
    Records latency, detects 429 rate limits vs 403 invalid keys, and optionally updates the rotator state.
    """
    clean_key = api_key.strip()
    masked = mask_api_key(clean_key)
    start_time = time.time()
    
    try:
        response = await call_gemini_api(
            prompt='Respond with JSON: {"status": "ok", "message": "Key is active and quota verified"}',
            api_key=clean_key,
            model=model
        )
        latency_ms = int((time.time() - start_time) * 1000)
        
        if update_state:
            rotator.mark_success(clean_key)
            
        return {
            "valid": True,
            "status": "active",
            "key": clean_key,
            "masked_key": masked,
            "status_code": 200,
            "latency_ms": latency_ms,
            "message": f"Verified successfully! Key is active and quota is available ({latency_ms}ms)."
        }
    except httpx.HTTPStatusError as e:
        latency_ms = int((time.time() - start_time) * 1000)
        status = e.response.status_code
        err_text = str(e)
        try:
            err_text = e.response.json().get("error", {}).get("message", err_text)
        except Exception:
            pass
            
        if update_state:
            rotator.mark_error(clean_key, status, err_text)
            
        error_type = "UNKNOWN_ERROR"
        if status == 429 or "RESOURCE_EXHAUSTED" in err_text or "rate limit" in err_text.lower():
            error_type = "RATE_LIMIT_429"
            user_msg = f"HTTP 429 Rate Limit / Quota Exceeded: {err_text}"
        elif status in (400, 403):
            error_type = "INVALID_KEY"
            user_msg = f"HTTP {status} Invalid API Key: {err_text}"
        else:
            error_type = f"HTTP_{status}"
            user_msg = f"HTTP {status} Error: {err_text}"
            
        return {
            "valid": False,
            "status": "cooldown" if status == 429 else ("invalid" if status in (400, 403) else "error"),
            "key": clean_key,
            "masked_key": masked,
            "status_code": status,
            "error_type": error_type,
            "latency_ms": latency_ms,
            "message": user_msg
        }
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        if update_state:
            rotator.mark_error(clean_key, 500, str(e))
        return {
            "valid": False,
            "status": "error",
            "key": clean_key,
            "masked_key": masked,
            "status_code": 500,
            "error_type": "NETWORK_EXCEPTION",
            "latency_ms": latency_ms,
            "message": f"Network or connection error: {str(e)}"
        }

async def test_all_keys(
    keys: Optional[List[str]] = None,
    model: str = "gemini-3.8-flash"
) -> Dict[str, Any]:
    """
    Tests all Gemini keys respectively one by one.
    Returns full diagnostics identifying exactly which key(s) work and which key hits 429 or errors.
    """
    if keys:
        clean_keys = [k.strip() for k in keys if k.strip()]
        # Ensure registered in rotator
        rotator.add_keys(clean_keys)
    else:
        clean_keys = rotator.get_all_keys()

    if not clean_keys:
        return {
            "total_tested": 0,
            "active_count": 0,
            "rate_limited_count": 0,
            "invalid_count": 0,
            "model_used": model,
            "results": []
        }

    results: List[Dict[str, Any]] = []
    active_count = 0
    rate_limited_count = 0
    invalid_count = 0

    for idx, k in enumerate(clean_keys, 1):
        res = await test_single_key(k, model=model, update_state=True)
        res["index"] = idx
        if res.get("valid"):
            active_count += 1
        elif res.get("error_type") == "RATE_LIMIT_429":
            rate_limited_count += 1
        else:
            invalid_count += 1
        results.append(res)

    return {
        "total_tested": len(clean_keys),
        "active_count": active_count,
        "rate_limited_count": rate_limited_count,
        "invalid_count": invalid_count,
        "model_used": model,
        "results": results
    }
