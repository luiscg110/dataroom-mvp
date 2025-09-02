# Dataroom MVP

**Production URLs**

- **Frontend:** https://dataroom-mvp.vercel.app/
- **Backend:**  https://dataroom-mvp.onrender.com/

Multi-tenant Dataroom with JWT auth, datarooms/folders/files, PDF upload with text extraction, global search (by name/date/size and by PDF content), and cursor-based pagination.  
Frontend built with **React + Vite + Tailwind** (dark/light mode). Backend built with **Flask + SQLAlchemy + Postgres**.

---

## ✨ Features

- **JWT Auth** (register/login, `Bearer <token>`) and backend auth guard.  
- **Multi-user:** each user only sees their own datarooms/folders/files.  
- **PDF uploads** (PDF-only). Text is extracted using **pdfminer.six**.  
- **Global search per user**:
  - **Meta:** name, creation date, size (**keyset pagination**).
  - **Content:** full-text search over extracted text (**Postgres GIN + `to_tsvector`**).
- **Cursor pagination** to list folders/files (10 at a time in the UI).  
- **Inline PDF viewer** (blob) and “open in new tab”.  
- **Dark/Light mode** toggle (persisted per user).  
- **Auto-rename on name collisions** (or **409** if you enable that variant).

---

## 🗂️ Project Structure

dataroom-mvp/
├─ backend/
│  ├─ app.py                 # Flask app factory + CORS + auth guard
│  ├─ config.py              # .env, DATABASE_URL, UPLOAD_DIR, etc.
│  ├─ db.py                  # engine/session
│  ├─ models.py              # User, Dataroom, Folder, File, FileText, ...
│  ├─ bootstrap.py           # ensure_extensions/schema/indexes (idempotent)
│  ├─ controllers/           # auth, datarooms, folders, files, search, ...
│  ├─ services/pdf_text.py   # PDF text extraction
│  ├─ requirements.txt
│  └─ .env.example
└─ frontend/
   ├─ src/
   │  ├─ api.ts              # backend calls (+ token)
   │  ├─ auth.tsx            # AuthProvider (localStorage)
   │  ├─ app.tsx             # simple routing (list/room)
   │  ├─ components/
   │  │  ├─ Topbar.tsx (theme toggle + email)
   │  │  ├─ Login.tsx
   │  │  ├─ DataroomListPaginated.tsx
   │  │  ├─ DataroomView.tsx (breadcrumbs, search, pagination)
   │  │  ├─ UploadButton.tsx (collisions/errors handling)
   │  │  └─ PdfViewer.tsx
   │  └─ types.ts
   ├─ tailwind.config.js
   ├─ postcss.config.js
   ├─ index.html
   ├─ package.json
   └─ .env.example

---

## ⚙️ Requirements

- **Backend:** Python 3.11+ (3.13 OK on Render), **Postgres 14+** (tested with 17).  
- **Frontend:** Node 18+ / 20+.  
- **Windows local:** use **waitress**; on Linux/Mac/Render use **gunicorn**.

---

## 🧪 Local Development

### 1) Database

**Option A: Docker Postgres**

docker run -d --name dataroom-postgres -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 postgres:17

# create DB (once)
docker exec -it dataroom-postgres psql -U postgres -c "CREATE DATABASE dataroom;"

**Option B: SQLite (dev only)**  
If `DATABASE_URL` is not defined, the backend will use **SQLite** (`backend/dataroom.db`).

---

### 2) Backend

cd backend
python -m venv .venv

# Windows
. .venv/Scripts/activate
# Mac/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

**Edit `backend/.env`:**

# Local Postgres (recommended)
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/dataroom
# or leave empty for SQLite

UPLOAD_DIR=../uploads
MAX_CONTENT_LENGTH_MB=25
PORT=5001

SECRET_KEY=put-a-long-unique-value
AUTH_REQUIRED=true
JWT_EXPIRES_HOURS=12

**Run the backend (dev):**

# Windows (use waitress)
waitress-serve --listen=0.0.0.0:5001 backend.app:app

# Mac/Linux (you can also)
python -m backend.app
# or
gunicorn -w 2 -k gthread -b 0.0.0.0:5001 backend.app:app

**On startup the backend runs:**

