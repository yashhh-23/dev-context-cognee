import pytest
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_root_and_health(client):
    r1 = client.get("/")
    print(f"GET / -> Status: {r1.status_code}, Response: {r1.json()}")
    assert r1.status_code == 200
    assert "healthy" in r1.json().get("message", "")

    r2 = client.get("/health")
    print(f"GET /health -> Status: {r2.status_code}, Response: {r2.json()}")
    assert r2.status_code == 200
    assert r2.json() == {"status": "ok"}

def test_dependencies_health(client):
    r = client.get("/api/dependencies/health")
    print(f"GET /api/dependencies/health -> Status: {r.status_code}")
    assert r.status_code == 200
    data = r.json()
    assert "status" in data
    assert "total_dependencies" in data

def test_sessions_endpoint(client):
    r = client.get("/api/sessions")
    print(f"GET /api/sessions -> Status: {r.status_code}")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)

def test_graph_endpoints(client):
    r1 = client.get("/api/graph")
    print(f"GET /api/graph -> Status: {r1.status_code}")
    assert r1.status_code == 200
    data1 = r1.json()
    assert "nodes" in data1
    assert "edges" in data1

    r2 = client.post("/api/graph/build")
    print(f"POST /api/graph/build -> Status: {r2.status_code}")
    assert r2.status_code == 200

def test_overview_stats_endpoints(client):
    r1 = client.get("/api/overview/stats")
    print(f"GET /api/overview/stats -> Status: {r1.status_code}")
    assert r1.status_code == 200
    data1 = r1.json()
    assert "health_score" in data1

    r2 = client.get("/api/overview/bug-trend")
    print(f"GET /api/overview/bug-trend -> Status: {r2.status_code}")
    assert r2.status_code == 200
    assert "labels" in r2.json()

def test_memory_health_stats(client):
    r = client.get("/api/stats/memory-health")
    print(f"GET /api/stats/memory-health -> Status: {r.status_code}")
    assert r.status_code == 200
    data = r.json()
    assert "health_score" in data
    assert "total_nodes" in data

def test_bugs_endpoints(client):
    r1 = client.get("/api/bugs")
    print(f"GET /api/bugs -> Status: {r1.status_code}")
    assert r1.status_code == 200
    data1 = r1.json()
    assert "bugs" in data1

    r2 = client.get("/api/bugs/opportunities")
    print(f"GET /api/bugs/opportunities -> Status: {r2.status_code}")
    assert r2.status_code == 200
    assert "opportunities" in r2.json()

    r3 = client.get("/api/bugs/1/recall")
    print(f"GET /api/bugs/1/recall -> Status: {r3.status_code}")
    assert r3.status_code == 200
    assert "context" in r3.json()

def test_memify_and_contribute(client):
    r1 = client.get("/api/stats")
    print(f"GET /api/stats -> Status: {r1.status_code}")
    assert r1.status_code == 200
    assert "status" in r1.json()

    r2 = client.get("/api/contribute")
    print(f"GET /api/contribute -> Status: {r2.status_code}")
    assert r2.status_code == 200
    assert isinstance(r2.json(), list)

def test_lifecycle_endpoints(client):
    r1 = client.post("/api/session/start", json={"sessionId": "test-session-id-123", "workspaceName": "test-ws"})
    print(f"POST /api/session/start -> Status: {r1.status_code}")
    assert r1.status_code == 200
    data = r1.json()
    assert data.get("status") == "started"

    r2 = client.post("/api/session/end", json={"sessionId": "test-session-id-123", "triggerDistillation": False})
    print(f"POST /api/session/end -> Status: {r2.status_code}")
    assert r2.status_code == 200
    assert r2.json().get("status") == "ended"

def test_context_and_recall(client):
    r1 = client.get("/api/context/nonexistent-session")
    print(f"GET /api/context/nonexistent -> Status: {r1.status_code}")
    assert r1.status_code in (200, 404)

    r2 = client.post("/api/recall", json={"query": "test query", "limit": 2})
    print(f"POST /api/recall -> Status: {r2.status_code}")
    assert r2.status_code == 200
    assert "bugs" in r2.json() or "sessions" in r2.json()