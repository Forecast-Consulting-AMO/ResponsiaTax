# ResponsiaTax

Blank Nx monorepo template based on the [Forecast Consulting SWAS](https://github.com/Forecast-Consulting/swas) architecture.

## Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | **Nx 21** |
| Backend | **NestJS 11** + TypeORM 0.3 + PostgreSQL 15 |
| Frontend | **React 19** + MUI 7 + Vite 6 |
| Auth | **Auth0** (JWT strategy via Passport) |
| API client | **Orval** (auto-generated React Query hooks from OpenAPI) |
| i18n | **i18next** (FR, EN, NL) |
| Logging | **pino** (structured JSON) |
| CI | GitHub Actions (lint, typecheck, build) |
| Deploy | Docker → Azure Web App / Static Web Apps |

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Copy env
cp .env.example .env

# 3. Start dev Postgres
docker compose -f docker/dev/docker-compose.yml up -d

# 4. Start backend + frontend
npm run dev
```

- Backend: http://localhost:3000
- Swagger: http://localhost:3000/api/docs
- Frontend: http://localhost:4200

## Project structure

```
├── apps/
│   ├── responsia-tax-backend/        # NestJS 11 API
│   │   └── src/
│   │       ├── app/        # Root module, controller, service
│   │       ├── auth/       # Auth0 JWT guard + strategy
│   │       └── health/     # Health check endpoint
│   └── responsia-tax-frontend/       # React 19 SPA
│       └── src/
│           ├── api/        # Orval mutator + generated hooks
│           ├── app/        # Root App component
│           ├── i18n/       # Translations (fr, en, nl)
│           ├── pages/      # Page components
│           ├── providers/  # Auth0, Notistack
│           ├── routes/     # AppRouter
│           └── theme/      # MUI theme
├── libs/
│   └── shared-types/       # Shared TypeScript types
├── docker/dev/             # Dev docker-compose (Postgres + PGAdmin)
└── .github/workflows/      # CI pipeline
```

## Scripts

| Command | Description |
|---------|------------|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run backend:serve` | Start NestJS dev server (port 3000) |
| `npm run frontend:serve` | Start Vite dev server (port 4200) |
| `npm run generate:api` | Generate API hooks from OpenAPI (Orval) |
| `npm run lint` | Lint all projects |
| `npm run test` | Test all projects |
| `npm run build` | Build all projects |

## Creating a new app from this template

1. Clone this repo
2. Find-and-replace `@fc/` with your org scope (e.g., `@myorg/`)
3. Rename `responsia-tax-backend` / `responsia-tax-frontend` to your app name
4. Update `nx.json`, `package.json`, and individual `package.json` files accordingly
5. Set up your Auth0 tenant and fill in `.env`
6. Start building!
