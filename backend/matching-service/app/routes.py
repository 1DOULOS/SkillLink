"""
API route handlers for the SkillLink Matching Service.

Endpoints
---------
GET  /api/match/jobs                        – top jobs for the authenticated student
GET  /api/match/candidates/{job_id}         – top candidates for a recruiter's job
POST /api/match/score                       – compute a single student↔job score
GET  /api/match/recommendations/{student_id} – admin / self-service recommendation lookup
"""

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth import get_current_user, require_role
from app.database import execute_one, execute_query
from app.matcher import JobMatcher
from app.models import (
    CandidateMatchResponse,
    JobMatchResponse,
    MatchScoreRequest,
    MatchScoreResponse,
    MatchDetails,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/match", tags=["matching"])

# Module-level matcher instance (stateless per call – safe to share)
matcher = JobMatcher()


# ---------------------------------------------------------------------------
# DB helper – parse JSON columns that psycopg2 returns as strings
# ---------------------------------------------------------------------------


def _parse_json_field(value: Any) -> Any:
    """If *value* is a JSON string, decode it; otherwise return as-is."""
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (json.JSONDecodeError, ValueError):
            return value
    return value or []


def _normalise_list(value: Any) -> List[str]:
    """Ensure the value is a list of strings (handles JSON strings and None)."""
    parsed = _parse_json_field(value)
    if isinstance(parsed, list):
        return [str(item) for item in parsed if item]
    return []


# ---------------------------------------------------------------------------
# DB query helpers
# ---------------------------------------------------------------------------

_STUDENT_PROFILE_SQL = """
    SELECT
        sp.id                 AS student_id,
        u.email,
        u.first_name,
        u.last_name,
        sp.bio,
        sp.skills,
        sp.education,
        sp.experience,
        sp.location,
        sp.github_url,
        sp.linkedin_url
    FROM student_profiles sp
    JOIN users u ON u.id = sp.user_id
    WHERE sp.user_id = %s
"""

_ACTIVE_JOBS_SQL = """
    SELECT
        j.id                  AS job_id,
        j.title,
        j.description,
        j.requirements,
        j.skills_required,
        j.job_type,
        j.location,
        j.salary_min,
        j.salary_max,
        j.status,
        rp.company_name,
        rp.company_description
    FROM jobs j
    JOIN recruiter_profiles rp ON rp.user_id = j.recruiter_id
    WHERE j.status = 'active'
"""

_JOB_BY_ID_SQL = """
    SELECT
        j.id                  AS job_id,
        j.title,
        j.description,
        j.requirements,
        j.skills_required,
        j.job_type,
        j.location,
        j.salary_min,
        j.salary_max,
        j.status,
        j.recruiter_id,
        rp.company_name
    FROM jobs j
    JOIN recruiter_profiles rp ON rp.user_id = j.recruiter_id
    WHERE j.id = %s
"""

_ALL_STUDENTS_SQL = """
    SELECT
        sp.id                 AS student_id,
        u.email,
        u.first_name,
        u.last_name,
        sp.bio,
        sp.skills,
        sp.education,
        sp.experience,
        sp.location
    FROM student_profiles sp
    JOIN users u ON u.id = sp.user_id
"""


def _hydrate_student(row: dict) -> dict:
    """Normalise DB row into the dict shape the matcher expects."""
    return {
        **row,
        "skills": _normalise_list(row.get("skills")),
        "education": _parse_json_field(row.get("education")) or [],
        "experience": _parse_json_field(row.get("experience")) or [],
    }


def _hydrate_job(row: dict) -> dict:
    """Normalise DB row into the dict shape the matcher expects."""
    return {
        **row,
        "skills_required": _normalise_list(row.get("skills_required")),
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get(
    "/jobs",
    summary="Get top matched jobs for the authenticated student",
)
async def get_jobs_for_student(
    top_n: int = Query(default=10, ge=1, le=50, description="Maximum number of results"),
    current_user: Dict[str, Any] = Depends(require_role("student")),
) -> List[dict]:
    """
    Fetch the authenticated student's profile and return the top *top_n*
    active job postings ranked by match score.
    """
    user_id = current_user["id"]

    # 1. Load student profile
    student_row = execute_one(_STUDENT_PROFILE_SQL, (user_id,))
    if not student_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found. Please complete your profile first.",
        )
    student = _hydrate_student(student_row)

    # 2. Load all active jobs
    job_rows = execute_query(_ACTIVE_JOBS_SQL)
    if not job_rows:
        return []
    jobs = [_hydrate_job(r) for r in job_rows]

    # 3. Run matcher
    results = matcher.match_jobs_for_student(student, jobs, top_n=top_n)

    # 4. Serialise response
    response = []
    for item in results:
        m = item["match"]
        response.append(
            {
                "job_id": item.get("job_id"),
                "title": item.get("title"),
                "company_name": item.get("company_name"),
                "location": item.get("location"),
                "job_type": item.get("job_type"),
                "salary_min": item.get("salary_min"),
                "salary_max": item.get("salary_max"),
                "skills_required": item.get("skills_required", []),
                "status": item.get("status", "active"),
                "score": m["score"],
                "skill_match": m["skill_match"],
                "text_similarity": m["text_similarity"],
                "matched_skills": m["matched_skills"],
                "missing_skills": m["missing_skills"],
            }
        )
    return response


@router.get(
    "/candidates/{job_id}",
    summary="Get top matched candidates for a job (recruiter)",
)
async def get_candidates_for_job(
    job_id: str,
    top_n: int = Query(default=20, ge=1, le=100, description="Maximum number of results"),
    current_user: Dict[str, Any] = Depends(require_role("recruiter", "admin")),
) -> List[dict]:
    """
    Return the top *top_n* student candidates ranked by match score for the
    specified job.  Only the recruiter who owns the job (or an admin) may call
    this endpoint.
    """
    # 1. Fetch job and verify ownership
    job_row = execute_one(_JOB_BY_ID_SQL, (job_id,))
    if not job_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found.",
        )

    if (
        current_user["role"] == "recruiter"
        and str(job_row.get("recruiter_id")) != current_user["id"]
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view candidates for this job.",
        )

    job = _hydrate_job(job_row)

    # 2. Load all student profiles
    student_rows = execute_query(_ALL_STUDENTS_SQL)
    if not student_rows:
        return []
    students = [_hydrate_student(r) for r in student_rows]

    # 3. Run matcher
    results = matcher.match_candidates_for_job(job, students, top_n=top_n)

    # 4. Serialise response
    response = []
    for item in results:
        m = item["match"]
        response.append(
            {
                "student_id": item.get("student_id"),
                "first_name": item.get("first_name"),
                "last_name": item.get("last_name"),
                "email": item.get("email"),
                "bio": item.get("bio"),
                "skills": item.get("skills", []),
                "location": item.get("location"),
                "score": m["score"],
                "skill_match": m["skill_match"],
                "text_similarity": m["text_similarity"],
                "matched_skills": m["matched_skills"],
                "missing_skills": m["missing_skills"],
            }
        )
    return response


