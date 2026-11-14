from flask import Flask
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def configure_database(app: Flask) -> None:
    database_url = app.config.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL."
        )

    engine = create_engine(database_url, pool_pre_ping=True)
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
