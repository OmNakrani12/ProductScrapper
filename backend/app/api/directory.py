from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.scraper.directory_extractor import extract_directory_products, extract_directory_products_range
from app.services.job_service import create_scraping_job
from app.workers.tasks import process_job_async
from app.utils.url_utils import normalize_url, is_valid_url

router = APIRouter(prefix="/directory", tags=["directory"])

class DirectoryExtractRequest(BaseModel):
    directory_url: str

class DirectoryExtractRangeRequest(BaseModel):
    url_pattern: str
    start_number: int = 1
    end_number: int = 10

class ScrapeDiscoveredProductsRequest(BaseModel):
    filename: str = "directory_products.txt"
    urls: list[str]

@router.post("/extract")
async def extract_products_from_directory(payload: DirectoryExtractRequest):
    """
    Crawls a directory/showcase page (e.g., https://scrolllaunch.com)
    and extracts external product website URLs listed on it.
    """
    if not payload.directory_url:
        raise HTTPException(status_code=400, detail="Directory URL is required.")

    result = await extract_directory_products(payload.directory_url)
    if result.get("error") and result["total_products_found"] == 0:
        raise HTTPException(status_code=400, detail=result["error"])

    return result

@router.post("/extract-range")
async def extract_range_products_from_directory(payload: DirectoryExtractRangeRequest):
    """
    Crawls a sequence of directory pages using a number range (e.g. /week/2026/1 to /week/2026/38)
    and extracts all unique external product links across all pages in range.
    """
    if not payload.url_pattern:
        raise HTTPException(status_code=400, detail="URL pattern or directory URL is required.")
    if payload.start_number < 1 or payload.end_number < 1:
        raise HTTPException(status_code=400, detail="Start and end numbers must be positive integers.")

    result = await extract_directory_products_range(
        payload.url_pattern,
        payload.start_number,
        payload.end_number
    )
    if result.get("error") and result["total_products_found"] == 0:
        raise HTTPException(status_code=400, detail=result["error"])

    return result

@router.post("/scrape-discovered")
async def scrape_discovered_products(
    payload: ScrapeDiscoveredProductsRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Creates a new contact scraping job for discovered product links from a directory
    and triggers background extraction of emails, phones, and social links.
    """
    if not payload.urls:
        raise HTTPException(status_code=400, detail="No product URLs provided.")

    valid_urls = []
    seen = set()

    for u in payload.urls:
        norm = normalize_url(u)
        if not norm or norm in seen:
            continue
        valid, _ = is_valid_url(norm)
        if valid:
            seen.add(norm)
            valid_urls.append(norm)

    if not valid_urls:
        raise HTTPException(status_code=400, detail="No valid product URLs found to scrape.")

    job = create_scraping_job(db, filename=payload.filename, urls=valid_urls)
    background_tasks.add_task(process_job_async, job.id)

    return {
        "job_id": job.id,
        "filename": job.filename,
        "valid_urls_count": len(valid_urls),
        "status": job.status
    }
