"""
JWT authentication helpers for the SkillLink Matching Service.

Provides:
- ``get_current_user``  – FastAPI dependency that validates a Bearer token and
  returns the decoded user payload as a dict.
- ``require_role``      – dependency factory that additionally checks the
  caller's role.
"""

import logging
from typing import Any, Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import ExpiredSignatureError, JWTError, jwt

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OAuth2 scheme – expects "Authorization: Bearer <token>" header
# ---------------------------------------------------------------------------

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# JWT algorithm used by all SkillLink services
ALGORITHM = "HS256"


# ---------------------------------------------------------------------------
# Core dependency
# ---------------------------------------------------------------------------


async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    """
    FastAPI dependency.  Decodes and verifies the JWT in the Authorization
    header.

    Returns
    -------
    dict
        ``{ "id": str, "email": str, "role": str, ... }``

    Raises
    ------
    HTTPException 401
        When the token is missing, expired, or otherwise invalid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload: Dict[str, Any] = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[ALGORITHM],
        )
    except ExpiredSignatureError:
        logger.warning("Rejected expired JWT token.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as exc:
        logger.warning("JWT decode error: %s", exc)
        raise credentials_exception

    # Validate required claims
    user_id: str | None = payload.get("id") or payload.get("sub")
    email: str | None = payload.get("email")
    role: str | None = payload.get("role")

    if not user_id or not email or not role:
        logger.warning("JWT payload missing required claims: %s", payload)
        raise credentials_exception

    return {
        "id": str(user_id),
        "email": email,
        "role": role,
        # Pass through any extra claims (e.g. first_name) for convenience
        **{k: v for k, v in payload.items() if k not in ("id", "sub", "email", "role")},
    }


# ---------------------------------------------------------------------------
# Role-based dependency factory
# ---------------------------------------------------------------------------


def require_role(*roles: str):
    """
    Dependency factory that ensures the authenticated user has one of the
    specified *roles*.

    Usage::

        @router.get("/admin-only", dependencies=[Depends(require_role("admin"))])
        async def admin_endpoint(): ...

        # Or inject the user at the same time:
        @router.get("/recruiter-thing")
        async def recruiter_endpoint(user = Depends(require_role("recruiter", "admin"))): ...

    Parameters
    ----------
    *roles:
        Allowed role strings, e.g. ``"student"``, ``"recruiter"``, ``"admin"``.

    Returns
    -------
    Callable
        An async FastAPI dependency that returns the current user dict when
        the role check passes, or raises HTTP 403 otherwise.
    """

    async def _check_role(
        current_user: Dict[str, Any] = Depends(get_current_user),
    ) -> Dict[str, Any]:
        if current_user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Required role(s): {', '.join(roles)}. "
                    f"Your role: {current_user['role']}"
                ),
            )
        return current_user

    return _check_role
