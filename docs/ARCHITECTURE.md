# SkillLink — Architecture Document

**Course:** SEN3244 Software Architecture | ICT University | Spring 2026  
**Team:** Product Owner — NJINDA BRIAN JR (ICTU20234467) | Scrum Master — ETIMBI ZANGUE ANGE (ICTU20233866)

---

## 1. Architectural Style: Microservices

### Justification
SkillLink adopts a **Microservices Architecture** where each bounded domain (authentication, user profiles, job listings, AI matching) is independently deployed, scaled, and maintained. This choice was driven by:

| Driver | Rationale |
|--------|-----------|
| Independent scalability | The matching service (CPU-intensive TF-IDF) must scale to 10 pods while auth stays at 2 |
| Technology heterogeneity | Python/FastAPI for ML, Node.js/Express for REST CRUD — each service picks the right tool |
| Fault isolation | A crash in the matching service does not take down job browsing |
| Team autonomy | Two developers can own separate services without merge conflicts |
| Independent deployment | Jenkins pipeline builds and pushes each service image independently |

---

## 2. High-Level Architecture (System Context View)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      External Users                                  │
│   Students · Recruiters · Administrators                             │
└────────────────────────┬────────────────────────────────────────────┘
                         │ HTTPS :443 / HTTP :80
┌────────────────────────▼────────────────────────────────────────────┐
│                   Nginx API Gateway                                  │
│   Reverse proxy + static file server + GZIP + security headers       │
│   /api/auth → :3001 | /api/users → :3002 | /api/jobs → :3003        │
│   /api/match → :8000 | / → React SPA (static)                       │
└──┬──────────┬──────────────┬──────────────────┬─────────────────────┘
   │          │              │                  │
   ▼          ▼              ▼                  ▼
┌──────┐ ┌────────┐ ┌─────────────┐ ┌──────────────────┐
│ Auth │ │  User  │ │    Job      │ │    Matching      │
│:3001 │ │  :3002 │ │   :3003     │ │    :8000         │
│Node  │ │ Node   │ │  Node.js    │ │ Python / FastAPI │
│/Expr │ │ /Expr  │ │  /Express   │ │ scikit-learn     │
└──┬───┘ └───┬────┘ └──────┬──────┘ └─────────┬────────┘
   │         │             │                   │
   └─────────┴─────────────┴───────────────────┘
                           │
             ┌─────────────▼──────────────┐
             │      PostgreSQL 16          │
             │  uuid-ossp · pg_trgm        │
             │  GIN indexes · 6 tables     │
             └────────────────────────────┘
                           │
             ┌─────────────▼──────────────┐
             │         Redis 7             │
             │  Refresh token blacklist    │
             └────────────────────────────┘
```

---

## 3. Component View

### 3.1 Auth Service (Node.js / Express — Port 3001)

```
Auth Service
├── Routes Layer        (auth.routes.js)    — express-validator chains
├── Controller Layer    (auth.controller.js) — business logic
├── Middleware Layer    (auth.middleware.js) — authenticate, authorize, optionalAuth
├── Config
│   ├── db.js           — pg Pool connection
│   └── logger.js       — Winston JSON logger
└── Metrics             (metrics.routes.js)  — prom-client Counter + Histogram
```

**Responsibilities:** Registration, login, JWT issuance, token refresh, logout, password change, RBAC middleware exported to all services.

**Security design:**
- JWT HS256, 15-minute access tokens, 7-day refresh tokens
- Refresh tokens stored as bcrypt hashes (10 rounds) — DB breach cannot replay tokens
- Rate limit: 100 req / 15 min

---

### 3.2 User Service (Node.js / Express — Port 3002)

```
User Service
├── Routes
│   ├── student.routes.js    — profile, skills, CV, avatar, stats
│   ├── recruiter.routes.js  — company profile, student listing
│   └── admin.routes.js      — user management, platform stats
├── Controllers
│   ├── student.controller.js   (520 lines)
│   ├── recruiter.controller.js
│   └── admin.controller.js
├── Config
│   └── upload.js            — Multer: PDF ≤10 MB for CV, JPEG/PNG ≤5 MB for avatar
└── Static                   — /uploads served as static files
```

**Profile completion scoring:**
```
score = (filled_fields / 10_total_fields) × 100
fields = [name, phone, bio, location, github, linkedin, skills, cv, avatar, education/experience]
```

---

### 3.3 Job Service (Node.js / Express — Port 3003)

```
Job Service
├── Routes
│   ├── job.routes.js         — CRUD, my-jobs, stats
│   └── application.routes.js — apply, withdraw, status-update
└── Controllers
    ├── job.controller.js
    └── application.controller.js
