# Stratify

Stratify is a prototype financial scenario simulator for small businesses. It gives a business owner a fictional baseline, lets them describe a possible change in plain language, and shows a transparent estimate of how that change could affect monthly profit and cash. The included KL Electronics Sdn. Bhd. figures are fictional; this is a demo, not accounting or financial advice.

## What it does

- Shows a dashboard and editable demo business profile.
- Uses Gemini to interpret a scenario description and ask for missing details.
- Uses a deterministic Python financial engine for calculations. Gemini does not calculate or change the displayed numbers.
- Supports supplier cost increases, sales decreases, and percentage changes to supported expense categories. The app asks for clarification when it cannot safely map an assumption.
- Keeps demo profile edits and new scenario results in browser memory. They reset when the page is refreshed.

## Project layout and tools

| Path | Contents |
| --- | --- |
| `frontend/` | React, TypeScript, Vite, Tailwind CSS, React Router, and Recharts. |
| `backend/` | Flask API, SQLAlchemy models, Psycopg 3, Gemini integration, and deterministic financial engine. |
| `backend/migrations/` | SQL migrations for the public demo schema, seed data, rate limiting, and the separate account-owned schema. |
| `backend/compose.yaml` | Local PostgreSQL 17 service for Docker Compose. |

The frontend uses Node.js and npm dependencies declared in `frontend/package.json` and `frontend/package-lock.json`. The backend uses Python 3.13 and dependencies in `backend/requirements.txt`. There is no root JavaScript package; install Node dependencies from `frontend/`, not the repository root.

Hosted services: Vercel serves the frontend and Flask backend as separate projects; Neon provides cloud PostgreSQL in Singapore; Google Gemini provides optional scenario interpretation and explanations. Vercel and Neon CLIs are used for deployment and database administration. Local development uses Docker Compose for PostgreSQL.

## Run locally

Keep the existing local Docker database and its volume in place. Start it from `backend/`:

```bash
cd backend
docker compose up -d db
```

Create the Python environment and install backend dependencies if they are not already installed:

```bash
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

Configure `backend/.env` from `backend/.env.example` only if a local environment file does not already exist. Set its `DATABASE_URL` to the local Compose database and, if using AI locally, configure `GEMINI_API_KEY`. See [backend/README.md](backend/README.md) for schema initialization, seeding, authentication mode, migrations, and API details. Run Flask from `backend/` with `python run.py`.

In another terminal, run the frontend:

```bash
cd frontend
npm ci
npm run dev
```

Vite proxies `/api` to Flask at `http://127.0.0.1:5000` when `VITE_API_BASE_URL` is blank. See [frontend/README.md](frontend/README.md) for frontend-specific details.

## Deployments

- Frontend Vercel project root: `frontend/`. Its only environment variable is `VITE_API_BASE_URL`, the public backend origin without `/api`.
- Backend Vercel project root: `backend/`. It runs Flask on Python 3.13 in the Singapore region.
- The backend uses Neon’s pooled TLS PostgreSQL connection URL through `DATABASE_URL`. The database URL, `GEMINI_API_KEY`, and `STRATIFY_SESSION_SECRET` belong only in backend Vercel settings; never put them in Vite variables or frontend code.
- Backend CORS allows exact frontend Production origins. Keep Preview and Production settings aligned with the frontend deployment being used.

The deployed Preview and Production backend environments currently point to the same Neon project/branch. The cloud database contains the fictional demo business and shared AI rate-limit counters. Use a separate Neon branch/database if Preview needs isolated data.

## Data and privacy

- **Local data:** Docker Compose stores PostgreSQL data in the named `stratify-postgres` volume. It is separate from Neon. Do not remove the volume if you need to retain the local database.
- **Cloud data:** Neon stores the fictional KL Electronics business row and AI rate-limit counters. The deployed demo does not persist profile edits or new scenario results. Existing cloud scenario rows, if any, are read-only in demo mode.
- **AI requests:** Scenario text is sent from the backend to Google Gemini for interpretation. Explanation requests send the deterministic calculation for a qualitative explanation. Do not enter confidential real-business data. Google’s Gemini free tier may use prompts and responses to improve its products; review Google’s current terms before sending sensitive information.
- **Browser and credentials:** The browser receives the public API origin only. Database and Gemini credentials stay in the backend environment. Flask session signing secrets also stay server-side. The demo API is intentionally public and returns fictional data; CORS restricts browser origins but is not authentication.
- **Local configuration:** `.env`, `.env.local`, Python virtual environments, and `node_modules` are ignored by Git. The committed `.env.example` files contain placeholders, not live credentials.

## Environment variable names

Configure values in the appropriate project’s environment settings; this README intentionally contains no secret values.

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Frontend only | Public origin of the matching Flask deployment. |
| `DATABASE_URL` | Backend only | Neon pooled TLS PostgreSQL connection string. |
| `GEMINI_API_KEY` | Backend only | Optional Google Gemini Developer API credential. |
| `GEMINI_MODEL` | Backend only, optional | Gemini model override. |
| `STRATIFY_SESSION_SECRET` | Backend only | Flask session signing secret; use a distinct random value per environment. |
| `STRATIFY_DEMO_MODE` | Backend only | Enables the fictional public demo when `true`. |
| `STRATIFY_CORS_ORIGINS` | Backend only | Comma-separated exact frontend origins allowed to call the API. |
| `AI_RATE_LIMIT_PER_MINUTE` | Backend only, optional | Per-client Gemini request limit; defaults to 12. |
| `STRATIFY_COOKIE_SECURE` | Backend only | Local cookie setting; Vercel serverless mode enforces secure cookies. |

For the full endpoint list, schema notes, supported calculations, and migration instructions, see [backend/README.md](backend/README.md).
