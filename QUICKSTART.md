# BuildTrack — Full Setup Guide
### From zero to a running app (Frontend + Backend + SQL Server)

---

## What You're Setting Up

```
Browser (http://localhost:8080)
    ↕  HTTP + SignalR
ASP.NET Core API (http://localhost:5069)
    ↕  Entity Framework Core
SQL Server Express (localhost\SQLEXPRESS → BuildTrackDB)
```

**Time required:** ~30 minutes on first install, ~2 minutes on subsequent starts.

---

## PART 1 — Install Required Software

> Skip any step where the tool is already installed.

---

### 1.1 — Install .NET 8 SDK

1. Go to: https://dotnet.microsoft.com/download/dotnet/8.0
2. Download **.NET 8.0 SDK** (not Runtime) for **Windows x64**
3. Run the installer, accept defaults
4. Open a **new** PowerShell or Command Prompt window and verify:

```powershell
dotnet --version
# Must show 8.x.x  (e.g. 8.0.404)
```

---

### 1.2 — Install SQL Server Express

1. Go to: https://www.microsoft.com/en-us/sql-server/sql-server-downloads
2. Scroll to **SQL Server 2022 Express** → click **Download now**
3. Run the installer → choose **Basic** installation type
4. Accept the license → click **Install**
5. When complete, note the **Instance name** shown — it will be:
   ```
   Server Name: localhost\SQLEXPRESS
   ```
6. Click **Close** (you do NOT need SSMS for this guide)

> **Verify SQL Server is running:**
> ```powershell
> Get-Service -Name "MSSQL*"
> # Should show Status = Running for MSSQL$SQLEXPRESS
> ```
> If it shows Stopped:
> ```powershell
> Start-Service "MSSQL$SQLEXPRESS"
> ```

---

### 1.3 — Install EF Core CLI Tools

Open PowerShell and run:

```powershell
dotnet tool install --global dotnet-ef
```

Verify:
```powershell
dotnet ef --version
# Should show 8.x.x
```

If already installed but on an older version:
```powershell
dotnet tool update --global dotnet-ef
```

---

### 1.4 — Install Node.js (if not already installed)

1. Go to: https://nodejs.org
2. Download **LTS** version
3. Run the installer, accept defaults
4. Verify:

```powershell
node --version   # 18.x.x or higher
npm --version    # 9.x.x or higher
```

---

### 1.5 — Install VS Code Extensions (recommended)

Open VS Code, press `Ctrl+Shift+X`, search and install:

| Extension | Publisher | Purpose |
|-----------|-----------|---------|
| C# Dev Kit | Microsoft | C# IntelliSense, run/debug |
| REST Client | Humao | Test API endpoints from VS Code |

---

## PART 2 — Set Up the Database

---

### 2.1 — Create the Database

Open PowerShell **in the project root folder** and run:

```powershell
sqlcmd -S "localhost\SQLEXPRESS" -E -Q "CREATE DATABASE BuildTrackDB"
```

Verify it was created:
```powershell
sqlcmd -S "localhost\SQLEXPRESS" -E -Q "SELECT name FROM sys.databases WHERE name = 'BuildTrackDB'"
```

You should see `BuildTrackDB` in the output.

> **If sqlcmd is not found:** Add SQL Server tools to PATH:
> ```powershell
> $env:PATH += ";C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn"
> ```
> Or use the full path:
> ```powershell
> & "C:\Program Files\Microsoft SQL Server\160\Tools\Binn\SQLCMD.EXE" -S "localhost\SQLEXPRESS" -E -Q "CREATE DATABASE BuildTrackDB"
> ```

---

### 2.2 — Run EF Core Migrations (Creates All Tables)

```powershell
# Navigate to the backend project
cd backend\BuildTrack.API

# Create the initial migration (only needed once)
dotnet ef migrations add InitialCreate --output-dir Data\Migrations

# Apply the migration to create all tables
dotnet ef database update
```

Expected output ends with:
```
Done.
```

> **Note:** The API also runs migrations automatically on startup in Development mode,
> so this step is optional — but running it manually lets you catch errors early.

---

### 2.3 — Seed the Admin User

This creates your first login account:

```powershell
# Still in the project root (go back up from backend/BuildTrack.API if needed)
cd ..\..

sqlcmd -S "localhost\SQLEXPRESS" -d "BuildTrackDB" -E -i "database-scripts\002_seed_admin.sql"
```

Expected output:
```
Admin user seeded: admin@buildtrack.com / Admin@123456
```

> **Default login credentials:**
> - Email: `admin@buildtrack.com`
> - Password: `Admin@123456`
> - **Change this password after your first login!**

---

### 2.4 — (Optional) Seed Sample Data

Adds 10 sample SKUs and 2 sample projects to explore the app:

```powershell
sqlcmd -S "localhost\SQLEXPRESS" -d "BuildTrackDB" -E -i "database-scripts\003_seed_sample_data.sql"
```

---

## PART 3 — Configure the Backend

---

### 3.1 — Check the Connection String

Open [backend/BuildTrack.API/appsettings.json](backend/BuildTrack.API/appsettings.json) and confirm:

