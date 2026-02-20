# ResponsiaTax Deployment Guide

## Azure Resources (already created)

| Resource | Name | Location |
|----------|------|----------|
| Resource Group | `ResponsiaTax` | West Europe |
| Container Registry | `responsiataxacr` (responsiataxacr.azurecr.io) | West Europe |
| Web App | `responsia-tax` (responsia-tax.azurewebsites.net) | West Europe |
| App Service Plan | `asp-responsia` (shared with ReponsIA) | West Europe |
| Database | `responsia_tax` on fc-shared-pg | West Europe |

## Remaining Setup Steps

### 1. Configure Web App environment variables

```bash
az webapp config appsettings set \
  --resource-group ResponsiaTax \
  --name responsia-tax \
  --settings \
    DB_HOST=fc-shared-pg.postgres.database.azure.com \
    DB_PORT=5432 \
    DB_USER=pgadmin \
    DB_PASSWORD=FcPostgres2025xK9 \
    DB_NAME=responsia_tax \
    NODE_ENV=production \
    TYPEORM_MODE_SSL=true \
    PORT=3000 \
    WEBSITES_PORT=3000
```

### 2. Get ACR credentials for GitHub Actions

```bash
az acr credential show --name responsiataxacr
```

### 3. Get Web App publish profile

```bash
az webapp deployment list-publishing-profiles \
  --name responsia-tax \
  --resource-group ResponsiaTax \
  --xml
```

### 4. Set GitHub Actions secrets

Go to https://github.com/Forecast-Consulting-AMO/ResponsiaTax/settings/secrets/actions

Add these repository secrets:

| Secret Name | Value |
|-------------|-------|
| `ACR_LOGIN_SERVER` | `responsiataxacr.azurecr.io` |
| `ACR_USERNAME` | (from step 2 output) |
| `ACR_PASSWORD` | (from step 2 output) |
| `AZURE_WEBAPP_NAME` | `responsia-tax` |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | (full XML from step 3) |

### 5. Push to trigger deployment

Once secrets are set, push to `main` branch to trigger the deploy workflow.

### 6. Configure LLM/OCR in the app

After deployment, go to https://responsia-tax.azurewebsites.net/settings and configure:
- Azure OpenAI endpoint + API key
- Azure Anthropic endpoint + API key (if available)
- Azure Document Intelligence endpoint + key

## Local Development

```bash
cd C:\Users\AdelMoulai\ResponsiaTax
docker compose -f docker/dev/docker-compose.yml up -d   # Start local Postgres
npm run dev                                               # Backend :3000 + Frontend :4200
```

Open http://localhost:4200 in your browser.
