# SkillLink — Scrum Artifacts
**Course:** SEN3244 Software Architecture | ICT University | Spring 2026
**Repository:** https://github.com/1DOULOS/SkillLink

## Team
| Role | Name | Matricule | GitHub |
|------|------|-----------|--------|
| Scrum Master | ETIMBI ZANGUE ANGE | ICTU20233866 | @angecatti |
| Product Owner | NJINDA BRIAN JR | ICTU20234467 | @1DOULOS |

---

## Sprint Schedule
| Sprint | Start | End | Focus |
|--------|-------|-----|-------|
| Sprint 1 | 25 Mar 2026 | 7 Apr 2026 | Infrastructure, Auth, Database |
| Sprint 2 | 8 Apr 2026 | 21 Apr 2026 | Profiles, Jobs, Applications |
| Sprint 3 | 22 Apr 2026 | 5 May 2026 | AI Matching, Full Frontend |
| Sprint 4 | 6 May 2026 | 20 May 2026 | DevOps, CI/CD, Testing, Docs |

---

## Sprint 1 — Foundation (25 Mar – 7 Apr 2026)

### Sprint Goal
Establish the full development environment, implement the authentication service with JWT, design the database schema, and validate the Docker Compose stack.

### Sprint Backlog
| Story | Description | Points | Assignee | Status |
|-------|-------------|--------|----------|--------|
| US-01 | User Registration | 3 | @angecatti | ✅ Done |
| US-02 | User Login + JWT | 3 | @angecatti | ✅ Done |
| US-03 | Token Refresh | 2 | @angecatti | ✅ Done |
| US-04 | Logout | 1 | @angecatti | ✅ Done |
| US-05 | Change Password | 2 | @angecatti | ✅ Done |
| INFRA | PostgreSQL schema (6 tables) | 3 | @angecatti | ✅ Done |
| INFRA | Docker Compose (auth + postgres + nginx) | 5 | @1DOULOS | ✅ Done |
| **Total** | | **19** | | **100%** |

