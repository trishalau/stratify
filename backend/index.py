"""Vercel WSGI entry point. Local development continues to use run.py."""

from app import create_app

app = create_app(serverless=True)
