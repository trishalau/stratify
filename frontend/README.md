# Stratify

React and TypeScript frontend for the Stratify business scenario simulator. The app uses fictional KL Electronics Sdn. Bhd. data and keeps profile edits in shared in-memory state. Edits survive client-side navigation and reset on a full page refresh.

## Run locally

```bash
npm install
npm run dev
```

Vite prints the local URL after startup. Build the production bundle with `npm run build` and run the configured lint checks with `npm run lint`.

## API configuration

The frontend sends API requests to `VITE_API_BASE_URL` when it is set. Configure it as the backend origin only, for example `https://your-backend-project.vercel.app` (do not add `/api`). This value is included in the public frontend bundle, so it must never contain a key, password, or database URL.

For local development, leave `VITE_API_BASE_URL` blank or unset. Vite proxies `/api` requests to Flask at `http://127.0.0.1:5000`.

## Vercel frontend project

Connect the repository to Vercel and set the project root to `frontend`. Use `npm run build` as the build command and `dist` as the output directory. Configure `VITE_API_BASE_URL` separately for Preview and Production to point at the corresponding backend deployment. `vercel.json` rewrites page routes to `index.html`, allowing React Router pages to load when opened directly or refreshed.

The only frontend environment variable is the public API origin. Configure `DATABASE_URL`, `GEMINI_API_KEY`, Flask secrets, and demo-mode settings only in the backend project's environment.

New scenario results and scenario history are held in shared React memory for the current browser session; a refresh clears them along with edited business values. The Vercel config adds browser security headers and a Content Security Policy. `connect-src` allows Vercel-hosted backend projects by default; add a custom HTTPS backend origin there if you use one.

| Variable | Example | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `https://your-backend-project.vercel.app` | Public backend origin. Set separately for Preview and Production; never put credentials or API keys in this variable. |

## Frontend stack

- React and TypeScript with Vite
- Tailwind CSS v4 and shadcn/ui components
- React Router for page navigation
- Recharts for dashboard and result-preview charts

## Application pages

The frontend includes the dashboard, business profile, scenario simulator, simulation results, scenario history, and settings. The shared demo business context is the single source of truth for visible business data. Profile changes remain in memory and are sent as validated snapshots for scenario requests; they are not persisted by the frontend.