- Base.metadata.create_all  
- ensure_extensions (e.g., pg_trgm if applicable)  
- ensure_schema (adds missing columns/tables with IF NOT EXISTS)  
- ensure_indexes (creates recommended indexes)

---

### 3) Frontend

cd frontend
npm i

# create .env from example
cp .env.example .env
# set local backend:
# VITE_API_URL=http://localhost:5001

npm run dev

Open http://localhost:5173.

---

## 🔐 Authentication

- POST /api/auth/register { email, password }  
- POST /api/auth/login → { access_token, token_type }  
  - The token is stored in localStorage and sent as Authorization: Bearer <token>.  
- GET /api/auth/me → { id, email, theme }

---

## 📦 Datarooms / Folders / Files (Summary)

- GET /api/datarooms (user’s own only)  
- POST /api/datarooms { name }  
- GET /api/datarooms/:id  
- PUT /api/datarooms/:id { name }  
- DELETE /api/datarooms/:id

- GET /api/folders/:id → folder info  
- GET /api/folders/:id/children/paged?limitFolders=10&limitFiles=10&cursorFolders=&cursorFiles=
  → { folders, files, next_cursor_folders, next_cursor_files }

- POST /api/datarooms/:rid/folders { name, parent_id }  
- PUT /api/folders/:id { name }  
- DELETE /api/folders/:id

- POST /api/folders/:id/files multipart/form-data (file must be PDF)
  - Stores file at UPLOAD_DIR/<dataroom>/<folder>/<uuid>.pdf.
  - Computes sha256, persists files row.
  - Extracts text and persists file_texts.
  - Name collision: backend auto-renames (name (1).pdf, etc.) and returns 201 with the final name.
    The frontend shows a “Heads up” notice if a rename happened.
    (If you prefer 409 on collision, adjust the controller to return {error, conflict:<suggested>}—the UI already handles it.)

- GET /api/files/:id  
- GET /api/files/:id/stream → binary stream (iframe/blob)  
- PUT /api/files/:id { name } (auto-rename if collision)  
- DELETE /api/files/:id

---

## 🔎 Global Search (per user)

**Meta (name/date/size)**  
GET /api/search/meta?name=...&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&size_min_mb=&size_max_mb=&limit=10&cursor=
→ { items: File[], next_cursor }  
Searches across all files owned by the user. Uses keyset pagination (opaque cursor).

**Content (PDF text)**  
GET /api/search/content?q=terms&limit=10&cursor=
→ { items: [{ id, name, size_bytes, snippet }], next_cursor }  
Full-text search using to_tsvector('simple', content_plain) + GIN.  
snippet is HTML with highlights (render carefully on the frontend).

---

## 🎨 Dark/Light Mode

- Toggle in Topbar.  
- Persisted in DB per user (users.theme = 'light' | 'dark').  
- Tailwind configured with darkMode: 'class' and a wrapper <html class="dark"> when applicable.  
- Components use neutral classes for good contrast in both modes.

---

## 🌐 CORS

Backend allows by default:
- http://localhost:5173 (dev)

Add your Vercel/Render domain(s) if exposing the frontend.  
Edit CORS(...) in backend/app.py as needed.

---

## 🚀 Deployment

### Backend on Render

- Service Type: Web Service (Python)  
- Build Command: pip install -r backend/requirements.txt  
- Start Command: gunicorn -w 2 -k gthread -b 0.0.0.0:$PORT backend.app:app  
- Root Directory: (leave empty)

