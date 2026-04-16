"""
Unit tests for the JobMatcher AI matching engine.

Run with:
    pytest tests/test_matcher.py -v
"""

import pytest

from app.matcher import JobMatcher


# ---------------------------------------------------------------------------
# Fixtures / shared data
# ---------------------------------------------------------------------------


class TestJobMatcher:
    """Full test suite for JobMatcher."""

    def setup_method(self):
        """Instantiate a fresh JobMatcher and define canonical test fixtures."""
        self.matcher = JobMatcher()

        # --- Student profiles -------------------------------------------

        self.student_python = {
            "skills": ["Python", "Django", "PostgreSQL", "Docker", "REST APIs"],
            "bio": "Backend developer with Python expertise and strong database skills",
            "education": [
                {
                    "degree": "BSc",
                    "field": "Computer Science",
                    "school": "ICT University",
                }
            ],
            "experience": [
                {
                    "role": "Backend Developer",
                    "description": "Built Python REST APIs and managed PostgreSQL databases",
                }
            ],
        }

        self.student_frontend = {
            "skills": ["React", "JavaScript", "CSS", "HTML", "TypeScript"],
            "bio": "Frontend developer passionate about UI/UX and responsive design",
            "education": [],
            "experience": [],
        }

        self.student_empty = {
            "skills": [],
            "bio": "",
            "education": [],
            "experience": [],
        }

        self.student_java = {
            "skills": ["Java", "Spring Boot", "Hibernate", "Maven"],
            "bio": "Java enterprise developer",
            "education": [],
            "experience": [],
        }

        # --- Job postings -----------------------------------------------

        self.job_python = {
            "title": "Python Backend Developer",
            "description": "We need a Python developer for backend services and APIs",
            "requirements": "Experience with Python, Django, and PostgreSQL required",
            "skills_required": ["Python", "Django", "PostgreSQL", "REST APIs"],
        }

        self.job_react = {
            "title": "React Frontend Developer",
            "description": "Join our team building React applications for web clients",
            "requirements": "Experience with React and modern JavaScript required",
            "skills_required": ["React", "JavaScript", "CSS"],
        }

        self.job_data_science = {
            "title": "Data Scientist",
            "description": "Analyse large datasets and build machine learning models",
            "requirements": "Experience with Python and machine learning required",
            "skills_required": ["Python", "Machine Learning", "Pandas", "SQL"],
        }

        self.job_empty_skills = {
            "title": "General Developer",
            "description": "Any developer welcome to apply",
            "requirements": "",
            "skills_required": [],
        }

    # ------------------------------------------------------------------
    # compute_match_score – return structure
    # ------------------------------------------------------------------

    def test_compute_match_score_returns_required_fields(self):
        result = self.matcher.compute_match_score(self.student_python, self.job_python)
        assert "score" in result
        assert "skill_match" in result
        assert "text_similarity" in result
        assert "matched_skills" in result
        assert "missing_skills" in result

    def test_score_is_numeric(self):
        result = self.matcher.compute_match_score(self.student_python, self.job_python)
        assert isinstance(result["score"], (int, float))
        assert isinstance(result["skill_match"], (int, float))
        assert isinstance(result["text_similarity"], (int, float))

    def test_matched_and_missing_skills_are_lists(self):
        result = self.matcher.compute_match_score(self.student_python, self.job_python)
        assert isinstance(result["matched_skills"], list)
        assert isinstance(result["missing_skills"], list)

    # ------------------------------------------------------------------
    # compute_match_score – score bounds
    # ------------------------------------------------------------------

    def test_score_between_0_and_100(self):
        for student in [self.student_python, self.student_frontend, self.student_empty]:
            for job in [self.job_python, self.job_react, self.job_data_science]:
                result = self.matcher.compute_match_score(student, job)
                assert 0 <= result["score"] <= 100, (
                    f"score {result['score']} out of bounds for "
                    f"student={student['skills']} job={job['title']}"
                )

    def test_skill_match_between_0_and_100(self):
        for student in [self.student_python, self.student_frontend]:
            for job in [self.job_python, self.job_react]:
                result = self.matcher.compute_match_score(student, job)
                assert 0 <= result["skill_match"] <= 100

    def test_text_similarity_between_0_and_100(self):
        result = self.matcher.compute_match_score(self.student_python, self.job_python)
        assert 0 <= result["text_similarity"] <= 100

    # ------------------------------------------------------------------
    # compute_match_score – quality assertions
    # ------------------------------------------------------------------

    def test_compute_match_score_high_match(self):
        """Python student vs Python job should score > 50."""
        result = self.matcher.compute_match_score(self.student_python, self.job_python)
        assert result["score"] > 50, f"Expected >50, got {result['score']}"
        assert result["skill_match"] > 50

    def test_compute_match_score_low_match(self):
        """Frontend student vs Python job should score < 30."""
        result = self.matcher.compute_match_score(self.student_frontend, self.job_python)
        assert result["score"] < 30, f"Expected <30, got {result['score']}"

    def test_frontend_student_matches_react_job_better_than_python_job(self):
        score_python = self.matcher.compute_match_score(self.student_frontend, self.job_python)
        score_react = self.matcher.compute_match_score(self.student_frontend, self.job_react)
        assert score_react["score"] > score_python["score"], (
            f"React job score ({score_react['score']}) should exceed "
            f"Python job score ({score_python['score']}) for frontend student"
        )

    def test_python_student_matches_python_job_better_than_react_job(self):
        score_python_job = self.matcher.compute_match_score(self.student_python, self.job_python)
        score_react_job = self.matcher.compute_match_score(self.student_python, self.job_react)
        assert score_python_job["score"] > score_react_job["score"]

    # ------------------------------------------------------------------
    # Skill overlap edge cases
    # ------------------------------------------------------------------

    def test_skill_overlap_perfect_match(self):
        student = {
            "skills": ["Python", "Django"],
            "bio": "",
            "education": [],
            "experience": [],
        }
        job = {
            "title": "Dev",
            "description": "",
            "requirements": "",
            "skills_required": ["Python", "Django"],
        }
        result = self.matcher.compute_match_score(student, job)
        assert result["skill_match"] == 100.0
        assert len(result["missing_skills"]) == 0
        assert set(result["matched_skills"]) == {"Python", "Django"}

    def test_skill_overlap_no_match(self):
        student = {
            "skills": ["Java", "Spring"],
            "bio": "",
            "education": [],
            "experience": [],
        }
        job = {
            "title": "React Dev",
            "description": "",
            "requirements": "",
            "skills_required": ["React", "JavaScript"],
        }
        result = self.matcher.compute_match_score(student, job)
        assert result["skill_match"] == 0.0
        assert len(result["matched_skills"]) == 0

    def test_case_insensitive_skill_matching(self):
        student = {
            "skills": ["python", "django"],
            "bio": "",
            "education": [],
            "experience": [],
        }
        job = {
            "title": "Dev",
            "description": "",
            "requirements": "",
            "skills_required": ["Python", "Django"],
        }
        result = self.matcher.compute_match_score(student, job)
        assert result["skill_match"] == 100.0

    def test_partial_skill_match(self):
        student = {
            "skills": ["Python", "Django"],
            "bio": "",
            "education": [],
            "experience": [],
        }
        job = {
            "title": "Dev",
            "description": "",
            "requirements": "",
            "skills_required": ["Python", "Django", "Docker", "Kubernetes"],
        }
        result = self.matcher.compute_match_score(student, job)
        assert result["skill_match"] == 50.0  # 2 of 4 matched
        assert len(result["matched_skills"]) == 2
        assert len(result["missing_skills"]) == 2

    def test_matched_skills_are_subset_of_job_skills(self):
        result = self.matcher.compute_match_score(self.student_python, self.job_python)
        job_skills_lower = {s.lower() for s in self.job_python["skills_required"]}
        for skill in result["matched_skills"]:
            assert skill.lower() in job_skills_lower

    def test_missing_plus_matched_equals_all_job_skills(self):
        result = self.matcher.compute_match_score(self.student_python, self.job_python)
        all_skills = set(result["matched_skills"]) | set(result["missing_skills"])
        expected = set(self.job_python["skills_required"])
        assert all_skills == expected

    # ------------------------------------------------------------------
    # Empty / edge case inputs
    # ------------------------------------------------------------------

    def test_match_with_empty_student_skills(self):
        result = self.matcher.compute_match_score(self.student_empty, self.job_python)
        assert result["score"] >= 0
        assert result["skill_match"] == 0.0
        assert len(result["matched_skills"]) == 0

    def test_match_with_empty_job_skills(self):
        result = self.matcher.compute_match_score(self.student_python, self.job_empty_skills)
        assert result["score"] >= 0
        assert result["skill_match"] == 0.0

    def test_match_fully_empty_student_and_job(self):
        student = {"skills": [], "bio": "", "education": [], "experience": []}
        job = {
            "title": "",
            "description": "",
            "requirements": "",
            "skills_required": [],
        }
        result = self.matcher.compute_match_score(student, job)
        assert result["score"] == 0.0
        assert result["skill_match"] == 0.0
        assert result["text_similarity"] == 0.0

    def test_match_with_none_values(self):
        student = {"skills": None, "bio": None, "education": None, "experience": None}
        job = {
            "title": "Dev",
            "description": None,
            "requirements": None,
            "skills_required": None,
        }
        result = self.matcher.compute_match_score(student, job)
        assert result["score"] >= 0

    # ------------------------------------------------------------------
    # match_jobs_for_student
    # ------------------------------------------------------------------

    def test_match_jobs_for_student_sorted_by_score(self):
        jobs = [self.job_python, self.job_react, self.job_data_science]
        results = self.matcher.match_jobs_for_student(self.student_python, jobs, top_n=3)
        assert len(results) <= 3
        scores = [r["match"]["score"] for r in results]
        assert scores == sorted(scores, reverse=True)

    def test_match_jobs_for_student_top_n_respected(self):
        jobs = [self.job_python, self.job_react, self.job_data_science]
        results = self.matcher.match_jobs_for_student(self.student_python, jobs, top_n=2)
        assert len(results) == 2

    def test_match_jobs_for_student_returns_all_when_top_n_exceeds_jobs(self):
        jobs = [self.job_python]
        results = self.matcher.match_jobs_for_student(self.student_python, jobs, top_n=10)
        assert len(results) == 1

    def test_match_jobs_for_student_result_contains_match_key(self):
        jobs = [self.job_python]
        results = self.matcher.match_jobs_for_student(self.student_python, jobs, top_n=5)
        assert "match" in results[0]
        assert "score" in results[0]["match"]

    def test_match_jobs_empty_jobs_list(self):
        results = self.matcher.match_jobs_for_student(self.student_python, [], top_n=10)
        assert results == []

    # ------------------------------------------------------------------
    # match_candidates_for_job
    # ------------------------------------------------------------------

    def test_match_candidates_for_job_sorted_by_score(self):
        students = [self.student_python, self.student_frontend, self.student_java]
        results = self.matcher.match_candidates_for_job(self.job_python, students, top_n=10)
        scores = [r["match"]["score"] for r in results]
        assert scores == sorted(scores, reverse=True)

    def test_match_candidates_python_student_tops_python_job(self):
        students = [self.student_python, self.student_frontend]
        results = self.matcher.match_candidates_for_job(self.job_python, students, top_n=10)
        assert len(results) == 2
        # Python student should rank higher for Python job
        assert results[0]["match"]["score"] >= results[1]["match"]["score"]
        # The top result should have higher skill match than the frontend student
        assert results[0]["match"]["skill_match"] > results[1]["match"]["skill_match"]

    def test_match_candidates_top_n_respected(self):
        students = [self.student_python, self.student_frontend, self.student_java]
        results = self.matcher.match_candidates_for_job(self.job_python, students, top_n=2)
        assert len(results) == 2

    def test_match_candidates_result_contains_match_key(self):
        students = [self.student_python]
        results = self.matcher.match_candidates_for_job(self.job_python, students, top_n=5)
        assert "match" in results[0]

    def test_match_candidates_empty_student_list(self):
        results = self.matcher.match_candidates_for_job(self.job_python, [], top_n=10)
        assert results == []

    # ------------------------------------------------------------------
    # _build_student_text and _build_job_text (internal helpers)
    # ------------------------------------------------------------------

    def test_build_student_text_includes_skills(self):
        text = self.matcher._build_student_text(self.student_python)
        # Skills should appear at least once
        assert "Python" in text
        assert "Django" in text

    def test_build_job_text_includes_required_skills(self):
        text = self.matcher._build_job_text(self.job_python)
        assert "Python" in text
        assert "Django" in text

    def test_build_student_text_empty_student(self):
        text = self.matcher._build_student_text(self.student_empty)
        assert isinstance(text, str)

    def test_build_job_text_empty_job(self):
        text = self.matcher._build_job_text(self.job_empty_skills)
        assert isinstance(text, str)

    # ------------------------------------------------------------------
    # _skill_overlap_score (internal helper)
    # ------------------------------------------------------------------

    def test_skill_overlap_both_empty(self):
        score = self.matcher._skill_overlap_score([], [])
        assert score == 0.0

    def test_skill_overlap_student_empty(self):
        score = self.matcher._skill_overlap_score([], ["Python", "Django"])
        assert score == 0.0

    def test_skill_overlap_job_empty(self):
        score = self.matcher._skill_overlap_score(["Python"], [])
        assert score == 0.0

    def test_skill_overlap_full_match(self):
        score = self.matcher._skill_overlap_score(
            ["Python", "Django", "PostgreSQL"], ["Python", "Django", "PostgreSQL"]
        )
        assert score == 1.0

    def test_skill_overlap_half_match(self):
        score = self.matcher._skill_overlap_score(
            ["Python", "Django"], ["Python", "Django", "Docker", "Redis"]
        )
        assert score == pytest.approx(0.5)

    def test_skill_overlap_superset_student(self):
        """Student has extra skills not in job – recall should still be 1.0."""
        score = self.matcher._skill_overlap_score(
            ["Python", "Django", "React", "Vue"], ["Python", "Django"]
        )
        assert score == 1.0
