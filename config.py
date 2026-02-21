import os
from pathlib import Path

# Load .env from project root so BREVO_API_KEY etc. are available
_env_path = Path(__file__).resolve().parent / ".env"
if _env_path.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_env_path)
    except ImportError:
        pass  # python-dotenv not installed

def env(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DATABASE_URL = env("DATABASE_URL") or f"sqlite+aiosqlite:///{DATA_DIR / 'voting.db'}"
SECRET_KEY = env("SECRET_KEY") or "change-me-in-production"
RESEND_API_KEY = env("RESEND_API_KEY")
BREVO_API_KEY = env("BREVO_API_KEY")
FROM_EMAIL = env("FROM_EMAIL") or "Voting App <onboarding@resend.dev>"
AUTO_APPROVE_FIRST_USER = env("AUTO_APPROVE_FIRST_USER") == "1"

# Code expiry seconds (e.g. 15 min)
CODE_EXPIRY_SECONDS = 900
