# Stratify backend

Flask REST API, SQLAlchemy persistence, and a deterministic financial engine for the Stratify prototype. Scenario interpretation still does not use an AI provider.

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
| `POST` | `/api/scenarios/<id>/simulate` | Calculate a confirmed supported scenario |

Scenario records begin in `draft` status. Confirmation requires explicit `{ "confirmed": true }`, at least one assumption, and an empty `missing_information` list. Confirmed scenarios are locked from edits. The simulation endpoint checks confirmation again before calculation.

The engine currently calculates supplier price increases, sales decreases, and percentage changes to one expense category (`supplier_costs`, `rent`, `staff_salaries`, or `other_expenses`). It uses Python `Decimal` with half-up cent rounding. It reports a baseline and central estimate. Optimistic/pessimistic estimates are returned only when both alternative assumptions are explicitly provided; the engine does not invent them. Cash-flow change is unavailable because payment timing, tax, debt, and capital-spending information is not part of the profile. No calculations are implemented for customer loss, new competitors, interest rates, or a new branch yet.

Supported assumption fields:

- `supplier_price_increase`: `supplier_cost_increase_percent`; optional pair `optimistic_supplier_cost_increase_percent` and `pessimistic_supplier_cost_increase_percent`.
- `sales_decrease`: `sales_decrease_percent`; optional pair `optimistic_sales_decrease_percent` and `pessimistic_sales_decrease_percent`.
- `expense_change`: `expense_category` and `expense_change_percent`; optional pair `optimistic_expense_change_percent` and `pessimistic_expense_change_percent`.

Validation errors return HTTP 422 with a JSON `error` and field-level `fields`. The API currently has no authentication and is intended for local prototype use.

## Check the API

Run the full suite with the project virtual environment. The runner creates `.venv` and installs `requirements.txt` if dependencies are missing, so it never falls back to a system Python that lacks Flask or click:

```bash
./run-tests.sh
```

If the virtual environment is already active, the equivalent command is:

```bash
python -m unittest discover -s tests -v
```

Do not run the suite with the system `python3` or `python`; those interpreters do not have the backend dependencies.

With the API running in another terminal:

```bash
curl http://127.0.0.1:5000/api/health
curl http://127.0.0.1:5000/api/businesses
```

The financial engine tests use only Python's standard library and can run separately with `./run-tests.sh -p 'test_financial_engine.py'`. API tests use an in-memory SQLite database as a fast test adapter. PostgreSQL remains the configured application database. The initial schema uses SQLAlchemy `create_all`; schema migrations are not introduced in this phase.

The full suite currently passes 13 tests, including Flask route tests against SQLite. Those tests do not verify a live PostgreSQL connection. In this environment, Docker socket access and a localhost PostgreSQL connection are unavailable; verify `GET /api/health` after starting the documented PostgreSQL service on a machine with Docker access.
