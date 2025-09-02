# backend/config.py
from pathlib import Path
import os
from dotenv import load_dotenv

# Paths
BASE_DIR = Path(__file__).resolve().parent        # .../dataroom-mvp/backend
REPO_ROOT = BASE_DIR.parent                       # .../dataroom-mvp

# Always load .env from backend/
load_dotenv(BASE_DIR / ".env")

# ---- Database URL ----
DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()
if not DATABASE_URL:
    # Fallback to SQLite file inside backend/
    DATABASE_URL = f"sqlite+pysqlite:///{(BASE_DIR / 'dataroom.db').as_posix()}"

# ---- Upload directory ----
_raw_upload_dir = (os.getenv("UPLOAD_DIR") or "uploads").strip()
UPLOAD_DIR_PATH = Path(_raw_upload_dir)
# If relative, anchor to the repo root so uploads/ means <repo>/uploads
if not UPLOAD_DIR_PATH.is_absolute():
    UPLOAD_DIR_PATH = (REPO_ROOT / UPLOAD_DIR_PATH).resolve()
# Export as POSIX string to avoid backslash issues on Windows
UPLOAD_DIR = UPLOAD_DIR_PATH.as_posix()

# ---- Other settings ----
MAX_CONTENT_LENGTH_MB = int(os.getenv("MAX_CONTENT_LENGTH_MB", "25"))
PORT = int(os.getenv("PORT", "5001"))
