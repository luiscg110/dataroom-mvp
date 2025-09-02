# backend/controllers/users.py
from flask import Blueprint, request, jsonify, g
from ..db import session
from ..models import User

class UsersController:
    def __init__(self):
        self.bp = Blueprint("users", __name__)
        self.bp.add_url_rule("/me/theme", view_func=self.update_theme, methods=["PUT"])

    def update_theme(self):
        data = request.get_json(force=True)
        theme = (data.get("theme") or "").strip().lower()
        if theme not in ("light", "dark"):
            return jsonify({"error": "invalid theme"}), 400
        with session() as db:
            u = db.get(User, g.user_id)
            if not u:
                return jsonify({"error": "not found"}), 404
            u.theme = theme
            db.commit()
            return jsonify({"ok": True, "theme": u.theme})
