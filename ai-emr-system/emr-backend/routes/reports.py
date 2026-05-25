import os
import datetime
import tempfile
import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, validator
from typing import Optional, List
from database import get_db, log_action
from utils.extractor import extract_from_pdf, extract_from_image_file
from utils.storage import upload_report_file, get_report_file_path, delete_file, REPORTS_BUCKET

router = APIRouter(prefix="/reports", tags=["reports"])

DEFAULT_LAB          = os.getenv("DEFAULT_LAB_NAME", "Nashman Institute")
VALID_EDITOR_ROLES   = ("admin", "doctor", "technician")
IMAGE_EXTS           = (".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp")


class ReportValue(BaseModel):
    name: str
    value: Optional[float] = None
    value_text: Optional[str] = None
    unit: Optional[str] = None
    ref_min: Optional[float] = None
    ref_max: Optional[float] = None
    status: Optional[str] = "Needs Review"
    abnormal: bool = False

    @validator("value", pre=True)
    def coerce_value(cls, v):
        if v is None: return None
        try: return float(str(v).lstrip("<>"))
        except (ValueError, TypeError): return None


class EditValuesRequest(BaseModel):
    values: List[ReportValue]
    editor_role: str


@router.get("/check-lab-id")
def check_lab_id(lab_id: str = ""):
    """Real-time lab ID uniqueness check for frontend validation."""
    if not lab_id.strip():
        return {"exists": False}
    db = get_db()
    row = db.execute(
        """SELECT r.id, r.patient_id, p.name as patient_name
           FROM reports r
           LEFT JOIN patients p ON p.id = r.patient_id
           WHERE r.lab_id = ? AND r.lab_id != ''""",
        (lab_id.strip(),)
    ).fetchone()
    db.close()
    if row:
        return {"exists": True, "report_id": row["id"], "patient_id": row["patient_id"], "patient_name": row["patient_name"]}
    return {"exists": False}


@router.post("/upload")
async def upload_report(
    patient_id:  str = Form(...),
    report_type: str = Form(...),
    lab:         str = Form(""),
    lab_id:      str = Form(""),
    date:        str = Form(""),
    time:        str = Form(""),
    patient_sex: str = Form("Female"),
    patient_age: str = Form(""),
    file: UploadFile = File(...)
):
    # Read file into memory
    file_bytes = await file.read()
    ext        = os.path.splitext(file.filename)[1].lower()

    # Write to temp file for extraction (extractor needs a file path)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    tmp.write(file_bytes)
    tmp.close()

    try:
        is_image  = ext in IMAGE_EXTS
        age_val   = None
        try: age_val = int(patient_age) if patient_age else None
        except ValueError: pass

        if is_image:
            extracted = extract_from_image_file(tmp.name, patient_sex)
        else:
            extracted = extract_from_pdf(tmp.name, patient_sex)
    finally:
        try: os.unlink(tmp.name)
        except Exception: pass

    # Upload to storage (Supabase or local)
    stored = upload_report_file(file_bytes, file.filename)

    final_type   = report_type or extracted.get("report_type", "Other")
    final_lab    = lab or extracted.get("lab_name", DEFAULT_LAB) or DEFAULT_LAB
    final_lab_id = lab_id or extracted.get("lab_id", "")
    final_date   = date or extracted.get("test_date", datetime.date.today().isoformat())
    bd_time = datetime.datetime.utcnow() + datetime.timedelta(hours=6)
    final_time   = time or bd_time.strftime("%I:%M %p")

    db        = get_db()
    report_id = f"R{str(uuid.uuid4())[:8].upper()}"
    now       = datetime.datetime.now().isoformat()

    # Enforce lab_id uniqueness (if provided)
    if final_lab_id:
        existing = db.execute(
            "SELECT id, patient_id FROM reports WHERE lab_id = ? AND lab_id != ''",
            (final_lab_id,)
        ).fetchone()
        if existing:
            db.close()
            raise HTTPException(
                status_code=409,
                detail=f"Lab ID '{final_lab_id}' already exists (report {existing['id']} for patient {existing['patient_id']}). Each report must have a unique Lab ID."
            )

    db.execute(
        "INSERT INTO reports (id,patient_id,type,date,time,lab,lab_id,pdf_name,pdf_path,storage_url,edited_by,edited_at,created_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (report_id, patient_id, final_type, final_date, final_time,
         final_lab, final_lab_id, file.filename,
         stored["filepath"], stored.get("storage_url"), None, None, now)
    )

    for v in extracted.get("values", []):
        val_num = v.get("value")
        if val_num is not None:
            try: val_num = float(str(val_num).lstrip("<>"))
            except (TypeError, ValueError): val_num = None
        status   = v.get("status", "Needs Review")
        abnormal = 1 if v.get("abnormal") or status not in ("Normal",) else 0
        db.execute(
            "INSERT INTO report_values (report_id,name,value,value_text,unit,ref_min,ref_max,status,abnormal) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (report_id, v.get("name",""), val_num,
             v.get("value_text") or (str(val_num) if val_num is not None else ""),
             v.get("unit",""), v.get("ref_min"), v.get("ref_max"), status, abnormal)
        )

    log_action(db, "report_uploaded",
               detail=f"Uploaded {final_type} report {report_id} for {patient_id}")
    db.commit()

    report      = db.execute("SELECT * FROM reports WHERE id=?", (report_id,)).fetchone()
    vals        = db.execute("SELECT * FROM report_values WHERE report_id=?", (report_id,)).fetchall()
    report      = dict(report)
    report["values"]            = [dict(v) for v in vals]
    report["extraction_note"]   = extracted.get("note", "")
    report["extraction_error"]  = extracted.get("error", "")
    report["extraction_method"] = extracted.get("_method", "")
    report["model_used"]        = extracted.get("_model", "")
    report["escalated"]         = extracted.get("_escalated", False)
    db.close()
    return report


