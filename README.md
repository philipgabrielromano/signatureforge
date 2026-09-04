# SignatureForge

SignatureForge is a Microsoft 365 email signature management platform. Marketing and IT teams design HTML signatures, assign them to people or departments, and SignatureForge **writes the HTML directly into each user's Exchange Online mailbox**.

This is not a mail-flow product. There are **no transport rules, journaling, connectors, or SMTP relays**. Outlook on Windows, Mac, iOS, Android, and the web discovers the roaming mailbox signature on its own.

The production target is **Render.com**: a Docker web service, a Managed Postgres database, and a Cron Job that POSTs to a protected `/api/cron/tick` endpoint every five minutes.

## How signature injection works

For each pending user, SignatureForge resolves `{{variables}}` from Azure AD profile fields, then tries three mailbox APIs in order:

1. **Outlook REST API v2** `PATCH /users/{id}/MailboxSettings` with `SignatureHtml`, `AutoAddSignature`, `SignatureForNewMessage`, and `SignatureForReply`.
2. **Microsoft Graph** `PATCH /users/{id}/mailboxSettings` with the same semantic fields (newer Outlook clients).
3. **Exchange Web Services SOAP** `UpdateUserConfiguration` on `OWA.UserOptions`, with `X-AnchorMailbox` impersonation.

A failure on one user is recorded (`signaturePushStatus = failed`) and processing continues. The cron job retries pending and failed mailboxes on the next tick.

Application permissions required:

- `MailboxSettings.ReadWrite`
- `Mail.ReadWrite`
- `User.Read.All`
- `Directory.Read.All`

EWS impersonation additionally needs the Exchange Online application permission `full_access_as_app`. Grant admin consent after adding it.

## Architecture on Render

```
┌─────────────────────────────────────────┐
│           Render Services               │
│                                         │
│  1. Web Service (Next.js app)           │
│     - Serves UI and API routes          │
│     - Connects to Managed Postgres      │
│     - Connects to Azure Blob Storage    │
│                                         │
│  2. Managed Postgres Database           │
│     - Fully managed by Render           │
│     - Auto-backups, SSL enforced        │
│                                         │
│  3. Cron Job Service (scheduler)        │
│     - Runs every 5 minutes              │
│     - POSTs to /api/cron/tick           │
│     - Protected by CRON_SECRET header   │
└─────────────────────────────────────────┘
```

Render web services use an **ephemeral filesystem**. Uploaded logos never land in `/public/uploads`. They are stored in **Azure Blob Storage** with public blob access so recipients' mail clients can fetch them.

There is **no `node-cron`**. In-process timers die on every deploy. Scheduled work lives in `src/lib/jobs/tick.ts` and is triggered by the Cron Job container.

Prisma migrations run at **deploy time** via `preDeployCommand: npx prisma migrate deploy` in `render.yaml`, not during `next start`.

## Local development

```bash
cp .env.example .env
# Fill DATABASE_URL / DIRECT_URL for a local Postgres instance.
# Leave AUTH_DEMO_MODE=true to skip Azure AD while exploring the UI.

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

The dev server binds `0.0.0.0:43123`. Open `http://127.0.0.1:43123`, choose **Continue in demo mode**, and you will see the seeded Contoso tenant (three templates, five users, two assignments, one holiday schedule).

Demo mode does not call Microsoft Graph. Deploy actions will mark mailboxes failed until you add real `MS365_*` credentials.

## Azure AD App Registration Setup

You need TWO app registrations (or one with dual purpose):

- App 1: For admin login to SignatureForge (delegated auth)
- App 2: For Microsoft Graph API signature injection (app-only auth)

These can be the same app registration if desired.

### Step 1: Create App Registration

1. Azure Portal → Microsoft Entra ID → App registrations → New registration
2. Name: "SignatureForge"
3. Supported account types: "Accounts in this organizational directory only"
4. Redirect URI (Web): `https://your-app.onrender.com/api/auth/callback/azure-ad`
   (Also add `http://localhost:43123/api/auth/callback/azure-ad` for local dev)

### Step 2: API Permissions

Add these **Application permissions** (not delegated) — for signature injection:

- Microsoft Graph → `Mail.ReadWrite`
- Microsoft Graph → `MailboxSettings.ReadWrite`
- Microsoft Graph → `User.Read.All`
- Microsoft Graph → `Directory.Read.All`
- Office 365 Exchange Online → `full_access_as_app` (for the EWS SOAP fallback)

Add these **Delegated permissions** — for admin login:

- Microsoft Graph → `User.Read`
- Microsoft Graph → `openid`, `profile`, `email`

Click **"Grant admin consent for [Your Org]"**

### Step 3: Client Secret

1. Certificates & secrets → New client secret → copy value immediately
2. Add to Render env vars as `AZURE_AD_CLIENT_SECRET` and `MS365_CLIENT_SECRET`

### Step 4: Render Environment Variables

After deploying to Render:

1. Go to your Web Service → Environment
2. Add all variables from `.env.example`
3. Set `NEXTAUTH_URL` = your Render service URL (e.g. `https://signatureforge.onrender.com`)

## Azure Blob Storage Setup

Since you're already using Azure, this integrates directly into your existing subscription.

