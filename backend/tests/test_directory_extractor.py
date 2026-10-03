import pytest
from app.scraper.directory_extractor import extract_redirect_target, extract_directory_products

def test_extract_redirect_target():
    assert extract_redirect_target("https://scrolllaunch.com/out?url=https://myproduct.com") == "https://myproduct.com"
    assert extract_redirect_target("https://directory.com/r?target=https%3A%2F%2Fsaasapp.io") == "https://saasapp.io"
    assert extract_redirect_target("https://directory.com/about") is None

@pytest.mark.asyncio
async def test_extract_directory_products():
    html_mock = """
    <html>
      <body>
        <h1>ScrollLaunch Showcase</h1>
        <div class="product-card">
          <a href="https://superproduct.io">Super Product AI</a>
          <a href="https://scrolllaunch.com/out?url=https://anotherproduct.com">Another Product</a>
          <a href="https://scrolllaunch.com/about">About Us</a>
          <a href="https://facebook.com/scrolllaunch">Facebook</a>
        </div>
      </body>
    </html>
    """
    from unittest.mock import patch, AsyncMock
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = AsyncMock()
        mock_resp.status_code = 200
        mock_resp.text = html_mock
        mock_resp.raise_for_status = lambda: None
        mock_get.return_value = mock_resp

        res = await extract_directory_products("https://scrolllaunch.com")
        assert res["total_products_found"] >= 2
        urls = [p["url"] for p in res["products"]]
        assert "https://superproduct.io" in urls
        assert "https://anotherproduct.com" in urls
        assert not any("scrolllaunch.com" in u for u in urls)
        assert not any("facebook.com" in u for u in urls)
