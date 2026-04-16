# SkillLink — AI-Powered Internship & Job Matching Platform

> **SEN3244 Software Architecture | Spring 2026 | ICT University**
>
> **Team:** Scrum Master — ETIMBI ZANGUE ANGE (ICTU20233866, @angecatti) | Product Owner — NJINDA BRIAN JR (ICTU20234467, @1DOULOS)

SkillLink is a full-stack microservices platform that connects students with internship and job opportunities through AI-powered skill matching. Students get an automatically ranked job feed; recruiters get a ranked candidate list — no manual filtering required.

---

## Architecture

SkillLink uses a **Microservices Architecture** with 5 independent services behind a single Nginx API gateway. **12 containers total** in Docker Compose.

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (React 18 SPA)                     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP
┌────────────────────────▼────────────────────────────────────┐
│              Nginx API Gateway  (:80)                        │
│  /api/auth→:3001 | /api/users→:3002 | /api/jobs→:3003       │
│  /api/match→:8000 | / → React SPA static files              │
└──┬──────────┬────────────┬───────────────┬──────────────────┘
   ▼          ▼            ▼               ▼
┌──────┐ ┌────────┐ ┌──────────┐ ┌────────────────┐
│ Auth │ │  User  │ │   Job    │ │   Matching     │
│ :3001│ │  :3002 │ │  :3003   │ │   :8000        │
│Node.js│ │Node.js │ │ Node.js  │ │ Python/FastAPI │
└──┬───┘ └───┬────┘ └────┬─────┘ └───────┬────────┘
   └─────────┴────────────┴───────────────┘
                         │
              ┌──────────▼──────────┐
              │   PostgreSQL :5432  │
              └─────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, React Router v6 |
| Auth Service | Node.js, Express, JWT HS256 (15 min), bcryptjs (12 salt rounds) |
| User Service | Node.js, Express, Multer (CV ≤ 10 MB, avatar ≤ 5 MB) |
| Job Service | Node.js, Express, PostgreSQL pg_trgm full-text search |
| Matching Service | Python 3.11, FastAPI, scikit-learn (TF-IDF), numpy |
| Database | PostgreSQL 16 — uuid-ossp, pg_trgm, GIN indexes, 6 tables |
| Cache | Redis 7 — refresh token blacklist |
| API Gateway | Nginx |
| Containerisation | Docker, Docker Compose (12 services) |
| Orchestration | Kubernetes — HPA, RollingUpdate, liveness/readiness probes |
| CI/CD | Jenkins — 8-stage declarative pipeline, 3 parallel blocks |
| Monitoring | Prometheus (7 targets, 15 s interval) + Grafana (auto-provisioned) |
| IaC | Ansible — 2 playbooks, ARM64/amd64 auto-detect |

---

## Quick Start

```bash
git clone https://github.com/1DOULOS/SkillLink.git
cd SkillLink
docker compose up --build -d
```

| URL | What you see |
|-----|-------------|
| http://localhost | SkillLink app |
| http://localhost:9090 | Prometheus |
| http://localhost:3004 | Grafana (admin / skilllink2026) |

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@skilllink.com | password |
| Recruiter | recruiter@techcorp.com | Pass@123 |
| Student | student@university.cm | Pass@123 |

---

## Local Development (Without Docker)

```bash
# Requires PostgreSQL 16 running locally
psql -c "CREATE DATABASE skilllink_db;"
psql skilllink_db < database/init.sql

# Auth Service — port 3001
cd backend/auth-service && cp .env.example .env && npm install && npm run dev

# User Service — port 3002
cd backend/user-service && cp .env.example .env && npm install && npm run dev

# Job Service — port 3003
cd backend/job-service && cp .env.example .env && npm install && npm run dev

# Matching Service — port 8000
cd backend/matching-service && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend — port 5173 (host:true, accessible on LAN for mobile testing)
cd frontend && npm install && npm run dev
```

---

## AI Matching Engine

### Scoring Formula

```
score = (0.6 × skill_overlap + 0.4 × cosine_similarity) × 100
```

