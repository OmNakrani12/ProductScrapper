from app.scraper.email_extractor import extract_emails
from app.scraper.phone_extractor import extract_phone_numbers
from app.scraper.contact_page import discover_internal_pages
from app.scraper.extractor import extract_company_name

def test_email_extractor():
    html = '''
    <div>
        <p>Contact us at <a href="mailto:info@stripe.com">Email Us</a></p>
        <p>Support: support [at] stripe [dot] com</p>
        <p>Ignore: fake@example.com or logo@2x.png</p>
    </div>
    '''
    emails = extract_emails(html)
    assert "info@stripe.com" in emails
    assert "support@stripe.com" in emails
    assert "fake@example.com" not in emails
    assert "logo@2x.png" not in emails

def test_phone_extractor():
    html = '''
    <div>
        <p>Call us at <a href="tel:+12125551234">+1 (212) 555-1234</a></p>
        <p>India office: +91 98765 43210</p>
    </div>
    '''
    phones = extract_phone_numbers(html, "+1 (212) 555-1234 India office: +91 98765 43210")
    assert any("212" in p for p in phones)
    assert any("98765" in p for p in phones)

def test_discover_internal_pages():
    html = '''
    <html>
        <body>
            <a href="/contact-us">Contact Page</a>
            <a href="/about">About Us</a>
            <a href="https://external.com">External Link</a>
        </body>
    </html>
    '''
    res = discover_internal_pages("https://acme.com", html, max_pages=5)
    assert res["contact_page"] == "https://acme.com/contact-us"
    assert res["about_page"] == "https://acme.com/about"
    assert "https://external.com" not in res["pages_to_crawl"]

def test_extract_company_name():
    html = '''
    <html>
        <head>
            <title>Acme Corp | Leading Tech Innovation</title>
        </head>
        <body><h1>Welcome</h1></body>
    </html>
    '''
    company = extract_company_name("https://acme.com", html)
    assert company == "Acme Corp"