**Environment Variables:**
- DATABASE_URL → Render External Database URL, e.g.:
  postgresql+psycopg://dataroom_db_user:******@dpg-xxxxx/dat..._db
  (Important: use postgresql+psycopg://, not postgres://)
- SECRET_KEY → long/unique value
- AUTH_REQUIRED → true
- JWT_EXPIRES_HOURS → 12
- MAX_CONTENT_LENGTH_MB → 25
- UPLOAD_DIR → persistent if you add a Disk on Render, e.g., /var/data/uploads

**Persistent disk (recommended):**
- Add Disk → Mount Path: /var/data  
- UPLOAD_DIR=/var/data/uploads

### Frontend on Vercel

In frontend/.env:
VITE_API_URL=https://dataroom-mvp.onrender.com

npm run build (optional locally)  
Connect repo and deploy using Vite/React framework preset.

---

## 🧰 Troubleshooting

- 401 from frontend: missing Authorization header (token lost/expired).  
- CORS blocked: add your frontend origin to CORS(...) in the backend.  
- ModuleNotFoundError on Render: ensure the start command backend.app:app and the build command install backend/requirements.txt.  
- Windows + gunicorn: fails due to fcntl. Use waitress-serve locally (Render uses gunicorn fine).  
- UndefinedTable/Column: drop DB or restart; ensure_schema/create_all add missing bits on startup.  
- UPLOAD_DIR paths on Windows: backend normalizes to POSIX; handles repo-relative paths. In production use an absolute path (e.g., /var/data/uploads).

---

## 🧪 Quick API Smoke (curl)

# register
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"a@a.com","password":"secret"}'

# login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@a.com","password":"secret"}'

# with token
TOKEN=...
curl http://localhost:5001/api/datarooms -H "Authorization: Bearer $TOKEN"

---

## 1. User Experience & Functionality

### 1.1 Clean, Intuitive UI/UX

- Clear layout: Topbar with auth & theme toggle; Datarooms view (paginated list) → Dataroom with breadcrumbs and two columns (folders/files).  
- Obvious actions: Create dataroom/folder, upload PDF, rename/delete, open inline PDF viewer or new tab.  
- “Drive-like” search:
  - Toolbar with criterion selector (name, date, size, content).
  - Dedicated results view that hides the normal view while searching.
  - Global per-user search (not tied to current folder).
- 10-by-10 pagination with “View more” button.
- Name collisions: auto-rename (name (1).pdf) plus UX notice (“Heads up”).
- PDF viewer: inline (blob) rendering with “open in new tab” button.
- Dark/Light mode: Topbar toggle, persisted per user; Tailwind darkMode: 'class'.

---

## 2. Robustness, Scalability & Security

### 2.1 Robustness

- Keyset pagination (created_at,id) in listings & search → stable performance without costly offsets.  
- Critical indexes:
  - (owner_id, created_at DESC, id DESC) on datarooms
  - (parent_id, created_at DESC, id DESC) on folders
  - (folder_id, created_at DESC, id DESC) on files
  - GIN on to_tsvector('simple', content_plain) for content search
  - (Optional) pg_trgm GIN for filename search
- Text extraction performed in-request with fallback: failures don’t break the upload (metadata still saved).
- SHA-256 checksum by streamed chunks for robustness and future dedup.
- Idempotent boot: ensure_extensions(), ensure_schema() (ADD IF NOT EXISTS), ensure_indexes() at startup.
- Safe disk paths: stored_name uses UUID; never trust user filename for filesystem paths.

### 2.2 Scalability

- Stateless app: JWT + external DB → horizontal scaling without sticky sessions.  
- Search & listings ready to grow: keyset + indexes → from thousands to millions of rows without sudden degradation.  
- Easy evolution:
  - Move UPLOAD_DIR to S3/Cloud Storage (presigned URLs).
  - Workers/queues (RQ/Celery) for heavy text extraction/OCR & reindexing.
  - Caches (Redis) for cursors & hot queries; Postgres read replicas for read offload.
  - Sharding by owner_id or time-based partitioning if needed.

### 2.3 Security

- Per-user isolation on all routes (owner-guard on dataroom/folder/file).  
- JWT HS256 with configurable expiry (12h) and strong SECRET_KEY; /me endpoint to validate sessions.  
- Explicit CORS for frontend origins; Bearer only (no cookies/CSRF).  
- Input validation & limits:
  - PDF-only uploads; MAX_CONTENT_LENGTH_MB.
  - Normalized names and controlled collision handling.
- Minimal exposed headers; safe send_file streaming without revealing real paths.
- Secret rotation & TLS handled by platform (Render/Vercel); recommend rate limiting and structured logs.

---

## 3. Code Quality & Readability

- Layered backend:
  - controllers/ (HTTP), models.py (ORM), services/ (PDF/text), bootstrap.py (DB infra).
