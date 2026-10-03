import pytest
from app.utils.url_utils import normalize_url, is_valid_url, parse_url_file

def test_normalize_url():
    assert normalize_url("stripe.com") == "https://stripe.com"
    assert normalize_url("http://example.com/") == "http://example.com"
    assert normalize_url(" HTTPS://Sub.Domain.com/path ") == "https://sub.domain.com/path"
    assert normalize_url("") == ""

def test_is_valid_url():
    valid, _ = is_valid_url("https://google.com")
    assert valid is True
    
    valid, _ = is_valid_url("https://github.com/openai")
    assert valid is True

    valid, reason = is_valid_url("http://127.0.0.1")
    assert valid is False
    assert "restricted" in reason.lower() or "private" in reason.lower()

    valid, reason = is_valid_url("http://localhost:8000")
    assert valid is False
    assert "restricted" in reason.lower() or "private" in reason.lower()

def test_parse_txt_file():
    txt_content = b"https://stripe.com\nstripe.com\nhttp://127.0.0.1\nnot_a_url\nhttps://openai.com\n"
    res = parse_url_file(txt_content, "urls.txt")
    assert res["total"] == 5
    assert "https://stripe.com" in res["valid_urls"]
    assert "https://openai.com" in res["valid_urls"]
    assert res["duplicates_removed"] == 1
    assert len(res["invalid_urls"]) == 2

def test_parse_csv_file():
    csv_content = b"website\nhttps://example.com\nhttps://google.com\n"
    res = parse_url_file(csv_content, "test.csv")
    assert len(res["valid_urls"]) == 2
    assert "https://example.com" in res["valid_urls"]
    assert "https://google.com" in res["valid_urls"]
