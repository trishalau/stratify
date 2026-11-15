import click
import os
import secrets
from datetime import timedelta

from dotenv import load_dotenv
from flask import Flask, g, jsonify, request, session
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.exceptions import HTTPException

from .ai_provider import DEFAULT_GEMINI_MODEL, GeminiScenarioAI
from .database import Base, configure_database, get_session_factory
from .routes import businesses, scenarios
from .models import User
from .seed import seed_demo_business
from .validation import RequestValidationError


def create_app(test_config: dict | None = None) -> Flask:
    load_dotenv()
    app = Flask(__name__)
    app.config.from_mapping(
        DEBUG=False,
        DATABASE_URL=os.environ.get("DATABASE_URL"),
        GEMINI_API_KEY=os.environ.get("GEMINI_API_KEY"),
        GEMINI_MODEL=os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL),
        MAX_CONTENT_LENGTH=1024 * 1024,
        SECRET_KEY=os.environ.get("STRATIFY_SESSION_SECRET"),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.environ.get("STRATIFY_COOKIE_SECURE", "false").lower() == "true",
        PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
        STRATIFY_DEMO_MODE=os.environ.get("STRATIFY_DEMO_MODE", "true").lower() == "true",
        STRATIFY_DEMO_OWNER_USERNAME=os.environ.get("STRATIFY_DEMO_OWNER_USERNAME", "owner"),
    )
    app.config.from_prefixed_env()

    if test_config:
        app.config.update(test_config)
    if not app.config.get("SECRET_KEY"):
        app.config["SECRET_KEY"] = secrets.token_hex(32)

    configure_database(app)
    session_factory = get_session_factory(app)
    app.extensions["scenario_ai"] = app.config.get("SCENARIO_AI") or GeminiScenarioAI(
        api_key=app.config.get("GEMINI_API_KEY"),
        model=app.config.get("GEMINI_MODEL"),
    )

    @app.get("/api/auth/session")
    def auth_session():
        if app.config["STRATIFY_DEMO_MODE"]:
            demo_user = g.db_session.scalar(select(User).where(User.username == app.config["STRATIFY_DEMO_OWNER_USERNAME"]))
            if demo_user is None:
                return jsonify({"error": "Demo owner account is not configured. Set STRATIFY_DEMO_OWNER_USERNAME and seed the demo business."}), 503
            return jsonify({"authenticated": True, "demo_mode": True, "username": "Demo reviewer"})
        user = g.db_session.get(User, session.get("user_id")) if session.get("user_id") else None
        return jsonify({"authenticated": user is not None, "username": user.username if user else None})

    @app.post("/api/auth/register")
    def auth_register():
        if app.config["STRATIFY_DEMO_MODE"]:
            return jsonify({"error": "Account registration is disabled in demo mode."}), 404
        payload = request.get_json(silent=True)
        username = payload.get("username") if isinstance(payload, dict) else None
        password = payload.get("password") if isinstance(payload, dict) else None
        if not isinstance(username, str) or not 3 <= len(username.strip()) <= 64 or not all(c.isalnum() or c in "_.-" for c in username.strip()):
            return jsonify({"error": "Username must be 3–64 characters using letters, numbers, dots, dashes, or underscores."}), 422
        if not isinstance(password, str) or len(password) < 6 or len(password) > 12:
            return jsonify({"error": "Password must be between 6 and 12 characters."}), 422
        user = User(username=username.strip(), password_hash=generate_password_hash(password))
        g.db_session.add(user)
        try:
            g.db_session.commit()
        except IntegrityError:
            g.db_session.rollback()
            return jsonify({"error": "That username is already registered."}), 409
        session.clear()
        session["user_id"] = user.id
        session.permanent = True
        return jsonify({"authenticated": True, "username": user.username}), 201

    @app.post("/api/auth/login")
    def auth_login():
        if app.config["STRATIFY_DEMO_MODE"]:
            return jsonify({"error": "Sign-in is disabled in demo mode."}), 404
        payload = request.get_json(silent=True)
        username = payload.get("username") if isinstance(payload, dict) else None
        password = payload.get("password") if isinstance(payload, dict) else None
        user = g.db_session.scalar(select(User).where(User.username == username)) if isinstance(username, str) else None
        if user is None or not isinstance(password, str) or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Incorrect username or password."}), 401
        session.clear()
        session["user_id"] = user.id
        session.permanent = True
        return jsonify({"authenticated": True})

    @app.post("/api/auth/logout")
    def auth_logout():
        session.clear()
        return jsonify({"authenticated": False})

    @app.teardown_appcontext
    def close_session(error: BaseException | None = None) -> None:
        session = g.pop("db_session", None)
        if session is not None:
            if error is not None:
                session.rollback()
            session.close()

    @app.get("/api/health")
    def health():
        try:
            g.db_session.execute(text("SELECT 1"))
        except Exception:
            app.logger.exception("Database health check failed")
            return jsonify({"status": "unavailable", "database": "disconnected"}), 503
        return jsonify({"status": "ok", "database": "connected"})

    @app.errorhandler(RequestValidationError)
    def handle_validation_error(error: RequestValidationError):
        return jsonify({"error": error.message, "fields": error.fields}), 422

    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException):
        return jsonify({"error": error.description}), error.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        app.logger.exception("Unhandled API error")
        return jsonify({"error": "An unexpected server error occurred."}), 500

    app.register_blueprint(businesses.bp, url_prefix="/api")
    app.register_blueprint(scenarios.bp, url_prefix="/api")

    @app.cli.command("init-db")
    def init_db_command() -> None:
        """Create the initial development schema."""
        engine = app.extensions["stratify_engine"]
        Base.metadata.create_all(engine)
        click.echo("Database schema created.")

    @app.cli.command("seed-demo")
    def seed_demo_command() -> None:
        """Insert the fictional KL Electronics business if absent."""
        with session_factory.begin() as session:
            owner_username = os.environ.get("STRATIFY_DEMO_OWNER_USERNAME")
            owner = session.scalar(select(User).where(User.username == owner_username)) if owner_username else None
            if owner is None:
                raise click.ClickException("Set STRATIFY_DEMO_OWNER_USERNAME to the account that should own the demo business.")
            business = seed_demo_business(session, owner.id)
            click.echo(f"Demo business ready (id={business.id}).")

    @app.before_request
    def open_request_session() -> None:
        g.db_session = session_factory()

    @app.before_request
    def require_owner_session():
        if not request.path.startswith("/api/"):
            return
        if request.path in {"/api/health", "/api/auth/session", "/api/auth/register", "/api/auth/login", "/api/auth/logout"}:
            return
        if app.config["STRATIFY_DEMO_MODE"]:
            demo_user = g.db_session.scalar(select(User).where(User.username == app.config["STRATIFY_DEMO_OWNER_USERNAME"]))
            if demo_user is None:
                return jsonify({"error": "Demo owner account is not configured."}), 503
            g.current_user = demo_user
            return
        user = g.db_session.get(User, session.get("user_id")) if session.get("user_id") else None
        if user is None:
            return jsonify({"error": "Authentication required."}), 401
        g.current_user = user

    return app
