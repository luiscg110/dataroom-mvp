import os, shutil
from flask import Blueprint, request, jsonify, g
from sqlalchemy import select, and_
from ..utils.pagination import encode_cursor, decode_cursor
from ..db import session
from ..models import Dataroom, Folder, File
from ..config import UPLOAD_DIR

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

class FoldersController:
    def __init__(self):
        self.bp = Blueprint("folders", __name__)
        self.bp.add_url_rule("/folders/<int:fid>", view_func=self.get_folder, methods=["GET"])
        self.bp.add_url_rule("/folders/<int:fid>/children", view_func=self.children, methods=["GET"])
        self.bp.add_url_rule("/datarooms/<int:rid>/folders", view_func=self.create_folder, methods=["POST"])
        self.bp.add_url_rule("/folders/<int:fid>", view_func=self.rename_folder, methods=["PUT"])
        self.bp.add_url_rule("/folders/<int:fid>", view_func=self.delete_folder, methods=["DELETE"])

    def _ensure_owner_folder(self, db, folder_id: int, uid: int) -> Folder | None:
        f = db.get(Folder, folder_id)
        if not f:
            return None
        d = db.get(Dataroom, f.dataroom_id)
        if not d or d.owner_id != uid:
            return None
        return f

    def _ensure_owner_room(self, db, rid: int, uid: int) -> Dataroom | None:
        d = db.get(Dataroom, rid)
        if not d or d.owner_id != uid:
            return None
        return d

    def get_folder(self, fid: int):
        uid = g.user_id
        with session() as db:
            f = self._ensure_owner_folder(db, fid, uid)
            if not f:
                return jsonify({"error": "not found"}), 404
            return jsonify({"id": f.id, "name": f.name, "dataroom_id": f.dataroom_id, "parent_id": f.parent_id})

    def children(self, fid: int):
        uid = g.user_id
        limit_f = min(int(request.args.get("limit_folders", 50)), 200)
        limit_files = min(int(request.args.get("limit_files", 50)), 200)
        cur_f = request.args.get("cursor_folders")
        cur_file = request.args.get("cursor_files")

        with session() as db:
            f = self._ensure_owner_folder(db, fid, uid)
            if not f:
                return jsonify({"error": "not found"}), 404

            # Folders
            sf = select(Folder).where(Folder.parent_id == fid)
            if cur_f:
                try:
                    cdt, cid = decode_cursor(cur_f)
                except ValueError:
                    return jsonify({"error": "bad cursor"}), 400
                sf = sf.where(
                    (Folder.created_at < cdt) |
                    (and_(Folder.created_at == cdt, Folder.id < cid))
                )
            sf = sf.order_by(Folder.created_at.desc(), Folder.id.desc()).limit(limit_f + 1)
            folders = db.execute(sf).scalars().all()
            next_f = None
            if len(folders) == limit_f + 1:
                last = folders[-1]
                next_f = encode_cursor(last.created_at, last.id)
                folders = folders[:-1]

            # Files
            sfile = select(File).where(File.folder_id == fid)
            if cur_file:
                try:
                    cdt2, cid2 = decode_cursor(cur_file)
                except ValueError:
                    return jsonify({"error": "bad cursor"}), 400
                sfile = sfile.where(
                    (File.created_at < cdt2) |
                    (and_(File.created_at == cdt2, File.id < cid2))
                )
            sfile = sfile.order_by(File.created_at.desc(), File.id.desc()).limit(limit_files + 1)
            files = db.execute(sfile).scalars().all()
            next_file = None
            if len(files) == limit_files + 1:
                last2 = files[-1]
                next_file = encode_cursor(last2.created_at, last2.id)
                files = files[:-1]

            return jsonify({
                "folders": [{"id": x.id, "name": x.name, "parent_id": x.parent_id} for x in folders],
                "files": [{"id": y.id, "name": y.name, "size_bytes": y.size_bytes, "mime_type": y.mime_type} for y in files],
                "next_cursor_folders": next_f,
                "next_cursor_files": next_file
            })

    def create_folder(self, rid: int):
        uid = g.user_id
        data = request.get_json(force=True)
        name = (data.get("name") or "").strip()
        parent_id = data.get("parent_id")
        if not name or parent_id is None:
            return jsonify({"error": "name and parent_id required"}), 400
        with session() as db:
            d = self._ensure_owner_room(db, rid, uid)
            parent = db.get(Folder, int(parent_id))
            if not d or not parent or parent.dataroom_id != rid:
                return jsonify({"error": "invalid parent or dataroom"}), 400
            siblings = set(db.execute(select(Folder.name).where(Folder.parent_id == parent.id, Folder.dataroom_id == rid)).scalars().all())
            final = next_collision_name(name, siblings)
            f = Folder(name=final, dataroom_id=rid, parent_id=parent.id)
            db.add(f)
            db.commit()
            db.refresh(f)
            os.makedirs(os.path.join(UPLOAD_DIR, str(rid), str(f.id)), exist_ok=True)
            return jsonify({"id": f.id, "name": f.name, "parent_id": f.parent_id})

    def rename_folder(self, fid: int):
        uid = g.user_id
        data = request.get_json(force=True)
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name is required"}), 400
        with session() as db:
            f = self._ensure_owner_folder(db, fid, uid)
            if not f:
                return jsonify({"error": "not found"}), 404
            siblings = set(db.execute(select(Folder.name).where(Folder.parent_id == f.parent_id, Folder.dataroom_id == f.dataroom_id, Folder.id != f.id)).scalars().all())
            f.name = next_collision_name(name, siblings)
            db.commit()
            return jsonify({"ok": True, "name": f.name})

    def delete_folder(self, fid: int):
        uid = g.user_id
        with session() as db:
            f = self._ensure_owner_folder(db, fid, uid)
            if not f:
                return jsonify({"error": "not found"}), 404
            rid = f.dataroom_id
            db.delete(f)
            db.commit()
        path = os.path.join(UPLOAD_DIR, str(rid), str(fid))
        try:
            if os.path.exists(path):
                shutil.rmtree(path)
        except Exception:
            pass
        return jsonify({"ok": True})
