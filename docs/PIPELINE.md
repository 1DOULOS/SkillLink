# SkillLink — CI/CD Pipeline Documentation

**Course:** SEN3244 Software Architecture | ICT University | Spring 2026  
**Tool:** Jenkins Declarative Pipeline  
**File:** `infrastructure/jenkins/Jenkinsfile`

---

## Overview

SkillLink uses an **8-stage Jenkins declarative pipeline** that automates the complete software delivery lifecycle from source code to a running Kubernetes deployment. The pipeline is triggered on every push to the GitHub repository and enforces quality gates (≥80% code coverage) before any image is built or deployed.

```
GitHub Push
    │
    ▼
┌─────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  1.Checkout │ → │ 2.Install (parallel) │ → │   3.Lint (parallel)  │
└─────────────┘   └─────────────────────┘   └─────────────────────┘
                                                        │
    ┌───────────────────────────────────────────────────┘
    ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│  4.Test (parallel)  │ → │ 5.Build (parallel)  │ → │  6.Push Registry    │
│  ≥80% coverage gate │   │  docker build x5    │   │  (main/develop)     │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
                                                                │
    ┌───────────────────────────────────────────────────────────┘
    ▼
┌─────────────────────┐   ┌─────────────────────┐
│  7.Deploy K8s       │ → │  8.Smoke Tests       │
│  kubectl set image  │   │  curl /health x5     │
└─────────────────────┘   └─────────────────────┘
```

**Total timeout:** 30 minutes  
**Build history retained:** 10 most recent builds

---

## Stage-by-Stage Explanation

### Stage 1 — Checkout

```groovy
stage('Checkout') {
    steps {
        checkout scm
        script {
            env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
            env.IMAGE_TAG = "${env.BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"
        }
    }
}
```

**What it does:**
- Checks out the source code from the configured GitHub repository
- Generates a unique `IMAGE_TAG` combining the Jenkins build number and the short Git commit SHA (e.g., `42-a3f9d1c`)
- This tag is used for all Docker images in this build, ensuring full traceability: every image in production can be traced back to an exact commit

**Why this matters:** Immutable image tags prevent "latest" tag confusion and allow rollbacks to any previous build.

---

### Stage 2 — Install Dependencies (Parallel)

```groovy
stage('Install Dependencies') {
    parallel {
        stage('Auth Service')     { steps { dir('backend/auth-service')    { sh 'npm ci' } } }
        stage('User Service')     { steps { dir('backend/user-service')    { sh 'npm ci' } } }
        stage('Job Service')      { steps { dir('backend/job-service')     { sh 'npm ci' } } }
        stage('Matching Service') { steps { dir('backend/matching-service'){ sh 'pip install -r requirements.txt' } } }
        stage('Frontend')         { steps { dir('frontend')                { sh 'npm ci' } } }
    }
}
```

**What it does:**
- Installs dependencies for all 5 services **in parallel** — all 5 run simultaneously
- Uses `npm ci` (not `npm install`) — ci mode uses `package-lock.json` exactly, never resolves newer versions, and deletes `node_modules` first for a clean state
- Python uses `pip install -r requirements.txt` with pinned versions

**Why this matters:** Parallel execution cuts this stage from ~5 minutes to ~1 minute. `npm ci` guarantees reproducible builds — the same code always installs the same dependency versions.

---

### Stage 3 — Lint & Static Analysis (Parallel)

**What it does:**
- Runs ESLint on all Node.js services in parallel
- Runs flake8 (PEP 8 style checker) on the Python matching service
- Fails the build immediately if any lint error is found

**Why this matters:** Lint gates catch syntax errors and style violations before spending time on tests or builds. Failing fast here saves compute resources.

---

### Stage 4 — Test with Coverage Gate (Parallel)

```groovy
stage('Test') {
    parallel {
        stage('Auth')     { steps { dir('backend/auth-service')    { sh 'npm test -- --coverage --ci --forceExit' } } }
        stage('User')     { steps { dir('backend/user-service')    { sh 'npm test -- --coverage --ci --forceExit' } } }
        stage('Job')      { steps { dir('backend/job-service')     { sh 'npm test -- --coverage --ci --forceExit' } } }
        stage('Matching') { steps { dir('backend/matching-service'){ sh 'pytest tests/ -v --cov=app --cov-fail-under=80' } } }
        stage('Frontend') { steps { dir('frontend')                { sh 'npm test' } } }
    }
}
```

**What it does:**
- Runs all test suites in parallel — Jest for Node.js, pytest for Python, Vitest for React
- Enforces the **≥80% code coverage gate** configured in each service's Jest config (`coverageThreshold`) and pytest (`--cov-fail-under=80`)
- Runs both unit tests AND integration tests in a single pass