| Component | Weight | How it works |
|-----------|--------|-------------|
| `skill_overlap` | 0.6 | `len(student_skills ∩ required_skills) / len(required_skills)` |
| `cosine_similarity` | 0.4 | TF-IDF vector dot product — semantic match of bio + experience text |

Skills are repeated ×3 in the text document to boost their TF-IDF weight over free-text fields. The vectoriser uses `ngram_range=(1,2)`, `max_features=5000`, `stop_words='english'`. All jobs are scored in a single matrix operation — not per-job loops.

No training data required. Deterministic, fast, and fully interpretable.

---

## Database (6 Tables)

| Table | Key Design Decisions |
|-------|---------------------|
| `users` | UUID PK, email UNIQUE, role CHECK, is_active for soft ban |
| `refresh_tokens` | token stored as bcrypt hash — compromised DB cannot replay sessions |
| `student_profiles` | `skills TEXT[]` — GIN-indexed array used directly by AI engine |
| `recruiter_profiles` | Linked 1:1 to users via UNIQUE FK |
| `jobs` | `skills_required TEXT[]`, status CHECK, GIN + tsvector indexes |
| `applications` | `UNIQUE(student_id, job_id)` — DB-level duplicate prevention |

---

## API Reference

> **OpenAPI 3.0:** [`docs/openapi.yaml`](docs/openapi.yaml)
> **Postman Collection:** [`docs/SkillLink.postman_collection.json`](docs/SkillLink.postman_collection.json)

### Auth Service (:3001)

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/refresh` | Public |
| POST | `/api/auth/logout` | Bearer |
| GET | `/api/auth/me` | Bearer |
| PUT | `/api/auth/change-password` | Bearer |

### User Service (:3002)

| Method | Endpoint | Auth |
|--------|----------|------|
| GET / PUT | `/api/users/profile` | Student |
| PUT | `/api/users/skills` | Student |
| POST | `/api/users/cv` | Student (PDF ≤ 10 MB) |
| POST | `/api/users/avatar` | Student (image ≤ 5 MB) |
| GET / PUT | `/api/users/recruiter/profile` | Recruiter |
| GET | `/api/users/students` | Recruiter / Admin |
| GET | `/api/admin/users` | Admin |
| PUT | `/api/admin/users/:id/status` | Admin |
| GET | `/api/admin/stats` | Admin |

### Job Service (:3003)

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/jobs` | Public |
| POST | `/api/jobs` | Recruiter |
| GET / PUT / DELETE | `/api/jobs/:id` | Public / Recruiter |
| GET | `/api/jobs/my` | Recruiter |
| GET | `/api/jobs/:id/applications` | Recruiter |
| PUT | `/api/jobs/:jobId/applications/:appId` | Recruiter |
| POST | `/api/applications/jobs/:jobId` | Student |
| GET | `/api/applications/my` | Student |
| DELETE | `/api/applications/:id` | Student |

