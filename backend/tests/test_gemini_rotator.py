import pytest
import asyncio
import json
from unittest.mock import patch, MagicMock
import httpx

from app.services.gemini_rotator import (
    GeminiKeyRotator,
    mask_api_key,
    clean_and_parse_json_response,
    generate_ai_email,
    test_single_key as verify_single_key,
    test_all_keys as verify_all_keys,
    rotator
)

def test_mask_api_key():
    assert mask_api_key("AIzaSyD1234567890XYZ") == "AIzaSy...0XYZ"
    assert mask_api_key("short") == "sh...rt"
    assert mask_api_key("") == ""

def test_key_rotator_registration():
    r = GeminiKeyRotator()
    r.key_states.clear()
    r.add_keys(["key_alpha", "key_beta", "key_alpha"])  # duplicate test
    assert len(r.key_states) == 2
    assert "key_alpha" in r.key_states
    assert "key_beta" in r.key_states
    status = r.get_pool_status()
    assert status["total_keys"] == 2
    assert status["active_keys"] == 2

@pytest.mark.asyncio
async def test_key_rotation_round_robin():
    r = GeminiKeyRotator()
    r.key_states.clear()
    r.add_keys(["key_1", "key_2", "key_3"])

    k1 = await r.get_next_key_candidate()
    k2 = await r.get_next_key_candidate()
    k3 = await r.get_next_key_candidate()

    keys_chosen = [k1.key, k2.key, k3.key]
    assert len(set(keys_chosen)) >= 2  # Ensured rotation between candidates

@pytest.mark.asyncio
async def test_key_rotator_failover_on_429_rate_limit():
    r = GeminiKeyRotator()
    r.key_states.clear()
    r.add_keys(["key_quota_fail", "key_working"])

    # Simulate key_quota_fail failing with 429
    r.mark_error("key_quota_fail", 429, "Resource exhausted (rate limit)")

    status = r.get_pool_status()
    assert status["cooldown_keys"] == 1
    assert status["active_keys"] == 1

    # Next candidate must be key_working!
    next_candidate = await r.get_next_key_candidate()
    assert next_candidate is not None
    assert next_candidate.key == "key_working"

@pytest.mark.asyncio
async def test_key_rotator_failover_on_403_invalid_key():
    r = GeminiKeyRotator()
    r.key_states.clear()
    r.add_keys(["key_bad", "key_good"])

    # Simulate key_bad failing with 403 API_KEY_INVALID
    r.mark_error("key_bad", 403, "API_KEY_INVALID")

    status = r.get_pool_status()
    assert status["invalid_keys"] == 1
    assert status["active_keys"] == 1

    next_candidate = await r.get_next_key_candidate()
    assert next_candidate is not None
    assert next_candidate.key == "key_good"

def test_clean_and_parse_json_response():
    # Test valid JSON with markdown fence
    raw_markdown = """```json
    {
        "subject": "Invite: Host your site on our cloud",
        "body": "Hi there,\\n\\nWe'd love to invite you to our platform."
    }
    ```"""
    parsed = clean_and_parse_json_response(raw_markdown)
    assert parsed["subject"] == "Invite: Host your site on our cloud"
    assert "We'd love to invite you" in parsed["body"]

    # Test plain text with Subject: line
    plain_text = "Subject: Special Collaboration Offer\n\nHello Team,\nWe noticed your domain."
    parsed2 = clean_and_parse_json_response(plain_text)
    assert parsed2["subject"] == "Special Collaboration Offer"
    assert "Hello Team" in parsed2["body"]

@pytest.mark.asyncio
async def test_generate_ai_email_with_simulated_switch():
    """Simulates first key failing with HTTP 429 and second key succeeding."""
    r = rotator
    r.key_states.clear()
    r.add_keys(["key_will_fail", "key_will_succeed"])
    r.current_index = -1  # Ensure first chosen key is key_will_fail (index 0)

    call_count = 0

    async def mock_post(url, **kwargs):
        nonlocal call_count
        call_count += 1
        # If url contains key_will_fail, throw 429
        if "key_will_fail" in url:
            req = httpx.Request("POST", url)
            resp = httpx.Response(429, request=req, json={"error": {"message": "Rate limit exceeded"}})
            raise httpx.HTTPStatusError("Rate limited", request=req, response=resp)
        else:
            req = httpx.Request("POST", url)
            return httpx.Response(
                200,
                request=req,
                json={
                    "candidates": [
                        {
                            "content": {
                                "parts": [
                                    {
                                        "text": '{"subject": "Hosting Invitation for Acme", "body": "Join our platform today!"}'
                                    }
                                ]
                            }
                        }
                    ]
                }
            )

    with patch("httpx.AsyncClient.post", side_effect=mock_post):
        res = await generate_ai_email(
            user_instruction="visit all websites and invite that website host to host platform",
            website_url="https://acme.org",
            company_name="Acme Inc"
        )

        assert res["subject"] == "Hosting Invitation for Acme"
        assert res["body"] == "Join our platform today!"
        assert res["attempts"] >= 2  # Verified that it tried first key, caught error, and switched to second key!

