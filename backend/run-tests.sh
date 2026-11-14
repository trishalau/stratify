#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PYTHON=".venv/bin/python"
BASE_PYTHON="${PYTHON_BIN:-python3}"

if [ ! -x "$PYTHON" ]; then
  echo "Creating backend virtual environment with $BASE_PYTHON..."
  "$BASE_PYTHON" -m venv .venv
fi

if ! "$PYTHON" -c "import flask, click, sqlalchemy, dotenv, psycopg" >/dev/null 2>&1; then
  echo "Installing backend dependencies..."
  "$PYTHON" -m pip install --upgrade pip
  "$PYTHON" -m pip install --retries 5 --timeout 30 -r requirements.txt
fi

exec "$PYTHON" -m unittest discover -s tests -v "$@"
