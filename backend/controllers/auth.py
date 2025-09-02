# backend/controllers/auth.py
import os
from datetime import datetime, timedelta
import jwt
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from ..db import session
from ..models import User


class AuthController:
    def __init__(self):
        self.bp = Blueprint("auth", __name__)
        self.secret = os.getenv("SECRET_KEY", "dev-secret")
        self.expires_hours = int(os.getenv("JWT_EXPIRES_HOURS", "12"))
        self.bp.add_url_rule("/register", view_func=self.register, methods=["POST"])
        self.bp.add_url_rule("/login", view_func=self.login, methods=["POST"])
        self.bp.add_url_rule("/me", view_func=self.me, methods=["GET"])

    def _token(self, user_id: int) -> str:
        payload = {
            "sub": str(user_id),
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=self.expires_hours),
        }
        return jwt.encode(payload, self.secret, algorithm="HS256")

    def register(self):
        data = request.get_json(force=True)
        email = (data.get("email") or "").strip().lower()
        password = (data.get("password") or "").strip()
        if not email or not password:
            return jsonify({"error": "email and password required"}), 400
        with session() as db:
            exists = db.query(User).filter(User.email == email).first()
            if exists:
                return jsonify({"error": "email already registered"}), 409
            u = User(email=email, password_hash=generate_password_hash(password))
            db.add(u)
            db.commit()
            db.refresh(u)
            return jsonify({"id": u.id, "email": u.email, "theme": getattr(u, "theme", "light")})

    def login(self):
        data = request.get_json(force=True)
        email = (data.get("email") or "").strip().lower()
        password = (data.get("password") or "").strip()
        with session() as db:
            u = db.query(User).filter(User.email == email).first()
            if not u or not check_password_hash(u.password_hash, password):
                return jsonify({"error": "invalid credentials"}), 401
            return jsonify({"access_token": self._token(u.id), "token_type": "bearer"})

    def me(self):
        h = request.headers.get("Authorization", "")
        if not h.startswith("Bearer "):
            return jsonify({"error": "unauthorized"}), 401
        token = h.split(" ", 1)[1].strip()
        try:
            data = jwt.decode(token, self.secret, algorithms=["HS256"])
        except Exception:
            return jsonify({"error": "unauthorized"}), 401
        uid = int(data["sub"])
        with session() as db:
            u = db.get(User, uid)
            if not u:
                return jsonify({"error": "unauthorized"}), 401
            return jsonify({"id": u.id, "email": u.email, "theme": getattr(u, "theme", "light")})
