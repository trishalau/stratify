# Stratify backend

Flask REST API, SQLAlchemy persistence, a deterministic financial engine, and a separately validated Gemini integration for the Stratify prototype.

## Local setup

From this directory:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
# Edit .env and set a random STRATIFY_SESSION_SECRET before starting the API.
docker compose up -d db
flask --app run:app init-db
flask --app run:app seed-demo
python run.py
```

The local PostgreSQL service uses the development-only credentials in `compose.yaml`. Keep those credentials local; replace them with managed secrets for any deployed environment. `DATABASE_URL` is read from `.env` and must point to PostgreSQL for a normal run.

The API is served at `http://127.0.0.1:5000/api`. `GET /api/health` checks the database connection. Amounts are returned as decimal strings to avoid losing cents through JSON floating-point conversion. Unknown inventory and liabilities remain `null`.

For a reviewer-facing hackathon demo, `STRATIFY_DEMO_MODE` defaults to `true` (set it to `false` to use the preserved sign-in flow). Reviewers open directly to the dashboard. Demo API requests do not look up an owner or depend on the `users` table; business and scenario reads are scoped to the seeded `KL Electronics Sdn. Bhd.` record. Registration and sign-in endpoints are disabled in demo mode; no database rows or authentication code are removed.

Demo profile edits live only in the React business context and reset to the original sample values on refresh. Scenario interpretation, simulation and explanation requests must send a complete, validated snapshot of that in-memory profile; the API will not silently substitute stale database figures. The snapshot is used only for that request and is not written to PostgreSQL. Business create, update and delete API routes are blocked in demo mode to protect the PostgreSQL seed. Scenario records remain saved as before. Keep database and Gemini credentials only in this backend `.env`; never define them as Vite environment variables.

With `STRATIFY_DEMO_MODE=false`, users can create accounts from the sign-in screen. Passwords are stored as Werkzeug password hashes; responses never include passwords or hashes. Set `STRATIFY_SESSION_SECRET` to a long random value and do not use the example placeholder. The browser receives only a signed, HttpOnly, SameSite=Lax session cookie. Cookies are non-Secure for local HTTP; set `STRATIFY_COOKIE_SECURE=true` when serving over HTTPS. `/api/health` and auth endpoints are public; in production mode, business and scenario endpoints require an authenticated session and enforce owner scoping. Passwords must be 6–12 characters for the current prototype. Account recovery and email verification are not implemented.

### Ownership migration for an existing database

Back up the database before applying schema changes. Do not run `init-db` as a substitute for these migrations; `create_all` does not alter existing tables.

1. Apply `migrations/20261116_add_business_owner_nullable.sql`. Existing rows and scenario records are preserved; the new owner field is nullable temporarily.
2. Choose the account that should own the existing, previously shared business data. Backfill explicitly, replacing the username below with that account:

   ```sql
   UPDATE businesses
   SET owner_id = (SELECT id FROM users WHERE username = 'your-chosen-username')
   WHERE owner_id IS NULL;
   ```

   Confirm the username exists and that no businesses remain unowned. All scenarios remain with their businesses through their existing foreign keys.
3. Apply `migrations/20261117_require_business_owner.sql`. It refuses to proceed if any business remains unowned, then makes ownership mandatory.
4. Set `STRATIFY_DEMO_OWNER_USERNAME` to the account that should own a newly seeded demo business before running `flask --app run:app seed-demo`.

The API derives ownership from the authenticated session. It ignores no ownership input because `owner_id` is rejected as an unsupported business field. Cross-account resource access returns 404 to avoid disclosing another account's records. Deleting an owned business deletes its dependent scenarios by the existing cascade; deleting a user with businesses is restricted.

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
| `POST` | `/api/businesses/<id>/scenarios/interpret` | Interpret chat messages into validated assumptions and questions |
| `GET` | `/api/scenarios/<id>` | Get a scenario |
| `PATCH` | `/api/scenarios/<id>` | Edit a draft scenario |
| `POST` | `/api/scenarios/<id>/confirm` | Confirm reviewed assumptions |
| `POST` | `/api/scenarios/<id>/simulate` | Calculate a confirmed supported scenario |
| `POST` | `/api/scenarios/<id>/explain` | Recalculate a confirmed scenario and return a qualitative AI explanation |