@router.post(
    "/score",
    summary="Compute a detailed match score for a student↔job pair",
)
async def compute_score(
    body: MatchScoreRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> dict:
    """
    Accept ``{ student_id, job_id }`` and return a detailed breakdown of the
    match score.  Any authenticated user may call this endpoint (the caller is
    responsible for passing IDs they are authorised to query).
    """
    # 1. Load student profile
    student_sql = """
        SELECT
            sp.id AS student_id,
            u.email,
            u.first_name,
            u.last_name,
            sp.bio,
            sp.skills,
            sp.education,
            sp.experience
        FROM student_profiles sp
        JOIN users u ON u.id = sp.user_id
        WHERE sp.id = %s
    """
    student_row = execute_one(student_sql, (body.student_id,))
    if not student_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student profile {body.student_id} not found.",
        )
    student = _hydrate_student(student_row)

    # 2. Load job
    job_row = execute_one(_JOB_BY_ID_SQL, (body.job_id,))
    if not job_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {body.job_id} not found.",
        )
    job = _hydrate_job(job_row)

    # 3. Compute score
    match_result = matcher.compute_match_score(student, job)

    return {
        "student_id": body.student_id,
        "job_id": body.job_id,
        "student_name": f"{student_row.get('first_name', '')} {student_row.get('last_name', '')}".strip(),
        "job_title": job_row.get("title"),
        "company_name": job_row.get("company_name"),
        "match": match_result,
    }


@router.get(
    "/recommendations/{student_id}",
    summary="Get job recommendations for any student (admin or self)",
)
async def get_recommendations(
    student_id: str,
    top_n: int = Query(default=10, ge=1, le=50, description="Maximum number of results"),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> List[dict]:
    """
    Return job recommendations for *student_id*.

    - Admins may query any student.
    - Students may only query their own recommendations (matched by profile ID
      or user ID).
    """
    # Authorization check
    if current_user["role"] not in ("admin",):
        # Student must own the profile
        ownership_sql = """
            SELECT id FROM student_profiles
            WHERE id = %s AND user_id = %s
        """
        owned = execute_one(ownership_sql, (student_id, current_user["id"]))
        if not owned:
            # Also allow matching by user_id directly
            ownership_sql2 = """
                SELECT id FROM student_profiles
                WHERE user_id = %s
            """
            profile = execute_one(ownership_sql2, (current_user["id"],))
            if not profile or str(profile["id"]) != student_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorised to view recommendations for this student.",
                )

    # 1. Load student profile by student_profile id
    student_sql = """
        SELECT
            sp.id AS student_id,
            u.email,
            u.first_name,
            u.last_name,
            sp.bio,
            sp.skills,
            sp.education,
            sp.experience,
            sp.location
        FROM student_profiles sp
        JOIN users u ON u.id = sp.user_id
        WHERE sp.id = %s
    """
    student_row = execute_one(student_sql, (student_id,))
    if not student_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student profile {student_id} not found.",
        )
    student = _hydrate_student(student_row)

    # 2. Load all active jobs
    job_rows = execute_query(_ACTIVE_JOBS_SQL)
    if not job_rows:
        return []
    jobs = [_hydrate_job(r) for r in job_rows]

    # 3. Run matcher
    results = matcher.match_jobs_for_student(student, jobs, top_n=top_n)

    # 4. Serialise response
    response = []
    for item in results:
        m = item["match"]
        response.append(
            {
                "job_id": item.get("job_id"),
                "title": item.get("title"),
                "company_name": item.get("company_name"),
                "location": item.get("location"),
                "job_type": item.get("job_type"),
                "salary_min": item.get("salary_min"),
                "salary_max": item.get("salary_max"),
                "skills_required": item.get("skills_required", []),
                "status": item.get("status", "active"),
                "score": m["score"],
                "skill_match": m["skill_match"],
                "text_similarity": m["text_similarity"],
                "matched_skills": m["matched_skills"],
                "missing_skills": m["missing_skills"],
            }
        )
    return response
