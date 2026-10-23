from fastapi import APIRouter, HTTPException, Request, Depends, status
from pydantic import BaseModel
from typing import Optional
from database import get_db, hash_password, verify_password, log_action
from utils.security import (
    create_access_token,
    get_current_user,
    require_role,
    login_rate_limiter
)
import datetime

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    role: str
    new_password: str
    editor_role: Optional[str] = None   # who is making the change (admin can change any)

class EmergencyResetRequest(BaseModel):
    master_code: str
    new_password: str

class UpdateMasterCodeRequest(BaseModel):
    current_master_code: str
    new_master_code: str

VALID_ROLES = ("admin", "doctor")

def get_master_code(db) -> str:
    row = db.execute("SELECT value FROM system_settings WHERE key='master_code'").fetchone()
    if row:
        return row["value"]
    import os
    return os.getenv("MASTER_CODE", "CLINIC-2026-MASTER")


@router.post("/login")
def login(req: LoginRequest, request: Request):
    # ── 1. Brute-force rate limiting check ────────────────────────────────────
    client_ip = request.client.host if request and request.client else "unknown"
    rate_limit_key = f"{client_ip}:{req.username.strip().lower()}"
    login_rate_limiter.check_rate_limit(rate_limit_key)

    db = get_db()
    row = db.execute(
        "SELECT * FROM credentials WHERE username=?",
        (req.username.strip(),)
    ).fetchone()

    # ── 2. Credential verification ────────────────────────────────────────────
    if not row or not verify_password(req.password, row["password"]):
        login_rate_limiter.record_failure(rate_limit_key)
        log_action(db, "login_failed", detail=f"Failed login attempt for username: {req.username[:50]} from IP: {client_ip}")
        db.commit()
        db.close()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    # ── 3. Reset rate limiter on successful authentication ────────────────────
    login_rate_limiter.reset_on_success(rate_limit_key)

    # ── 4. Auto-upgrade legacy password to Bcrypt ($2b$) ─────────────────────
    current_pwd_hash = row["password"] or ""
    if not current_pwd_hash.startswith("$2b$"):
        db.execute("UPDATE credentials SET password=? WHERE role=?", (hash_password(req.password), row["role"]))

    log_action(db, "login", role=row["role"], username=row["username"], detail=f"Login successful from {client_ip}")
    db.commit()
    db.close()

    # ── 5. Generate secure JWT token ──────────────────────────────────────────
    access_token = create_access_token({
        "sub": row["username"],
        "role": row["role"]
    })

    return {
        "success": True,
        "role": row["role"],
        "username": row["username"],
        "token": access_token,
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.get("/me")
def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """Validates the currently active JWT session."""
    return {
        "username": current_user["username"],
        "role": current_user["role"],
        "authenticated": True
    }


@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    if req.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    # Doctors can only change their own password; Admin can change any
    if current_user["role"] != "admin" and current_user["role"] != req.role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are only authorized to change your own password."
        )

    db = get_db()
    r = db.execute("SELECT * FROM credentials WHERE role=?", (req.role,)).fetchone()
    if not r:
        db.close()
        raise HTTPException(status_code=404, detail="Role not found")

    db.execute("UPDATE credentials SET password=? WHERE role=?", (hash_password(req.new_password), req.role))
    log_action(db, "change_password", role=current_user["role"], username=current_user["username"],
               detail=f"Password changed for role: {req.role}")
    db.commit()
    db.close()
    return {"success": True, "message": f"{req.role} password updated"}


@router.post("/emergency-reset")
def emergency_reset(req: EmergencyResetRequest, request: Request):
    """Emergency Admin Password Reset protected by master backup code."""
    client_ip = request.client.host if request and request.client else "unknown"
    rate_limit_key = f"emergency:{client_ip}"
    login_rate_limiter.check_rate_limit(rate_limit_key)

    db = get_db()
    master = get_master_code(db)
    if req.master_code != master:
        login_rate_limiter.record_failure(rate_limit_key)
        log_action(db, "emergency_reset_failed", detail=f"Wrong master code used from {client_ip}")
        db.commit()
        db.close()
        raise HTTPException(status_code=403, detail="Invalid master backup code")
    if len(req.new_password) < 6:
        db.close()
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    login_rate_limiter.reset_on_success(rate_limit_key)
    db.execute("UPDATE credentials SET password=? WHERE role='admin'", (hash_password(req.new_password),))
    log_action(db, "emergency_reset", role="admin", detail="Admin password reset via master code")
    db.commit()
    db.close()
    return {"success": True, "message": "Admin password reset successfully"}


@router.post("/update-master-code")
def update_master_code(
    req: UpdateMasterCodeRequest,
    current_user: dict = Depends(require_role(["admin"]))
):
    db = get_db()
    current = get_master_code(db)
    if req.current_master_code != current:
        log_action(db, "master_code_change_failed", detail=f"Wrong current master code attempt by {current_user['username']}")
        db.commit()
        db.close()
        raise HTTPException(status_code=403, detail="Current master code is incorrect")
    if len(req.new_master_code) < 8:
        db.close()
        raise HTTPException(status_code=400, detail="Master code must be at least 8 characters")

    now = datetime.datetime.now().isoformat()
    db.execute("INSERT OR REPLACE INTO system_settings VALUES ('master_code', ?, ?)", (req.new_master_code, now))
    log_action(db, "master_code_updated", role="admin", username=current_user["username"], detail="Master backup code updated")
    db.commit()
    db.close()
    return {"success": True, "message": "Master code updated"}


@router.get("/credentials")
def get_credentials(current_user: dict = Depends(get_current_user)):
    db = get_db()
    rows = db.execute("SELECT role, username FROM credentials").fetchall()
    db.close()
    return [dict(r) for r in rows]


@router.get("/audit-log")
def get_audit_log(
    limit: int = 100,
    current_user: dict = Depends(require_role(["admin"]))
):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]