```

**Application state machine:**
```
pending → reviewed → shortlisted → accepted
                   ↘ rejected
```

**Database constraint:** `UNIQUE(student_id, job_id)` — duplicate applications blocked at DB level.

---

### 3.4 Matching Service (Python / FastAPI — Port 8000)

```
Matching Service
├── main.py      — FastAPI app, CORS, Prometheus middleware, health endpoint
├── routes.py    — /api/match/jobs · /api/match/candidates/:id · /api/match/score
├── matcher.py   — JobMatcher class (TF-IDF + cosine similarity)
├── auth.py      — JWT verification (shared secret with Node services)
├── database.py  — psycopg2 connection pool
└── models.py    — Pydantic request/response schemas
```

**AI Algorithm:**
```
Step 1: Build student document
        text = bio + skills×3 + education + experience

Step 2: Build job document
        text = title + description + requirements + skills_required×3

Step 3: TF-IDF vectorisation
        vectoriser = TfidfVectorizer(ngram_range=(1,2), max_features=5000)
        matrix = vectoriser.fit_transform([student_doc] + [all_job_docs])

Step 4: Cosine similarity
        cosine_sim = cosine_similarity(matrix[0:1], matrix[1:])[0]

Step 5: Skill overlap (Jaccard recall)
        overlap = |student_skills ∩ job_skills| / |job_skills|

Step 6: Final score
        score = (0.6 × overlap + 0.4 × cosine_sim) × 100
```

**Skills weighted 3× in documents** to boost their TF-IDF contribution without changing the algorithm.  
**Fresh vectoriser per request** to avoid stale vocabulary drift in long-running service.

---

## 4. Deployment View (Kubernetes)

```
Kubernetes Cluster — Namespace: skilllink
│
├── auth-service        Deployment (2–5 replicas, HPA CPU 70%)
│   ├── service.yaml    ClusterIP :3001
│   └── hpa.yaml        autoscaling/v2
│
├── user-service        Deployment (2–5 replicas, HPA CPU 70%)
│   ├── service.yaml    ClusterIP :3002
│   └── hpa.yaml
│
├── job-service         Deployment (2–5 replicas, HPA CPU 70%)
│   ├── service.yaml    ClusterIP :3003
│   └── hpa.yaml
│
├── matching-service    Deployment (2–10 replicas, HPA CPU 70%)
│   ├── service.yaml    ClusterIP :8000
│   └── hpa.yaml        (max 10 — TF-IDF is CPU-intensive)
│
├── frontend            Deployment (2–5 replicas)
│   ├── service.yaml    ClusterIP :80
│   └── hpa.yaml
│
├── postgres            Deployment (1 replica — stateful)
│   └── service.yaml    ClusterIP :5432
│
├── ingress.yaml        Nginx Ingress Controller → routes to ClusterIP services
├── configmap.yaml      NODE_ENV, LOG_LEVEL, etc.
└── secrets.yaml        DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
```

**Rolling update strategy (all services):**
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0   # zero-downtime deployments
```

**Health probes:**
- Readiness: `GET /health` — 10s initial delay, 10s period
- Liveness: `GET /health` — 30s initial delay, 30s period

---

## 5. Module View (Dependency Structure)

```
frontend (React 18 SPA)
  └── api.ts (Axios)
        ├── authAPI      → POST /api/auth/...
        ├── studentAPI   → GET/PUT /api/users/...
        ├── jobAPI       → GET/POST /api/jobs/...
        ├── applicationAPI → POST /api/applications/...
        └── matchingAPI  → GET /api/match/...

auth-service
  └── auth.middleware.js  ← shared pattern replicated in user-service, job-service

user-service / job-service / matching-service
  └── all verify JWT with same JWT_SECRET (HS256, symmetric)

All services → PostgreSQL 16 (shared database, separate schemas by table name)
Auth-service → Redis 7 (refresh token blacklist lookups)
```

---

## 6. Quality Attributes

### 6.1 Performance
- **Matching service:** TF-IDF vectorisation runs as a single numpy matrix operation across all jobs — O(n) not O(n²)
- **GIN indexes** on `skills TEXT[]` and `skills_required TEXT[]` — O(log n) array containment queries
- **pg_trgm** extension on job descriptions — full-text search without external search engine
- **Redis** caching of token blacklist — O(1) revocation lookup

### 6.2 Scalability
- Each service scales independently via Kubernetes HPA
- Matching service allowed up to 10 replicas (others max 5) — reflects asymmetric load
- Nginx gateway handles connection pooling and GZIP before hitting services
- Stateless service design — no in-memory session state, all state in PostgreSQL/Redis

