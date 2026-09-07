# Deploying BuildTrack to Vercel

The app is a Vite/React SPA plus a serverless API (Hono) in `api/index.ts`, backed by
Neon Postgres and Vercel Blob. The old .NET backend under `backend/` is kept for
reference and is **not** deployed.

## 1. One-time setup on Vercel

1. **Import the repo** into Vercel. Framework preset: **Vite** (auto-detected from
   `vercel.json`). Build command `vite build`, output `dist`.
2. **Add the Neon integration** (Storage → Create → Neon Postgres, or the Neon
   integration from the Marketplace) and link it to the project. This injects
   `DATABASE_URL` / `POSTGRES_URL` into all environments.
3. **Add Vercel Blob** (Storage → Create → Blob) and link it. This injects
   `BLOB_READ_WRITE_TOKEN`.
4. **Set the remaining env vars** (Project → Settings → Environment Variables), for
   Production *and* Preview:

   | Variable | Value |
   |---|---|
   | `JWT_SECRET` | a 32+ char random string |
   | `VITE_API_BASE_URL` | *(empty)* — the app calls the same-origin `/api` |
   | `JWT_ACCESS_MINUTES` | `60` (optional) |
   | `JWT_REFRESH_DAYS` | `30` (optional) |

## 2. Create the schema and seed

Run locally against the Neon database (get its connection string from the Vercel
project → Storage → Neon → `.env.local` tab, or the Neon console):

```bash
cp .env.example .env.local        # then paste DATABASE_URL + JWT_SECRET
npm install
npm run db:push                   # creates all tables
npm run db:seed                   # default company + admin@buildtrack.com / Admin@123456
```

`npm run db:generate` writes versioned SQL to `drizzle/`; `npm run db:migrate` applies
it. For the first deploy `db:push` is enough.

## 3. Deploy

```bash
npx vercel           # preview
npx vercel --prod    # production
```

Or just push the branch — Vercel builds automatically.

## 4. Smoke test (preview URL)

```bash
BASE=https://<your-deployment>.vercel.app
curl $BASE/api/health
curl $BASE/api/companies/list
curl -X POST $BASE/api/auth/login -H 'content-type: application/json' \
  -d '{"loginId":"admin@buildtrack.com","password":"Admin@123456","companyId":null}'
```

Then log in through the UI and check Dashboard / Projects / Orders / SKUs / Inventory /
Equipment / Quotations, create an order, and upload a delivery photo.

## Local development

```bash
npm run dev:api      # API on http://localhost:5069 (reads .env.local)
npm run dev          # Vite on http://localhost:8080
```

`.env` points `VITE_API_BASE_URL` at `http://localhost:5069`; CORS is open in the API
for local use.

## What changed from the .NET backend

| Area | Before | After |
|---|---|---|
| Runtime | ASP.NET Core 8 (`backend/`) | Hono serverless function (`api/`, `server/`) |
| Database | SQL Server Express + EF Core | Neon Postgres + Drizzle ORM (`server/db/`) |
| Auth | JWT + BCrypt.Net | JWT (`jose`) + `bcryptjs`, refresh tokens in `refresh_tokens` |
| File uploads | `wwwroot/uploads` on disk | Vercel Blob (`server/lib/blob.ts`) |
| Realtime | SignalR hub | removed — the frontend polls every 30s |
| Email | MailKit (unused) | `server/lib/email.ts` stub |

The REST contract (paths, payloads, response envelope) is unchanged — see
`src/lib/apiClient.ts`.

## Leftover Azure files (safe to delete later)

- `staticwebapp.config.json`
- `.github/workflows/azure-static-web-apps-*.yml` (only triggers on the old
  `buildTrack_UsingDotNet` branch)
