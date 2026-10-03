from app.utils.security import is_ssrf_safe

def test_ssrf_security():
    safe, _ = is_ssrf_safe("https://stripe.com")
    assert safe is True

    safe, reason = is_ssrf_safe("http://127.0.0.1")
    assert safe is False
    assert "restricted" in reason.lower() or "private" in reason.lower()

    safe, reason = is_ssrf_safe("http://169.254.169.254/latest/meta-data")
    assert safe is False

    safe, reason = is_ssrf_safe("http://localhost:3000")
    assert safe is False

    safe, reason = is_ssrf_safe("ftp://stripe.com")
    assert safe is False
    assert "scheme" in reason.lower()
