# Stockwell API – .NET 8 REST API with MS SQL Server

Backend for the Stockwell construction inventory frontend. REST API with JWT auth and Entity Framework Core against SQL Server.

## Opening in Visual Studio

- **From repo root:** Open `Stockwell.sln` in the project root (File → Open → Project/Solution). The solution contains the StockwellApi project.
- **From backend folder:** Open `backend\Stockwell.sln` or open the `backend` folder (File → Open → Folder). Set **StockwellApi** as the startup project and press F5 to run.

**If you see "Unable to start program ... StockwellApi.exe'. The system cannot find the file specified":**

1. **Build the solution first:** Build → Build Solution (or Ctrl+Shift+B). The executable is created when the project builds successfully.
2. **Restore packages:** If build fails, open a terminal in the `backend` folder and run `dotnet restore`, then build again.
3. **.NET 8 SDK:** Ensure [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) is installed (Visual Studio 2022 17.8+ includes it).
4. On Windows, the first successful build may put the exe in `bin\Debug\net8.0\win-x64\`; Visual Studio will use that path when you press F5.

## Requirements

- .NET 8 SDK
- SQL Server (LocalDB, Express, or full)

## Migrate to your MS SQL Server

1. **Set the connection string**  
   Edit `backend/appsettings.json` (or `appsettings.Development.json`) and set `ConnectionStrings:DefaultConnection` to your SQL Server:

   | Scenario | Example |
   |----------|---------|
   | **LocalDB** (Visual Studio) | `Server=(LocalDB)\\MSSQLLocalDB;Database=StockwellDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=true` |
   | **SQL Server Express** (local) | `Server=localhost\\SQLEXPRESS;Database=StockwellDb;Trusted_Connection=True;TrustServerCertificate=true` |
   | **Default instance** (local) | `Server=localhost;Database=StockwellDb;Trusted_Connection=True;TrustServerCertificate=true` |
   | **SQL Server auth** | `Server=your-server;Database=StockwellDb;User Id=your-user;Password=your-password;TrustServerCertificate=true` |
   | **Remote / Azure SQL** | `Server=tcp:yourserver.database.windows.net,1433;Database=StockwellDb;User Id=user;Password=pass;Encrypt=True;TrustServerCertificate=False` |

   Use a **database name** you want (e.g. `StockwellDb`). The app will create it if it doesn’t exist (when the server allows).

2. **Apply migrations** (pick one):

   - **Option A – Run the API**  
     From the repo root or `backend` folder:
     ```bash
     cd backend
     dotnet run
     ```
     On startup the API runs `MigrateAsync()` and applies any pending migrations. Tables are created or updated automatically.

   - **Option B – Command line only**  
     Apply migrations without starting the API:
     ```bash
     cd backend
     dotnet tool install --global dotnet-ef   # once per machine, if needed
     dotnet ef database update
     ```

3. **Confirm**  
   In SQL Server (SSMS, Azure Data Studio, or `sqlcmd`), check that the database exists and has tables such as `profiles`, `projects`, `orders`, `skus`, etc., and that `__EFMigrationsHistory` has a row for `20260130120000_InitialCreate`.

## Setup (rest of app)

1. **Connection string**  
   If you didn’t above, set `ConnectionStrings:DefaultConnection` in `appsettings.json` to your SQL Server (see table above).

2. **Restore and run**

   ```bash
   cd backend
   dotnet restore
   dotnet run
   ```

   The API will apply migrations and create/update the database on first run (via `MigrateAsync`).  
   Base URL: **http://localhost:5000**  
   Swagger: **http://localhost:5000/swagger**

3. **Migrations**  
   The project uses EF Core migrations. On startup, `MigrateAsync()` runs and applies any pending migrations to SQL Server.  
   To add a new migration (after changing entities or `ApplicationDbContext`), install the EF Core tools and run:

   ```bash
   cd backend
   dotnet tool install --global dotnet-ef   # once per machine
   dotnet ef migrations add YourMigrationName
   dotnet ef database update                # or let the app apply it on next run
   ```

## Authentication

- **POST /api/auth/register** – Register (email, password, optional fullName). Creates profile and default `viewer` role.
- **POST /api/auth/login** – Login (email, password). Returns JWT and user info.
- **GET /api/auth/me** – Current user profile (requires `Authorization: Bearer <token>`).

All other endpoints require the JWT in the header unless noted.

## Main endpoints (all require JWT except auth)

| Area        | Method | Endpoint | Description |
|------------|--------|----------|-------------|
| Auth       | POST   | /api/auth/register | Register |
| Auth       | POST   | /api/auth/login    | Login |
| Auth       | GET    | /api/auth/me      | Current user |
| Dashboard  | GET    | /api/dashboard/stats | Counts: active projects, SKUs, orders, members (admin) |
| Dashboard  | GET    | /api/dashboard/recent-orders | Recent orders (limit query) |
| Projects   | GET    | /api/projects     | List (optional ?status=) |
| Projects   | GET    | /api/projects/{id} | Get one |
| Projects   | POST   | /api/projects     | Create (admin) |
| Projects   | PUT    | /api/projects/{id} | Update (admin) |
| Projects   | DELETE | /api/projects/{id} | Delete (admin) |
| Orders     | GET    | /api/orders       | List (?status=, ?limit=) |
| Orders     | GET    | /api/orders/{id}  | Get one (?includeItems=true) |
| Orders     | POST   | /api/orders       | Create |
| Orders     | PUT    | /api/orders/{id}  | Update |
| Orders     | DELETE | /api/orders/{id}  | Delete |
| Order items| GET    | /api/orders/{orderId}/items | List items |
| Order items| POST   | /api/orders/{orderId}/items | Add item |
| Order items| PUT    | /api/orders/{orderId}/items/{itemId} | Update item |
| Order items| DELETE | /api/orders/{orderId}/items/{itemId} | Remove item |
| SKUs       | GET    | /api/skus        | List (?isActive=) |
| SKUs       | GET    | /api/skus/{id}   | Get one |
| SKUs       | POST   | /api/skus        | Create (admin) |
| SKUs       | PUT    | /api/skus/{id}   | Update (admin) |
| SKUs       | DELETE | /api/skus/{id}   | Delete (admin) |
| Profiles   | GET    | /api/profiles    | List (admin; ?isActive=) |
| Profiles   | GET    | /api/profiles/{id} | Get one |
| Profiles   | PUT    | /api/profiles/{id} | Update |
| User roles | GET    | /api/userroles   | List (?userId=) |
| User roles | POST   | /api/userroles   | Add role (admin) |
| User roles | DELETE | /api/userroles/{id} | Remove role (admin) |
| Members    | GET    | /api/projects/{projectId}/members | List project members |
| Members    | POST   | /api/projects/{projectId}/members | Add member (admin) |
| Members    | PUT    | /api/projects/{projectId}/members/{memberId} | Update role (admin) |
| Members    | DELETE | /api/projects/{projectId}/members/{memberId} | Remove (admin) |

## CORS

Default policy allows: `http://localhost:5173`, `http://localhost:3000`, and `127.0.0.1` variants. Adjust in `Program.cs` if your frontend runs on another origin.

## Connecting the frontend

The React app currently uses Supabase. To use this API instead:

1. Add an API base URL (e.g. `VITE_API_URL=http://localhost:5000`) and build a small client that calls the endpoints above with fetch/axios.E
2. For login: call `POST /api/auth/login` with `{ email, password }`, store the returned `accessToken`, and send it as `Authorization: Bearer <accessToken>` on every request.
3. Map existing Supabase calls to the REST endpoints in the table (e.g. `supabase.from('projects').select('*')` → `GET /api/projects` with the JWT header).

Response shapes are aligned with the frontend types (camelCase JSON, same field names where applicable).

## JWT configuration

In `appsettings.json`:

```json
"Jwt": {
  "Key": "YourSuperSecretKeyThatIsAtLeast32CharactersLong!",
  "Issuer": "StockwellApi",
  "Audience": "StockwellFrontend",
  "ExpiryMinutes": 60
}
```

Use a strong, unique key in production and keep it out of source control (e.g. User Secrets or environment variables).
