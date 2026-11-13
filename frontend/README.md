# Stratify

Phase 1 frontend prototype for an SME business scenario planner. The app uses fictional data for KL Electronics Sdn. Bhd. and keeps all edits in the browser session.

## Run locally

```bash
npm install
npm run dev
```

Vite prints the local URL after startup. Build the production bundle with `npm run build` and run the configured lint checks with `npm run lint`.

## Frontend stack

- React and TypeScript with Vite
- Tailwind CSS v4 and shadcn/ui components
- React Router for page navigation
- Recharts for dashboard and result-preview charts

## Phase 1 scope

The frontend includes the dashboard, business profile, scenario simulator, result preview, history, and settings. The scenario confirmation step is interactive, but it does not run a financial calculation. The result page is a fixed supplier-cost illustration, clearly separated from user-entered assumptions. AI interpretation, persistent storage, APIs, and the Python financial engine belong to later phases.
