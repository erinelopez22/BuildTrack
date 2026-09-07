# Deploying BuildTrack to Vercel — full guide

This walks you through hosting the **entire app** (React frontend + API) on Vercel,
end to end. No prior Vercel experience assumed.

- Frontend: Vite/React SPA, built to `dist/`.
- API: one serverless function, `api/index.ts` (a Hono app in `server/`).
- Database: Neon Postgres (managed, serverless).
- File uploads: Vercel Blob.
- The old .NET backend in `backend/` is **not** deployed — it stays as reference.

Everything below happens on the **`vercel-fullstack-migration`** branch.

---

## 0. What you'll end up with

```
https://<your-project>.vercel.app          →  the React app
https://<your-project>.vercel.app/api/...   →  the API (same domain, no CORS)
Neon Postgres                                →  all data
Vercel Blob                                  →  uploaded photos / PDFs
```

Login after seeding: **admin@buildtrack.com** / **Admin@123456**

---

## 1. Prerequisites

| Need | How |
|---|---|
| Node.js 20+ | You have v24 — fine. Check: `node -v` |
| A GitHub account | The repo is already at `github.com/erinelopez22/stockwell-build` |
| A Vercel account | Sign up free at <https://vercel.com/signup> — choose **"Continue with GitHub"** |
| Vercel CLI | `npm i -g vercel` (used in step 6) |

---

## 2. Push the branch to GitHub

The new code is committed locally but not on GitHub yet.

```bash
cd C:/Users/elopez24/Documents/stockwell-build
git push -u origin vercel-fullstack-migration
```

Confirm it shows up at
`https://github.com/erinelopez22/stockwell-build/tree/vercel-fullstack-migration`.

---

## 3. Create the Vercel project

