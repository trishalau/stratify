# Stratify backend

Phase 2 Flask REST API and SQLAlchemy persistence for business profiles and scenario records. This phase does not calculate financial results or connect to an AI provider.

## Local setup

From this directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
docker compose up -d db
flask --app run:app init-db
flask --app run:app seed-demo
python run.py
```

The local PostgreSQL service uses the development-only credentials in `compose.yaml`. Keep those credentials local; replace them with managed secrets for any deployed environment. `DATABASE_URL` is read from `.env` and must point to PostgreSQL for a normal run.

The API is served at `http://127.0.0.1:5000/api`. `GET /api/health` checks the database connection. Amounts are returned as decimal strings to avoid losing cents through JSON floating-point conversion. Unknown inventory and liabilities remain `null`.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API and database health |
| `GET` | `/api/businesses` | List businesses |
| `POST` | `/api/businesses` | Create a business profile |
| `GET` | `/api/businesses/<id>` | Get one business |
| `PATCH` | `/api/businesses/<id>` | Update supplied profile fields |
| `GET` | `/api/businesses/<id>/scenarios` | List a business's scenarios |
| `POST` | `/api/businesses/<id>/scenarios` | Create a draft scenario |
| `GET` | `/api/scenarios/<id>` | Get a scenario |
| `PATCH` | `/api/scenarios/<id>` | Edit a draft scenario |
| `POST` | `/api/scenarios/<id>/confirm` | Confirm reviewed assumptions |

Scenario records begin in `draft` status. Confirmation requires explicit `{ "confirmed": true }`, at least one assumption, and an empty `missing_information` list. Confirmed scenarios are locked from edits. There is no simulation endpoint in this phase, so scenario data cannot produce financial outputs yet.

Validation errors return HTTP 422 with a JSON `error` and field-level `fields`. The API currently has no authentication and is intended for local prototype use.

## Check the API

```bash
python -m unittest discover -s tests
curl http://127.0.0.1:5000/api/health
curl http://127.0.0.1:5000/api/businesses
```

The automated API tests use an in-memory SQLite database as a fast test adapter. PostgreSQL remains the configured application database. The initial schema uses SQLAlchemy `create_all`; schema migrations are not introduced in this phase.
