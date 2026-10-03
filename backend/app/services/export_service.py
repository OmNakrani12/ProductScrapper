import io
import json
import pandas as pd
from sqlalchemy.orm import Session
from app.models.website_result import WebsiteResult

def get_job_results_raw(db: Session, job_id: str) -> list[WebsiteResult]:
    """Fetch all results for export."""
    return db.query(WebsiteResult).filter(WebsiteResult.job_id == job_id).all()

def generate_csv_export(results: list[WebsiteResult]) -> str:
    """Returns CSV string containing all website result details with personal vs business contact breakdown."""
    rows = []
    for r in results:
        social = r.social_links or {}
        rows.append({
            "website_url": r.website_url,
            "company_name": r.company_name or "",
            "primary_email": r.primary_email or "",
            "personal_emails": ", ".join(r.personal_emails),
            "business_emails": ", ".join(r.business_emails),
            "all_emails": ", ".join(r.emails),
            "personal_phones": ", ".join(r.personal_phones),
            "business_phones": ", ".join(r.business_phones),
            "all_phones": ", ".join(r.phone_numbers),
            "github_links": ", ".join(social.get("github", [])),
            "linkedin_links": ", ".join(social.get("linkedin", [])),
            "facebook_links": ", ".join(social.get("facebook", [])),
            "twitter_links": ", ".join(social.get("twitter", [])),
            "all_social_links": ", ".join([url for urls in social.values() for url in urls]),
            "contact_page": r.contact_page or "",
            "about_page": r.about_page or "",
            "pages_scanned": r.pages_scanned,
            "duration_seconds": r.duration_seconds,
            "status": r.status,
            "error_message": r.error_message or ""
        })
    df = pd.DataFrame(rows)
    return df.to_csv(index=False)

def generate_xlsx_export(results: list[WebsiteResult]) -> bytes:
    """Returns XLSX file bytes containing properly formatted columns."""
    rows = []
    for r in results:
        social = r.social_links or {}
        rows.append({
            "Website URL": r.website_url,
            "Company Name": r.company_name or "",
            "Primary Email (Best Outreach)": r.primary_email or "",
            "Personal Emails": ", ".join(r.personal_emails),
            "Business Emails": ", ".join(r.business_emails),
            "All Emails": ", ".join(r.emails),
            "Personal Phones": ", ".join(r.personal_phones),
            "Business Phones": ", ".join(r.business_phones),
            "All Phones": ", ".join(r.phone_numbers),
            "GitHub": ", ".join(social.get("github", [])),
            "LinkedIn": ", ".join(social.get("linkedin", [])),
            "Facebook": ", ".join(social.get("facebook", [])),
            "Twitter / X": ", ".join(social.get("twitter", [])),
            "All Social Links": ", ".join([url for urls in social.values() for url in urls]),
            "Contact Page": r.contact_page or "",
            "About Page": r.about_page or "",
            "Pages Scanned": r.pages_scanned,
            "Duration (sec)": r.duration_seconds,
            "Status": r.status,
            "Error Details": r.error_message or ""
        })
    df = pd.DataFrame(rows)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Contact Results")
        # Format column widths
        worksheet = writer.sheets["Contact Results"]
        for col in worksheet.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = col[0].column_letter
            worksheet.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 50)
            
    return output.getvalue()

def generate_json_export(results: list[WebsiteResult]) -> str:
    """Returns JSON string containing structured website result objects."""
    items = []
    for r in results:
        items.append({
            "id": r.id,
            "website_url": r.website_url,
            "company_name": r.company_name,
            "primary_email": r.primary_email,
            "personal_emails": r.personal_emails,
            "business_emails": r.business_emails,
            "emails": r.emails,
            "personal_phones": r.personal_phones,
            "business_phones": r.business_phones,
            "phone_numbers": r.phone_numbers,
            "social_links": r.social_links,
            "contact_page": r.contact_page,
            "about_page": r.about_page,
            "pages_scanned": r.pages_scanned,
            "duration_seconds": r.duration_seconds,
            "status": r.status,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
    return json.dumps(items, indent=2)
