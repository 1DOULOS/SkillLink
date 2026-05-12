# SkillLink — Monitoring Documentation

**Course:** SEN3244 Software Architecture | ICT University | Spring 2026  
**Stack:** Prometheus + Grafana + Node Exporter + PostgreSQL Exporter

---

## Architecture Overview

```
SkillLink Services                  Prometheus (:9090)       Grafana (:3004)
─────────────────                   ──────────────────       ──────────────
auth-service:3001/metrics  ─────→   scrape (15s)    ─────→  Dashboards
user-service:3002/metrics  ─────→   scrape (15s)            Alerts
job-service:3003/metrics   ─────→   scrape (15s)
matching-service:8000/metrics ──→   scrape (15s)
node-exporter:9100         ─────→   scrape (15s)
postgres-exporter:9187     ─────→   scrape (15s)
prometheus:9090            ─────→   scrape (15s) ← self-monitoring
```

**Scrape interval:** 15 seconds — tight enough to detect latency spikes within one interval  
**Grafana provisioning:** Auto-provisioned at startup via `grafana/provisioning/` — no manual dashboard import required  
**Access:** Grafana at `http://localhost:3004` | Credentials: `admin / skilllink2026`

---

## Metrics Catalogue

### 1. Application HTTP Metrics (all 4 services)

Each Node.js and Python service exports Prometheus metrics via the `/metrics` endpoint using `prom-client` (Node.js) and `prometheus-client` (Python).

#### Request Count Counter

| Metric | `skilllink_<service>_requests_total` |
|--------|-------------------------------------|
| Type | Counter (monotonically increasing) |
| Labels | `method` (GET/POST/PUT/DELETE), `endpoint` (path pattern), `status_code` (200/201/400/401/403/404/500) |
| Example | `skilllink_auth_requests_total{method="POST",endpoint="/api/auth/login",status_code="200"} 1428` |

**What to watch for:**
- Sudden drop in `status_code="200"` with spike in `status_code="500"` → service error
- Rising `status_code="429"` → rate limit being hit (potential DDoS or runaway client)
- Rising `status_code="401"` → token expiry issues or auth service problems

**Useful PromQL:**
```promql
# Request rate per service (req/s over 5 min)
rate(skilllink_auth_requests_total[5m])

# Error rate (5xx) percentage
rate(skilllink_job_requests_total{status_code=~"5.."}[5m])
  / rate(skilllink_job_requests_total[5m]) * 100

# 4xx rate (client errors) for matching service
rate(skilllink_matching_requests_total{status_code=~"4.."}[5m])
```

---

#### Request Duration Histogram

| Metric | `skilllink_<service>_request_duration_seconds` |
|--------|-----------------------------------------------|
| Type | Histogram |
| Labels | `method`, `endpoint` |
| Buckets | 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5 seconds |

**What to watch for:**
- p95 latency > 500 ms for auth/user/job → database query bottleneck
- p95 latency > 2 s for matching service → TF-IDF computation under heavy load
- Histogram bucket saturation (all requests in highest bucket) → service overload

**Useful PromQL:**
```promql
# p50 latency for auth service
histogram_quantile(0.50, rate(skilllink_auth_request_duration_seconds_bucket[5m]))

# p95 latency for matching service
histogram_quantile(0.95, rate(skilllink_matching_request_duration_seconds_bucket[5m]))

# p99 latency across all services
histogram_quantile(0.99, sum by (le, job) (
  rate(skilllink_auth_request_duration_seconds_bucket[5m])
))
```

---

### 2. System Metrics (Node Exporter — port 9100)

Node Exporter runs as a Docker container with host `/proc`, `/sys`, and `/` mounted read-only.

#### CPU

| Metric | `node_cpu_seconds_total` |
|--------|--------------------------|
| Labels | `cpu` (cpu0, cpu1...), `mode` (user, system, idle, iowait, steal) |

**Useful PromQL:**
```promql
# Overall CPU usage %
100 - (avg by (instance)(rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)

# I/O wait (disk bottleneck signal)
rate(node_cpu_seconds_total{mode="iowait"}[2m]) * 100
```

#### Memory

| Metric | Description |
|--------|-------------|
| `node_memory_MemTotal_bytes` | Total RAM |
| `node_memory_MemAvailable_bytes` | Available (free + reclaimable) |
| `node_memory_SwapUsed_bytes` | Swap in use |

**Useful PromQL:**
```promql
# Memory usage %
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100

# Alert if memory > 85%
(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100 > 85
```

**What to watch for:** Matching service loads scikit-learn models and full job datasets into RAM on each request — memory pressure indicates need to add replicas or implement model caching.

#### Disk

| Metric | `node_filesystem_avail_bytes`, `node_filesystem_size_bytes` |
|--------|-------------------------------------------------------------|

**Useful PromQL:**
```promql
# Disk free %
node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"} * 100
```

**What to watch for:** CV uploads (`/uploads` volume) — disk can fill silently. Alert if < 20% free.

#### Network