```json
"ConnectionStrings": {
  "DefaultConnection": "Server=localhost\\SQLEXPRESS;Database=BuildTrackDB;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True"
}
```

> **If your SQL Server instance has a different name**, update `localhost\\SQLEXPRESS` to match.
> To check your instance name:
> ```powershell
> sqlcmd -S "localhost\SQLEXPRESS" -E -Q "SELECT @@SERVERNAME"
> ```

---

### 3.2 — Check the JWT Secret

Open [backend/BuildTrack.API/appsettings.Development.json](backend/BuildTrack.API/appsettings.Development.json):

```json
"Jwt": {
  "Secret": "dev-secret-key-change-in-production-must-be-32-chars",
  "Issuer": "BuildTrack.API",
  "Audience": "BuildTrack.Frontend"
}
```

The default development secret is fine for local use. For production, replace it with a strong random key:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## PART 4 — Start the Backend

---

### 4.1 — Restore NuGet Packages

```powershell
cd backend\BuildTrack.API
dotnet restore
```

First run downloads all packages (~30 seconds). Subsequent runs are instant.

---

### 4.2 — Build the Project

```powershell
dotnet build
```

Expected output:
```
Build succeeded.
    0 Warning(s)
    0 Error(s)
```

> If you see errors, the most common fixes:
> - `dotnet restore` was not run first
> - .NET SDK version is not 8.x — check with `dotnet --version`

---

### 4.3 — Run the Backend API

```powershell
dotnet run
```

Wait for this output:
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5069
info: Microsoft.Hosting.Lifetime[0]
      Application started. Press Ctrl+C to stop.
```

> On first startup, it will also run any pending EF Core migrations automatically.

---

### 4.4 — Verify the Backend is Running

Open your browser and go to:

```
http://localhost:5069/swagger
```

You should see the **BuildTrack API** Swagger documentation page listing all endpoints.

**Test a login from Swagger:**

1. Click on `POST /api/auth/login` → **Try it out**
2. Paste this body:
   ```json
   {
     "loginId": "admin@buildtrack.com",
     "password": "Admin@123456"
   }
   ```
3. Click **Execute**
4. You should get a `200 OK` response with `accessToken` and `refreshToken`

✅ **Backend is working!**

---

## PART 5 — Set Up the Frontend

---

### 5.1 — Open a New Terminal (keep the backend running)

In VS Code: `Ctrl+Shift+`` ` or open a new PowerShell window.

Navigate to the project root (where `package.json` lives):

```powershell
cd C:\Users\elopez24\Documents\stockwell-build
```

---

### 5.2 — Install npm Dependencies

```powershell
npm install
```

Also install the SignalR client for real-time notifications:

```powershell
npm install @microsoft/signalr
```

---

### 5.3 — Check the Frontend Environment File

Open [.env](.env) in the project root and confirm it contains:

```env
VITE_API_BASE_URL=http://localhost:5069
```

> This tells the frontend where to find the backend API.
> If your backend runs on a different port, update this value.

---

### 5.4 — Start the Frontend

```powershell
npm run dev
```

Wait for:
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:8080/
```

---

### 5.5 — Open the App

Go to: **http://localhost:8080**

You should see the **BuildTrack login page**.

Log in with:
- **Email:** `admin@buildtrack.com`
- **Password:** `Admin@123456`

After login you should land on the **Dashboard**.

✅ **Full stack is running!**

---

## PART 6 — Running Both Every Time

After the initial setup, starting the app requires only two commands in two terminals:

### Terminal 1 — Backend
```powershell
cd backend\BuildTrack.API
dotnet run
```

### Terminal 2 — Frontend
```powershell
cd C:\Users\elopez24\Documents\stockwell-build
npm run dev
```

### Useful URLs

| URL | Purpose |
|-----|---------|
| http://localhost:8080 | Frontend app (login here) |
| http://localhost:5069/swagger | Backend API docs + interactive testing |
| http://localhost:5069/api/auth/me | Check if you're authenticated |

---

## PART 7 — Verify Everything Works

Run through this checklist after starting both services:

- [ ] Backend terminal shows `Now listening on: http://localhost:5069`
- [ ] Frontend terminal shows `Local: http://localhost:8080/`
- [ ] http://localhost:5069/swagger loads without error
- [ ] http://localhost:8080 shows the login page
- [ ] Login with `admin@buildtrack.com` / `Admin@123456` succeeds
- [ ] Dashboard loads with stats and recent orders
- [ ] No red errors in the browser console (`F12` → Console tab)

---

## PART 8 — Troubleshooting

### SQL Server won't connect

```powershell
# Check if service is running
Get-Service "MSSQL$SQLEXPRESS"

# Start it if stopped
Start-Service "MSSQL$SQLEXPRESS"

# Test the connection directly
sqlcmd -S "localhost\SQLEXPRESS" -E -Q "SELECT @@VERSION"
```

Common causes:
- SQL Server service stopped → start it as shown above
- Wrong instance name → check with `sqlcmd -L` to list local instances
- Named Pipes disabled → open **SQL Server Configuration Manager** → enable TCP/IP and Named Pipes for SQLEXPRESS