Scenario records begin in `draft` status. Confirmation requires explicit `{ "confirmed": true }`, at least one assumption, and an empty `missing_information` list. Confirmed scenarios are locked from edits. The simulation endpoint checks confirmation again before calculation.

The engine currently calculates supplier price increases, sales decreases, and percentage changes to one expense category (`supplier_costs`, `rent`, `staff_salaries`, or `other_expenses`). It uses Python `Decimal` with half-up cent rounding. It reports a baseline and central estimate. Optimistic/pessimistic estimates are returned only when both alternative assumptions are explicitly provided; the engine does not invent them. Cash-flow change is unavailable because payment timing, tax, debt, and capital-spending information is not part of the profile. No calculations are implemented for customer loss, new competitors, interest rates, or a new branch yet.

## AI interpretation and explanations

Create a Gemini Developer API key in [Google AI Studio](https://aistudio.google.com/apikey), then set `GEMINI_API_KEY` in `backend/.env`. Optionally choose a supported model with `GEMINI_MODEL`; the example uses `gemini-3.5-flash-lite`. The provider uses Google's Gemini Developer API directly, so no additional SDK is required. Keep the key on the backend; do not add it to Vite variables or frontend code. Restart Flask after changing `.env` or switching providers. Without a key, AI routes return HTTP 503 and deterministic simulation remains available.

If Gemini returns HTTP 403, check that the key belongs to the Gemini Developer API project in AI Studio, the project has access to the Generative Language API, and API-key restrictions permit that API. Some project or region configurations may also require billing. The backend returns a targeted error for 403 responses without exposing the key.

Free-tier Gemini prompts and responses may be used by Google to improve its products, so do not send confidential business data through a free-tier key.

The interpretation endpoint accepts a `messages` array containing `user` and `assistant` messages, with up to 24 messages per turn. The provider receives the conversation and the names of available business profile fields, not the profile's financial amounts. Its structured response is checked against an application contract. Any numeric assumption must quote matching text written by the user and include its unit; unknown, ambiguous-unit, or out-of-range values are omitted from assumptions and produce follow-up questions. Common terms such as `payroll` can map to the saved `staff_salaries` line when the user wording supports that mapping. Other expense categories, such as marketing, are not silently mapped to `other_expenses`; the assistant asks the user which saved line to use. Recoverable model-validation problems return a clarification turn with no accepted assumptions instead of a red API error. Interpretation never returns calculation results. Unsupported event types can be understood and clarified, but are not sent to the current financial engine.

The user must review and confirm the assumptions before `/simulate` can calculate. `/explain` only accepts confirmed scenarios, runs the deterministic engine first, then asks the AI for a qualitative explanation. Explanations cannot add numerical results, and each metric's positive/negative direction is checked against the engine output. The engine's calculation remains the source of all displayed numbers.

AI tests inject a fake provider, so the suite makes no model requests and does not require an API key. Real provider behavior requires a configured key and is not covered by these automated tests.

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

The full suite includes financial-engine, API-route, AI-contract, and mocked AI-route tests. API tests use in-memory SQLite and do not exercise PostgreSQL. The project owner separately verified the local Mac PostgreSQL container as healthy, `pg_isready` as accepting connections, `/api/health` as connected, and `/api/businesses/1` as returning the demo business. A sandbox's inability to access that Mac's Docker socket is an environment boundary, not evidence of an application error.

For frontend development, run Vite from `frontend` with `npm run dev`; its `/api` proxy expects Flask at `http://127.0.0.1:5000`. Start Flask separately using `python run.py`. Production hosting and cross-origin API configuration are not part of this prototype phase.
