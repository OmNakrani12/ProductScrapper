from app.scraper.classifier import (
    classify_email, classify_phone, classify_emails_batch, classify_phones_batch,
    is_working_email, select_primary_email
)

def test_email_classification():
    # Personal Emails
    assert classify_email("john.doe@company.com") == "personal"
    assert classify_email("sarah_jones@company.org") == "personal"
    assert classify_email("alex.smith@gmail.com") == "personal"
    assert classify_email("ceo@startup.io") == "personal"
    assert classify_email("founder@mybiz.com") == "personal"

    # Business Emails
    assert classify_email("info@company.com") == "business"
    assert classify_email("support@company.com") == "business"
    assert classify_email("sales@company.com") == "business"
    assert classify_email("contact@domain.org") == "business"
    assert classify_email("admin@service.io") == "business"

def test_phone_classification():
    # Personal Mobile Phones
    assert classify_phone("+1 555-0199", context="Mobile: +1 555-0199") == "personal"
    assert classify_phone("+44 7911 123456") == "personal"
    assert classify_phone("+91 9876543210") == "personal"

    # Business Switchboard / Toll-Free Phones
    assert classify_phone("1-800-555-0199") == "business"
    assert classify_phone("+1 800 123 4567") == "business"
    assert classify_phone("0800 123 456") == "business"
    assert classify_phone("+1 555-0100", context="Fax / Main Switchboard") == "business"

def test_batch_classification():
    emails = [
        "info@co.com", "john.doe@co.com", "support@co.com", "ceo@co.com", "myname@gmail.com"
    ]
    personal, business = classify_emails_batch(emails)
    assert "john.doe@co.com" in personal
    assert "ceo@co.com" in personal
    assert "myname@gmail.com" in personal
    assert "info@co.com" in business
    assert "support@co.com" in business

def test_working_email_validation():
    # Legitimate working emails
    assert is_working_email("john.doe@acme.com") is True
    assert is_working_email("ceo@startup.io") is True
    assert is_working_email("info@company.org") is True

    # Dummy / Disposable / Placeholder emails
    assert is_working_email("noreply@company.com") is False
    assert is_working_email("test@domain.com") is False
    assert is_working_email("user@example.com") is False
    assert is_working_email("john@mailinator.com") is False
    assert is_working_email("dummy@tempmail.com") is False

def test_select_primary_email_ignores_dummy():
    candidates = [
        "noreply@acme.com",       # Dummy / system
        "test@example.com",       # Placeholder
        "user@mailinator.com",    # Disposable
        "sales@acme.com",         # Valid business
        "john.doe@acme.com"       # Valid personal executive
    ]
    primary = select_primary_email(candidates)
    assert primary == "john.doe@acme.com"

    # If only dummy emails exist, primary should be None
    dummy_only = ["noreply@company.com", "user@example.com"]
    assert select_primary_email(dummy_only) is None

