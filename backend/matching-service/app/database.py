"""
Database connection pool and utility helpers for the SkillLink Matching Service.

Uses psycopg2 ThreadedConnectionPool to reuse connections efficiently across
FastAPI worker threads. All query results are returned as plain dicts via
RealDictCursor so the rest of the application never has to deal with row objects.
"""

import logging
from contextlib import contextmanager
from typing import Any, Generator, List, Optional

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Connection pool – created once at import time, reused for every request.
# ---------------------------------------------------------------------------

_pool: Optional[ThreadedConnectionPool] = None


def _get_pool() -> ThreadedConnectionPool:
    """Return (or lazily create) the shared connection pool."""
    global _pool
    if _pool is None or _pool.closed:
        try:
            _pool = ThreadedConnectionPool(
                minconn=1,
                maxconn=10,
                dsn=settings.DATABASE_URL,
            )
            logger.info("PostgreSQL connection pool created successfully.")
        except psycopg2.OperationalError as exc:
            logger.error("Failed to create PostgreSQL connection pool: %s", exc)
            raise
    return _pool


def close_pool() -> None:
    """Close all connections in the pool (call at application shutdown)."""
    global _pool
    if _pool and not _pool.closed:
        _pool.closeall()
        logger.info("PostgreSQL connection pool closed.")


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


@contextmanager
def get_db_connection() -> Generator[psycopg2.extensions.connection, None, None]:
    """
    Context manager that acquires a connection from the pool and releases it
    when the block exits (even on error).

    Usage::

        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT 1")
    """
    pool = _get_pool()
    conn = pool.getconn()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def execute_query(
    sql: str,
    params: Optional[tuple] = None,
    *,
    fetch_all: bool = True,
) -> List[dict]:
    """
    Execute *sql* with optional *params* and return results as a list of dicts.

    Parameters
    ----------
    sql:
        The SQL statement to execute.
    params:
        Optional tuple of positional parameters (``%s`` placeholders).
    fetch_all:
        When ``True`` (default) returns all rows via ``fetchall()``.
        Set to ``False`` to return at most one row (``fetchone()``
        wrapped in a list, or empty list if no row found).

    Returns
    -------
    list[dict]
        Each row is a plain ``dict`` keyed by column name.
        Returns an empty list when no rows are found.
    """
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)

            # DDL / DML statements have no result set
            if cur.description is None:
                conn.commit()
                return []

            if fetch_all:
                rows = cur.fetchall()
            else:
                row = cur.fetchone()
                rows = [row] if row is not None else []

            # RealDictRow is subscriptable but not a plain dict – normalise.
            return [dict(row) for row in rows]


def execute_one(sql: str, params: Optional[tuple] = None) -> Optional[dict]:
    """
    Convenience wrapper around :func:`execute_query` that returns either the
    first matching row as a dict, or ``None`` if no rows were found.
    """
    rows = execute_query(sql, params, fetch_all=False)
    return rows[0] if rows else None


def test_connection() -> bool:
    """
    Attempt a trivial query to verify connectivity.
    Returns ``True`` on success, ``False`` otherwise.
    """
    try:
        rows = execute_query("SELECT 1 AS ok")
        return bool(rows and rows[0].get("ok") == 1)
    except Exception as exc:
        logger.error("Database connectivity test failed: %s", exc)
        return False
