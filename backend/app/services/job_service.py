from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, and_
from app.models.job import Job
from app.models.website_result import WebsiteResult

def create_scraping_job(db: Session, filename: str, urls: list[str]) -> Job:
    """Create a new Job record and initial WebsiteResult records in DB."""
    job = Job(
        filename=filename,
        total_websites=len(urls),
        processed_websites=0,
        successful_websites=0,
        failed_websites=0,
        emails_found=0,
        phones_found=0,
        status="pending",
        created_at=datetime.utcnow()
    )
    db.add(job)
    db.flush()

    # Pre-create pending website result entries
    results = []
    for url in urls:
        res = WebsiteResult(
            job_id=job.id,
            website_url=url,
            status="pending"
        )
        results.append(res)
    
    db.add_all(results)
    db.commit()
    db.refresh(job)
    return job

def get_job_progress(db: Session, job_id: str) -> dict | None:
    """Calculates live progress metrics for a job."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return None
        
    percent = 0.0
    if job.total_websites > 0:
        percent = round((job.processed_websites / job.total_websites) * 100, 1)
        
    # Get current processing website if any
    current_item = db.query(WebsiteResult).filter(
        WebsiteResult.job_id == job_id,
        WebsiteResult.status == "processing"
    ).first()
    
    return {
        "job_id": job.id,
        "filename": job.filename,
        "status": job.status,
        "total_websites": job.total_websites,
        "processed_websites": job.processed_websites,
        "successful_websites": job.successful_websites,
        "failed_websites": job.failed_websites,
        "emails_found": job.emails_found,
        "personal_emails_found": getattr(job, "personal_emails_found", 0) or 0,
        "phones_found": job.phones_found,
        "personal_phones_found": getattr(job, "personal_phones_found", 0) or 0,
        "progress_percent": percent,
        "current_website": current_item.website_url if current_item else None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None
    }

def get_job_results(
    db: Session,
    job_id: str,
    page: int = 1,
    page_size: int = 25,
    search: str = "",
    status_filter: str = "all",
    has_personal_email: bool = False,
    has_business_email: bool = False,
    has_primary_email: bool = False,
    has_contact_info: bool = False,
    has_social_links: bool = False,
    only_success: bool = False
) -> dict:
    """Returns paginated and filtered WebsiteResult records for a given job."""
    query = db.query(WebsiteResult).filter(WebsiteResult.job_id == job_id)
    
    # Filter by status
    if status_filter and status_filter != "all":
        if status_filter == "success":
            query = query.filter(WebsiteResult.status == "success")
        elif status_filter == "failed":
            query = query.filter(WebsiteResult.status == "failed")
        elif status_filter == "no_contact_found":
            query = query.filter(WebsiteResult.status == "no_contact_found")
        elif status_filter == "processing":
            query = query.filter(WebsiteResult.status == "processing")

    if only_success:
        query = query.filter(WebsiteResult.status == "success")

    # Filter by Personal Email
    if has_personal_email:
        query = query.filter(
            WebsiteResult._personal_emails.isnot(None),
            WebsiteResult._personal_emails != "[]",
            WebsiteResult._personal_emails != ""
        )

    # Filter by Business Email ID (info@, contact@, sales@, etc.)
    if has_business_email:
        query = query.filter(
            WebsiteResult._business_emails.isnot(None),
            WebsiteResult._business_emails != "[]",
            WebsiteResult._business_emails != ""
        )

    # Filter by Primary Outreach Email
    if has_primary_email:
        query = query.filter(
            or_(
                and_(WebsiteResult._personal_emails.isnot(None), WebsiteResult._personal_emails != "[]", WebsiteResult._personal_emails != ""),
                and_(WebsiteResult._business_emails.isnot(None), WebsiteResult._business_emails != "[]", WebsiteResult._business_emails != ""),
                and_(WebsiteResult._emails.isnot(None), WebsiteResult._emails != "[]", WebsiteResult._emails != "")
            )
        )

    # Filter by Contact Info (Phone numbers or Contact page URL)
    if has_contact_info:
        query = query.filter(
            or_(
                and_(WebsiteResult._phone_numbers.isnot(None), WebsiteResult._phone_numbers != "[]", WebsiteResult._phone_numbers != ""),
                and_(WebsiteResult.contact_page.isnot(None), WebsiteResult.contact_page != "")
            )
        )

    # Filter by Social Media Links
    if has_social_links:
        query = query.filter(
            WebsiteResult._social_links.isnot(None),
            WebsiteResult._social_links != "{}",
            WebsiteResult._social_links != "[]",
            WebsiteResult._social_links != ""
        )

    # Search by website, company, email, phone
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                WebsiteResult.website_url.ilike(search_term),
                WebsiteResult.company_name.ilike(search_term),
                WebsiteResult._emails.ilike(search_term),
                WebsiteResult._personal_emails.ilike(search_term),
                WebsiteResult._business_emails.ilike(search_term),
                WebsiteResult._phone_numbers.ilike(search_term),
                WebsiteResult._personal_phones.ilike(search_term),
                WebsiteResult._business_phones.ilike(search_term),
                WebsiteResult._social_links.ilike(search_term)
            )
        )
        
    total_count = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(desc(WebsiteResult.created_at)).offset(offset).limit(page_size).all()
    
    # Format items
    result_list = []
    for item in items:
        result_list.append({
            "id": item.id,
            "job_id": item.job_id,
            "website_url": item.website_url,
            "company_name": item.company_name,
            "emails": item.emails,
            "personal_emails": item.personal_emails,
            "business_emails": item.business_emails,
            "primary_email": item.primary_email,
            "phone_numbers": item.phone_numbers,
            "personal_phones": item.personal_phones,
            "business_phones": item.business_phones,
            "social_links": item.social_links,
            "contact_page": item.contact_page,
            "about_page": item.about_page,
            "pages_scanned": item.pages_scanned,
            "duration_seconds": item.duration_seconds,
            "status": item.status,
            "error_message": item.error_message,
            "created_at": item.created_at.isoformat() if item.created_at else None
        })

    total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 1
    
    return {
        "items": result_list,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

def list_jobs(db: Session, page: int = 1, page_size: int = 20) -> dict:
    """Lists jobs ordered by created_at desc."""
    query = db.query(Job)
    total_count = query.count()
    offset = (page - 1) * page_size
    jobs = query.order_by(desc(Job.created_at)).offset(offset).limit(page_size).all()
    
    items = []
    for j in jobs:
        items.append({
            "id": j.id,
            "filename": j.filename,
            "total_websites": j.total_websites,
            "processed_websites": j.processed_websites,
            "successful_websites": j.successful_websites,
            "failed_websites": j.failed_websites,
            "emails_found": j.emails_found,
            "personal_emails_found": getattr(j, "personal_emails_found", 0) or 0,
            "phones_found": j.phones_found,
            "personal_phones_found": getattr(j, "personal_phones_found", 0) or 0,
            "status": j.status,
            "error_message": j.error_message,
            "created_at": j.created_at.isoformat() if j.created_at else None,
            "completed_at": j.completed_at.isoformat() if j.completed_at else None
        })
        
    total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 1
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

def delete_job(db: Session, job_id: str) -> bool:
    """Deletes job and cascade delete associated website results."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return False
    db.delete(job)
    db.commit()
    return True