@router.get("/{report_id}")
def get_report(report_id: str):
    db = get_db()
    r = db.execute("SELECT * FROM reports WHERE id=?", (report_id,)).fetchone()
    if not r: raise HTTPException(404, "Report not found")
    r    = dict(r)
    vals = db.execute("SELECT * FROM report_values WHERE report_id=?", (report_id,)).fetchall()
    r["values"] = [dict(v) for v in vals]
    db.close()
    return r


@router.put("/{report_id}/values")
def edit_report_values(report_id: str, req: EditValuesRequest):
    if req.editor_role not in VALID_EDITOR_ROLES:
        raise HTTPException(403, "Only doctors, technicians and admins can edit values")

    db = get_db()
    r  = db.execute("SELECT * FROM reports WHERE id=?", (report_id,)).fetchone()
    if not r: db.close(); raise HTTPException(404, "Report not found")

    db.execute("DELETE FROM report_values WHERE report_id=?", (report_id,))
    for v in req.values:
        val_num = v.value
        status  = v.status or "Needs Review"
        if val_num is not None and v.ref_min is not None and v.ref_max is not None:
            if val_num < v.ref_min:   status = "Low"
            elif val_num > v.ref_max: status = "High"
            else:                     status = "Normal"
        abnormal = 1 if status not in ("Normal",) else 0
        db.execute(
            "INSERT INTO report_values (report_id,name,value,value_text,unit,ref_min,ref_max,status,abnormal) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (report_id, v.name, val_num,
             v.value_text or (str(val_num) if val_num is not None else ""),
             v.unit, v.ref_min, v.ref_max, status, abnormal)
        )

    now = datetime.datetime.now().isoformat()
    db.execute("UPDATE reports SET edited_by=?, edited_at=? WHERE id=?",
               (req.editor_role, now, report_id))
    log_action(db, "report_values_edited", role=req.editor_role,
               detail=f"Edited values in report {report_id}")
    db.commit()

    updated      = dict(db.execute("SELECT * FROM reports WHERE id=?", (report_id,)).fetchone())
    vals         = db.execute("SELECT * FROM report_values WHERE report_id=?", (report_id,)).fetchall()
    updated["values"] = [dict(v) for v in vals]
    db.close()
    return updated


@router.delete("/{report_id}")
def delete_report(report_id: str):
    db = get_db()
    r  = db.execute("SELECT * FROM reports WHERE id=?", (report_id,)).fetchone()
    if not r: db.close(); raise HTTPException(404, "Report not found")

    # Delete file from storage (Supabase or local)
    delete_file(r.get("pdf_path",""), r.get("storage_url"), REPORTS_BUCKET)

    log_action(db, "report_deleted", detail=f"Deleted report {report_id}")
    db.execute("DELETE FROM report_values WHERE report_id=?", (report_id,))
    db.execute("DELETE FROM reports WHERE id=?", (report_id,))
    db.commit()
    db.close()
    return {"success": True}


@router.get("/{report_id}/pdf")
def get_pdf(report_id: str):
    db = get_db()
    r  = db.execute("SELECT * FROM reports WHERE id=?", (report_id,)).fetchone()
    db.close()
    if not r: raise HTTPException(404, "Report not found")

    # If stored in Supabase — redirect to public URL
    if r.get("storage_url"):
        return RedirectResponse(url=r["storage_url"])

    # Local file — detect media type and serve inline
    local = get_report_file_path(r.get("pdf_path",""))
    if not local or not os.path.isfile(local):
        raise HTTPException(404, "File not available. This report was uploaded before cloud storage was configured. Please re-upload the report.")
    from fastapi.responses import Response
    pdf_name = r.get("pdf_name", "report.pdf")
    ext = os.path.splitext(pdf_name)[1].lower()
    media_types = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".bmp": "image/bmp",
        ".tiff": "image/tiff", ".webp": "image/webp",
    }
    media_type = media_types.get(ext, "application/octet-stream")
    with open(local, "rb") as f:
        file_bytes = f.read()
    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f"inline; filename={pdf_name}"}
    )