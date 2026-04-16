"""
SkillLink Matching Service – FastAPI application entry point.

Responsibilities
----------------
* Assemble the FastAPI application (CORS, routes, Prometheus metrics).
* Verify the database connection on startup.
* Expose /health and / convenience endpoints.
* Mount the Prometheus ASGI app at /metrics.
"""

import logging
import time
from typing import Any, Dict

import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Histogram,
    generate_latest,
    make_asgi_app,
)
from starlette.routing import Mount

from app.config import settings
from app.database import close_pool, test_connection
from app.models import HealthResponse, RootResponse
from app.routes import router

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prometheus metrics
# ---------------------------------------------------------------------------

REQUEST_COUNT = Counter(
    "skilllink_matching_requests_total",
    "Total HTTP requests handled by the matching service",
    labelnames=["method", "endpoint", "status_code"],
)

REQUEST_DURATION = Histogram(
    "skilllink_matching_request_duration_seconds",
    "HTTP request latency for the matching service",
    labelnames=["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

# Record startup time for uptime reporting
_START_TIME: float = time.monotonic()


def create_app() -> FastAPI:
    """Build and return the configured FastAPI application."""

    app = FastAPI(
        title="SkillLink Matching Service",
        version="1.0.0",
        description=(
            "AI-powered job–candidate matching service using TF-IDF "
            "and cosine similarity."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # ------------------------------------------------------------------
    # CORS
    # ------------------------------------------------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],        # Restrict in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ------------------------------------------------------------------
    # Prometheus instrumentation middleware
    # ------------------------------------------------------------------

    @app.middleware("http")
    async def prometheus_middleware(request: Request, call_next):
        # Normalise endpoint label (strip query string, collapse IDs)
        endpoint = request.url.path
        method = request.method

        start = time.monotonic()
        response: Response = await call_next(request)
        duration = time.monotonic() - start

        REQUEST_COUNT.labels(
            method=method,
            endpoint=endpoint,
            status_code=str(response.status_code),
        ).inc()
        REQUEST_DURATION.labels(method=method, endpoint=endpoint).observe(duration)

        return response

    # ------------------------------------------------------------------
    # Routes
    # ------------------------------------------------------------------
    app.include_router(router)

    # ------------------------------------------------------------------
    # Prometheus /metrics endpoint
    # ------------------------------------------------------------------
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

    # ------------------------------------------------------------------
    # Startup / shutdown lifecycle
    # ------------------------------------------------------------------

    @app.on_event("startup")
    async def on_startup() -> None:
        logger.info("Starting %s v%s on port %d …", settings.APP_NAME, settings.APP_VERSION, settings.PORT)
        if test_connection():
            logger.info("Database connectivity: OK")
        else:
            logger.warning(
                "Database connectivity check FAILED – the service will start "
                "but queries may fail until the database is reachable."
            )

    @app.on_event("shutdown")
    async def on_shutdown() -> None:
        logger.info("Shutting down %s – releasing DB connections …", settings.APP_NAME)
        close_pool()

    # ------------------------------------------------------------------
    # Built-in endpoints
    # ------------------------------------------------------------------

    @app.get(
        "/health",
        response_model=HealthResponse,
        tags=["system"],
        summary="Service health check",
    )
    async def health() -> Dict[str, Any]:
        uptime = time.monotonic() - _START_TIME
        return {
            "status": "ok",
            "service": "matching-service",
            "uptime": round(uptime, 2),
            "version": settings.APP_VERSION,
        }

    @app.get(
        "/",
        response_model=RootResponse,
        tags=["system"],
        summary="Service root",
    )
    async def root() -> Dict[str, Any]:
        return {
            "message": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs",
        }

    return app


# ---------------------------------------------------------------------------
# Application instance
# ---------------------------------------------------------------------------

app: FastAPI = create_app()

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info",
    )
