from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.utils.url_utils import parse_url_file, normalize_url, is_valid_url
from app.services.job_service import create_scraping_job, get_job_progress, list_jobs, delete_job
from app.workers.tasks import process_job_async
from app.models.job import Job

router = APIRouter(prefix="/jobs", tags=["jobs"])

class DirectJobCreateRequest(BaseModel):
    filename: str = "direct_input.txt"
    urls: list[str]

@router.post("/upload")
async def upload_url_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a file (CSV, XLSX, TXT) containing website URLs.
    Validates, normalizes, removes duplicates, creates a job, and starts background processing.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")
        
    ext = file.filename.lower().split(".")[-1] if "." in file.filename else ""
    if ext not in ("csv", "xlsx", "xls", "txt"):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload CSV, XLSX, or TXT file."
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    parsed_info = parse_url_file(content, file.filename)
    valid_urls = parsed_info["valid_urls"]

    if not valid_urls:
        raise HTTPException(
            status_code=400,
            detail=f"No valid website URLs found in file. Total lines parsed: {parsed_info['total']}."
        )

    job = create_scraping_job(db, filename=file.filename, urls=valid_urls)

    # Start background processing task
    background_tasks.add_task(process_job_async, job.id)

    return {
        "job_id": job.id,
        "filename": job.filename,
        "total_urls_detected": parsed_info["total"],
        "valid_urls_count": len(valid_urls),
        "invalid_urls": parsed_info["invalid_urls"],
        "duplicates_removed": parsed_info["duplicates_removed"],
        "status": job.status
    }

@router.post("/direct")
async def create_job_direct(
    payload: DirectJobCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Create job directly from a list of URLs."""
    valid_urls = []
    invalid_urls = []
    seen = set()

    for u in payload.urls:
        norm = normalize_url(u)
        if not norm or norm in seen:
            continue
        valid, reason = is_valid_url(norm)
        if valid:
            seen.add(norm)
            valid_urls.append(norm)
        else:
            invalid_urls.append({"raw_url": u, "reason": reason})

    if not valid_urls:
        raise HTTPException(status_code=400, detail="No valid URLs provided.")

    job = create_scraping_job(db, filename=payload.filename, urls=valid_urls)
    background_tasks.add_task(process_job_async, job.id)

    return {
        "job_id": job.id,
        "filename": job.filename,
        "valid_urls_count": len(valid_urls),
        "invalid_urls": invalid_urls,
        "status": job.status
    }

@router.get("")
def get_jobs_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Returns paginated list of all previous scraping jobs."""
    return list_jobs(db, page=page, page_size=page_size)

@router.get("/{job_id}")
def get_job_detail(job_id: str, db: Session = Depends(get_db)):
    """Returns job details."""
    progress = get_job_progress(db, job_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Job not found.")
    return progress

@router.get("/{job_id}/progress")
def get_job_live_progress(job_id: str, db: Session = Depends(get_db)):
    """Returns live progress details for a running job."""
    progress = get_job_progress(db, job_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Job not found.")
    return progress

@router.delete("/{job_id}")
def delete_job_by_id(job_id: str, db: Session = Depends(get_db)):
    """Deletes job and its results."""
    success = delete_job(db, job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found.")
    return {"message": "Job deleted successfully", "job_id": job_id}
