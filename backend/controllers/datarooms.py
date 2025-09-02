from flask import Blueprint, request, jsonify, g
from sqlalchemy import select, and_
from ..db import session
from ..models import Dataroom, Folder
from ..utils.pagination import encode_cursor, decode_cursor


class DataroomsController:
    def __init__(self):
        self.bp = Blueprint("datarooms", __name__)
        self.bp.add_url_rule("/datarooms", view_func=self.list_datarooms, methods=["GET"])
        self.bp.add_url_rule("/datarooms", view_func=self.create_dataroom, methods=["POST"])
        self.bp.add_url_rule("/datarooms/<int:rid>", view_func=self.get_dataroom, methods=["GET"])
        self.bp.add_url_rule("/datarooms/<int:rid>", view_func=self.rename_dataroom, methods=["PUT"])
        self.bp.add_url_rule("/datarooms/<int:rid>", view_func=self.delete_dataroom, methods=["DELETE"])

    def list_datarooms(self):
        uid = g.user_id
        with session() as db:
            rows = db.execute(select(Dataroom).where(Dataroom.owner_id == uid)).scalars().all()
            return jsonify([{"id": d.id, "name": d.name, "root_folder_id": d.root_folder_id, "created_at": d.created_at.isoformat()} for d in rows])

    def create_dataroom(self):
        uid = g.user_id
        data = request.get_json(force=True)
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name is required"}), 400
        with session() as db:
            d = Dataroom(name=name, owner_id=uid)
            db.add(d)
            db.flush()
            root = Folder(name="root", dataroom_id=d.id, parent_id=None)
            db.add(root)
            db.flush()
            d.root_folder_id = root.id
            db.commit()
            db.refresh(d)
            return jsonify({"id": d.id, "name": d.name, "root_folder_id": d.root_folder_id})

    def get_dataroom(self, rid: int):
        uid = g.user_id
        with session() as db:
            d = db.get(Dataroom, rid)
            if not d or d.owner_id != uid:
                return jsonify({"error": "not found"}), 404
            return jsonify({"id": d.id, "name": d.name, "root_folder_id": d.root_folder_id})

    def rename_dataroom(self, rid: int):
        uid = g.user_id
        data = request.get_json(force=True)
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name is required"}), 400
        with session() as db:
            d = db.get(Dataroom, rid)
            if not d or d.owner_id != uid:
                return jsonify({"error": "not found"}), 404
            d.name = name
            db.commit()
            return jsonify({"ok": True})

    def delete_dataroom(self, rid: int):
        uid = g.user_id
        with session() as db:
            d = db.get(Dataroom, rid)
            if not d or d.owner_id != uid:
                return jsonify({"error": "not found"}), 404
            db.delete(d)
            db.commit()
            return jsonify({"ok": True})
        
    def list_datarooms(self):
        uid = g.user_id
        limit = min(int(request.args.get("limit", 50)), 200)
        cursor = request.args.get("cursor")
        with session() as db:
            stmt = select(Dataroom).where(Dataroom.owner_id == uid)

            if cursor:
                try:
                    cdt, cid = decode_cursor(cursor)
                except ValueError:
                    return jsonify({"error": "bad cursor"}), 400
                stmt = stmt.where(
                    (Dataroom.created_at < cdt) |
                    (and_(Dataroom.created_at == cdt, Dataroom.id < cid))
                )

            stmt = stmt.order_by(Dataroom.created_at.desc(), Dataroom.id.desc()).limit(limit + 1)
            rows = db.execute(stmt).scalars().all()

            next_cursor = None
            if len(rows) == limit + 1:
                last = rows[-1]
                next_cursor = encode_cursor(last.created_at, last.id)
                rows = rows[:-1]

            return jsonify({
                "items": [
                    {"id": d.id, "name": d.name, "root_folder_id": d.root_folder_id, "created_at": d.created_at.isoformat()}
                    for d in rows
                ],
                "next_cursor": next_cursor
            })
