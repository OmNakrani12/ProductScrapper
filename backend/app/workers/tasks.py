import asyncio
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.config import settings
from app.models.job import Job
from app.models.website_result import WebsiteResult
from app.scraper.crawler import crawl_website

logger = logging.getLogger(__name__)

async def process_single_website(job_id: str, result_id: str, semaphore: asyncio.Semaphore):
    """Process a single website with concurrency control and DB updates."""
    async with semaphore:
        db: Session = SessionLocal()
        try:
            res_item = db.query(WebsiteResult).filter(WebsiteResult.id == result_id).first()
            if not res_item:
                return

            res_item.status = "processing"
            db.commit()

            # Execute crawling
            crawl_data = await crawl_website(res_item.website_url)

            # Re-fetch item to update
            res_item = db.query(WebsiteResult).filter(WebsiteResult.id == result_id).first()
            job = db.query(Job).filter(Job.id == job_id).first()
            if not res_item or not job:
                return

            res_item.company_name = crawl_data["company_name"]
            res_item.emails = crawl_data.get("emails", [])
            res_item.personal_emails = crawl_data.get("personal_emails", [])
            res_item.business_emails = crawl_data.get("business_emails", [])
            res_item.phone_numbers = crawl_data.get("phone_numbers", [])
            res_item.personal_phones = crawl_data.get("personal_phones", [])
            res_item.business_phones = crawl_data.get("business_phones", [])
            res_item.social_links = crawl_data.get("social_links", {})
            res_item.contact_page = crawl_data["contact_page"]
            res_item.about_page = crawl_data["about_page"]
            res_item.pages_scanned = crawl_data["pages_scanned"]
            res_item.duration_seconds = crawl_data["duration_seconds"]
            res_item.status = crawl_data["status"]
            res_item.error_message = crawl_data["error_message"]

            # Update job statistics
            job.processed_websites += 1
            if crawl_data["status"] in ("success", "no_contact_found"):
                job.successful_websites += 1
            else:
                job.failed_websites += 1

            job.emails_found += len(crawl_data.get("emails", []))
            job.personal_emails_found += len(crawl_data.get("personal_emails", []))
            job.phones_found += len(crawl_data.get("phone_numbers", []))
            job.personal_phones_found += len(crawl_data.get("personal_phones", []))

            db.commit()

        except Exception as e:
            logger.error(f"Error processing website result {result_id}: {e}")
            try:
                res_item = db.query(WebsiteResult).filter(WebsiteResult.id == result_id).first()
                job = db.query(Job).filter(Job.id == job_id).first()
                if res_item and job:
                    res_item.status = "failed"
                    res_item.error_message = str(e)
                    job.processed_websites += 1
                    job.failed_websites += 1
                    db.commit()
            except Exception:
                pass
        finally:
            db.close()

async def process_job_async(job_id: str):
    """Background task handler for processing a full job."""
    db: Session = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return

        job.status = "processing"
        job.started_at = datetime.utcnow()
        db.commit()

        # Fetch all website results to process
        results = db.query(WebsiteResult).filter(WebsiteResult.job_id == job_id).all()
        result_ids = [r.id for r in results]
        db.close()

        semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_SITES)
        tasks = [process_single_website(job_id, r_id, semaphore) for r_id in result_ids]
        
        await asyncio.gather(*tasks)

        # Mark job completed
        db = SessionLocal()
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "completed"
            job.completed_at = datetime.utcnow()
            db.commit()

    except Exception as e:
        logger.error(f"Job processing failed for job {job_id}: {e}")
        try:
            db = SessionLocal()
            job = db.query(Job).filter(Job.id == job_id).first()
            if job:
                job.status = "failed"
                job.error_message = str(e)
                job.completed_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass
    finally:
        db.close()

def run_job_background(job_id: str):
    """Synchronous bridge to run async job task in new event loop if needed."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(process_job_async(job_id))
        else:
            loop.run_until_complete(process_job_async(job_id))
    except RuntimeError:
        asyncio.run(process_job_async(job_id))

# Celery Task integration (if Redis/Celery enabled)
try:
    from celery import Celery
    celery_app = Celery("webcontact_tasks", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

    @celery_app.task(name="tasks.process_job_celery")
    def process_job_celery(job_id: str):
        asyncio.run(process_job_async(job_id))
except Exception:
    celery_app = None
