# MSSQL Database Setup & Migration Guide

## Prerequisites

- SQL Server 2019+ or SQL Server Express LocalDB
- Node.js 18+
- npm or bun

## Database Setup

### 1. Create Database

```sql
CREATE DATABASE BuildTrack;
```

### 2. Configure Environment

Create `.env` file in the backend directory:

```env
DB_SERVER=(LocalDB)\\MSSQLLocalDB
DB_NAME=BuildTrack
DB_TRUST_SERVER_CERTIFICATE=true
NODE_ENV=development
PORT=3000
JWT_SECRET=your-secret-key-here
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

### 3. Run Migrations

The migrations run automatically when the backend starts:

```bash
cd backend
npm install
npm run dev
```

The migrations will:
1. Create all required tables (users, projects, orders, skus, etc.)
2. Create indexes for performance
3. Track migration history
4. Log execution times

### 4. Seed Initial Data (Optional)

After migrations complete, manually run the seed script in MSSQL:

```sql
-- Run seed script to create default admin user
USE StockwellDB;

IF NOT EXISTS (SELECT * FROM users WHERE email = 'admin@stockwell.com')
BEGIN
    INSERT INTO users (id, email, full_name, password_hash, is_active, created_at, updated_at)
    VALUES (
        'admin-001', 
        'admin@stockwell.com', 
        'Admin User',
        '$2a$10$TfX0xQGvF/qm5zQOjqVr4O7i7GLz3S9z8YQ7Q7R6H4mO9Z1Z1qZlG',
        1,
        GETUTCDATE(),
        GETUTCDATE()
    );
    
    INSERT INTO user_roles (id, user_id, role, created_at)
    VALUES ('role-001', 'admin-001', 'super_admin', GETUTCDATE());
END
```

**Default Admin Credentials:**
- Email: `admin@stockwell.com`
- Password: `admin123`

## Database Schema

### Core Tables

- **users** - User accounts with authentication
- **user_roles** - Role-based access control
- **projects** - Project/site management
- **project_members** - Project team members
- **skus** - Stock keeping units (products/materials)
- **project_inventory** - Inventory per project
- **inventory_transactions** - All inventory movements

### Order Management

- **orders** - Purchase orders
- **order_items** - Order line items
- **deliveries** - Delivery tracking
- **delivery_items** - Received items

### Other

- **notifications** - User notifications
- **migration_history** - Migration tracking

## Frontend to Backend Connection

### 1. Frontend Environment Setup

Create `.env.local` in the frontend root:

```env
VITE_API_URL=http://localhost:3000
```

### 2. API Usage Examples

The frontend has ready-to-use API hooks via React Query:

#### Authentication

```typescript
import { useLogin } from '@/hooks/useApi';

function LoginComponent() {
  const { mutate: login } = useLogin();
  
  const handleLogin = (email: string, password: string) => {
    login(
      { email, password },
      {
        onSuccess: (data) => {
          localStorage.setItem('auth_token', data.access_token);
          // Redirect to dashboard
        },
      }
    );
  };
}
```

#### Projects

```typescript
import { useGetAllProjects, useCreateProject } from '@/hooks/useApi';

function ProjectsPage() {
  const { data: projectsData, isLoading } = useGetAllProjects(1, 10);
  const { mutate: createProject } = useCreateProject();
  
  return (
    <div>
      {/* Display projects */}
    </div>
  );
}
```

#### Inventory

```typescript
import { useGetProjectInventory, useAdjustInventory } from '@/hooks/useApi';

function InventoryPage({ projectId }) {
  const { data: inventory } = useGetProjectInventory(projectId);
  const { mutate: adjustStock } = useAdjustInventory();
  
  return (
    <div>
      {/* Inventory management UI */}
    </div>
  );
}
```

## Running Both Frontend and Backend

### Terminal 1 - Backend

```bash
cd backend
npm install
npm run dev
# Server runs on http://localhost:3000
```

### Terminal 2 - Frontend

```bash
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

## Troubleshooting

### Database Connection Issues

**Error: "Cannot open database"**
- Ensure database exists: `CREATE DATABASE StockwellDB`
- Check `DB_NAME` in `.env` matches database name
- Verify SQL Server is running

**Error: "Login failed"**
- Check `DB_SERVER` setting for LocalDB
- Use: `(LocalDB)\MSSQLLocalDB` for LocalDB
- Use: `localhost\SQLEXPRESS` for SQL Express

### Migration Failures

Check `migration_history` table for details:

```sql
SELECT * FROM migration_history ORDER BY executed_at DESC;
```

### CORS Issues

If frontend can't reach backend:
1. Ensure `CORS_ORIGIN` includes frontend URL
2. Default: `http://localhost:5173`
3. Backend must be running on configured PORT

### API Calls Failing

Check:
1. Auth token stored in localStorage
2. Backend is running and listening on PORT
3. Network tab in browser DevTools for 401/403 errors
4. Server logs for detailed error messages

## Database Backup

```bash
# Using sqlcmd
sqlcmd -S (LocalDB)\MSSQLLocalDB -d StockwellDB -Q "BACKUP DATABASE StockwellDB TO DISK = 'C:\backups\StockwellDB.bak'"
```

## Migration Rollback

To manually undo migrations, drop tables in reverse order:

```sql
DROP TABLE IF EXISTS migration_history;
DROP TABLE IF EXISTS delivery_items;
DROP TABLE IF EXISTS deliveries;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS project_inventory;
DROP TABLE IF EXISTS skus;
DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS users;
```

Then re-run: `npm run dev` to re-migrate.
