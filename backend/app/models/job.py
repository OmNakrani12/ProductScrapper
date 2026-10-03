import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.orm import relationship
from app.database import Base

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    total_websites = Column(Integer, default=0)
    processed_websites = Column(Integer, default=0)
    successful_websites = Column(Integer, default=0)
    failed_websites = Column(Integer, default=0)
    emails_found = Column(Integer, default=0)
    personal_emails_found = Column(Integer, default=0)
    phones_found = Column(Integer, default=0)
    personal_phones_found = Column(Integer, default=0)
    status = Column(String(50), default="pending")  # pending, processing, completed, failed
    error_message = Column(String(500), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    results = relationship("WebsiteResult", back_populates="job", cascade="all, delete-orphan")