1. Go to <https://vercel.com/new>.
2. Under **Import Git Repository**, find **`stockwell-build`** and click **Import**.
   (If you don't see it: **Adjust GitHub App Permissions** → grant access to the repo.)
3. On the configuration screen:
   - **Framework Preset:** `Vite` (auto-detected from `vercel.json`).
   - **Root Directory:** leave as `./`.
   - **Build & Output Settings:** leave defaults (`vite build` → `dist`). `vercel.json`
     already sets these.
   - **Environment Variables:** skip for now — added in the next steps.
4. Click **Deploy**. The first build will succeed (it only builds the frontend), but
   the API will return errors until steps 4–7 are done. That's expected.
5. After it finishes, open **Settings → Git** and set the **Production Branch** to
   `vercel-fullstack-migration` (so this branch is the live one). *Or* keep `main` as
   production and treat this as a preview until you merge — your call.

> **CLI alternative to steps 3:** from the repo root run `vercel` and answer the
> prompts (link to your account, project name, keep defaults). Then `vercel --prod`
> when ready. You still do steps 4–7 in the dashboard / CLI.

---

## 4. Add Neon Postgres

1. In your Vercel project → **Storage** tab → **Create Database** → **Neon** (Serverless
   Postgres) → **Continue**.
2. Pick a region close to your users, name it e.g. `buildtrack-db`, **Create**.
3. When asked which project to connect, choose this one and **Connect**. Leave all
   environments (Production, Preview, Development) checked.

This automatically adds these env vars to the project:
`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`,
`PGHOST`, `PGUSER`, `PGPASSWORD`, … You don't need to touch them.

---

## 5. Add Vercel Blob (file storage)

1. **Storage** tab → **Create Database** → **Blob** → **Continue** → name it
   e.g. `buildtrack-uploads` → **Create**.
2. **Connect** it to this project, all environments checked.

This adds **`BLOB_READ_WRITE_TOKEN`** automatically.

---

## 6. Add the JWT secret

1. Generate a random secret. In a terminal:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
   Copy the output.
2. In Vercel → **Settings → Environment Variables** → add:

   | Key | Value | Environments |
   |---|---|---|
   | `JWT_SECRET` | *(the string you just generated)* | Production, Preview, **Development** |

   Check **all three** environment boxes so `vercel env pull` gets it in step 7.
3. (Optional) also add `JWT_ACCESS_MINUTES=60` and `JWT_REFRESH_DAYS=30`.
4. Do **not** set `VITE_API_BASE_URL` on Vercel — the app must call the same-origin
   `/api`, which is the default when the variable is empty/absent.

---

## 7. Create the database schema and seed it

Now pull all those env vars down to your machine and run the migration once.

```bash
cd C:/Users/elopez24/Documents/stockwell-build

# link this folder to the Vercel project (one time)
vercel link            # pick your account + the stockwell-build project

# pull env vars into .env.local (gitignored)
vercel env pull .env.local

# create every table in Neon
npm run db:push

# insert the default company + super admin
npm run db:seed
```

Expected output from `db:seed`:
```
✓ Default company "BuildTrack" created
✓ Default admin seeded: admin@buildtrack.com / Admin@123456
Seed complete.
```

> `.env.local` will contain `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`
> (direct). `npm run db:push` uses the direct one; the app runtime uses the pooled one.
> If `vercel env pull` also wrote `VITE_API_BASE_URL=""`, delete that line from
> `.env.local` so local dev keeps using `http://localhost:5069` from `.env`.

---

## 8. Redeploy

The API function needs to pick up the storage env vars (it was deployed before them in
step 3).

- **Dashboard:** Deployments tab → latest → **⋯ → Redeploy**.
- **CLI:** `vercel --prod` (or push any commit to the production branch).

---

## 9. Smoke-test the API

Replace `BASE` with your deployment URL (shown in the Vercel dashboard).

```bash
BASE=https://<your-project>.vercel.app

# 1. health — no DB needed
curl $BASE/api/health
# → {"ok":true,"ts":"..."}

# 2. company list — reads DB, used by the login page
curl $BASE/api/companies/list
# → {"success":true,"data":[{"id":"...","name":"BuildTrack"}]}

# 3. login as the seeded admin
curl -X POST $BASE/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"loginId":"admin@buildtrack.com","password":"Admin@123456","companyId":null}'
# → {"success":true,"data":{"accessToken":"...","refreshToken":"...","user":{...}}}

# 4. authenticated call — paste the accessToken from step 3
TOKEN=<paste accessToken>
curl $BASE/api/dashboard/stats -H "authorization: Bearer $TOKEN"
# → {"success":true,"data":{"activeProjects":0, ...}}
```

If all four return `success:true`, the backend is live.

---

## 10. Test the full app

1. Open `https://<your-project>.vercel.app` in a browser.
2. On the login page the company dropdown should list **BuildTrack**.
3. Log in with **admin@buildtrack.com** / **Admin@123456**.
4. Click through: **Dashboard**, **Projects**, **SKUs**, **Orders**, **Inventory**,
   **Equipment**, **Quotations** — each should load without errors.
5. Create a project, then a SKU, then an order. Upload a photo somewhere that allows it
   (e.g. delivery tracking evidence) — it should return a
   `...public.blob.vercel-storage.com/...` URL and display.
6. Open the browser devtools **Network** tab and confirm calls go to
   `/api/...` on your own domain (not `localhost` or `azurewebsites.net`).

---

## 11. Day-to-day local development

```bash
cd C:/Users/elopez24/Documents/stockwell-build

# terminal 1 — the API (reads .env.local: DATABASE_URL, JWT_SECRET, BLOB token)
npm run dev:api          # http://localhost:5069

# terminal 2 — the React app
npm run dev              # http://localhost:8080
```

`.env` sets `VITE_API_BASE_URL=http://localhost:5069` so the local app talks to your
local API, which talks to the **same Neon database** as production. If you want an
isolated dev database, create a second Neon branch/database and put its URL in
`.env.local`.

Useful scripts:

| Command | Does |
|---|---|
| `npm run db:push` | Sync schema changes to the DB (no migration files) |
| `npm run db:generate` | Write a versioned SQL migration to `drizzle/` |
| `npm run db:migrate` | Apply generated migrations |
| `npm run db:studio` | Browse the DB in a local GUI |
| `npm run db:seed` | Re-run the seed (safe; skips if data exists) |
| `npm run typecheck:server` | Type-check the API code |
| `npm run build` | Build the frontend (what Vercel runs) |

---

## 12. Troubleshooting

| Symptom | Fix |
|---|---|
| `/api/health` works but `/api/companies/list` returns `"An unexpected error occurred."` | `DATABASE_URL` missing or schema not pushed. Check the function logs (Vercel → Deployments → the deployment → **Functions** / **Logs**). Re-run steps 4, 7, 8. |
| Login returns `"Invalid credentials."` for the seeded admin | Seed didn't run, or ran against a different DB. Re-run `npm run db:seed` with the same `.env.local`. |
| Login page company dropdown is empty | Same as above — `companies` table empty. |
| `db:push` hangs or SSL error | Make sure `.env.local` has `DATABASE_URL_UNPOOLED` (from `vercel env pull`). Neon requires `sslmode=require` — the integration's URLs include it. |
| Frontend calls go to `azurewebsites.net` | An old `VITE_API_BASE_URL` is set on Vercel. Delete it (Settings → Environment Variables) and redeploy. |
| Uploads fail with a 500 | `BLOB_READ_WRITE_TOKEN` not connected. Redo step 5, redeploy. |
| 404 for every `/api/*` route on Vercel | `vercel.json` not picked up. Confirm it's at the repo root and the deployment is from this branch. |
| Build fails on Vercel | Run `npm run build` locally; fix errors; commit; push. |

**Reading function logs:** Vercel dashboard → your project → **Deployments** → click the
deployment → **Functions** tab → click `api/index.ts` → **Logs**. `console.error` from
the API shows up here.

---

## 13. Promoting to production / custom domain

- **Custom domain:** Vercel → **Settings → Domains** → add your domain, follow the DNS
  instructions.
- **Make this branch the live site:** either set Production Branch to
  `vercel-fullstack-migration` (step 3.5), or merge it into `main`:
  ```bash
  git checkout main
  git merge vercel-fullstack-migration
  git push origin main
  ```
- **Rotate the admin password** immediately after first login (Profile → change
  password) — the seeded password is public in this repo.

---

## 14. Cleanup (optional, later)

Once the Vercel version is confirmed working you can delete the Azure leftovers:

- `staticwebapp.config.json`
- `.github/workflows/azure-static-web-apps-*.yml`
- the entire `backend/` folder (only if you no longer want the .NET reference)

---

## Reference: what changed from the .NET backend

| Area | Before | After |
|---|---|---|
| Runtime | ASP.NET Core 8 (`backend/`) | Hono serverless function (`api/`, `server/`) |
| Database | SQL Server Express + EF Core | Neon Postgres + Drizzle ORM (`server/db/`) |
| Auth | JWT + BCrypt.Net | JWT (`jose`) + `bcryptjs`; refresh tokens in `refresh_tokens` |
| File uploads | `wwwroot/uploads` on disk | Vercel Blob (`server/lib/blob.ts`) |
| Realtime | SignalR hub | removed — the frontend polls every 30s |
| Email | MailKit (unused) | `server/lib/email.ts` stub |

The REST contract (paths, payloads, `{success,data,message}` envelope) is unchanged —
see `src/lib/apiClient.ts`.
