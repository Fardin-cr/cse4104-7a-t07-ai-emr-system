"""
File Storage Layer
Priority: R2 (primary) → Supabase Storage (fallback) → Local filesystem (dev)
"""
import os
import uuid

# ── R2 config ──────────────────────────────────────────────────────────────
R2_ACCOUNT_ID       = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID    = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME      = os.getenv("R2_BUCKET_NAME", "emr-reports")
R2_PUBLIC_URL       = os.getenv("R2_PUBLIC_URL", "").rstrip("/")
USE_R2 = bool(R2_ACCOUNT_ID and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY)

# ── Supabase config ─────────────────────────────────────────────────────────
SUPABASE_URL     = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY     = os.getenv("SUPABASE_SERVICE_KEY", "")
REPORTS_BUCKET   = os.getenv("SUPABASE_REPORTS_BUCKET", "report-previews")
USE_SUPABASE     = bool(SUPABASE_URL and SUPABASE_KEY)

# ── Local fallback ──────────────────────────────────────────────────────────
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


def _r2_client():
    import boto3
    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def _supabase_client():
    from supabase import create_client
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def upload_report_file(file_bytes: bytes, original_filename: str) -> dict:
    ext      = os.path.splitext(original_filename)[1].lower()
    file_id  = str(uuid.uuid4())
    filename = f"{file_id}{ext}"
    path     = f"reports/{filename}"

    # ── 1. R2 (primary) ────────────────────────────────────────────────────
    if USE_R2:
        try:
            s3 = _r2_client()
            s3.put_object(
                Bucket=R2_BUCKET_NAME,
                Key=path,
                Body=file_bytes,
                ContentType=_mime_type(ext),
            )
            public_url = f"{R2_PUBLIC_URL}/{path}" if R2_PUBLIC_URL else None
            print(f"[storage] Uploaded to R2: {path}")
            return {
                "file_id": file_id,
                "filename": filename,
                "filepath": path,
                "storage_url": public_url,
                "storage_backend": "r2",
            }
        except Exception as e:
            print(f"[storage] R2 upload failed: {e} — falling back to Supabase")

    # ── 2. Supabase Storage (fallback) ─────────────────────────────────────
    if USE_SUPABASE:
        try:
            sb = _supabase_client()
            sb.storage.from_(REPORTS_BUCKET).upload(
                path, file_bytes,
                {"content-type": _mime_type(ext), "upsert": "true"}
            )
            url = sb.storage.from_(REPORTS_BUCKET).get_public_url(path)
            print(f"[storage] Uploaded to Supabase: {path}")
            return {
                "file_id": file_id,
                "filename": filename,
                "filepath": path,
                "storage_url": url,
                "storage_backend": "supabase",
            }
        except Exception as e:
            print(f"[storage] Supabase upload failed: {e} — falling back to local")

    # ── 3. Local filesystem (dev only) ─────────────────────────────────────
    local_path = os.path.join(UPLOADS_DIR, filename)
    with open(local_path, "wb") as f:
        f.write(file_bytes)
    print(f"[storage] Saved locally: {local_path}")
    return {
        "file_id": file_id,
        "filename": filename,
        "filepath": local_path,
        "storage_url": None,
        "storage_backend": "local",
    }


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
    # Try R2 delete
    if USE_R2 and filepath and not os.path.isabs(filepath):
        try:
            s3 = _r2_client()
            s3.delete_object(Bucket=R2_BUCKET_NAME, Key=filepath)
            print(f"[storage] Deleted from R2: {filepath}")
            return
        except Exception as e:
            print(f"[storage] R2 delete failed: {e}")

    # Try Supabase delete
    if USE_SUPABASE and storage_url and filepath:
        try:
            sb = _supabase_client()
            sb.storage.from_(bucket or REPORTS_BUCKET).remove([filepath])
            return
        except Exception as e:
            print(f"[storage] Supabase delete failed: {e}")

    # Local delete
    if filepath and os.path.isfile(filepath):
        try:
            os.remove(filepath)
        except Exception:
            pass


def storage_status() -> dict:
    backend = "r2" if USE_R2 else ("supabase" if USE_SUPABASE else "local")
    return {
        "type": backend,
        "r2_configured": USE_R2,
        "supabase_configured": USE_SUPABASE,
    }
