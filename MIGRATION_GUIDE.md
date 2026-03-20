# BuildTrack — Supabase → ASP.NET Core Migration Guide

## What Changed

| Before | After |
|--------|-------|
| Supabase PostgreSQL | SQL Server Express |
| Supabase Auth (JWT) | ASP.NET Core JWT + Refresh Tokens |
| Supabase Realtime | SignalR (WebSockets) |
| Supabase Edge Functions | ASP.NET Core Controllers |
| Row-Level Security | Role-based Authorization Policies |
| Direct DB queries from frontend | REST API via `src/lib/apiClient.ts` |

---

## Prerequisites

| Tool | Version | Link |
|------|---------|-------|
| .NET SDK | 8.0+ | https://dotnet.microsoft.com/download |
| SQL Server Express | 2019+ | https://www.microsoft.com/en-us/sql-server/sql-server-downloads |
| VS Code | Latest | https://code.visualstudio.com |
| C# Dev Kit Extension | Latest | `ms-dotnettools.csdevkit` in VS Code |
| Node.js | 18+ | https://nodejs.org |

---

## Backend Setup (Step-by-Step)

### 1. Install .NET 8 SDK
```
winget install Microsoft.DotNet.SDK.8
# or download from https://dotnet.microsoft.com/download/dotnet/8.0
dotnet --version   # should show 8.x.x
```

### 2. SQL Server Express should already be installed.
Verify it's running:
```
# Check service
sc query "MSSQL$SQLEXPRESS"
# Start if stopped
net start "MSSQL$SQLEXPRESS"
```

### 3. Install EF Core tools
```bash
dotnet tool install --global dotnet-ef
# Verify
dotnet ef --version
```

### 4. Restore NuGet packages & build
```bash
cd backend/BuildTrack.API
dotnet restore
dotnet build
```

### 5. Create database and run migrations
```bash
# Option A: Let auto-migration create it (Development mode)
dotnet run   # Migration runs automatically on startup in dev

# Option B: Manual
sqlcmd -S "localhost\SQLEXPRESS" -E -Q "CREATE DATABASE BuildTrackDB"
dotnet ef migrations add InitialCreate --output-dir Data/Migrations
dotnet ef database update
```

### 6. Seed initial admin user
```bash
sqlcmd -S "localhost\SQLEXPRESS" -d BuildTrackDB -E -i ..\..\database-scripts\002_seed_admin.sql
```
**Default login:** `admin@buildtrack.com` / `Admin@123456`
**Change this password immediately after first login!**

### 7. (Optional) Seed sample projects & SKUs
```bash
sqlcmd -S "localhost\SQLEXPRESS" -d BuildTrackDB -E -i ..\..\database-scripts\003_seed_sample_data.sql
```

### 8. Start the API
```bash
cd backend/BuildTrack.API
dotnet run
```
- API: `http://localhost:5069`
- Swagger: `http://localhost:5069/swagger`

---

## Frontend Setup

### 1. Install SignalR client (real-time notifications)
```bash
npm install @microsoft/signalr
```

### 2. (Optional) Remove Supabase
```bash
npm uninstall @supabase/supabase-js
# Note: Keep it installed if pages still reference it during migration
```

### 3. Verify .env
```
VITE_API_BASE_URL=http://localhost:5069
```

### 4. Start the frontend
```bash
npm run dev
```
Frontend: `http://localhost:8080`

---

## Architecture Overview

```
Frontend (React + TypeScript)
    │
    ├─ src/lib/apiClient.ts           ← All API calls, JWT token management
    ├─ src/contexts/AuthContext.tsx    ← JWT auth state
    ├─ src/hooks/useNotifications.ts   ← REST polling + SignalR
    ├─ src/lib/activityLogger.ts       ← → /api/audit-logs
    └─ src/lib/notificationService.ts  ← → /api/notifications
         │
         │  HTTP + SignalR WebSocket
         ▼
Backend (ASP.NET Core 8)              http://localhost:5069
    │
    ├─ Controllers/     ← REST endpoints
    ├─ Services/        ← Business logic
    ├─ Data/            ← EF Core AppDbContext
    ├─ Models/Entities/ ← C# entity classes (map to DB tables)
    ├─ DTOs/            ← Request/Response shapes
    ├─ Hubs/            ← SignalR NotificationHub (/hubs/notifications)
    └─ Middleware/      ← Global error handling
         │
         │  Entity Framework Core
         ▼
SQL Server Express (BuildTrackDB)     localhost\SQLEXPRESS
```

---

## Complete API Endpoints

### Auth
```
POST /api/auth/login           { loginId, password }
POST /api/auth/refresh         { refreshToken }
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/change-password { currentPassword, newPassword }
```

### Users
```
GET    /api/users
GET    /api/users/{id}
GET    /api/users/me
POST   /api/users             [admin]
PUT    /api/users/{id}
DELETE /api/users/{id}        [admin]
GET    /api/users/{id}/roles
POST   /api/users/{id}/roles  [admin]  { role }
DELETE /api/users/{id}/roles/{role}    [admin]
```

### Projects
```
GET    /api/projects?includeHidden&status&search
GET    /api/projects/{id}
POST   /api/projects
PUT    /api/projects/{id}
DELETE /api/projects/{id}              [admin]
GET    /api/projects/{id}/members
POST   /api/projects/{id}/members      { userId, role }
DELETE /api/projects/{id}/members/{userId}
GET    /api/projects/{id}/progress
GET    /api/projects/{id}/activity?limit
```

