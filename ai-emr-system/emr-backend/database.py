"""
Nashman Institute EMR — Database Layer v3 (Production)
- PostgreSQL (Supabase) in production via DATABASE_URL env var
- SQLite for local development (no config needed)
- Same interface for all callers — zero code changes needed in routes
"""
import os
import hashlib
import secrets
import datetime
import uuid as _uuid

DATABASE_URL = os.getenv("DATABASE_URL", "")
USE_POSTGRES  = DATABASE_URL.startswith("postgresql") or DATABASE_URL.startswith("postgres")

SQLITE_PATH = os.path.join(os.path.dirname(__file__), "meditrack.db")


# ── Password utilities ────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h    = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{h}"

def verify_password(password: str, stored: str) -> bool:
    try:
        if ":" in stored:
            salt, h = stored.split(":", 1)
            return hashlib.sha256((salt + password).encode()).hexdigest() == h
        return password == stored
    except Exception:
        return False


# ── Unified DB wrapper ────────────────────────────────────────────────────────
class _Cursor:
    """Wraps a cursor so callers can do db.execute(...).fetchone()"""
    def __init__(self, cursor, is_pg):
        self._c    = cursor
        self._is_pg = is_pg

    def fetchone(self):
        row = self._c.fetchone()
        if row is None:
            return None
        return dict(row) if self._is_pg else dict(row)

    def fetchall(self):
        rows = self._c.fetchall()
        return [dict(r) for r in rows]


class DBWrapper:
    def __init__(self, conn, is_pg=False):
        self._conn  = conn
        self._is_pg = is_pg
        self._cur   = conn.cursor() if is_pg else None

    def execute(self, sql, params=()):
        if self._is_pg:
            psql = sql.replace("?", "%s")
            # Handle ON CONFLICT / INSERT OR IGNORE
            psql = psql.replace("INSERT OR IGNORE INTO", "INSERT INTO")
            psql = psql.replace("INSERT OR REPLACE INTO", "INSERT INTO")
            # rowid is SQLite-only; PostgreSQL uses id
            psql = psql.replace("rowid", "id")
            self._cur.execute(psql, params or ())
            return _Cursor(self._cur, True)
        else:
            import sqlite3
            cur = self._conn.execute(sql, params or ())
            return _SQLiteCursor(cur)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        try:
            self._conn.rollback()
        except Exception:
            pass

    def close(self):
        try:
            if self._is_pg and self._cur:
                self._cur.close()
            self._conn.close()
        except Exception:
            pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, *_):
        if exc_type:
            self.rollback()
        else:
            self.commit()
        self.close()


class _SQLiteCursor:
    def __init__(self, cur):
        self._c = cur
    def fetchone(self):
        row = self._c.fetchone()
        return dict(row) if row else None
    def fetchall(self):
        return [dict(r) for r in self._c.fetchall()]


