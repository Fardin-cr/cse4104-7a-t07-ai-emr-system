"""
Security Utilities for AI Medical Report Analysis and Patient Management System
- JWT Token issuance and verification
- Role-based Access Control (RBAC) dependencies
- Thread-safe Brute-force Login Rate Limiter (sliding 15-minute window)
"""

import os
import time
import threading
import datetime
from datetime import timezone, timedelta
from typing import Optional, List, Dict
import jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Secret configuration (Defaults to 64-character high-entropy secret; override with JWT_SECRET_KEY in production)
JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "meditrack-clinical-ai-emr-jwt-secret-key-production-2026-secure-32bytes"
)
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 hours

http_bearer = HTTPBearer(auto_error=False)


# ==============================================================================
# 1. JWT TOKEN MANAGEMENT
# ==============================================================================
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token containing user claims."""
    to_encode = data.copy()
    now_utc = datetime.datetime.now(timezone.utc)
    if expires_delta:
        expire = now_utc + expires_delta
    else:
        expire = now_utc + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode.update({
        "exp": expire,
        "iat": now_utc,
        "iss": "ai-emr-backend"
    })
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            issuer="ai-emr-backend"
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    request: Request,
    auth_header: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer)
) -> dict:
    """
    FastAPI Dependency to authenticate requests.
    Inspects Authorization: Bearer <token> header or ?token= query parameter.
    """
    token = None
    if auth_header and auth_header.credentials:
        token = auth_header.credentials
    else:
        # Fallback to query parameter (useful for file previews / window.open)
        token = request.query_params.get("token")
        
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    payload = decode_access_token(token)
    username = payload.get("sub")
    role = payload.get("role")
    if not username or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token claims.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    return {
        "username": username,
        "role": role,
        "claims": payload
    }


def require_role(allowed_roles: List[str]):
    """FastAPI Dependency for Role-Based Access Control (RBAC)."""
    async def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role in {allowed_roles}, but current role is '{user_role}'."
            )
        return current_user
    return role_checker


# ==============================================================================
# 2. BRUTE FORCE LOGIN RATE LIMITER
# ==============================================================================
class LoginRateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter.
    Limits failed login attempts per IP and/or username.
    Default: max 5 failed attempts per 15-minute sliding window.
    """
    def __init__(self, max_attempts: int = 5, window_seconds: int = 900):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.failed_attempts: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def _cleanup_old(self, key: str, now: float):
        cutoff = now - self.window_seconds
        self.failed_attempts[key] = [t for t in self.failed_attempts.get(key, []) if t > cutoff]

    def check_rate_limit(self, key: str):
        """Raises HTTP 429 if the key has exceeded max allowed failed attempts."""
        now = time.time()
        with self._lock:
            self._cleanup_old(key, now)
            history = self.failed_attempts.get(key, [])
            if len(history) >= self.max_attempts:
                oldest_in_window = min(history)
                retry_after = int(self.window_seconds - (now - oldest_in_window))
                minutes_remaining = max(1, (retry_after + 59) // 60)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many failed login attempts. Account temporarily locked. Please try again in {minutes_remaining} minute(s).",
                    headers={"Retry-After": str(max(1, retry_after))}
                )

    def record_failure(self, key: str):
        """Records a failed attempt."""
        now = time.time()
        with self._lock:
            self._cleanup_old(key, now)
            self.failed_attempts.setdefault(key, []).append(now)

    def reset_on_success(self, key: str):
        """Clears failed attempts upon successful login."""
        with self._lock:
            self.failed_attempts.pop(key, None)


login_rate_limiter = LoginRateLimiter(max_attempts=5, window_seconds=900)
