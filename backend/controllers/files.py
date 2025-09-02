import os, uuid, hashlib
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file, g
from sqlalchemy import select
from ..db import session
from ..models import Folder, File, Dataroom, FileText
from ..config import UPLOAD_DIR
from ..services.pdf_text import extract_pdf_text


def next_collision_name(name: str, siblings: set[str]) -> str:
    if name not in siblings:
        return name
    i = 1
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, ""
    base = stem
    while True:
        candidate = f"{base} ({i}){('.' + ext) if ext else ''}"
        if candidate not in siblings:
            return candidate
        i += 1


class FilesController:
    def __init__(self):
        self.bp = Blueprint("files", __name__)
        self.bp.add_url_rule("/folders/<int:fid>/files", view_func=self.upload, methods=["POST"])
        self.bp.add_url_rule("/files/<int:fid>", view_func=self.get_file, methods=["GET"])
        self.bp.add_url_rule("/files/<int:fid>/stream", view_func=self.stream_file, methods=["GET"])
        self.bp.add_url_rule("/files/<int:fid>", view_func=self.rename_file, methods=["PUT"])
        self.bp.add_url_rule("/files/<int:fid>", view_func=self.delete_file, methods=["DELETE"])

    def _ensure_owner_folder(self, db, folder_id: int, uid: int) -> Folder | None:
        f = db.get(Folder, folder_id)
        if not f:
            return None
        d = db.get(Dataroom, f.dataroom_id)
        if not d or d.owner_id != uid:
            return None
        return f

    def _ensure_owner_file(self, db, file_id: int, uid: int) -> File | None:
        f = db.get(File, file_id)
        if not f:
            return None
        folder = db.get(Folder, f.folder_id)
        if not folder:
            return None
        d = db.get(Dataroom, folder.dataroom_id)
        if not d or d.owner_id != uid:
            return None
        return f

    def upload(self, fid: int):
        uid = g.user_id
        if "file" not in request.files:
            return jsonify({"error": "file is required"}), 400
        up = request.files["file"]
        if not up.filename or not up.filename.lower().endswith(".pdf"):
            return jsonify({"error": "only pdf allowed"}), 400

        with session() as db:
            folder = self._ensure_owner_folder(db, fid, uid)
            if not folder:
                return jsonify({"error": "folder not found"}), 404

            rid = folder.dataroom_id
            os.makedirs(os.path.join(UPLOAD_DIR, str(rid), str(folder.id)), exist_ok=True)
            stored = f"{uuid.uuid4()}.pdf"
            disk_path = os.path.join(UPLOAD_DIR, str(rid), str(folder.id), stored)

            up.save(disk_path)

            h = hashlib.sha256()
            with open(disk_path, "rb") as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b""):
                    h.update(chunk)
            checksum = h.hexdigest()

            siblings = set(
                db.execute(select(File.name).where(File.folder_id == folder.id)).scalars().all()
            )
            final_name = next_collision_name(up.filename, siblings)

            file = File(
                folder_id=fid,
                name=final_name,
                stored_name=stored,
                mime_type="application/pdf",
                size_bytes=os.path.getsize(disk_path),
                checksum_sha256=checksum,
            )
            db.add(file)
            db.flush()  # asegura file.id disponible

            text_plain = extract_pdf_text(disk_path)
            db.add(FileText(file_id=file.id, content_plain=text_plain))

            renamed = (final_name != up.filename)

            db.commit()
            db.refresh(file)
            return jsonify({
                "id": file.id,
                "name": file.name,
                "size_bytes": file.size_bytes,
                "renamed": renamed,
                "original_name": up.filename
            }), 201

    def get_file(self, fid: int):
        uid = g.user_id
        with session() as db:
            f = self._ensure_owner_file(db, fid, uid)
            if not f:
                return jsonify({"error": "not found"}), 404
            return jsonify(
                {
                    "id": f.id,
                    "name": f.name,
                    "folder_id": f.folder_id,
                    "size_bytes": f.size_bytes,
                    "mime_type": f.mime_type,
                }
            )

    def stream_file(self, fid: int):
        uid = g.user_id
        with session() as db:
            f = self._ensure_owner_file(db, fid, uid)
            if not f:
                return jsonify({"error": "not found"}), 404
            folder = db.get(Folder, f.folder_id)
            disk_path = os.path.join(
                UPLOAD_DIR, str(folder.dataroom_id), str(folder.id), f.stored_name
            )
            if not os.path.exists(disk_path):
                return jsonify({"error": "file missing on disk"}), 410
            return send_file(disk_path, mimetype=f.mime_type, as_attachment=False, download_name=f.name)

    def rename_file(self, fid: int):
        uid = g.user_id
        data = request.get_json(force=True)
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name is required"}), 400
        with session() as db:
            f = self._ensure_owner_file(db, fid, uid)
            if not f:
                return jsonify({"error": "not found"}), 404
            siblings = set(
                db.execute(
                    select(File.name).where(File.folder_id == f.folder_id, File.id != f.id)
                ).scalars().all()
            )
            from datetime import datetime as _dt

            f.name = next_collision_name(name, siblings)
            f.updated_at = _dt.utcnow()
            db.commit()
            return jsonify({"ok": True, "name": f.name})

    def delete_file(self, fid: int):
        uid = g.user_id
        with session() as db:
            f = self._ensure_owner_file(db, fid, uid)
            if not f:
                return jsonify({"error": "not found"}), 404
            folder = db.get(Folder, f.folder_id)
            disk_path = os.path.join(
                UPLOAD_DIR, str(folder.dataroom_id), str(folder.id), f.stored_name
            )
            try:
                if os.path.exists(disk_path):
                    os.remove(disk_path)
            except Exception:
                pass
            db.delete(f)
            db.commit()
            return jsonify({"ok": True})