def get_db() -> DBWrapper:
    if USE_POSTGRES:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        conn.autocommit = False
        return DBWrapper(conn, is_pg=True)
    else:
        import sqlite3
        conn = sqlite3.connect(SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return DBWrapper(conn, is_pg=False)


# ── Schema ────────────────────────────────────────────────────────────────────
def _exec_safe(db, sql, params=()):
    try:
        db.execute(sql, params)
        db.commit()
    except Exception:
        db.rollback()


def _create_tables(db):
    tables = [
        """CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY, name TEXT NOT NULL,
            age INTEGER, sex TEXT, blood TEXT, phone TEXT,
            address TEXT, doctor TEXT, emergency_contact TEXT,
            notes TEXT, registered TEXT NOT NULL)""",

        """CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY, patient_id TEXT NOT NULL,
            type TEXT NOT NULL, date TEXT NOT NULL, time TEXT,
            lab TEXT, lab_id TEXT, pdf_name TEXT, pdf_path TEXT,
            storage_url TEXT,
            edited_by TEXT, edited_at TEXT, created_at TEXT NOT NULL)""",

        """CREATE TABLE IF NOT EXISTS report_values (
            id SERIAL PRIMARY KEY, report_id TEXT NOT NULL,
            name TEXT NOT NULL, value REAL, value_text TEXT,
            unit TEXT, ref_min REAL, ref_max REAL,
            status TEXT DEFAULT 'Needs Review', abnormal INTEGER DEFAULT 0
        )""" if USE_POSTGRES else
        """CREATE TABLE IF NOT EXISTS report_values (
            id INTEGER PRIMARY KEY AUTOINCREMENT, report_id TEXT NOT NULL,
            name TEXT NOT NULL, value REAL, value_text TEXT,
            unit TEXT, ref_min REAL, ref_max REAL,
            status TEXT DEFAULT 'Needs Review', abnormal INTEGER DEFAULT 0
        )""",

        """CREATE TABLE IF NOT EXISTS credentials (
            role TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL)""",

        """CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)""",

        """CREATE TABLE IF NOT EXISTS imaging (
            id TEXT PRIMARY KEY, patient_id TEXT NOT NULL,
            modality TEXT NOT NULL, date TEXT NOT NULL, time TEXT,
            description TEXT, findings TEXT, radiologist TEXT,
            file_name TEXT, file_path TEXT, storage_url TEXT,
            created_at TEXT NOT NULL, created_by TEXT)""",

        """CREATE TABLE IF NOT EXISTS audit_log (
            id SERIAL PRIMARY KEY, action TEXT NOT NULL,
            role TEXT, username TEXT, detail TEXT,
            ip_address TEXT, timestamp TEXT NOT NULL
        )""" if USE_POSTGRES else
        """CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL,
            role TEXT, username TEXT, detail TEXT,
            ip_address TEXT, timestamp TEXT NOT NULL
        )""",

        """CREATE TABLE IF NOT EXISTS error_log (
            id SERIAL PRIMARY KEY, level TEXT NOT NULL,
            message TEXT NOT NULL, detail TEXT,
            path TEXT, method TEXT,
            timestamp TEXT NOT NULL
        )""" if USE_POSTGRES else
        """CREATE TABLE IF NOT EXISTS error_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT NOT NULL,
            message TEXT NOT NULL, detail TEXT,
            path TEXT, method TEXT,
            timestamp TEXT NOT NULL
        )""",
    ]
    for t in tables:
        _exec_safe(db, t)

    # Safe column additions for upgrades
    for sql in [
        "ALTER TABLE report_values ADD COLUMN status TEXT DEFAULT 'Needs Review'",
        "ALTER TABLE audit_log ADD COLUMN username TEXT",
        "ALTER TABLE audit_log ADD COLUMN ip_address TEXT",
        "ALTER TABLE reports ADD COLUMN storage_url TEXT",
        "ALTER TABLE imaging ADD COLUMN storage_url TEXT",
    ]:
        _exec_safe(db, sql)


def _seed(db):
    defaults = [
        ("admin",        "admin",        "admin123"),
        ("doctor",       "doctor",       "doc123"),
        ("technician",   "technician",   "tech123"),
        ("receptionist", "receptionist", "recep123"),
    ]
    for role, uname, pwd in defaults:
        row = db.execute("SELECT password FROM credentials WHERE role=?", (role,)).fetchone()
        if not row:
            db.execute("INSERT INTO credentials (role,username,password) VALUES (?,?,?)",
                       (role, uname, hash_password(pwd)))
        elif ":" not in (row.get("password") or ""):
            db.execute("UPDATE credentials SET password=? WHERE role=?",
                       (hash_password(row["password"]), role))

    master = os.getenv("MASTER_CODE", "CLINIC-2026-MASTER")
    if USE_POSTGRES:
        db.execute(
            "INSERT INTO system_settings (key,value,updated_at) VALUES (%s,%s,NOW()) "
            "ON CONFLICT (key) DO NOTHING",
            ("master_code", master)
        )
    else:
        db.execute(
            "INSERT OR IGNORE INTO system_settings VALUES (?,?,datetime('now'))",
            ("master_code", master)
        )


def init_db():
    db = get_db()
    try:
        _create_tables(db)
        _seed(db)
        db.commit()
        mode = "PostgreSQL (Supabase)" if USE_POSTGRES else "SQLite (local)"
        print(f"✅ Database initialized — {mode}")
    except Exception as e:
        db.rollback()
        print(f"❌ Database init error: {e}")
        raise
    finally:
        db.close()


def log_action(db, action: str, role: str = None, username: str = None,
               detail: str = None, ip: str = None):
    db.execute(
        "INSERT INTO audit_log (action,role,username,detail,ip_address,timestamp) VALUES (?,?,?,?,?,?)",
        (action, role, username, detail, ip, datetime.datetime.now().isoformat())
    )


def log_error(level: str, message: str, detail: str = None,
              path: str = None, method: str = None):
    """Log application errors to DB for dashboard visibility."""
    try:
        db = get_db()
        db.execute(
            "INSERT INTO error_log (level,message,detail,path,method,timestamp) VALUES (?,?,?,?,?,?)",
            (level, message, detail, path, method, datetime.datetime.now().isoformat())
        )
        db.commit()
        db.close()
    except Exception:
        pass


if __name__ == "__main__":
    init_db()