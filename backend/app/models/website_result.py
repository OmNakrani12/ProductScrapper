import uuid
import json
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class WebsiteResult(Base):
    __tablename__ = "website_results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    website_url = Column(String(1024), nullable=False)
    company_name = Column(String(255), nullable=True)
    
    # JSON encoded lists
    _emails = Column("emails", Text, default="[]")
    _personal_emails = Column("personal_emails", Text, default="[]")
    _business_emails = Column("business_emails", Text, default="[]")
    _deployer_emails = Column("deployer_emails", Text, default="[]")
    _phone_numbers = Column("phone_numbers", Text, default="[]")
    _personal_phones = Column("personal_phones", Text, default="[]")
    _business_phones = Column("business_phones", Text, default="[]")
    _social_links = Column("social_links", Text, default="{}")
    
    contact_page = Column(String(1024), nullable=True)
    about_page = Column(String(1024), nullable=True)
    pages_scanned = Column(Integer, default=0)
    duration_seconds = Column(Integer, default=0)
    
    status = Column(String(50), default="pending")  # success, failed, no_contact_found
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job = relationship("Job", back_populates="results")

    @property
    def emails(self) -> list[str]:
        if not self._emails:
            return []
        try:
            return json.loads(self._emails)
        except Exception:
            return []

    @emails.setter
    def emails(self, val: list[str]):
        self._emails = json.dumps(val or [])

    @property
    def personal_emails(self) -> list[str]:
        if not self._personal_emails:
            return []
        try:
            return json.loads(self._personal_emails)
        except Exception:
            return []

    @personal_emails.setter
    def personal_emails(self, val: list[str]):
        self._personal_emails = json.dumps(val or [])

    @property
    def business_emails(self) -> list[str]:
        if not self._business_emails:
            return []
        try:
            return json.loads(self._business_emails)
        except Exception:
            return []

    @business_emails.setter
    def business_emails(self, val: list[str]):
        self._business_emails = json.dumps(val or [])

    @property
    def deployer_emails(self) -> list[str]:
        if not self._deployer_emails:
            return []
        try:
            return json.loads(self._deployer_emails)
        except Exception:
            return []

    @deployer_emails.setter
    def deployer_emails(self, val: list[str]):
        self._deployer_emails = json.dumps(val or [])

    @property
    def phone_numbers(self) -> list[str]:
        if not self._phone_numbers:
            return []
        try:
            return json.loads(self._phone_numbers)
        except Exception:
            return []

    @phone_numbers.setter
    def phone_numbers(self, val: list[str]):
        self._phone_numbers = json.dumps(val or [])

    @property
    def personal_phones(self) -> list[str]:
        if not self._personal_phones:
            return []
        try:
            return json.loads(self._personal_phones)
        except Exception:
            return []

    @personal_phones.setter
    def personal_phones(self, val: list[str]):
        self._personal_phones = json.dumps(val or [])

    @property
    def business_phones(self) -> list[str]:
        if not self._business_phones:
            return []
        try:
            return json.loads(self._business_phones)
        except Exception:
            return []

    @business_phones.setter
    def business_phones(self, val: list[str]):
        self._business_phones = json.dumps(val or [])

    @property
    def social_links(self) -> dict:
        if not self._social_links:
            return {}
        try:
            return json.loads(self._social_links)
        except Exception:
            return {}

    @social_links.setter
    def social_links(self, val: dict):
        self._social_links = json.dumps(val or {})

    @property
    def primary_email(self) -> str | None:
        from app.scraper.classifier import select_primary_email
        return select_primary_email(self.emails, self.personal_emails, self.business_emails)