**Coverage thresholds (per Jest config):**

| Metric | Threshold |
|--------|-----------|
| Lines | 80% |
| Statements | 80% |
| Functions | 75% |
| Branches | 70% |

**Why this matters:** The coverage gate is the most important quality gate. A build that fails tests or drops below 80% coverage is **never promoted** to the build or deploy stages. This prevents regressions from reaching production.

---

### Stage 5 — Build Docker Images (Parallel)

```groovy
stage('Build Images') {
    parallel {
        // Builds all 5 service images simultaneously
        // Tags each as: skilllink/<service>:<IMAGE_TAG>
    }
}
```

**What it does:**
- Builds Docker images for all 5 services in parallel using their individual `Dockerfile`s
- Tags each image with the `IMAGE_TAG` from Stage 1 (e.g., `skilllink/auth-service:42-a3f9d1c`)

**Why this matters:** Parallel builds reduce wall-clock time. Each Dockerfile uses multi-layer caching — only changed layers are rebuilt.

---

### Stage 6 — Push to Container Registry

**What it does:**
- Pushes all built images to Docker Hub (or configured private registry)
- **Only runs on `main` or `develop` branches** — feature branches build and test but never push images
- Authenticates using Jenkins credentials (`docker-hub-credentials`) injected as environment variable — credentials never appear in logs

**Why this matters:** Separating "build" from "push" means pull requests get full test coverage without polluting the registry with unmerged code.

---

### Stage 7 — Deploy to Kubernetes

```groovy
stage('Deploy K8s') {
    steps {
        sh '''
          kubectl set image deployment/auth-service     auth-service=skilllink/auth-service:${IMAGE_TAG}     -n skilllink
          kubectl set image deployment/user-service     user-service=skilllink/user-service:${IMAGE_TAG}     -n skilllink
          kubectl set image deployment/job-service      job-service=skilllink/job-service:${IMAGE_TAG}       -n skilllink
          kubectl set image deployment/matching-service matching-service=skilllink/matching-service:${IMAGE_TAG} -n skilllink
          kubectl set image deployment/frontend         frontend=skilllink/frontend:${IMAGE_TAG}             -n skilllink
        '''
    }
}
```

**What it does:**
- Updates the running Kubernetes deployment with the new image tag
- Kubernetes performs a **RollingUpdate** automatically: `maxSurge: 1, maxUnavailable: 0` — a new pod must be ready before the old one is terminated, guaranteeing zero downtime
- `kubectl` is authenticated via the `kubeconfig` Jenkins credential

**Why this matters:** Rolling updates ensure the application never has zero running pods during a deployment, satisfying the availability quality attribute.

---

### Stage 8 — Smoke Tests

```groovy
stage('Smoke Tests') {
    steps {
        sh '''
          curl -f http://auth-service:3001/health
          curl -f http://user-service:3002/health
          curl -f http://job-service:3003/health
          curl -f http://matching-service:8000/health
          curl -f http://frontend:80/
        '''
    }
}
```

**What it does:**
- Hits the `/health` endpoint of each deployed service using `curl -f` (fails on non-2xx response)
- Verifies that the new pods have started, passed Kubernetes readiness probes, and are serving traffic

**Why this matters:** Smoke tests catch deployment-time failures (bad environment variables, missing secrets, DB connection errors) that unit tests cannot detect.

---

## Credentials Managed in Jenkins

| Credential ID | Type | Used in |
|---------------|------|---------|
| `docker-hub-credentials` | Username/Password | Stage 6: push to Docker Hub |
| `kubeconfig` | Secret file | Stage 7: kubectl authentication |
| `skilllink-db-url` | Secret text | Stage 4: integration test DB |
| `skilllink-jwt-secret` | Secret text | Stage 4: JWT signing in tests |
| `sonarqube-token` | Secret text | Stage 3: SonarQube static analysis |

All credentials are injected via `credentials()` binding — **never hardcoded** in the Jenkinsfile.

---

## Pipeline Summary

| Stage | Parallel | Gate | Purpose |
|-------|----------|------|---------|
| 1. Checkout | No | — | Get source, generate image tag |
| 2. Install | Yes (5) | — | Reproducible dependency install |
| 3. Lint | Yes (5) | Fail on lint error | Code quality |
| 4. Test | Yes (5) | **≥80% coverage** | Quality gate |
| 5. Build | Yes (5) | — | Create Docker images |
| 6. Push | No | main/develop only | Publish to registry |
| 7. Deploy | No | — | Rolling update on K8s |
| 8. Smoke | No | curl -f (fail on error) | Verify deployment |
