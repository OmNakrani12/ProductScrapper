from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.export_service import (
    get_job_results_raw,
    generate_csv_export,
    generate_xlsx_export,
    generate_json_export
)
from app.models.job import Job

router = APIRouter(prefix="/jobs", tags=["export"])

@router.get("/{job_id}/export/csv")
def export_job_csv(job_id: str, db: Session = Depends(get_db)):
    """Export job results as a CSV file download."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    results = get_job_results_raw(db, job_id)
    csv_data = generate_csv_export(results)
    
    filename = f"contacts_{job_id[:8]}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/{job_id}/export/xlsx")
def export_job_xlsx(job_id: str, db: Session = Depends(get_db)):
    """Export job results as an Excel (XLSX) file download."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    results = get_job_results_raw(db, job_id)
    xlsx_bytes = generate_xlsx_export(results)
    
    filename = f"contacts_{job_id[:8]}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/{job_id}/export/json")
def export_job_json(job_id: str, db: Session = Depends(get_db)):
    """Export job results as a JSON file download."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    results = get_job_results_raw(db, job_id)
    json_data = generate_json_export(results)
    
    filename = f"contacts_{job_id[:8]}.json"
    return Response(
        content=json_data,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