### Matching Service (:8000)

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/api/match/jobs` | Student |
| GET | `/api/match/candidates/:jobId` | Recruiter |
| POST | `/api/match/score` | Bearer |

---

## Testing

```bash
cd backend/auth-service    && npm test
cd backend/user-service    && npm test
cd backend/job-service     && npm test
cd backend/matching-service && pytest tests/ -v --cov=app --cov-fail-under=80
cd frontend                && npm test
```

**Coverage threshold: ≥ 80% lines on all 5 suites.** Jenkins Stage 4 fails the build if any suite drops below this.

---

## CI/CD Pipeline (Jenkins)

**8-stage declarative pipeline** — `infrastructure/jenkins/Jenkinsfile`

| Stage | Detail |
|-------|--------|
| 1. Checkout | Clone repo; `IMAGE_TAG = git rev-parse --short HEAD` |
| 2. Install *(parallel)* | `npm ci` × 4 + `pip install` simultaneously |
| 3. Lint | eslint (Node.js), flake8 (Python) |
| 4. Test *(parallel)* | All 5 suites simultaneously; fails below 80% coverage |
| 5. Build Images *(parallel)* | `docker build` all 5 services |
| 6. Push Registry | Docker Hub — main / develop branches only |
| 7. Deploy K8s | `kubectl set image` rolling update on all 5 deployments |
| 8. Smoke Tests | `curl /health` on all 4 backend services |

Parallel stages cut total CI time by ~60%. Workspace cleaned after every run.

---

## Kubernetes

```bash
kubectl apply -f infrastructure/kubernetes/
kubectl get pods -n skilllink
kubectl get hpa  -n skilllink
```

| Setting | Value |
|---------|-------|
| Namespace | `skilllink` |
| Replicas | 2 per service |
| Strategy | RollingUpdate — maxSurge: 1, maxUnavailable: 0 |
| HPA CPU threshold | 70% |
| HPA max (most services) | 5 replicas |
| HPA max (matching-service) | 10 replicas |
| PVC | 20 Gi ReadWriteOnce |

---

## Monitoring

| Target | Port | Key Metrics |
|--------|------|------------|
| auth-service | 3001 | Login attempts, token generation latency |
| user-service | 3002 | CV uploads, profile updates |
| job-service | 3003 | Job creation rate, DB query duration |
| matching-service | 8000 | Match computation latency, scores/sec |
| node-exporter | 9100 | Host CPU, memory, disk |
| postgres-exporter | 9187 | DB connections, query stats |
| prometheus | 9090 | Self-monitoring |

Grafana at `http://localhost:3004` — auto-provisioned, no manual setup.

---

## Infrastructure as Code (Ansible)

```bash
cd infrastructure/ansible

# Provision a fresh Ubuntu 22.04 server (run once)
ansible-playbook -i inventory.ini playbook-setup.yml

# Deploy or update the application
ansible-playbook -i inventory.ini playbook-deploy.yml
```

Playbooks auto-detect server CPU architecture (amd64 / arm64).
Update `inventory.ini` with your server IP before running.

**VPS recommendation:** Oracle Cloud Always Free ARM — `VM.Standard.A1.Flex`, 4 OCPU, 24 GB RAM, permanently free. See the deployment checklist in the project wiki.

---

## Scrum (4 Sprints · 25 Mar – 20 May 2026)

| Sprint | Dates | Focus | Points |
|--------|-------|-------|--------|
| 1 — Foundation | 25 Mar – 7 Apr | Auth, DB schema, Docker Compose | 19 |
| 2 — Core Features | 8 Apr – 21 Apr | Profiles, jobs, applications, Nginx | 41 |
| 3 — AI & Frontend | 22 Apr – 5 May | TF-IDF engine, React portals | 42 |
| 4 — DevOps & Delivery | 6 May – 20 May | K8s, Jenkins, monitoring, Ansible, docs | 39 |

**141 total story points · 100% commitment rate · no sprint carryover**

Sprint docs, burndown data: [`docs/scrum/sprint_planning.md`](docs/scrum/sprint_planning.md)

---

## Project Structure

```
SkillLink/
├── backend/
│   ├── auth-service/           # JWT auth (Node.js :3001)
│   ├── user-service/           # Profiles + file upload (Node.js :3002)
│   ├── job-service/            # Jobs + applications (Node.js :3003)
│   └── matching-service/       # TF-IDF AI engine (Python :8000)
├── frontend/                   # React 18 + TypeScript + Tailwind (:5173)
├── database/
│   └── init.sql                # 6-table schema + seed data
├── docs/
│   ├── openapi.yaml            # OpenAPI 3.0 — all 35+ endpoints
│   ├── SkillLink.postman_collection.json
│   └── scrum/
│       └── sprint_planning.md  # All 4 sprints with burndown data
├── infrastructure/
│   ├── nginx/                  # API gateway config
│   ├── kubernetes/             # K8s manifests (HPA, probes, ingress)
│   ├── ansible/                # Setup + deploy playbooks (ARM64-ready)
│   ├── monitoring/             # Prometheus + Grafana provisioning
│   └── jenkins/                # 8-stage Jenkinsfile
├── .claude/
│   └── launch.json             # Dev server launch config
└── docker-compose.yml          # Full 12-container local stack
```

---

## License

MIT — Built for SEN3244 Software Architecture, ICT University, Spring 2026.