---

### Backend fails to start — "A connection was successfully established but then an error occurred"

The database doesn't exist or migrations haven't run:

```powershell
# Create DB manually
sqlcmd -S "localhost\SQLEXPRESS" -E -Q "CREATE DATABASE BuildTrackDB"

# Re-run migrations
cd backend\BuildTrack.API
dotnet ef database update
```

---

### Backend fails to start — port already in use

```powershell
# Find what's using port 5069
netstat -ano | findstr :5069

# Kill the process (replace 1234 with the PID shown)
taskkill /PID 1234 /F
```

Or change the port in `backend/BuildTrack.API/Properties/launchSettings.json`.

---

### Frontend shows "Failed to fetch" or CORS error

1. Confirm the backend is running: open http://localhost:5069/swagger
2. Check `.env` has the correct port:
   ```
   VITE_API_BASE_URL=http://localhost:5069
   ```
3. Restart the frontend after changing `.env`:
   ```powershell
   # Ctrl+C to stop, then:
   npm run dev
   ```

---

### Login fails — "Invalid credentials"

The admin seed script may not have run, or BCrypt hash is wrong:

```powershell
# Re-run the seed script
sqlcmd -S "localhost\SQLEXPRESS" -d "BuildTrackDB" -E -i "database-scripts\002_seed_admin.sql"
```

If the record already exists, delete it first and re-seed:
```powershell
sqlcmd -S "localhost\SQLEXPRESS" -d "BuildTrackDB" -E -Q "DELETE FROM Profiles WHERE Email = 'admin@buildtrack.com'"
sqlcmd -S "localhost\SQLEXPRESS" -d "BuildTrackDB" -E -i "database-scripts\002_seed_admin.sql"
```

---

### "dotnet ef" command not found

```powershell
dotnet tool install --global dotnet-ef
# Close and reopen your terminal, then try again
```

---

### EF Core migration errors

If `dotnet ef migrations add` fails because a migration already exists:

```powershell
# Remove the broken migration
dotnet ef migrations remove

# Re-create it
dotnet ef migrations add InitialCreate --output-dir Data\Migrations

# Apply
dotnet ef database update
```

---

### Notifications not real-time (polling instead of SignalR)

```powershell
npm install @microsoft/signalr
# Restart the frontend
```

If SignalR is installed but still not connecting, check the browser console for the specific error.

---

## PART 9 — Project File Reference

```
stockwell-build/
│
├── backend/BuildTrack.API/          ← ASP.NET Core 8 Web API
│   ├── Controllers/                 ← REST endpoints (Auth, Orders, Projects...)
│   ├── Services/                    ← Business logic
│   ├── Models/Entities/             ← Database entity classes
│   ├── DTOs/                        ← API request/response shapes
│   ├── Data/AppDbContext.cs         ← EF Core database context
│   ├── Data/Migrations/             ← Auto-generated DB migration files
│   ├── Hubs/NotificationHub.cs      ← SignalR real-time notifications
│   ├── Middleware/                  ← Global error handling
│   ├── Program.cs                   ← App startup and DI configuration
│   ├── appsettings.json             ← Production config (DB, JWT, CORS)
│   └── appsettings.Development.json ← Dev overrides (longer tokens, verbose logging)
│
├── database-scripts/
│   ├── 001_create_database.sql      ← Creates BuildTrackDB
│   ├── 002_seed_admin.sql           ← Creates admin@buildtrack.com account
│   └── 003_seed_sample_data.sql     ← Sample SKUs and projects
│
├── src/                             ← React + TypeScript frontend
│   ├── lib/apiClient.ts             ← All REST API calls + JWT token management
│   ├── contexts/AuthContext.tsx     ← Login state, roles, permissions
│   ├── hooks/useNotifications.ts    ← Real-time notifications (SignalR + fallback)
│   ├── lib/activityLogger.ts        ← Sends audit logs to backend
│   ├── lib/notificationService.ts   ← In-app notification helpers
│   ├── pages/                       ← Page components (Dashboard, Orders, etc.)
│   └── components/                  ← Reusable UI components
│
├── .env                             ← Frontend: VITE_API_BASE_URL=http://localhost:5069
├── package.json                     ← Frontend npm dependencies
├── vite.config.ts                   ← Dev server config (port 8080)
│
├── QUICKSTART.md                    ← This file
└── MIGRATION_GUIDE.md               ← Supabase → .NET migration details
```

---

## PART 10 — Default Credentials & Key Config

| Item | Value |
|------|-------|
| Admin email | `admin@buildtrack.com` |
| Admin password | `Admin@123456` |
| Frontend URL | http://localhost:8080 |
| Backend API URL | http://localhost:5069 |
| Swagger URL | http://localhost:5069/swagger |
| Database server | `localhost\SQLEXPRESS` |
| Database name | `BuildTrackDB` |
| JWT expiry (dev) | 8 hours |
| Refresh token expiry | 30 days |

---

**Good luck! If something breaks, start with the Troubleshooting section in Part 8.**
