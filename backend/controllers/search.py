# backend/controllers/search.py
from flask import Blueprint, request, jsonify, g
from sqlalchemy import select, and_, or_, func, text
from ..db import session
from ..models import File, Folder, Dataroom, FileText

class SearchController:
    def __init__(self):
        self.bp = Blueprint("search", __name__)
        # Nota: estas rutas se montarán bajo /api/search en register_controllers
        self.bp.add_url_rule("/meta", view_func=self.search_meta, methods=["GET"])
        self.bp.add_url_rule("/content", view_func=self.search_content, methods=["GET"])

    def _owner_join(self, db):
        # retorna un select base de archivos del owner autenticado
        uid = g.user_id
        # join files -> folders -> datarooms y filtra por owner
        base = (
            select(
                File.id,
                File.name,
                File.size_bytes,
                File.mime_type,
                File.created_at,
                File.folder_id,
            )
            .select_from(File)
            .join(Folder, Folder.id == File.folder_id)
            .join(Dataroom, Dataroom.id == Folder.dataroom_id)
            .where(Dataroom.owner_id == uid)
        )
        return base

    def _apply_cursor(self, stmt, cursor: str | None):
        # cursor formateado como "created_at_iso|id"
        if not cursor:
            return stmt
        try:
            created_iso, id_str = cursor.split("|", 1)
            # created_at DESC, id DESC → "menor a" ambos
            return stmt.where(
                or_(
                    File.created_at < created_iso,  # ISO funciona si DB guarda timestamptz comparable
                    and_(File.created_at == created_iso, File.id < int(id_str)),
                )
            )
        except Exception:
            return stmt

    def _make_cursor(self, row):
        # row trae created_at e id
        return f"{row.created_at.isoformat()}|{row.id}"

    def search_meta(self):
        # Parámetros:
        # name (ilike/trgm), date_from (YYYY-MM-DD), date_to, size_min_mb, size_max_mb, limit (<=50), cursor
        name = (request.args.get("name") or "").strip()
        date_from = (request.args.get("date_from") or "").strip()
        date_to = (request.args.get("date_to") or "").strip()
        size_min_mb = request.args.get("size_min_mb")
        size_max_mb = request.args.get("size_max_mb")
        limit = min(int(request.args.get("limit", "10") or "10"), 50)
        cursor = request.args.get("cursor")

        with session() as db:
            stmt = self._owner_join(db)

            if name:
                # Postgres con pg_trgm aprovecha ILIKE + trigram index
                stmt = stmt.where(File.name.ilike(f"%{name}%"))

            if date_from:
                stmt = stmt.where(File.created_at >= text(f"'{date_from} 00:00:00+00'"))
            if date_to:
                stmt = stmt.where(File.created_at < text(f"'{date_to} 23:59:59.999+00'"))

            if size_min_mb:
                stmt = stmt.where(File.size_bytes >= int(float(size_min_mb) * 1024 * 1024))
            if size_max_mb:
                stmt = stmt.where(File.size_bytes <= int(float(size_max_mb) * 1024 * 1024))

            # Orden para keyset
            stmt = stmt.order_by(File.created_at.desc(), File.id.desc())
            stmt = self._apply_cursor(stmt, cursor)
            rows = db.execute(stmt.limit(limit + 1)).all()

            items = [
                {
                    "id": r.id,
                    "name": r.name,
                    "size_bytes": r.size_bytes,
                    "mime_type": r.mime_type,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "folder_id": r.folder_id,
                }
                for r in rows[:limit]
            ]
            next_cursor = self._make_cursor(rows[-1]) if len(rows) > limit else None
            return jsonify({"items": items, "next_cursor": next_cursor})

    def search_content(self):
        # Parámetros: q (texto), limit (<=50), cursor
        q = (request.args.get("q") or "").strip()
        if not q:
            return jsonify({"items": [], "next_cursor": None})

        limit = min(int(request.args.get("limit", "10") or "10"), 50)
        cursor = request.args.get("cursor")

        with session() as db:
            uid = g.user_id
            # full-text simple sobre FileText.content_plain
            ts_query = func.to_tsquery('simple', ' & '.join(q.split()))
            stmt = (
                select(
                    File.id,
                    File.name,
                    File.size_bytes,
                    File.mime_type,
                    File.created_at,
                    File.folder_id,
                    # snippet simple: primera aparición resaltada
                    func.ts_headline('simple', FileText.content_plain, ts_query).label("snippet"),
                )
                .select_from(FileText)
                .join(File, File.id == FileText.file_id)
                .join(Folder, Folder.id == File.folder_id)
                .join(Dataroom, Dataroom.id == Folder.dataroom_id)
                .where(Dataroom.owner_id == uid)
                .where(func.to_tsvector('simple', FileText.content_plain).op('@@')(ts_query))
                .order_by(File.created_at.desc(), File.id.desc())
            )

            # cursor
            if cursor:
                try:
                    created_iso, id_str = cursor.split("|", 1)
                    stmt = stmt.where(
                        or_(
                            File.created_at < created_iso,
                            and_(File.created_at == created_iso, File.id < int(id_str)),
                        )
                    )
                except Exception:
                    pass

            rows = db.execute(stmt.limit(limit + 1)).all()
            items = [
                {
                    "id": r.id,
                    "name": r.name,
                    "size_bytes": r.size_bytes,
                    "mime_type": r.mime_type,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "folder_id": r.folder_id,
                    "snippet": r.snippet,
                }
                for r in rows[:limit]
            ]
            next_cursor = f"{rows[-1].created_at.isoformat()}|{rows[-1].id}" if len(rows) > limit else None
            return jsonify({"items": items, "next_cursor": next_cursor})