def test_remove_and_reset_cooldown():
    r = GeminiKeyRotator()
    r.key_states.clear()
    r.add_keys(["key_x", "key_y"])
    r.mark_error("key_x", 429, "Rate limit")
    
    assert r.key_states["key_x"].status == "cooldown"
    
    # Test reset cooldown
    r.reset_cooldown("key_x")
    assert r.key_states["key_x"].status == "active"
    assert r.key_states["key_x"].cooldown_until == 0.0
    
    # Test remove key
    success = r.remove_key("key_y")
    assert success is True
    assert "key_y" not in r.key_states
    assert len(r.key_states) == 1

@pytest.mark.asyncio
async def test_test_single_key_diagnostics():
    async def mock_post(url, **kwargs):
        req = httpx.Request("POST", url)
        if "rate_limit_key" in url:
            resp = httpx.Response(429, request=req, json={"error": {"message": "Resource has been exhausted (rate limit)"}})
            raise httpx.HTTPStatusError("Rate limited", request=req, response=resp)
        else:
            return httpx.Response(
                200,
                request=req,
                json={"candidates": [{"content": {"parts": [{"text": '{"status": "ok"}'}]}}]}
            )

    with patch("httpx.AsyncClient.post", side_effect=mock_post):
        # 1. Test successful key
        res_ok = await verify_single_key("active_working_key")
        assert res_ok["valid"] is True
        assert res_ok["status"] == "active"
        assert res_ok["status_code"] == 200

        # 2. Test 429 key
        res_429 = await verify_single_key("rate_limit_key")
        assert res_429["valid"] is False
        assert res_429["status"] == "cooldown"
        assert res_429["status_code"] == 429
        assert res_429["error_type"] == "RATE_LIMIT_429"
        assert "429" in res_429["message"]

@pytest.mark.asyncio
async def test_test_all_keys_respective_reporting():
    async def mock_post(url, **kwargs):
        req = httpx.Request("POST", url)
        if "bad_429" in url:
            resp = httpx.Response(429, request=req, json={"error": {"message": "Rate limit exceeded"}})
            raise httpx.HTTPStatusError("Rate limited", request=req, response=resp)
        else:
            return httpx.Response(
                200,
                request=req,
                json={"candidates": [{"content": {"parts": [{"text": '{"status": "ok"}'}]}}]}
            )

    with patch("httpx.AsyncClient.post", side_effect=mock_post):
        report = await verify_all_keys(["good_key_1", "bad_429_key", "good_key_2"])
        assert report["total_tested"] == 3
        assert report["active_count"] == 2
        assert report["rate_limited_count"] == 1
        assert len(report["results"]) == 3
        
        # Check that result #2 was identified as the 429 culprit
        culprit = report["results"][1]
        assert culprit["status_code"] == 429
        assert culprit["error_type"] == "RATE_LIMIT_429"

@pytest.mark.asyncio
async def test_generate_ai_email_multi_site_consolidation():
    captured_prompts = []

    async def mock_post(url, **kwargs):
        req = httpx.Request("POST", url)
        json_body = kwargs.get("json", {})
        prompt_text = json_body.get("contents", [{}])[0].get("parts", [{}])[0].get("text", "")
        captured_prompts.append(prompt_text)

        response_payload = {
            "subject": "Consolidating your platforms: Acme & Beta",
            "body": "Hello John,\n\nWe noticed you manage both acme.com and beta.com. We can host both platforms with 99.99% uptime and unified migration assistance."
        }
        return httpx.Response(
            200,
            request=req,
            json={"candidates": [{"content": {"parts": [{"text": json.dumps(response_payload)}]}}]}
        )

    with patch("httpx.AsyncClient.post", side_effect=mock_post):
        res = await generate_ai_email(
            user_instruction="Invite host to host platform",
            website_url="https://acme.com",
            company_name="Acme Corp",
            recipient_email="admin@sharedhost.com",
            custom_keys=["test_multi_site_key_123456"],
            websites=["https://acme.com", "https://beta.com", "https://gamma.com"],
            companies=["Acme Corp", "Beta Shop", "Gamma App"]
        )

        assert res["is_multi_site"] is True
        assert len(res["websites"]) == 3
        assert "acme.com" in res["websites"][0]
        assert res["subject"] == "Consolidating your platforms: Acme & Beta"
        
        # Verify the prompt sent to Gemini explicitly mentions all 3 websites and multi-site instructions
        sent_prompt = captured_prompts[0]
        assert "https://beta.com" in sent_prompt
        assert "https://gamma.com" in sent_prompt
        assert "CRITICAL MULTI-SITE INSTRUCTION" in sent_prompt
        assert "Do NOT send multiple separate emails" in sent_prompt


