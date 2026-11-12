import os
from flask import Flask, jsonify, send_from_directory

# Project root = the folder that holds index.html, css/, js/, images/
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PUBLIC_DIRS = {"css", "js", "images"}


def create_app():
    app = Flask(__name__, static_folder=None)
    app.json.sort_keys = False  # keep the key order we write
    app.url_map.strict_slashes = False  # /api/crops and /api/crops/ both work

    try:  # only needed if the website is opened from a different origin
        from flask_cors import CORS
        CORS(app)
    except ImportError:
        pass

    from .routes import crops, recommendations, compare, calendar, profiles, methodology

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    app.register_blueprint(crops.bp, url_prefix="/api/crops")
    app.register_blueprint(recommendations.bp, url_prefix="/api/recommendations")
    app.register_blueprint(compare.bp, url_prefix="/api/compare")
    app.register_blueprint(calendar.bp, url_prefix="/api/calendar")
    app.register_blueprint(profiles.bp, url_prefix="/api/profiles")
    app.register_blueprint(methodology.bp, url_prefix="/api/methodology")

    # Serve the existing website. Only the HTML pages in the root and the css/js/images folders
    # are public, so backend source code and storage/store.json are never exposed.
    @app.get("/")
    def home():
        return send_from_directory(PROJECT_ROOT, "index.html")

    @app.get("/<path:filename>")
    def website(filename):
        parts = filename.split("/")
        allowed = filename == "manus-routes.json" or (len(parts) == 1 and filename.endswith(".html")) or (len(parts) > 1 and parts[0] in PUBLIC_DIRS)
        if not allowed or ".." in parts:
            return jsonify({"error": "Not found."}), 404
        return send_from_directory(PROJECT_ROOT, filename)

    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "Not found."}), 404

    @app.errorhandler(405)
    def bad_method(_):
        return jsonify({"error": "Method not allowed."}), 405

    @app.errorhandler(Exception)
    def server_error(e):
        from werkzeug.exceptions import HTTPException
        if isinstance(e, HTTPException):
            return jsonify({"error": e.description}), e.code
        app.logger.exception(e)
        return jsonify({"error": "Server error."}), 500

    return app