| Metric | `node_network_receive_bytes_total`, `node_network_transmit_bytes_total` |
|--------|-------------------------------------------------------------------------|

```promql
# Inbound bandwidth (bytes/s)
rate(node_network_receive_bytes_total{device="eth0"}[2m])

# Outbound bandwidth (bytes/s)
rate(node_network_transmit_bytes_total{device="eth0"}[2m])
```

---

### 3. Database Metrics (PostgreSQL Exporter — port 9187)

The `postgres-exporter` connects to PostgreSQL and exports database-internal metrics.

#### Active Connections

| Metric | `pg_stat_activity_count` |
|--------|--------------------------|
| Labels | `state` (active, idle, idle in transaction), `datname` |

**Useful PromQL:**
```promql
# Active queries right now
pg_stat_activity_count{state="active"}

# Connections stuck "idle in transaction" (leak signal)
pg_stat_activity_count{state="idle in transaction"}
```

**What to watch for:** Each Node.js service uses a `pg.Pool` with default max 10 connections. 40 total (4 services × 10) — if `pg_stat_activity_count` approaches PostgreSQL's `max_connections` (default 100), connection exhaustion will cause query failures.

#### Transaction Rate

| Metric | `pg_stat_database_xact_commit`, `pg_stat_database_xact_rollback` |
|--------|------------------------------------------------------------------|

```promql
# Commit rate per second
rate(pg_stat_database_xact_commit{datname="skilllink"}[1m])

# Rollback rate (error signal)
rate(pg_stat_database_xact_rollback{datname="skilllink"}[1m])
```

#### Table Scan Activity

| Metric | `pg_stat_user_tables_seq_scan`, `pg_stat_user_tables_idx_scan` |
|--------|---------------------------------------------------------------|

```promql
# Sequential scan ratio (high = missing index)
rate(pg_stat_user_tables_seq_scan[5m])
  / (rate(pg_stat_user_tables_seq_scan[5m]) + rate(pg_stat_user_tables_idx_scan[5m]))
```

**What to watch for:** A rising sequential scan ratio on the `jobs` or `applications` tables means the GIN indexes on `skills_required` are not being used — check query plans.

#### Dead Tuples (Vacuum Health)

| Metric | `pg_stat_user_tables_n_dead_tup` |
|--------|----------------------------------|

High dead tuple counts indicate VACUUM is not keeping up with UPDATE/DELETE activity — can cause table bloat and slower queries.

---

### 4. Self-Monitoring (Prometheus — port 9090)

Prometheus scrapes itself to expose its own health metrics.

| Metric | Description |
|--------|-------------|
| `prometheus_tsdb_head_samples_appended_total` | Samples ingested per second |
| `prometheus_rule_evaluation_duration_seconds` | Alert rule evaluation time |
| `up{job="<service>"}` | 1 = target reachable, 0 = scrape failed |

**Most important:**
```promql
# Is every service reachable?
up

# Alert if any target has been down for > 1 min
up == 0
```

---

## Grafana Dashboard

The pre-provisioned dashboard at `infrastructure/monitoring/grafana/dashboards/skilllink-dashboard.json` contains the following panels:

| Panel | Metric | Visualisation |
|-------|--------|---------------|
| Request Rate per Service | `rate(skilllink_*_requests_total[5m])` | Time series |
| p50 / p95 / p99 Latency | `histogram_quantile(...)` | Time series |
| Error Rate (5xx) | ratio of 5xx to total | Gauge + time series |
| Active DB Connections | `pg_stat_activity_count` | Gauge |
| CPU Usage % | `node_cpu_seconds_total` | Time series |
| Memory Usage % | `node_memory_*` | Gauge |
| Disk Free % | `node_filesystem_*` | Gauge |
| DB Transaction Rate | `pg_stat_database_xact_commit` | Time series |

---

## Alerting Rules (Recommended)

Add these to `infrastructure/monitoring/prometheus.yml` under `rule_files`:

```yaml
groups:
  - name: skilllink_alerts
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"

      - alert: HighErrorRate
        expr: rate(skilllink_auth_requests_total{status_code=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High 5xx error rate on auth-service"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(skilllink_matching_request_duration_seconds_bucket[5m])) > 3
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Matching service p95 latency > 3s"

      - alert: HighMemoryUsage
        expr: (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Server memory usage above 85%"
```

---

## Key Metrics Summary Table

| Metric Category | Key Signal | Alert Threshold |
|----------------|------------|-----------------|
| Request rate | Drop to zero | 0 req/min for > 1 min |
| Error rate (5xx) | > 5% of requests | > 5% over 2 min |
| p95 latency (auth/user/job) | > 500 ms | > 500 ms over 2 min |
| p95 latency (matching) | > 3 s | > 3 s over 2 min |
| CPU | > 80% sustained | > 80% over 5 min |
| Memory | > 85% | > 85% over 5 min |
| Disk | < 20% free | < 20% free |
| DB connections | > 80 active | > 80 |
| Service up | = 1 | = 0 for > 1 min |
