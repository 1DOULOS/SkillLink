"""
Integration / route tests for the SkillLink Matching Service.

The database and JWT secret are mocked so no real PostgreSQL instance is
required.  Tests run with httpx.AsyncClient against the FastAPI app.

Run with:
    pytest tests/test_routes.py -v --asyncio-mode=auto
"""

import json
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt

from app.config import settings
from app.main import app

# ---------------------------------------------------------------------------
# Helpers – JWT token generation
# ---------------------------------------------------------------------------

ALGORITHM = "HS256"


def _make_token(user_id: str, email: str, role: str) -> str:
    """Create a signed JWT token using the app's secret."""
    payload = {"id": user_id, "email": email, "role": role}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


STUDENT_TOKEN = _make_token("user-student-1", "student@test.com", "student")
RECRUITER_TOKEN = _make_token("user-recruiter-1", "recruiter@test.com", "recruiter")
ADMIN_TOKEN = _make_token("user-admin-1", "admin@test.com", "admin")

# ---------------------------------------------------------------------------
# Shared mock DB data
# ---------------------------------------------------------------------------

MOCK_STUDENT_ROW = {
    "student_id": "student-profile-1",
    "email": "student@test.com",
    "first_name": "Alice",
    "last_name": "Smith",
    "bio": "Experienced Python backend developer",
    "skills": json.dumps(["Python", "Django", "PostgreSQL", "REST APIs"]),
    "education": json.dumps([{"degree": "BSc", "field": "CS", "school": "ICT University"}]),
    "experience": json.dumps([{"role": "Backend Dev", "description": "Built APIs"}]),
    "location": "Nairobi, Kenya",
}

MOCK_JOB_ROW = {
    "job_id": "job-1",
    "title": "Python Backend Developer",
    "description": "Backend role using Python and Django",
    "requirements": "Python, Django, PostgreSQL required",
    "responsibilities": "Build REST APIs",
    "skills_required": json.dumps(["Python", "Django", "PostgreSQL"]),
    "job_type": "full-time",
    "location": "Nairobi",
    "salary_min": 50000,
    "salary_max": 80000,
    "is_active": True,
    "recruiter_id": "user-recruiter-1",
    "company_name": "TechCorp Ltd",
    "company_description": "A great tech company",
}

MOCK_JOB_ROW_2 = {
    "job_id": "job-2",
    "title": "React Frontend Developer",
    "description": "Frontend React developer wanted",
    "requirements": "React and JavaScript required",
    "responsibilities": "Build UIs",
    "skills_required": json.dumps(["React", "JavaScript", "CSS"]),
    "job_type": "internship",
    "location": "Remote",
    "salary_min": 30000,
    "salary_max": 50000,
    "is_active": True,
    "recruiter_id": "user-recruiter-2",
    "company_name": "WebStartup",
    "company_description": "A frontend company",
}

MOCK_STUDENT_ROW_2 = {
    "student_id": "student-profile-2",
    "email": "student2@test.com",
    "first_name": "Bob",
    "last_name": "Jones",
    "bio": "Frontend developer with React expertise",
    "skills": json.dumps(["React", "JavaScript", "CSS", "TypeScript"]),
    "education": json.dumps([]),
    "experience": json.dumps([]),
    "location": "Kampala, Uganda",
}

