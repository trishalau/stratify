import click
import os

from dotenv import load_dotenv
from flask import Flask, g, jsonify
from sqlalchemy import text
from werkzeug.exceptions import HTTPException

from .database import Base, configure_database, get_session_factory
from .routes import businesses, scenarios
from .seed import seed_demo_business
from .validation import RequestValidationError


def create_app(test_config: dict | None = None) -> Flask:
    load_dotenv()
    app = Flask(__name__)
    app.config.from_mapping(DEBUG=False, DATABASE_URL=os.environ.get("DATABASE_URL"), MAX_CONTENT_LENGTH=1024 * 1024)
    app.config.from_prefixed_env()

    if test_config:
        app.config.update(test_config)

    configure_database(app)
    session_factory = get_session_factory(app)

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
            business = seed_demo_business(session)
            click.echo(f"Demo business ready (id={business.id}).")

    @app.before_request
    def open_request_session() -> None:
        g.db_session = session_factory()

    return app