### Sprint Review
All 7 stories completed. Authentication flow verified end-to-end via Postman. Docker Compose stack starts and passes health checks. Nginx routes /api/auth/* correctly.

### Retrospective
- ✅ What went well: Docker Compose setup was smooth; JWT middleware is clean and reusable
- ⚠️ To improve: Define API response envelope format earlier to avoid inconsistency

---

## Sprint 2 — Profiles & Jobs (8 Apr – 21 Apr 2026)

### Sprint Goal
Build the user service (profiles, CV upload), job service (CRUD, applications), and connect everything through the Nginx gateway.

### Sprint Backlog
| Story | Description | Points | Assignee | Status |
|-------|-------------|--------|----------|--------|
| US-06 | JWT Middleware + RBAC | 3 | @angecatti | ✅ Done |
| US-07 | Student Profile CRUD | 3 | @1DOULOS | ✅ Done |
| US-08 | Student Skills Management | 2 | @1DOULOS | ✅ Done |
| US-09 | CV & Avatar Upload | 5 | @1DOULOS | ✅ Done |
| US-10 | Recruiter Profile CRUD | 3 | @1DOULOS | ✅ Done |
| US-11 | Admin User Management | 5 | @angecatti | ✅ Done |
| US-12 | Job Posting CRUD | 5 | @1DOULOS | ✅ Done |
| US-13 | Job Browse & Search | 3 | @1DOULOS | ✅ Done |
| US-14 | Recruiter — Manage Listings | 2 | @1DOULOS | ✅ Done |
| US-15 | Application Submit | 3 | @1DOULOS | ✅ Done |
| US-16 | Student Track Applications | 2 | @1DOULOS | ✅ Done |
| US-17 | Recruiter View Applicants | 3 | @1DOULOS | ✅ Done |
| US-18 | Recruiter Update Status | 2 | @1DOULOS | ✅ Done |
| **Total** | | **41** | | **100%** |

### Sprint Review
All 13 stories completed. Full-stack CRUD working for profiles, jobs, and applications. CV upload with MIME-type and file-size validation working. Nginx routes all services.

### Retrospective
- ✅ What went well: RBAC middleware reused cleanly across both user and job services
- ⚠️ To improve: Write tests in parallel with feature development, not after

---

## Sprint 3 — AI Matching & Frontend (22 Apr – 5 May 2026)

### Sprint Goal
Implement the TF-IDF AI matching engine, complete all React frontend pages for all three user roles, and containerise the frontend.

### Sprint Backlog
| Story | Description | Points | Assignee | Status |
|-------|-------------|--------|----------|--------|
| US-19 | TF-IDF + Cosine Similarity Engine | 8 | @angecatti | ✅ Done |
| US-20 | Batch AI Job Feed Endpoint | 5 | @angecatti | ✅ Done |
| US-21 | Frontend — Auth Pages | 5 | @angecatti | ✅ Done |
| US-22 | Frontend — Student Portal | 8 | @angecatti | ✅ Done |
| US-23 | Frontend — Recruiter Portal | 8 | @1DOULOS | ✅ Done |
| US-24 | Frontend — Admin Portal | 5 | @angecatti | ✅ Done |
| INFRA | Frontend multi-stage Dockerfile | 3 | @1DOULOS | ✅ Done |
| **Total** | | **42** | | **100%** |

### Sprint Review
All 7 stories completed. AI engine scoring accurately (100% for perfect match, < 10 for zero overlap). React SPA serving all role portals. Match scores displayed on student job feed with percentage and matched/missing skills.

### Retrospective
- ✅ What went well: TF-IDF approach required no training data and worked from first request
- ⚠️ To improve: Plan for API latency between matching-service and other services earlier

---

## Sprint 4 — DevOps & Polish (6 May – 20 May 2026)

### Sprint Goal
Production-grade deployment on Kubernetes, Jenkins CI/CD pipeline, Prometheus + Grafana monitoring, Ansible IaC, ≥80% test coverage on all services, and complete documentation.

### Sprint Backlog
| Story | Description | Points | Assignee | Status |
|-------|-------------|--------|----------|--------|
| US-25 | Docker Compose Full Stack | 3 | @1DOULOS | ✅ Done |
| US-26 | Kubernetes Manifests (HPA, PVC, Ingress) | 8 | @angecatti | ✅ Done |
| US-27 | Jenkins 8-Stage CI/CD Pipeline | 8 | @angecatti | ✅ Done |
| INFRA | Prometheus + Grafana Monitoring | 5 | @angecatti | ✅ Done |
| INFRA | Ansible Playbooks (setup + deploy) | 5 | @1DOULOS | ✅ Done |
| TEST | Full test coverage all 5 services | 5 | @angecatti | ✅ Done |
| DOC | API Docs, Report, Architecture, Manual, Scrum | 5 | @angecatti, @1DOULOS | ✅ Done |
| **Total** | | **39** | | **100%** |

### Sprint Review
All stories completed. Kubernetes cluster running with HPA on all services. Jenkins pipeline green. Prometheus scraping all 4 backend services. Grafana auto-provisioned with operations dashboard. All 6 documentation files produced.

### Retrospective
- ✅ What went well: Ansible playbooks made server provisioning reproducible with one command
- ✅ What went well: Jenkins parallel stages reduced total CI time by ~60%
- ⚠️ To improve: Set up Kubernetes locally earlier in the project; left too late caused sprint pressure

---

## Velocity Summary

| Sprint | Committed | Completed | Velocity |
|--------|-----------|-----------|----------|
| Sprint 1 | 19 | 19 | 19 |
| Sprint 2 | 41 | 41 | 41 |
| Sprint 3 | 42 | 42 | 42 |
| Sprint 4 | 39 | 39 | 39 |
| **Total** | **141** | **141** | **35 avg** |

**Commitment rate: 100% — no stories carried over between sprints.**

---

## Definition of Done (DoD)
A user story is considered Done only when ALL of the following are true:
1. Code is fully implemented and follows the project's coding standards
2. Unit/integration tests written and passing with ≥80% coverage
3. Peer-reviewed (PR merged via GitHub with at least one review)
4. Feature integrated into Docker Compose stack and tested end-to-end
5. API endpoint documented in README.md
6. No known blocking bugs

---

## Burndown Data

### Sprint 1 Burndown (19 points)
| Day | Remaining Points |
|-----|-----------------|
| Day 1 (25 Mar) | 19 |
| Day 3 (27 Mar) | 16 |
| Day 5 (29 Mar) | 11 |
| Day 7 (31 Mar) | 7 |
| Day 9 (2 Apr) | 3 |
| Day 11 (4 Apr) | 0 |
| Day 14 (7 Apr) | 0 ✅ |

### Sprint 2 Burndown (41 points)
| Day | Remaining Points |
|-----|-----------------|
| Day 1 (8 Apr) | 41 |
| Day 3 (10 Apr) | 33 |
| Day 5 (12 Apr) | 25 |
| Day 7 (14 Apr) | 17 |
| Day 9 (16 Apr) | 10 |
| Day 11 (18 Apr) | 4 |
| Day 14 (21 Apr) | 0 ✅ |

### Sprint 3 Burndown (42 points)
| Day | Remaining Points |
|-----|-----------------|
| Day 1 (22 Apr) | 42 |
| Day 3 (24 Apr) | 34 |
| Day 5 (26 Apr) | 24 |
| Day 7 (28 Apr) | 16 |
| Day 9 (30 Apr) | 8 |
| Day 11 (2 May) | 2 |
| Day 14 (5 May) | 0 ✅ |

### Sprint 4 Burndown (39 points)
| Day | Remaining Points |
|-----|-----------------|
| Day 1 (6 May) | 39 |
| Day 3 (8 May) | 31 |
| Day 5 (10 May) | 22 |
| Day 7 (12 May) | 13 |
| Day 9 (14 May) | 6 |
| Day 11 (16 May) | 1 |
| Day 14 (20 May) | 0 ✅ |
