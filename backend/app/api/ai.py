import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.website_result import WebsiteResult
from app.models.job import Job
from app.services.gemini_rotator import (
    rotator,
    generate_ai_email,
    test_single_key,
    test_all_keys,
    mask_api_key
)

logger = logging.getLogger("ai_api")
router = APIRouter(prefix="/ai", tags=["ai"])

class GenerateAIEmailRequest(BaseModel):
    user_instruction: str
    website_url: Optional[str] = ""
    websites: Optional[List[str]] = None
    company_name: Optional[str] = None
    companies: Optional[List[str]] = None
    recipient_email: Optional[str] = None
    lead_context: Optional[Dict[str, Any]] = None
    gemini_api_keys: Optional[List[str]] = None
    model: Optional[str] = None
    result_id: Optional[str] = None
    result_ids: Optional[List[str]] = None

class BatchGenerateAIRequest(BaseModel):
    user_instruction: str
    result_ids: Optional[List[str]] = None
    overwrite_existing: bool = True
    gemini_api_keys: Optional[List[str]] = None
    model: Optional[str] = None

class AddKeysRequest(BaseModel):
    keys: List[str]

class TestKeyRequest(BaseModel):
    key: str
    model: Optional[str] = "gemini-3.8-flash"

class TestAllKeysRequest(BaseModel):
    keys: Optional[List[str]] = None
    model: Optional[str] = "gemini-3.8-flash"

class ResetCooldownRequest(BaseModel):
    key: Optional[str] = None

class RemoveKeyRequest(BaseModel):
    key: str

class UpdateAIEmailRequest(BaseModel):
    subject: str
    body: str