- Clear transactions using a session() context manager.  
- Consistent HTTP errors (400/401/404/409/410/5xx) with helpful messages.  
- Typed frontend (TypeScript):
  - api.ts centralizes fetch + JWT headers.
  - Small focused components (DataroomListPaginated, DataroomView, UploadButton, PdfViewer, etc.).
  - Contained state/effects; independent cursors for folders/files/search.
- Consistent styling:
  - Tailwind utilities (global dark via html.class), brand tokens, no ad-hoc CSS per component.
- Predictable UX patterns:
  - Spinners/error messages, disabled buttons while busy, collision notices.
- Idempotency & deployability: ensure_* reduces early migration debt.
- CI/CD-ready: .env.example, clear env vars, standard start commands (gunicorn/waitress), and deploy docs.

**Result:** a solid, clean foundation delivering a familiar “Drive-like” experience, ready to scale in load and team size, with technical choices that avoid bottlenecks and ease long-term maintenance.

---

## Persistent Metadata & Application State

- Source of truth in PostgreSQL; binaries (PDFs) on disk/object storage.  
- DB stores metadata + reference (stored_name) → easier backups, S3 migration, and access control.

**Schema overview:**

- users: id, email, password_hash, theme_mode (light/dark)  
- datarooms: id, owner_id, root_folder_id, created_at  
- folders: id, dataroom_id, parent_id, name, created_at  
- files: id, folder_id, name, stored_name, mime_type, size_bytes, checksum_sha256, created_at, updated_at  
- file_texts: file_id, content_plain

**Advantages:**

- Real persistence across sessions/devices.  
- Efficient search & listings via indexes + keyset.  
- Security by design: owner_id filter; no real paths exposed.  
- Safe collision handling: checksum + auto-rename with notice.  
- Portability to S3 without schema changes.  
- Scales with read replicas, caches, and indexing workers.

---

## Data Model for Functional Requirements

**Principles**

- Binaries out of DB; metadata in Postgres.  
- Multi-tenant by design via owner_id scoping.  
- Normalized schema with performance-minded indexes.  
- Binary immutability (identified by stored_name + checksum_sha256).

**Entities & relations**

- users → datarooms (each with a root folder)  
- folders: tree via parent_id (nullable for root)  
- files: UNIQUE(folder_id, name) at logical level; backend renames to “name (1).pdf”  
- file_texts: extracted plain text for content search

**Integrity & security**

- FKs with ON DELETE CASCADE.  
- Controllers always scope by owner_id.  
- Checksums and sizes for validation/dedup.

**Performance & scalability**

- Keyset pagination indexes:
  - datarooms(owner_id, created_at DESC, id DESC)
  - folders(parent_id, created_at DESC, id DESC)
  - files(folder_id, created_at DESC, id DESC)
- Search:
  - GIN on to_tsvector('simple', content_plain)
  - pg_trgm for filename fuzzy search

**Coverage**

- Auto-created root on new dataroom.  
- Stable listings & navigation.  
- Global search by name/date/size/content.  
- Renames/deletes don’t break binary references.

**Future-proof**

- Sharing/ACLs (room_members / file_shares).  
- Tagging (tags, file_tags).  
- Versioning (file_versions with current pointer).  
- Soft delete (deleted_at).  
- External storage fields (s3_bucket, s3_key).

---

## Edge Cases: Same-Name Uploads (and more)

**Same-name in the same folder**

- Auto-rename deterministically (Contract (1).pdf, (2).pdf, …) and persist without failing.  
- Frontend shows a “renamed to …” notice.

**Concurrency**

- Add UNIQUE(folder_id, name). On IntegrityError, retry with next suffix.  
- Disk write + metadata insert happen together; on failures, attempt rollback/cleanup.

**Validations**

- PDF-only (extension + optional header sniff).  
- 413 if size > MAX_CONTENT_LENGTH_MB (pre-checked).  
- Normalize names; prevent path traversal; safe suffix characters.  
- Case sensitivity: if you need case-insensitive semantics, use proper collation or a normalized column.

**Other edges**

- Empty/corrupt file: still save metadata; non-blocking notice.  
- Missing binary on stream: 410 Gone.  
- Rename to existing: apply same collision rule.  
- Deletes cascade; if file delete fails, continue and log for cleanup.

**Product signals**

- Be transparent about auto-renames.  
- “Rename now” quick action post-upload.  
- Optional “Replace” policy (requires file_versions).

---