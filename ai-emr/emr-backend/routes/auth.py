from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from database import get_db, hash_password, verify_password, log_action
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
def login(req: LoginRequest, request: Request = None):
    db = get_db()
    row = db.execute(
        "SELECT * FROM credentials WHERE username=?",
        (req.username.strip(),)
    ).fetchone()

    if not row or not verify_password(req.password, row["password"]):
        log_action(db, "login_failed", detail=f"Failed login for username: {req.username[:50]}")
        db.commit()
        db.close()
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Migrate plain-text password to hash on login
    if ":" not in (row["password"] or ""):
        db.execute("UPDATE credentials SET password=? WHERE role=?", (hash_password(req.password), row["role"]))

    log_action(db, "login", role=row["role"], username=row["username"], detail="Login successful")
    db.commit()
    db.close()

    return {
        "success": True,
        "role": row["role"],
        "username": row["username"]
    }

@router.post("/change-password")
def change_password(req: ChangePasswordRequest):
    if req.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    db = get_db()
    r = db.execute("SELECT * FROM credentials WHERE role=?", (req.role,)).fetchone()
    if not r:
        db.close()
        raise HTTPException(status_code=404, detail="Role not found")

    db.execute("UPDATE credentials SET password=? WHERE role=?", (hash_password(req.new_password), req.role))
    log_action(db, "change_password", role=req.editor_role or req.role, username=r["username"],
               detail=f"Password changed for role: {req.role}")
    db.commit()
    db.close()
    return {"success": True, "message": f"{req.role} password updated"}

@router.post("/emergency-reset")
def emergency_reset(req: EmergencyResetRequest):
    db = get_db()
    master = get_master_code(db)
    if req.master_code != master:
        log_action(db, "emergency_reset_failed", detail="Wrong master code used")
        db.commit()
        db.close()
        raise HTTPException(status_code=403, detail="Invalid master backup code")
    if len(req.new_password) < 6:
        db.close()
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    db.execute("UPDATE credentials SET password=? WHERE role='admin'", (hash_password(req.new_password),))
    log_action(db, "emergency_reset", role="admin", detail="Admin password reset via master code")
    db.commit()
    db.close()
    return {"success": True, "message": "Doctor password reset successfully"}

@router.post("/update-master-code")
def update_master_code(req: UpdateMasterCodeRequest):
    db = get_db()
    current = get_master_code(db)
    if req.current_master_code != current:
        log_action(db, "master_code_change_failed", detail="Wrong current master code")
        db.commit()
        db.close()
        raise HTTPException(status_code=403, detail="Current master code is incorrect")
    if len(req.new_master_code) < 8:
        db.close()
        raise HTTPException(status_code=400, detail="Master code must be at least 8 characters")

    now = datetime.datetime.now().isoformat()
    db.execute("INSERT OR REPLACE INTO system_settings VALUES ('master_code', ?, ?)", (req.new_master_code, now))
    log_action(db, "master_code_updated", role="admin", detail="Master backup code updated")
    db.commit()
    db.close()
    return {"success": True, "message": "Master code updated"}

@router.get("/credentials")
def get_credentials():
    db = get_db()
    rows = db.execute("SELECT role, username FROM credentials").fetchall()
    db.close()
    return [dict(r) for r in rows]

@router.get("/audit-log")
def get_audit_log(limit: int = 100):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    db.close()
    return [dict(r) for r in rows]