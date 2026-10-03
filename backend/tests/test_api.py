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
