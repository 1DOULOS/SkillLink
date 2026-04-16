"""
Core AI Matching Engine for SkillLink.

Uses TF-IDF vectorisation (scikit-learn) and cosine similarity to compute a
semantic relevance score between a student profile and a job posting.  A
separate skill-overlap score captures exact skill matches, and both are blended
into a single 0-100 composite score.
"""

import logging
from typing import Any, Dict, List

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)


class JobMatcher:
    """
    Stateless (per-call vectorisation) matching engine.

    Design notes
    ------------
    * Each call to :meth:`compute_match_score` fits a *fresh* TF-IDF
      vectoriser on exactly two documents (student text + job text).  This
      avoids stale vocabulary issues when the service is long-running and the
      corpus changes.
    * Skills are weighted 3× relative to free-text fields to reflect their
      strong signal value.
    * Final score = 60 % skill overlap + 40 % TF-IDF cosine similarity,
      scaled to 0-100.
    """

    def __init__(self) -> None:
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            stop_words="english",
            max_features=5000,
        )

    # ------------------------------------------------------------------
    # Text-building helpers
    # ------------------------------------------------------------------

    def _build_student_text(self, student: Dict[str, Any]) -> str:
        """
        Concatenate all textual fields of a student profile into a single
        string suitable for TF-IDF vectorisation.

        Skills are repeated three times to give them higher term frequency.
        """
        parts: List[str] = []

        # Skills – weighted 3×
        skills = student.get("skills") or []
        if skills:
            skills_text = " ".join(str(s) for s in skills)
            parts.extend([skills_text] * 3)

        # Bio / summary
        bio = student.get("bio") or student.get("summary") or ""
        if bio:
            parts.append(str(bio))

        # Education entries
        for edu in student.get("education") or []:
            if isinstance(edu, dict):
                parts.extend(
                    filter(
                        None,
                        [
                            edu.get("degree", ""),
                            edu.get("field", ""),
                            edu.get("school", ""),
                            edu.get("institution", ""),
                        ],
                    )
                )
            elif isinstance(edu, str):
                parts.append(edu)

        # Experience entries
        for exp in student.get("experience") or []:
            if isinstance(exp, dict):
                parts.extend(
                    filter(
                        None,
                        [
                            exp.get("role", ""),
                            exp.get("title", ""),
                            exp.get("description", ""),
                            exp.get("company", ""),
                        ],
                    )
                )
            elif isinstance(exp, str):
                parts.append(exp)

        return " ".join(p for p in parts if p and str(p).strip())

    def _build_job_text(self, job: Dict[str, Any]) -> str:
        """
        Concatenate all textual fields of a job posting into a single string
        for TF-IDF vectorisation.

        Required skills are repeated three times for extra weight.
        """
        parts: List[str] = []

        # Skills required – weighted 3×
        skills_required = job.get("skills_required") or []
        if skills_required:
            skills_text = " ".join(str(s) for s in skills_required)
            parts.extend([skills_text] * 3)

        # Title and descriptions
        for field in ("title", "description", "requirements", "responsibilities"):
            value = job.get(field) or ""
            if value:
                parts.append(str(value))

        return " ".join(p for p in parts if p and str(p).strip())

    # ------------------------------------------------------------------
    # Scoring helpers
    # ------------------------------------------------------------------

    def _skill_overlap_score(
        self,
        student_skills: List[str],
        job_skills: List[str],
    ) -> float:
        """
        Return the fraction of *job* required skills that the student has
        (Jaccard-style recall metric).

        Returns 0.0 when either list is empty.
        """
        if not job_skills or not student_skills:
            return 0.0

        student_set = {str(s).lower().strip() for s in student_skills if s}
        job_set = {str(s).lower().strip() for s in job_skills if s}

        if not job_set:
            return 0.0

        overlap = len(student_set & job_set)
        return overlap / len(job_set)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def compute_match_score(
        self,
        student: Dict[str, Any],
        job: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Compute a composite match score between one student and one job.

        Returns
        -------
        dict with keys:
            score           – float 0-100, overall composite score
            skill_match     – float 0-100, percentage of job skills the student has
            text_similarity – float 0-100, TF-IDF cosine similarity scaled to %
            matched_skills  – list[str] job skills present in the student profile
            missing_skills  – list[str] job skills absent from the student profile
        """
        student_text = self._build_student_text(student)
        job_text = self._build_job_text(job)

        # --- TF-IDF cosine similarity -----------------------------------
        text_similarity = 0.0
        if student_text.strip() and job_text.strip():
            try:
                # Re-fit on the two documents so vocabulary is always fresh
                tfidf_matrix = self.vectorizer.fit_transform(
                    [student_text, job_text]
                )
                sim = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])
                text_similarity = float(sim[0][0])
            except Exception as exc:  # pragma: no cover
                logger.warning("TF-IDF computation failed: %s", exc)
                text_similarity = 0.0

        # --- Skill overlap ---------------------------------------------
        skill_score = self._skill_overlap_score(
            student.get("skills") or [],
            job.get("skills_required") or [],
        )

        # --- Composite score (60 % skill, 40 % text) ------------------
        combined_score = (skill_score * 0.6 + text_similarity * 0.4) * 100
        # Clamp to [0, 100] for safety (floating-point edge cases)
        combined_score = max(0.0, min(100.0, combined_score))

        # --- Matched / missing skill lists ----------------------------
        student_skills_lower = {
            str(s).lower().strip()
            for s in (student.get("skills") or [])
            if s
        }
        job_skills = job.get("skills_required") or []

        matched_skills = [
            s for s in job_skills if str(s).lower().strip() in student_skills_lower
        ]
        missing_skills = [
            s for s in job_skills if str(s).lower().strip() not in student_skills_lower
        ]

        return {
            "score": round(combined_score, 2),
            "skill_match": round(skill_score * 100, 2),
            "text_similarity": round(text_similarity * 100, 2),
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
        }

    def match_jobs_for_student(
        self,
        student: Dict[str, Any],
        jobs: List[Dict[str, Any]],
        top_n: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Score all *jobs* for a *student* and return the top *top_n* results
        sorted by descending composite score.

        Each returned dict is a shallow copy of the original job dict with an
        additional ``"match"`` key containing the score details.
        """
        results: List[Dict[str, Any]] = []
        for job in jobs:
            match_result = self.compute_match_score(student, job)
            results.append({**job, "match": match_result})

        results.sort(key=lambda x: x["match"]["score"], reverse=True)
        return results[:top_n]

    def match_candidates_for_job(
        self,
        job: Dict[str, Any],
        students: List[Dict[str, Any]],
        top_n: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Score all *students* for a *job* and return the top *top_n* results
        sorted by descending composite score.

        Each returned dict is a shallow copy of the original student dict with
        an additional ``"match"`` key containing the score details.
        """
        results: List[Dict[str, Any]] = []
        for student in students:
            match_result = self.compute_match_score(student, job)
            results.append({**student, "match": match_result})

        results.sort(key=lambda x: x["match"]["score"], reverse=True)
        return results[:top_n]
