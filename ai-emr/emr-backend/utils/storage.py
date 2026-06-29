"""
AI-Based Medical Report Analysis — File Storage Layer
- Local filesystem for local development (no config needed)
- Supabase Storage for production (set SUPABASE_URL and SUPABASE_SERVICE_KEY)
"""
import os
import uuid

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_KEY)

REPORTS_BUCKET = os.getenv("SUPABASE_REPORTS_BUCKET", "lab-reports")

BASE_DIR    = os.path.dirname(os.path.dirname(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)


def _mime_type(ext: str) -> str:
    return {
        ".pdf":  "application/pdf",
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png":  "image/png",
        ".bmp":  "image/bmp",
        ".tiff": "image/tiff",
        ".webp": "image/webp",
    }.get(ext, "application/octet-stream")


def _supabase_client():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def upload_report_file(file_bytes: bytes, original_filename: str) -> dict:
    ext      = os.path.splitext(original_filename)[1].lower()
    file_id  = str(uuid.uuid4())
    filename = f"{file_id}{ext}"

    if USE_SUPABASE:
        try:
            sb   = _supabase_client()
            path = f"reports/{filename}"
            sb.storage.from_(REPORTS_BUCKET).upload(
                path, file_bytes,
                {"content-type": _mime_type(ext), "upsert": "true"}
            )
            url = sb.storage.from_(REPORTS_BUCKET).get_public_url(path)
            print(f"[storage] Uploaded to Supabase: {path}")
            return {"file_id": file_id, "filename": filename, "filepath": path, "storage_url": url}
        except Exception as e:
            print(f"[storage] Supabase upload failed: {e} — falling back to local")

    # Local filesystem fallback
    local_path = os.path.join(UPLOADS_DIR, filename)
    with open(local_path, "wb") as f:
        f.write(file_bytes)
    print(f"[storage] Saved locally: {local_path}")
    return {"file_id": file_id, "filename": filename, "filepath": local_path, "storage_url": None}


def get_report_file_path(filepath: str) -> str:
    if not filepath:
        return None
    if os.path.isabs(filepath) and os.path.isfile(filepath):
        return filepath
    local = os.path.join(UPLOADS_DIR, os.path.basename(filepath))
    if os.path.isfile(local):
        return local
    return None


def delete_file(filepath: str, storage_url: str = None, bucket: str = None):
    if USE_SUPABASE and storage_url and filepath:
        try:
            sb = _supabase_client()
            sb.storage.from_(bucket or REPORTS_BUCKET).remove([filepath])
        except Exception as e:
            print(f"[storage] Supabase delete failed: {e}")
    if filepath and os.path.isfile(filepath):
        try:
            os.remove(filepath)
        except Exception:
            pass


def storage_status() -> dict:
    return {
        "type": "supabase" if USE_SUPABASE else "local",
        "configured": USE_SUPABASE,
    }
