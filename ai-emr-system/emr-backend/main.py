"""
AI-Based Medical Report Analysis and Patient Management System
Backend Entry Point — Shorter Version for CSE 4104
"""
from dotenv import load_dotenv
load_dotenv()

import os, datetime, traceback

print("=" * 55)
print("  AI Medical Report Analysis System")
print("=" * 55)
print(f"  API KEY  : {'YES' if os.getenv('ANTHROPIC_API_KEY') else 'MISSING'}")
print(f"  MODEL    : {os.getenv('CLAUDE_MODEL','claude-haiku-4-5')}")
print(f"  DATABASE : {'PostgreSQL' if os.getenv('DATABASE_URL') else 'SQLite (local)'}")
print("=" * 55)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database import init_db, log_error, get_db
from routes import auth, patients, reports

app = FastAPI(
    title="AI Medical Report Analysis API",
    description="AI-Based Medical Report Analysis and Patient Management System",
    version="1.0.0",
    redirect_slashes=False,
)

ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logger(request: Request, call_next):
    start = datetime.datetime.now()
    try:
        response = await call_next(request)
        secs = (datetime.datetime.now() - start).total_seconds()
        if secs > 5:
            print(f"[SLOW] {request.method} {request.url.path} {secs:.1f}s")
        return response
    except Exception as exc:
        tb = traceback.format_exc()
        print(f"[ERROR] {request.method} {request.url.path}\n{tb}")
        log_error("ERROR", str(exc), detail=tb[:2000],
                  path=str(request.url.path), method=request.method)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error. Please try again."}
        )


@app.on_event("startup")
def startup():
    init_db()
    os.makedirs(os.path.join(os.path.dirname(__file__), "uploads"), exist_ok=True)
    print("✅ Database initialized")
    print("🚀 AI Medical Report Analysis API running")
    print("📍 Docs available at http://localhost:8000/docs")


app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(reports.router)


@app.get("/", tags=["system"])
def root():
    return {
        "name": "AI Medical Report Analysis API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health", tags=["system"])
def health():
    """Health check endpoint."""
    try:
        db = get_db()
        db.execute("SELECT 1")
        db.close()
        return {"status": "ok", "timestamp": datetime.datetime.now().isoformat()}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "detail": "Database unreachable"}
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=True
    )
