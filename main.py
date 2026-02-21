# Load .env first so BREVO_API_KEY etc. are set before any app code runs
from pathlib import Path
_env_file = Path(__file__).resolve().parent / ".env"
if _env_file.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_file)
    except ImportError:
        pass

import logging
import logging.handlers
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

# ---------------------------------------------------------------------------
# Logging setup — console + rotating file (data/app.log)
# ---------------------------------------------------------------------------

_LOG_DIR = Path(__file__).resolve().parent / "data"
_LOG_DIR.mkdir(exist_ok=True)

_fmt = logging.Formatter(
    fmt="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

_console = logging.StreamHandler()
_console.setFormatter(_fmt)

_file_handler = logging.handlers.RotatingFileHandler(
    filename=_LOG_DIR / "app.log",
    maxBytes=5 * 1024 * 1024,   # 5 MB per file
    backupCount=7,               # keep 7 rotated files (~35 MB total)
    encoding="utf-8",
)
_file_handler.setFormatter(_fmt)

# Root logger for our app
_root = logging.getLogger("voting_app")
_root.setLevel(logging.INFO)
_root.propagate = False
_root.addHandler(_console)
_root.addHandler(_file_handler)

# Suppress noisy third-party loggers
for _noisy in ("uvicorn.access", "sqlalchemy.engine"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

logger = logging.getLogger("voting_app.main")

from database import init_db
from routes import api as api_routes
from auth import decode_access_token

_DEV = os.environ.get("APP_ENV", "production").lower() == "development"

# ---------------------------------------------------------------------------
# Middleware: security headers + request audit log
# ---------------------------------------------------------------------------

# Paths we don't need to log (static assets, SPA shell)
_SKIP_LOG_PREFIXES = ("/assets/", "/favicon")


def _identity_from_request(request: Request) -> str:
    """Extract user email from JWT cookie, or return IP address."""
    token = request.cookies.get("token")
    if token:
        payload = decode_access_token(token)
        if payload and payload.get("email"):
            return payload["email"]
    return request.client.host if request.client else "unknown"


class RequestAuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip logging for static assets
        path = request.url.path
        if any(path.startswith(p) for p in _SKIP_LOG_PREFIXES):
            return await call_next(request)

        start = time.perf_counter()
        identity = _identity_from_request(request)

        response = await call_next(request)

        duration_ms = int((time.perf_counter() - start) * 1000)
        status = response.status_code
        log_fn = logger.warning if status >= 400 else logger.info

        log_fn(
            "[%s] %s %s → %d (%dms)",
            identity, request.method, path, status, duration_ms,
        )

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    from config import BREVO_API_KEY, RESEND_API_KEY
    logger.info(
        "Server starting — email provider: %s",
        "Brevo" if BREVO_API_KEY else ("Resend" if RESEND_API_KEY else "NONE (codes in logs only)"),
    )
    yield
    logger.info("Server shutting down")


# Disable /docs and /openapi.json in production — they expose full API schema publicly
app = FastAPI(
    title="SHOMACS MeetPulse",
    lifespan=lifespan,
    docs_url="/docs" if _DEV else None,
    redoc_url="/redoc" if _DEV else None,
    openapi_url="/openapi.json" if _DEV else None,
)
app.add_middleware(RequestAuditMiddleware)

# JSON API routes
app.include_router(api_routes.router)

# React build assets (JS/CSS bundles etc.)
_dist = Path(__file__).parent / "frontend" / "dist"
if _dist.exists():
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str, request: Request):
        """Serve the React SPA for every non-API route."""
        return FileResponse(_dist / "index.html")
else:
    @app.get("/", include_in_schema=False)
    async def dev_root():
        return JSONResponse({"status": "Backend OK — run `cd frontend && npm run dev` for the UI"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