@router.post("/generate-email")
async def generate_single_ai_email(
    payload: GenerateAIEmailRequest,
    db: Session = Depends(get_db)
):
    """
    Generates a personalized AI email draft based on user instruction and website context.
    Automatically rotates through Gemini API keys if one fails or hits rate limits.
    Seamlessly handles prospects managing multiple websites, generating a single combined email.
    If result_id or result_ids is provided, updates all linked database records.
    """
    if not payload.user_instruction.strip():
        raise HTTPException(status_code=400, detail="User instruction cannot be empty.")
    
    primary_url = (payload.website_url or "").strip()
    if not primary_url and payload.websites:
        primary_url = payload.websites[0].strip()
    if not primary_url and not payload.websites:
        raise HTTPException(status_code=400, detail="Website URL or websites list cannot be empty.")

    try:
        result = await generate_ai_email(
            user_instruction=payload.user_instruction,
            website_url=primary_url,
            company_name=payload.company_name,
            recipient_email=payload.recipient_email,
            lead_context=payload.lead_context,
            custom_keys=payload.gemini_api_keys,
            model=payload.model,
            websites=payload.websites,
            companies=payload.companies
        )

        # If linked to results in DB, persist across all associated records
        ids_to_update = set()
        if payload.result_ids:
            ids_to_update.update(payload.result_ids)
        if payload.result_id:
            ids_to_update.add(payload.result_id)

        if ids_to_update:
            db.query(WebsiteResult).filter(WebsiteResult.id.in_(ids_to_update)).update({
                WebsiteResult.ai_email_subject: result["subject"],
                WebsiteResult.ai_email_body: result["body"],
                WebsiteResult.ai_email_prompt: payload.user_instruction,
                WebsiteResult.ai_email_generated_at: datetime.utcnow()
            }, synchronize_session=False)
            db.commit()

        return {
            "status": "success",
            "subject": result["subject"],
            "body": result["body"],
            "key_used": result["key_used"],
            "model_used": result["model_used"],
            "attempts": result["attempts"],
            "website_url": result["website_url"],
            "websites": result.get("websites", []),
            "is_multi_site": result.get("is_multi_site", False),
            "recipient_email": result["recipient_email"]
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error generating AI email: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

@router.post("/jobs/{job_id}/batch-generate")
async def batch_generate_job_ai_emails(
    job_id: str,
    payload: BatchGenerateAIRequest,
    db: Session = Depends(get_db)
):
    """
    Batch generates AI emails for all or selected leads in a job.
    Saves generated AI email subject & body directly into each WebsiteResult.
    Auto-rotates Gemini API keys when errors occur.
    """
    if not payload.user_instruction.strip():
        raise HTTPException(status_code=400, detail="User instruction cannot be empty.")

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    query = db.query(WebsiteResult).filter(WebsiteResult.job_id == job_id)
    if payload.result_ids:
        query = query.filter(WebsiteResult.id.in_(payload.result_ids))

    results = query.all()
    if not results:
        raise HTTPException(status_code=404, detail="No matching website results found for this job.")

    # Group results by primary email so hosts with multiple websites receive a single consolidated AI pitch
    grouped_leads: Dict[str, List[WebsiteResult]] = {}
    for item in results:
        # Check if already generated and overwrite is false
        if not payload.overwrite_existing and item.ai_email_body:
            continue
        email_key = item.primary_email.strip().lower() if item.primary_email and item.primary_email.strip() else f"_no_email_{item.id}"
        if email_key not in grouped_leads:
            grouped_leads[email_key] = []
        grouped_leads[email_key].append(item)

    processed_count = 0
    errors_count = 0
    generated_items = []

    for email_key, group in grouped_leads.items():
        primary_item = group[0]
        primary_email = primary_item.primary_email if not email_key.startswith("_no_email_") else None
        
        # Collect all websites and companies for this host
        all_sites = [i.website_url for i in group if i.website_url]
        all_companies = [i.company_name for i in group if i.company_name]
        all_ids = [i.id for i in group]

        about_snippets = [i.about_page for i in group if i.about_page]
        about_combined = " | ".join(about_snippets[:2]) if about_snippets else ""
        context = {
            "about": about_combined,
            "contact_page": primary_item.contact_page,
            "pages_scanned": sum(i.pages_scanned or 0 for i in group)
        }

        try:
            ai_data = await generate_ai_email(
                user_instruction=payload.user_instruction,
                website_url=primary_item.website_url,
                company_name=primary_item.company_name,
                recipient_email=primary_email,
                lead_context=context,
                custom_keys=payload.gemini_api_keys,
                model=payload.model,
                websites=all_sites,
                companies=all_companies
            )

            now = datetime.utcnow()
            for item in group:
                item.ai_email_subject = ai_data["subject"]
                item.ai_email_body = ai_data["body"]
                item.ai_email_prompt = payload.user_instruction
                item.ai_email_generated_at = now
            db.commit()

            processed_count += len(group)
            generated_items.append({
                "id": primary_item.id,
                "result_ids": all_ids,
                "website_url": primary_item.website_url,
                "websites": all_sites,
                "is_multi_site": len(all_sites) > 1,
                "company_name": primary_item.company_name,
                "recipient_email": primary_email,
                "subject": ai_data["subject"],
                "body": ai_data["body"],
                "key_used": ai_data["key_used"]
            })

        except Exception as e:
            errors_count += len(group)
            logger.warning(f"Batch AI generation failed for lead {email_key} ({primary_item.website_url}): {e}")

    return {
        "status": "completed",
        "job_id": job_id,
        "total_requested": len(results),
        "successfully_generated": processed_count,
        "failed_count": errors_count,
        "items": generated_items
    }

@router.put("/jobs/{job_id}/results/{result_id}/ai-email")
def update_result_ai_email(
    job_id: str,
    result_id: str,
    payload: UpdateAIEmailRequest,
    db: Session = Depends(get_db)
):
    """Allows manual editing and saving of an AI email draft on a result."""
    res = db.query(WebsiteResult).filter(
        WebsiteResult.id == result_id,
        WebsiteResult.job_id == job_id
    ).first()
    if not res:
        raise HTTPException(status_code=404, detail="Result not found.")

    res.ai_email_subject = payload.subject
    res.ai_email_body = payload.body
    res.ai_email_generated_at = datetime.utcnow()
    db.commit()

    return {
        "status": "success",
        "id": res.id,
        "ai_email_subject": res.ai_email_subject,
        "ai_email_body": res.ai_email_body
    }

@router.get("/keys/status")
def get_gemini_rotator_status():
    """Returns status of all managed Gemini keys in the rotator pool."""
    return rotator.get_pool_status()

@router.post("/keys/add")
def add_gemini_keys(payload: AddKeysRequest):
    """Dynamically adds new Gemini keys to the rotator pool."""
    rotator.add_keys(payload.keys)
    return {
        "status": "success",
        "message": f"Added {len(payload.keys)} keys to the rotator.",
        "pool": rotator.get_pool_status()
    }

@router.post("/keys/test")
async def test_key_validity(payload: TestKeyRequest):
    """Tests a single Gemini key to verify if it responds successfully."""
    if not payload.key.strip():
        raise HTTPException(status_code=400, detail="Key cannot be empty.")
    result = await test_single_key(payload.key, payload.model or "gemini-3.8-flash")
    return result

@router.post("/keys/test-all")
async def test_all_keys_validity(payload: TestAllKeysRequest):
    """
    Tests all Gemini keys respectively one by one.
    Reports individual latency, active quota, or 429 quota exhausted error for each key.
    """
    result = await test_all_keys(payload.keys, payload.model or "gemini-3.8-flash")
    return result

@router.post("/keys/reset-cooldown")
def reset_keys_cooldown(payload: ResetCooldownRequest):
    """Resets cooldown status for a specific key or all keys."""
    count = rotator.reset_cooldown(payload.key)
    return {
        "status": "success",
        "message": f"Reset cooldown for {count} key(s).",
        "pool": rotator.get_pool_status()
    }

@router.post("/keys/remove")
def remove_gemini_key(payload: RemoveKeyRequest):
    """Removes a key from the rotator pool."""
    if not payload.key.strip():
        raise HTTPException(status_code=400, detail="Key cannot be empty.")
    success = rotator.remove_key(payload.key)
    if not success:
        raise HTTPException(status_code=404, detail="Key not found in pool.")
    return {
        "status": "success",
        "message": "Key removed from rotator pool.",
        "pool": rotator.get_pool_status()
    }