### 6.3 Availability
- `maxUnavailable: 0` rolling updates — zero downtime deployments
- Health probes restart failed pods automatically
- Liveness probe trigger: 30s initial → catches startup deadlocks without false positives
- 2 minimum replicas for every service — single pod failure doesn't cause outage

### 6.4 Security
- **HTTPS** via Nginx reverse proxy (TLS termination)
- **Helmet.js** — sets X-Frame-Options, X-XSS-Protection, X-Content-Type-Options
- **Rate limiting** — 100 req/15 min (auth), 200 req/15 min (user/job)
- **JWT HS256** — short-lived access tokens (15 min), refresh stored as bcrypt hash
- **RBAC** via `authorize(...roles)` middleware — role verified server-side on every request
- **Input validation** — express-validator chains on every mutating route
- **DB-level constraints** — UNIQUE, CHECK, FK enforced independent of application layer
- **Kubernetes Secrets** — credentials injected at runtime via `secretKeyRef`, not in images

### 6.5 Maintainability
- Each service has its own `package.json` / `requirements.txt` — no shared dependency hell
- Winston JSON logging on all Node services — structured, queryable in ELK/Loki
- Prometheus metrics on every service — performance regressions caught within 15 s scrape interval
- OpenAPI 3.0 spec and Postman collection — API contract documented and testable

---

## 7. Architectural Trade-offs

### Microservices vs Monolith

| Aspect | Microservices (chosen) | Monolith (alternative) |
|--------|----------------------|----------------------|
| Deployment complexity | High — 12 Docker containers | Low — single process |
| Independent scaling | ✅ Each service scales alone | ❌ Scale all or nothing |
| Technology freedom | ✅ Python for ML, Node for REST | ❌ One language |
| Network latency | ❌ Inter-service HTTP adds ~1–5 ms | ✅ In-process calls |
| Testing complexity | ❌ Requires service mocking | ✅ Single test suite |
| Fault isolation | ✅ One service fails, others run | ❌ One crash, full down |
| Team parallelism | ✅ Two devs own separate services | ❌ Merge conflicts |

### Shared Database vs Database-per-Service
We chose a **shared PostgreSQL instance** rather than a database per service. Rationale: matching service queries student profiles and jobs directly — cross-service joins are simpler with one DB. Trade-off: tighter coupling at the data layer; future work would introduce an event bus (Kafka) to allow true database isolation.

### TF-IDF vs Transformer Embeddings
TF-IDF was chosen over sentence transformers (BERT, etc.) because: no GPU requirement, deterministic results, no training data needed, sub-second inference per request. Trade-off: semantic understanding is shallow — "programmer" and "developer" are not seen as synonyms. Future work: embed skills using a pre-trained model like `all-MiniLM-L6-v2`.

---

## 8. Pros and Cons of Chosen Architecture

### Pros
1. **Independent deployability** — matching service can be updated without touching auth
2. **Right tool for each job** — FastAPI's async nature is ideal for IO-bound ML inference
3. **Battle-tested stack** — Express, FastAPI, PostgreSQL are well-documented
4. **Built-in observability** — Prometheus + Grafana auto-provisioned, 7 scrape targets
5. **Production-grade CI/CD** — Jenkins 8-stage pipeline with parallel builds and ≥80% coverage gate

### Cons
1. **Operational overhead** — 12 containers to manage, monitor, and update
2. **Shared database coupling** — cross-service data access bypasses service boundaries
3. **No event bus** — synchronous HTTP between services means no eventual consistency or event sourcing
4. **JWT symmetric key** — all services share the same secret; compromise of one exposes all
5. **No service mesh** — mTLS between services would require Istio/Linkerd (not implemented)

---

## 9. Architectural Design Process

Following the course methodology:

| Step | Activity | Output |
|------|----------|--------|
| 1 | Identify architectural drivers (requirements, constraints, quality goals) | Functional requirements, NFRs |
| 2 | Establish architectural style | Microservices justified above |
| 3 | Define service boundaries | 4 bounded domains: Auth, User, Job, Match |
| 4 | Design data model | 6-table PostgreSQL schema (see `database/init.sql`) |
| 5 | Define API contracts | OpenAPI 3.0 spec (`docs/openapi.yaml`) |
| 6 | Design infrastructure | Docker Compose → Kubernetes → Ansible provisioning |
| 7 | Define CI/CD pipeline | Jenkins 8-stage declarative pipeline |
| 8 | Instrument observability | Prometheus metrics + Grafana dashboards |
| 9 | Document trade-offs | Sections 7–8 above |
| 10 | Validate with tests | Unit tests + integration tests, ≥80% coverage |

---

*For UML diagrams (sequence, class, use case), see `SkillLink_Architecture_Document.docx` in the project deliverables.*