# ---------------------------------------------------------------------------
# Pytest configuration
# ---------------------------------------------------------------------------

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def client():
    """Async HTTP client pointed at the test app."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as ac:
        yield ac


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------


async def test_health_endpoint(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "matching-service"
    assert "uptime" in data
    assert "version" in data


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------


async def test_root_endpoint(client: AsyncClient):
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data
    assert data["version"] == "1.0.0"


# ---------------------------------------------------------------------------
# GET /api/match/jobs – student matches
# ---------------------------------------------------------------------------


@patch("app.routes.execute_one")
@patch("app.routes.execute_query")
async def test_get_jobs_for_student_success(
    mock_execute_query: MagicMock,
    mock_execute_one: MagicMock,
    client: AsyncClient,
):
    """Authenticated student should get ranked job list."""
    mock_execute_one.return_value = MOCK_STUDENT_ROW
    mock_execute_query.return_value = [MOCK_JOB_ROW, MOCK_JOB_ROW_2]

    response = await client.get(
        "/api/match/jobs",
        headers={"Authorization": f"Bearer {STUDENT_TOKEN}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) <= 10
    # Each item should have match fields
    for item in data:
        assert "score" in item
        assert "skill_match" in item
        assert "matched_skills" in item
        assert "missing_skills" in item
        assert 0 <= item["score"] <= 100


@patch("app.routes.execute_one")
@patch("app.routes.execute_query")
async def test_get_jobs_for_student_respects_top_n(
    mock_execute_query: MagicMock,
    mock_execute_one: MagicMock,
    client: AsyncClient,
):
    """top_n query param should limit results."""
    mock_execute_one.return_value = MOCK_STUDENT_ROW
    mock_execute_query.return_value = [MOCK_JOB_ROW, MOCK_JOB_ROW_2]

    response = await client.get(
        "/api/match/jobs?top_n=1",
        headers={"Authorization": f"Bearer {STUDENT_TOKEN}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) <= 1


@patch("app.routes.execute_one")
async def test_get_jobs_for_student_no_profile(
    mock_execute_one: MagicMock,
    client: AsyncClient,
):
    """Return 404 when student profile is missing."""
    mock_execute_one.return_value = None

    response = await client.get(
        "/api/match/jobs",
        headers={"Authorization": f"Bearer {STUDENT_TOKEN}"},
    )

    assert response.status_code == 404


async def test_get_jobs_for_student_unauthenticated(client: AsyncClient):
    """Return 401 when no token is provided."""
    response = await client.get("/api/match/jobs")
    assert response.status_code == 401


async def test_get_jobs_for_student_wrong_role(client: AsyncClient):
    """Recruiter token should be rejected (role check)."""
    response = await client.get(
        "/api/match/jobs",
        headers={"Authorization": f"Bearer {RECRUITER_TOKEN}"},
    )
    assert response.status_code == 403


@patch("app.routes.execute_one")
@patch("app.routes.execute_query")
async def test_get_jobs_for_student_empty_jobs(
    mock_execute_query: MagicMock,
    mock_execute_one: MagicMock,
    client: AsyncClient,
):
    """Return empty list when no active jobs exist."""
    mock_execute_one.return_value = MOCK_STUDENT_ROW
    mock_execute_query.return_value = []

    response = await client.get(
        "/api/match/jobs",
        headers={"Authorization": f"Bearer {STUDENT_TOKEN}"},
    )

    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------------------------
# GET /api/match/candidates/{job_id} – recruiter matches
# ---------------------------------------------------------------------------


@patch("app.routes.execute_one")
@patch("app.routes.execute_query")
async def test_get_candidates_for_job_success(
    mock_execute_query: MagicMock,
    mock_execute_one: MagicMock,
    client: AsyncClient,
):
    """Recruiter should get ranked candidate list for their job."""
    mock_execute_one.return_value = MOCK_JOB_ROW
    mock_execute_query.return_value = [MOCK_STUDENT_ROW, MOCK_STUDENT_ROW_2]

    response = await client.get(
        f"/api/match/candidates/{MOCK_JOB_ROW['job_id']}",
        headers={"Authorization": f"Bearer {RECRUITER_TOKEN}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for item in data:
        assert "score" in item
        assert "skill_match" in item
        assert 0 <= item["score"] <= 100


@patch("app.routes.execute_one")
async def test_get_candidates_for_job_not_found(
    mock_execute_one: MagicMock,
    client: AsyncClient,
):
    """Return 404 when job does not exist."""
    mock_execute_one.return_value = None

    response = await client.get(
        "/api/match/candidates/non-existent-job",
        headers={"Authorization": f"Bearer {RECRUITER_TOKEN}"},
    )

    assert response.status_code == 404


@patch("app.routes.execute_one")
async def test_get_candidates_for_job_wrong_owner(
    mock_execute_one: MagicMock,
    client: AsyncClient,
):
    """Recruiter who doesn't own the job should get 403."""
    # Job belongs to a different recruiter
    other_job = {**MOCK_JOB_ROW, "recruiter_id": "some-other-recruiter"}
    mock_execute_one.return_value = other_job

    response = await client.get(
        "/api/match/candidates/job-1",
        headers={"Authorization": f"Bearer {RECRUITER_TOKEN}"},
    )

    assert response.status_code == 403


async def test_get_candidates_student_not_allowed(client: AsyncClient):
    """Student token should not be able to access candidate endpoint."""
    response = await client.get(
        "/api/match/candidates/job-1",
        headers={"Authorization": f"Bearer {STUDENT_TOKEN}"},
    )
    assert response.status_code == 403


