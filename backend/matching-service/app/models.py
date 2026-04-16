"""
Pydantic request / response models for the SkillLink Matching Service API.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Shared / embedded models
# ---------------------------------------------------------------------------


class MatchDetails(BaseModel):
    """Detailed breakdown of a single match computation."""

    score: float = Field(..., ge=0, le=100, description="Overall composite score (0-100)")
    skill_match: float = Field(..., ge=0, le=100, description="Skill overlap score (0-100)")
    text_similarity: float = Field(
        ..., ge=0, le=100, description="TF-IDF cosine similarity scaled to (0-100)"
    )
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class MatchScoreRequest(BaseModel):
    """Body for POST /api/match/score – compute a single student↔job score."""

    student_id: str = Field(..., description="UUID of the student")
    job_id: str = Field(..., description="UUID of the job posting")


class BulkMatchRequest(BaseModel):
    """Body (or query params) for bulk-match endpoints."""

    student_id: str = Field(..., description="UUID of the student")
    top_n: int = Field(default=10, ge=1, le=50, description="Maximum number of results to return")


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class JobMatchResponse(BaseModel):
    """A job posting enriched with match-score details – returned to students."""

    job_id: str
    title: str
    company_name: str
    location: Optional[str] = None
    job_type: str
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    skills_required: List[str] = Field(default_factory=list)
    is_active: bool = True

    # Match details
    score: float
    skill_match: float
    text_similarity: float
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class CandidateMatchResponse(BaseModel):
    """A student profile enriched with match-score details – returned to recruiters."""

    student_id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: str
    bio: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    location: Optional[str] = None

    # Match details
    score: float
    skill_match: float
    text_similarity: float
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class MatchScoreResponse(BaseModel):
    """Detailed result for POST /api/match/score."""

    student_id: str
    job_id: str
    match: MatchDetails

    # Context
    student_name: Optional[str] = None
    job_title: Optional[str] = None
    company_name: Optional[str] = None

    model_config = {"from_attributes": True}


class HealthResponse(BaseModel):
    """Response schema for GET /health."""

    status: str
    service: str
    uptime: float
    version: str


class RootResponse(BaseModel):
    """Response schema for GET /."""

    message: str
    version: str
    docs: str