### Step 1: Create a Storage Account

1. Azure Portal → Storage accounts → Create
2. Subscription: your existing Azure subscription
3. Resource group: same as your other SignatureForge resources (or new)
4. Storage account name: `signatureforgestorage` (globally unique, lowercase, no hyphens)
5. Region: same as your M365 tenant region for lowest latency
6. Performance: Standard | Redundancy: LRS (cheapest) or GRS (recommended)
7. Click Review + Create

### Step 2: Create a Blob Container

1. Go to your Storage Account → Containers → + Container
2. Name: `signature-images`
3. **Public access level: Blob** (allows anonymous read of individual blobs)
   - This is required so Outlook can fetch images in email signatures
   - Emails are received by external parties — images must be publicly accessible
4. Click Create

### Step 3: Get Credentials

1. Storage Account → Access keys → Show keys
2. Copy **Storage account name** and **Key 1**
3. Add to Render environment variables:
   - `AZURE_STORAGE_ACCOUNT_NAME` = your storage account name
   - `AZURE_STORAGE_ACCOUNT_KEY` = Key 1 value
   - `AZURE_STORAGE_CONTAINER_NAME` = `signature-images`
   - `AZURE_STORAGE_PUBLIC_URL` = `https://[accountname].blob.core.windows.net/signature-images`

### Step 4 (Optional but Recommended): Add Azure CDN

For better global performance when signatures are opened in emails worldwide:

1. Azure Portal → CDN profiles → Create
2. Pricing tier: Azure CDN Standard from Microsoft
3. Add an endpoint pointing to your Storage Account
4. Set `AZURE_STORAGE_PUBLIC_URL` to your CDN endpoint URL instead:
   `https://signatureforge.azureedge.net/signature-images`

### Step 5 (Optional): Use the Same App Registration

If you want to avoid a separate Storage Account Key, you can grant your existing
Azure AD app registration access to the storage account:

1. Storage Account → Access Control (IAM) → Add role assignment
2. Role: **Storage Blob Data Contributor**
3. Assign to: your SignatureForge App Registration (service principal)
4. Then swap credential in `azureBlob.ts` to use `ClientSecretCredential` instead of
   the connection string — same clientId/clientSecret/tenantId already in your env vars.

## Deploy to Render

Blueprint deeplink (after the repo is on GitHub):

https://dashboard.render.com/blueprint/new?repo=https://github.com/philipgabrielromano/signatureforge

The Blueprint provisions a **Basic 256 MB** Postgres instance (`basic-256mb`). Render no longer allows the legacy Postgres `starter` instance type for new databases. Web and cron services still use the `starter` compute plan.

### First Deploy

### First Deploy

1. Push code to GitHub
2. Go to render.com → New → Blueprint
3. Connect your GitHub repo — Render reads `render.yaml` automatically
4. Render creates: Postgres DB + Web Service + Cron Job
5. Go to Web Service → Environment → add all `sync: false` variables manually
6. Trigger a manual deploy
7. Watch logs — Prisma migrations run in `preDeployCommand` before traffic switches

### After First Deploy

1. Copy your Render web service URL (e.g. `https://signatureforge-abc123.onrender.com`)
2. Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` env vars to this URL
3. Add this URL's callback to Azure AD app redirect URIs
4. Trigger redeploy

### Subsequent Deploys

- Push to the tracked branch → Render auto-deploys
- Prisma migrations run automatically via `preDeployCommand`
- Cron job picks up automatically (Render manages the schedule)

### Cold starts

Render's free plan spins down after 15 minutes of inactivity. This Blueprint uses the **starter** plan. If you switch the web service to free, the cron job (every 5 minutes) will wake the service, which keeps it warm in practice. First request after a true spin-down still pays a cold-start penalty.

Health checks call `GET /api/health`, which verifies Postgres connectivity.

## Environment variables

See `.env.example`. Secrets are never committed. In `render.yaml`:

- `DATABASE_URL` / `DIRECT_URL` come from the Managed Postgres connection string
- `NEXTAUTH_SECRET`, `AUTH_SECRET`, and `CRON_SECRET` use `generateValue: true`
- Azure and storage keys are `sync: false` and must be entered in the Dashboard

`DIRECT_URL` is the unpooled connection Prisma uses for migrations. On Render both keys currently point at the same `connectionString`. If you later put PgBouncer in front of Postgres, keep `DATABASE_URL` pooled (`pgbouncer=true`) and `DIRECT_URL` pointing at the database port.

## Known limitations

- Graph `mailboxSettings` does not officially document `SignatureHtml`. Method 1 and the EWS fallback exist because roaming signature APIs differ by Outlook build. Test in a pilot OU before org-wide rollout.
- EWS app-only impersonation requires Exchange `full_access_as_app` in addition to Graph Mail permissions.
- Image URLs in templates must be absolute `https://` Azure Blob or CDN URLs. Relative and `localhost` URLs are flagged in the editor because recipients cannot fetch them.
- Demo mode authenticates a local admin without Entra ID. Disable `AUTH_DEMO_MODE` in production.
- Bulk deploy of very large tenants is rate-limited to `deployBatchSize` (default 50) per 5-minute tick to stay inside Graph throttling.
