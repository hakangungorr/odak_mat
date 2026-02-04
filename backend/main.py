import os
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate

from config import Config
from app.database import db
from app.routes import register_routes

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="/")
app.config.from_object(Config)
app.url_map.strict_slashes = False

CORS(app)

# DB init
db.init_app(app)

# Migrate init
migrate = Migrate(app, db)

# Modeller Alembic görsün
from app import models  # noqa: F401

# Routes (tüm blueprint’ler burada)
register_routes(app)


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "message": "Backend + Front tek container ✅"})


# React SPA fallback
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    full_path = os.path.join(STATIC_DIR, path)
    if path and os.path.exists(full_path):
        return send_from_directory(STATIC_DIR, path)
    return send_from_directory(STATIC_DIR, "index.html")
