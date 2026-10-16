from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root_endpoint():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "online"

def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

@patch("app.api.jobs.process_job_async", new_callable=AsyncMock)
def test_direct_job_creation(mock_process_job):
    payload = {
        "filename": "test_urls.txt",
        "urls": ["https://example.com", "https://stripe.com"]
    }
    res = client.post("/api/jobs/direct", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["valid_urls_count"] == 2
    assert "job_id" in data

    job_id = data["job_id"]

    # Test progress endpoint
    prog_res = client.get(f"/api/jobs/{job_id}/progress")
    assert prog_res.status_code == 200
    assert prog_res.json()["job_id"] == job_id

    # Test results endpoint
    results_res = client.get(f"/api/jobs/{job_id}/results")
    assert results_res.status_code == 200
    assert results_res.json()["total"] == 2

    # Clean up job
    del_res = client.delete(f"/api/jobs/{job_id}")
    assert del_res.status_code == 200

def test_ai_keys_status_endpoint():
    res = client.get("/api/ai/keys/status")
    assert res.status_code == 200
    data = res.json()
    assert "total_keys" in data
    assert "active_keys" in data
    assert "keys" in data

@patch("app.api.ai.generate_ai_email", new_callable=AsyncMock)
def test_ai_generate_email_endpoint(mock_gen):
    mock_gen.return_value = {
        "subject": "Invite: Join our Platform",
        "body": "Hello, we would love to invite you to host with us.",
        "key_used": "AIzaSy...7X9q",
        "model_used": "gemini-1.5-flash",
        "attempts": 1,
        "website_url": "https://example.com",
        "recipient_email": "admin@example.com"
    }

    payload = {
        "user_instruction": "visit all websites and invite that website host to host platform",
        "website_url": "https://example.com",
        "company_name": "Example Corp",
        "recipient_email": "admin@example.com"
    }
    res = client.post("/api/ai/generate-email", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["subject"] == "Invite: Join our Platform"
    assert "invite you to host with us" in data["body"]

