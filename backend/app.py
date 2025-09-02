import os
from flask import Flask, jsonify, request, g
from flask_cors import CORS
import jwt
from .config import PORT, MAX_CONTENT_LENGTH_MB
from .db import engine
from .models import Base
from .controllers import register_controllers
from .bootstrap import ensure_indexes, ensure_schema, ensure_extensions

def create_app():
    app = Flask(__name__)
    CORS(
        app,
        resources={r"/api/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}},
        supports_credentials=False,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        expose_headers=["Content-Disposition"],
    )
    app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH_MB * 1024 * 1024

    secret = os.getenv("SECRET_KEY", "dev-secret")
    auth_required = os.getenv("AUTH_REQUIRED", "true").lower() == "true"

    @app.before_request
    def _auth():
        if not auth_required:
            return
        p = request.path
        if request.method == "OPTIONS":
            return
        if p.startswith("/api/auth/"):
            return
        if p == "/" or p.startswith("/static/"):
            return
        h = request.headers.get("Authorization", "")
        if not h.startswith("Bearer "):
            return jsonify({"error": "unauthorized"}), 401
        token = h.split(" ", 1)[1].strip()
        try:
            data = jwt.decode(token, secret, algorithms=["HS256"])
            g.user_id = int(data["sub"])
        except Exception:
            return jsonify({"error": "unauthorized"}), 401

    @app.route("/")
    def index():
        return jsonify({"status": "ok", "message": "Backend running"})

    register_controllers(app)
    return app

app = create_app()
Base.metadata.create_all(bind=engine)
ensure_extensions(engine)
ensure_schema(engine)
ensure_indexes(engine)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=True)
