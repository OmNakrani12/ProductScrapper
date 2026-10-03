import pytest
from app.scraper.social_extractor import extract_social_links, clean_social_url, detect_platform, merge_social_links

def test_clean_social_url():
    assert clean_social_url("https://github.com/torvalds?utm_source=test") == "https://github.com/torvalds"
    assert clean_social_url("https://www.linkedin.com/in/john-doe/") == "https://www.linkedin.com/in/john-doe"
    assert clean_social_url("https://facebook.com/sharer/sharer.php?u=example.com") is None
    assert clean_social_url("https://x.com/intent/tweet") is None

def test_detect_platform():
    assert detect_platform("https://github.com/username") == "github"
    assert detect_platform("https://linkedin.com/company/acme") == "linkedin"
    assert detect_platform("https://facebook.com/acme") == "facebook"
    assert detect_platform("https://x.com/acme") == "twitter"
    assert detect_platform("https://youtube.com/@acme") == "youtube"
    assert detect_platform("https://instagram.com/acme") == "instagram"

def test_extract_social_links():
    html = """
    <html>
      <head>
        <meta property="og:see_also" content="https://github.com/acmecorp" />
        <meta name="twitter:site" content="@acmetweets" />
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Acme Inc",
          "sameAs": [
            "https://www.linkedin.com/company/acme-inc",
            "https://facebook.com/acmeinc"
          ]
        }
        </script>
      </head>
      <body>
        <a href="https://github.com/acmecorp/repo">GitHub Repo</a>
        <a href="https://instagram.com/acme_official">Instagram</a>
        <a href="https://discord.gg/acmecommunity">Discord</a>
      </body>
    </html>
    """
    res = extract_social_links(html, "https://acme.com")
    assert "github" in res
    assert "https://github.com/acmecorp" in res["github"]
    assert "linkedin" in res
    assert "https://www.linkedin.com/company/acme-inc" in res["linkedin"]
    assert "facebook" in res
    assert "https://facebook.com/acmeinc" in res["facebook"]
    assert "twitter" in res
    assert "https://x.com/acmetweets" in res["twitter"]
    assert "instagram" in res
    assert "https://instagram.com/acme_official" in res["instagram"]
    assert "discord" in res
    assert "https://discord.gg/acmecommunity" in res["discord"]

def test_merge_social_links():
    a = {"github": ["https://github.com/user1"]}
    b = {"github": ["https://github.com/user2"], "linkedin": ["https://linkedin.com/in/user1"]}
    merged = merge_social_links(a, b)
    assert len(merged["github"]) == 2
    assert "linkedin" in merged