@patch("app.routes.execute_one")
@patch("app.routes.execute_query")
async def test_get_candidates_admin_can_access_any_job(
    mock_execute_query: MagicMock,
    mock_execute_one: MagicMock,
    client: AsyncClient,
):
    """Admin should be able to see candidates for any job."""
    # Job belongs to a recruiter, not the admin user
    other_job = {**MOCK_JOB_ROW, "recruiter_id": "user-recruiter-1"}
    mock_execute_one.return_value = other_job
    mock_execute_query.return_value = [MOCK_STUDENT_ROW]

    response = await client.get(
        "/api/match/candidates/job-1",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )

    assert response.status_code == 200


# ---------------------------------------------------------------------------
# POST /api/match/score
# ---------------------------------------------------------------------------


@patch("app.routes.execute_one")
async def test_compute_score_success(
    mock_execute_one: MagicMock,
    client: AsyncClient,
):
    """Authenticated user should get a detailed score."""
    # execute_one called twice: once for student, once for job
    mock_execute_one.side_effect = [MOCK_STUDENT_ROW, MOCK_JOB_ROW]

    response = await client.post(
        "/api/match/score",
        json={"student_id": "student-profile-1", "job_id": "job-1"},
        headers={"Authorization": f"Bearer {STUDENT_TOKEN}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert "match" in data
    assert "score" in data["match"]
    assert "student_id" in data
    assert "job_id" in data
    assert 0 <= data["match"]["score"] <= 100


@patch("app.routes.execute_one")
async def test_compute_score_student_not_found(
    mock_execute_one: MagicMock,
    client: AsyncClient,
):
    mock_execute_one.return_value = None

    response = await client.post(
        "/api/match/score",
        json={"student_id": "bad-id", "job_id": "job-1"},
        headers={"Authorization": f"Bearer {STUDENT_TOKEN}"},
    )

    assert response.status_code == 404


@patch("app.routes.execute_one")
async def test_compute_score_job_not_found(
    mock_execute_one: MagicMock,
    client: AsyncClient,
):
    # Student found, job not found
    mock_execute_one.side_effect = [MOCK_STUDENT_ROW, None]

    response = await client.post(
        "/api/match/score",
        json={"student_id": "student-profile-1", "job_id": "non-existent"},
        headers={"Authorization": f"Bearer {STUDENT_TOKEN}"},
    )

    assert response.status_code == 404


async def test_compute_score_unauthenticated(client: AsyncClient):
    response = await client.post(
        "/api/match/score",
        json={"student_id": "s1", "job_id": "j1"},
    )
    assert response.status_code == 401


async def test_compute_score_missing_body(client: AsyncClient):
    response = await client.post(
        "/api/match/score",
        json={},
        headers={"Authorization": f"Bearer {STUDENT_TOKEN}"},
    )
    assert response.status_code == 422  # Pydantic validation error


# ---------------------------------------------------------------------------
# GET /api/match/recommendations/{student_id}
# ---------------------------------------------------------------------------


@patch("app.routes.execute_one")
@patch("app.routes.execute_query")
async def test_get_recommendations_admin_success(
    mock_execute_query: MagicMock,
    mock_execute_one: MagicMock,
    client: AsyncClient,
):
    """Admin should be able to get recommendations for any student."""
    mock_execute_one.return_value = MOCK_STUDENT_ROW
    mock_execute_query.return_value = [MOCK_JOB_ROW, MOCK_JOB_ROW_2]

    response = await client.get(
        "/api/match/recommendations/student-profile-1",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@patch("app.routes.execute_one")
async def test_get_recommendations_student_not_found(
    mock_execute_one: MagicMock,
    client: AsyncClient,
):
    """Return 403/404 when student profile ID doesn't exist."""
    # First call (ownership check) returns None, second call (profile fetch) also None
    mock_execute_one.side_effect = [None, None]

    response = await client.get(
        "/api/match/recommendations/non-existent-profile",
        headers={"Authorization": f"Bearer {STUDENT_TOKEN}"},
    )

    # Student cannot access another student's profile
    assert response.status_code in (403, 404)


async def test_get_recommendations_unauthenticated(client: AsyncClient):
    response = await client.get("/api/match/recommendations/student-profile-1")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# JWT edge cases
# ---------------------------------------------------------------------------


async def test_invalid_token_rejected(client: AsyncClient):
    response = await client.get(
        "/api/match/jobs",
        headers={"Authorization": "Bearer this.is.not.valid"},
    )
    assert response.status_code == 401


async def test_wrong_secret_token_rejected(client: AsyncClient):
    bad_token = jwt.encode(
        {"id": "x", "email": "x@x.com", "role": "student"},
        "wrong-secret",
        algorithm=ALGORITHM,
    )
    response = await client.get(
        "/api/match/jobs",
        headers={"Authorization": f"Bearer {bad_token}"},
    )
    assert response.status_code == 401
