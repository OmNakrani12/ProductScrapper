from app.scraper.classifier import classify_email, classify_phone, classify_emails_batch, classify_phones_batch

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
