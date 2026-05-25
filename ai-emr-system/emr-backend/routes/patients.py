import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from typing import Optional
from database import get_db, log_action
import datetime, uuid

router = APIRouter(prefix="/patients", tags=["patients"])

BD_PHONE_RE = re.compile(r"^\+8801[3-9]\d{8}$")

def validate_bd_phone(phone: str) -> str:
    """Validate Bangladesh mobile number format: +8801XXXXXXXXX"""
    if not phone:
        return phone
    # Normalise: if starts with 01, prepend +880
    p = phone.strip()
    if re.match(r"^01[3-9]\d{8}$", p):
        p = "+880" + p
    if not BD_PHONE_RE.match(p):
        raise ValueError(
            "Phone must be a valid Bangladeshi mobile number (e.g. +8801717425136)"
        )
    return p

class PatientCreate(BaseModel):
    name: str
    age: Optional[int] = None
    sex: Optional[str] = None
    blood: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    doctor: Optional[str] = None
    emergency_contact: Optional[str] = None
    notes: Optional[str] = None

    @validator("name")
    def name_not_empty(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("Patient name cannot be empty")
        if len(v) > 200:
            raise ValueError("Patient name too long")
        return v

    @validator("age")
    def age_realistic(cls, v):
        if v is not None and (v < 0 or v > 150):
            raise ValueError("Age must be between 0 and 150")
        return v

    @validator("phone")
    def phone_valid(cls, v):
        if v:
            return validate_bd_phone(v)
        return v

class PatientUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    blood: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    doctor: Optional[str] = None
    emergency_contact: Optional[str] = None
    notes: Optional[str] = None

    @validator("phone")
    def phone_valid(cls, v):
        if v:
            return validate_bd_phone(v)
        return v

    @validator("age")
    def age_realistic(cls, v):
        if v is not None and (v < 0 or v > 150):
            raise ValueError("Age must be between 0 and 150")
        return v

def generate_emr_id(db) -> str:
    row = db.execute("SELECT id FROM patients ORDER BY rowid DESC LIMIT 1").fetchone()
    if not row:
        return "EMR-2026-0001"
    last = row["id"]
    try:
        num = int(last.split("-")[-1]) + 1
    except Exception:
        num = 1
    return f"EMR-2026-{str(num).zfill(4)}"

def get_patient_full(db, patient_id: str) -> dict:
    p = db.execute("SELECT * FROM patients WHERE id=?", (patient_id,)).fetchone()
    if not p:
        return None
    p = dict(p)
    reports = db.execute("SELECT * FROM reports WHERE patient_id=? ORDER BY date DESC", (patient_id,)).fetchall()
    report_list = []
    for r in reports:
        r = dict(r)
        values = db.execute("SELECT * FROM report_values WHERE report_id=?", (r["id"],)).fetchall()
        r["values"] = [dict(v) for v in values]
        report_list.append(r)
    p["reports"] = report_list
    return p

@router.get("")
def list_patients(search: str = ""):
    db = get_db()
    if search:
        rows = db.execute(
            """SELECT DISTINCT p.* FROM patients p
            LEFT JOIN reports r ON r.patient_id = p.id
            WHERE p.name LIKE ? OR p.id LIKE ? OR p.phone LIKE ? OR p.doctor LIKE ?
               OR r.lab_id LIKE ?
            ORDER BY p.rowid DESC""",
            (f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%")
        ).fetchall()
    else:
        rows = db.execute("SELECT * FROM patients ORDER BY rowid DESC").fetchall()

    result = []
    for row in rows:
        p = dict(row)
        reports = db.execute("SELECT * FROM reports WHERE patient_id=? ORDER BY date DESC", (p["id"],)).fetchall()
        report_list = []
        for r in reports:
            r = dict(r)
            values = db.execute("SELECT * FROM report_values WHERE report_id=?", (r["id"],)).fetchall()
            r["values"] = [dict(v) for v in values]
            report_list.append(r)
        p["reports"] = report_list
        result.append(p)

    db.close()
    return result

@router.get("/{patient_id}")
def get_patient(patient_id: str):
    db = get_db()
    p = get_patient_full(db, patient_id)
    db.close()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    return p

@router.post("")
def create_patient(data: PatientCreate):
    db = get_db()
    emr_id = generate_emr_id(db)
    now = datetime.date.today().isoformat()
    db.execute(
        "INSERT INTO patients VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (emr_id, data.name, data.age, data.sex, data.blood,
         data.phone, data.address, data.doctor,
         data.emergency_contact, data.notes, now)
    )
    log_action(db, "patient_registered", detail=f"Registered patient {emr_id}: {data.name}")
    db.commit()
    p = get_patient_full(db, emr_id)
    db.close()
    return p

@router.put("/{patient_id}")
def update_patient(patient_id: str, data: PatientUpdate):
    db = get_db()
    p = db.execute("SELECT * FROM patients WHERE id=?", (patient_id,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(status_code=404, detail="Patient not found")
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if updates:
        sets = ", ".join(f"{k}=?" for k in updates)
        db.execute(f"UPDATE patients SET {sets} WHERE id=?", (*updates.values(), patient_id))
        log_action(db, "patient_updated", detail=f"Updated patient {patient_id}")
        db.commit()
    p = get_patient_full(db, patient_id)
    db.close()
    return p

@router.delete("/{patient_id}")
def delete_patient(patient_id: str):
    db = get_db()
    p = db.execute("SELECT name FROM patients WHERE id=?", (patient_id,)).fetchone()
    if not p:
        db.close()
        raise HTTPException(status_code=404, detail="Patient not found")
    db.execute("DELETE FROM patients WHERE id=?", (patient_id,))
    log_action(db, "patient_deleted", detail=f"Deleted patient {patient_id}: {p['name']}")
    db.commit()
    db.close()
    return {"success": True, "message": f"Patient {patient_id} deleted"}