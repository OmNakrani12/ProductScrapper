from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.job_service import get_job_results

router = APIRouter(prefix="/jobs", tags=["results"])

@router.get("/{job_id}/results")
def get_results_for_job(
    job_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=5000),
    search: str = Query("", description="Search by website, company, email, phone"),
    status: str = Query("all", description="Status filter: all, success, failed, no_contact_found, processing"),
    has_personal_email: bool = Query(False, description="Filter results with personal email found"),
    has_business_email: bool = Query(False, description="Filter results with business email ID found"),
    has_primary_email: bool = Query(False, description="Filter results with primary outreach email found"),
    has_contact_info: bool = Query(False, description="Filter results with contact phone/page found"),
    has_social_links: bool = Query(False, description="Filter results with social media links found"),
    only_success: bool = Query(False, description="Filter results with status success"),
    db: Session = Depends(get_db)
):
    """Return paginated and filtered website results for a specific job."""
    res = get_job_results(
        db,
        job_id=job_id,
        page=page,
        page_size=page_size,
        search=search,
        status_filter=status,
        has_personal_email=has_personal_email,
        has_business_email=has_business_email,
        has_primary_email=has_primary_email,
        has_contact_info=has_contact_info,
        has_social_links=has_social_links,
        only_success=only_success
    )
    return res
