from flask import Flask
from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def configure_database(app: Flask) -> None:
    database_url = app.config.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL."
        )

    # Neon supplies PostgreSQL URLs with the generic `postgresql://` scheme.
    # This project installs psycopg 3 (not psycopg2), so tell SQLAlchemy to use
    # its psycopg 3 dialect explicitly.
    if database_url.startswith("postgresql://"):
        database_url = "postgresql+psycopg://" + database_url.removeprefix("postgresql://")

    engine_options = {"pool_pre_ping": True}
    if database_url.startswith(("postgresql://", "postgresql+")):
        # Keep the per-function-instance connection count bounded. The managed
        # deployment database should also provide a pooler for aggregate scale.
        engine_options.update(
            pool_size=2,
            max_overflow=0,
            pool_timeout=10,
            pool_recycle=300,
        )
        if app.config.get("SERVERLESS_RUNTIME"):
            url = make_url(database_url)
            sslmode = url.query.get("sslmode")
            if sslmode is None:
                # PostgreSQL deployments must not silently fall back to plaintext.
                url = url.update_query_dict({"sslmode": "require"})
            elif sslmode not in {"require", "verify-ca", "verify-full"}:
                raise RuntimeError(
                    "Serverless PostgreSQL requires sslmode=require, verify-ca, or verify-full."
                )
            database_url = url

    engine = create_engine(database_url, **engine_options)
    app.extensions["stratify_engine"] = engine
    app.extensions["stratify_session_factory"] = sessionmaker(
        bind=engine,
        autoflush=False,
        expire_on_commit=False,
    )


def get_session_factory(app: Flask) -> sessionmaker[Session]:
    return app.extensions["stratify_session_factory"]


def get_engine(app: Flask) -> Engine:
    return app.extensions["stratify_engine"]
