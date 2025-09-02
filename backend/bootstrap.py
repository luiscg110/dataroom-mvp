# backend/bootstrap.py
from sqlalchemy.engine import Engine
from sqlalchemy import text


def ensure_extensions(engine: Engine) -> None:
    """Enable useful Postgres extensions (no-op on other DBs)."""
    if engine.dialect.name == "postgresql":
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))


def ensure_schema(engine: Engine) -> None:
    """
    Online, idempotent schema tweaks (adds columns if missing).
    Uses ALTER TABLE ... IF EXISTS/IF NOT EXISTS on Postgres.
    On SQLite intentamos y si ya existe, ignoramos el error.
    """
    if engine.dialect.name == "postgresql":
        stmts = [
            "ALTER TABLE IF EXISTS users "
            "ADD COLUMN IF NOT EXISTS theme VARCHAR(10) NOT NULL DEFAULT 'light'",
        ]
    else:
        # SQLite: no soporta IF NOT EXISTS en ADD COLUMN; ignoramos error si ya existe.
        stmts = [
            "ALTER TABLE users ADD COLUMN theme VARCHAR(10) DEFAULT 'light'",
        ]

    with engine.begin() as conn:
        for s in stmts:
            try:
                conn.execute(text(s))
            except Exception:
                # columna ya existe u otra condición inofensiva
                pass


def ensure_indexes(engine: Engine) -> None:
    """Create performance indexes idempotently."""
    dialect = engine.dialect.name

    if dialect == "postgresql":
        stmts = [
            # keyset pagination
            "CREATE INDEX IF NOT EXISTS ix_datarooms_owner_created_id "
            "ON datarooms (owner_id, created_at DESC, id DESC)",
            "CREATE INDEX IF NOT EXISTS ix_folders_parent_created_id "
            "ON folders (parent_id, created_at DESC, id DESC)",
            "CREATE INDEX IF NOT EXISTS ix_files_folder_created_id "
            "ON files (folder_id, created_at DESC, id DESC)",

            # búsqueda por contenido
            "CREATE INDEX IF NOT EXISTS ix_file_texts_tsv "
            "ON file_texts USING GIN (to_tsvector('simple', content_plain))",

            # búsqueda por nombre (trigram)
            "CREATE INDEX IF NOT EXISTS ix_files_name_trgm "
            "ON files USING GIN (name gin_trgm_ops)",
        ]
    else:
        # SQLite (sin extensiones GIN/pg_trgm)
        stmts = [
            "CREATE INDEX IF NOT EXISTS ix_datarooms_owner_created_id "
            "ON datarooms (owner_id, created_at, id)",
            "CREATE INDEX IF NOT EXISTS ix_folders_parent_created_id "
            "ON folders (parent_id, created_at, id)",
            "CREATE INDEX IF NOT EXISTS ix_files_folder_created_id "
            "ON files (folder_id, created_at, id)",
        ]

    with engine.begin() as conn:
        for s in stmts:
            conn.execute(text(s))
