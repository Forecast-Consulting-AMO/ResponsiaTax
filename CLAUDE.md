# CLAUDE.md — ResponsiaTax

## Overview

ResponsiaTax is a tax audit response assistant. It helps tax consultants prepare replies to Belgian tax authority "Demande de Renseignements" (DR) documents. Users upload DR PDFs, the system extracts questions via OCR + LLM, and provides AI-assisted response drafting with multi-model LLM support.

Built on the FC SWAS template: Nx 21 monorepo, NestJS 11 backend + React 19 frontend, TypeORM + PostgreSQL, MUI 7.

## Commands

```bash
npm install --legacy-peer-deps    # Install all dependencies
npm run dev                       # Backend (3000) + Frontend (4200)
npm run backend:serve             # NestJS only
npm run frontend:serve            # Vite only
npm run generate:api              # Orval: regenerate API hooks from OpenAPI
npm run lint                      # Lint all
npm run build                     # Build all
docker compose -f docker/dev/docker-compose.yml up -d  # Dev Postgres (port 5433)
```

## Architecture

- `apps/responsia-tax-backend/` — NestJS 11, TypeORM, pino logging
- `apps/responsia-tax-frontend/` — React 19, Vite 6, MUI 7, i18next (FR/EN/NL)
- `libs/shared-types/` — Shared TS types/enums

### Backend modules

| Module | Purpose |
|--------|---------|
| DossierModule | Tax audit case (dossier) CRUD |
| RoundModule | Rounds of Q&A within a dossier |
| DocumentModule | File upload + Azure Document Intelligence OCR |
| QuestionModule | Question extraction from DR PDFs + response management |
| LlmModule | Multi-model LLM chat (Azure OpenAI + Azure Anthropic) |
| SettingModule | Key-value settings (API keys, default prompts) |
| ExportModule | DOCX export of responses |

### Key entities

- **Dossier** — company, tax type/year, reference, status, custom system prompt
- **Round** — exchange round within a dossier (received date, deadline, status)
- **Document** — uploaded files with OCR text
- **Question** — individual questions extracted from DR, with response text
- **LlmMessage** — chat history per question (system/user/assistant messages)
- **Setting** — runtime config (LLM keys, OCR keys, default model/prompt)

## API

- URI versioning: `/api/v1/...`
- Swagger at `/api/docs`
- Global `ValidationPipe` (whitelist + transform)
- Auth: Skipped in v1 (Auth0 module exists but no guards on routes)

### Key endpoints

```
GET/POST       /api/v1/dossiers
GET/PATCH/DEL  /api/v1/dossiers/:id
GET/POST       /api/v1/dossiers/:dossierId/rounds
GET/PATCH      /api/v1/rounds/:id
POST           /api/v1/dossiers/:dossierId/documents (multipart upload)
POST           /api/v1/documents/:id/ocr
POST           /api/v1/documents/:docId/extract-questions
GET/PATCH      /api/v1/questions/:id
POST           /api/v1/questions/:questionId/chat
GET            /api/v1/llm/models
POST           /api/v1/rounds/:roundId/export
GET/PUT        /api/v1/settings/:key
```

## Database

PostgreSQL 15 via TypeORM. Dev docker-compose exposes port 5433. `synchronize: true` in dev only. DB name: `responsia_tax_dev`.

## LLM Configuration

All LLM/OCR settings stored in the `setting` DB table (not env vars). Configure via the Settings page:

| Setting key | Purpose |
|-------------|---------|
| azure_openai_endpoint | Azure OpenAI endpoint URL |
| azure_openai_api_key | Azure OpenAI API key |
| azure_openai_api_version | API version (default: 2024-12-01-preview) |
| azure_anthropic_endpoint | Azure AI Foundry endpoint for Claude models |
| azure_anthropic_api_key | Azure AI Foundry API key |
| azure_di_endpoint | Azure Document Intelligence endpoint |
| azure_di_key | Azure Document Intelligence key |
| default_llm_model | Default model ID for LLM calls |
| default_system_prompt | Default system prompt for response drafting |

## Environment

See `.env.example`. Only DB config and VITE_API_URL needed for local dev. LLM/OCR keys go in the Settings page.