### Orders
```
GET    /api/orders?status&projectId&search
GET    /api/orders/{id}
GET    /api/orders/project/{projectId}?status
POST   /api/orders             { projectId, orderType, supplierName, items[] }
PUT    /api/orders/{id}
DELETE /api/orders/{id}
POST   /api/orders/{id}/submit
POST   /api/orders/{id}/approve        [approver]  { notes }
POST   /api/orders/{id}/reject         [approver]  { reason }
POST   /api/orders/{id}/status         { status, notes }
```

### SKUs
```
GET    /api/skus?search&isActive&category&sortBy&sortOrder
GET    /api/skus/{id}
POST   /api/skus                       [warehouse_admin]
PUT    /api/skus/{id}                  [warehouse_admin]
DELETE /api/skus/{id}                  [warehouse_admin]
```

### Inventory
```
GET    /api/inventory?projectId
GET    /api/inventory/project/{projectId}
GET    /api/inventory/transactions?projectId&skuId&limit
POST   /api/inventory/transactions     { projectId, skuId, transactionType, quantity }
```

### Company Assets & Borrowing
```
GET    /api/company-assets?search&assetType
GET    /api/company-assets/{id}
POST   /api/company-assets             [warehouse_admin]
PUT    /api/company-assets/{id}        [warehouse_admin]
DELETE /api/company-assets/{id}        [warehouse_admin]
GET    /api/company-assets/{id}/borrows
GET    /api/company-assets/borrow-transactions?projectId
POST   /api/company-assets/borrow     { assetId, projectId, quantity, expectedReturnDate }
POST   /api/company-assets/borrow-transactions/{id}/return  { returnedQty, remarks }
```

### Quotations
```
GET    /api/quotations?projectId
GET    /api/quotations/{id}
POST   /api/quotations                 { projectId, notes, category, items[] }
DELETE /api/quotations/{id}            [office_admin]
PUT    /api/quotations/{id}/items/{itemId}  { materialName, unit, quantity }
GET    /api/quotations/change-requests?projectId&status
POST   /api/quotations/change-requests { projectId, quotationId, changeType, payload }
PUT    /api/quotations/change-requests/{id}  [office_admin]  { status, reviewRemarks }
```

### Notifications
```
GET    /api/notifications?unreadOnly
PUT    /api/notifications/{id}/read
PUT    /api/notifications/read-all
DELETE /api/notifications/{id}
```

### Dashboard & Reports
```
GET /api/dashboard/stats
```

### Audit Logs
```
GET  /api/audit-logs?tableName&userId&limit   [admin]
POST /api/audit-logs
```

### SignalR
```
WebSocket: /hubs/notifications
Events pushed to client: NewNotification
```

---

## Remaining Frontend Migration Tasks

Find pages still using Supabase directly:
```bash
grep -r "supabase\." src/pages/ src/components/ --include="*.tsx" -l
```

**Pattern for migrating a page:**
```typescript
// BEFORE
import { supabase } from '@/integrations/supabase/client';
const { data, error } = await supabase.from('orders').select('*');

// AFTER
import { ordersApi } from '@/lib/apiClient';
const res = await ordersApi.getAll();
const data = res.data ?? [];
```

**Key API mappings:**

| Old Supabase | New API |
|---|---|
| `supabase.from('orders').select(...)` | `ordersApi.getAll(...)` |
| `supabase.from('projects').select(...)` | `projectsApi.getAll(...)` |
| `supabase.from('skus').select(...)` | `skusApi.getAll(...)` |
| `supabase.from('profiles').select(...)` | `usersApi.getAll()` |
| `supabase.from('user_roles').select(...)` | `usersApi.getRoles(id)` |
| `supabase.from('notifications').select(...)` | `notificationsApi.getAll()` |
| `supabase.from('company_assets').select(...)` | `companyAssetsApi.getAll()` |
| `supabase.from('borrow_transactions').select(...)` | `companyAssetsApi.getAllBorrows()` |
| `supabase.from('project_quotations').select(...)` | `quotationsApi.getAll(projectId)` |
| `supabase.from('quotation_change_requests').select(...)` | `quotationsApi.getChangeRequests()` |
| `supabase.from('project_inventory').select(...)` | `inventoryApi.getAll(projectId)` |
| `supabase.rpc('create_project_with_membership', ...)` | `projectsApi.create(...)` |

---

## Roles & Authorization Policies

| Role | Policy | Capabilities |
|------|--------|-------------|
| `super_admin`, `admin` | `RequireAdmin` | Full access |
| `office_admin` | `RequireOfficeAdmin` | Approve orders, change requests |
| `approver`, `approval_admin` | `RequireApprover` | Approve/reject orders |
| `warehouse_admin` | `RequireWarehouseAdmin` | Manage SKUs, assets, inventory |
| `project_manager`, `project_engineer` | `RequireProjectManager` | Create projects/orders |
| `logistics_admin`, `driver`, `tracking_driver` | `RequireLogistics` | Logistics operations |
| `receiver`, `storekeeper` | `RequireReceiver` | Receive deliveries |

---

## Troubleshooting

### "Unable to connect to SQL Server"
1. Start SQL Server: `net start "MSSQL$SQLEXPRESS"`
2. Check instance name in `appsettings.Development.json`
3. Try connecting with SSMS first

### "EF Core migration error"
```bash
# Remove last migration and recreate
dotnet ef migrations remove
dotnet ef migrations add InitialCreate
dotnet ef database update
```

### "CORS error in browser"
Add your frontend URL to `appsettings.json`:
```json
"Cors": { "AllowedOrigins": ["http://localhost:8080"] }
```

### "401 Unauthorized on all requests"
- Check `VITE_API_BASE_URL` in `.env` matches the API port
- Verify JWT secret is the same in `appsettings.Development.json`
- Clear localStorage and log in again

### "SignalR not connecting"
```bash
npm install @microsoft/signalr
```
Falls back to 30s polling if not installed.

### JWT secret warning
Generate a proper secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
