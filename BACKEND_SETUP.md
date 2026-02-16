# Stockwell - MSSQL Backend & Frontend Integration

Complete setup guide for deploying the Stockwell inventory management system with MSSQL backend and React frontend.

## Quick Start

### 1. Backend Setup (Terminal 1)

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials

# Run migrations and start server
npm run dev
```

The backend will:
- ✅ Connect to MSSQL database
- ✅ Run all migrations automatically
- ✅ Create tables with proper indexes
- ✅ Start API server on http://localhost:3000

### 2. Frontend Setup (Terminal 2)

```bash
# Frontend dependencies already mostly installed
npm install axios

# Configure API endpoint
echo "VITE_API_URL=http://localhost:3000" > .env.local

# Start development server
npm run dev
```

Frontend runs on http://localhost:5173

## Architecture

```
stockwell-build/
├── backend/                    # Node.js/Express API
│   ├── migrations/            # MSSQL migration files
│   ├── src/
│   │   ├── config/           # Database & environment config
│   │   ├── controllers/      # HTTP request handlers
│   │   ├── services/         # Business logic
│   │   ├── dto/              # Data transfer objects
│   │   ├── routes/           # API endpoint definitions
│   │   ├── middleware/       # Auth, error handling
│   │   └── utils/            # Logger, migrations
│   └── package.json
│
└── src/                       # React frontend
    ├── lib/
    │   ├── apiClient.ts      # Axios setup with interceptors
    │   └── api.ts            # API service functions
    ├── hooks/
    │   └── useApi.ts         # React Query hooks
    ├── contexts/
    └── pages/
```

## API Features

### ✅ Authentication
- JWT-based authentication
- Login, profile management
- Role-based access control (RBAC)

### ✅ User Management
- User creation and management
- Multiple roles support
- Profile updates

### ✅ Project Management
- Create and manage projects
- Add team members
- Track project status

### ✅ Order Management
- Create purchase orders
- Order approval workflow
- Order item tracking

### ✅ Inventory Management
- Track stock per project
- Stock adjustments
- Inter-project transfers
- Low stock alerts
- Transaction history

### ✅ SKU Management
- Product/material catalog
- Search functionality
- Category management

## Database Tables

13 main tables with proper relationships and indexes:

1. **users** - User accounts
2. **user_roles** - Role assignments
3. **projects** - Project/site records
4. **project_members** - Team assignments
5. **skus** - Products/materials
6. **project_inventory** - Stock tracking
7. **inventory_transactions** - Audit trail
8. **orders** - Purchase orders
9. **order_items** - Order details
10. **deliveries** - Delivery tracking
11. **delivery_items** - Received items
12. **notifications** - User notifications
13. **migration_history** - Migration tracking

## API Endpoints

### Authentication
```
POST   /api/auth/login              - Login
GET    /api/auth/profile            - Current user
POST   /api/auth/change-password    - Change password
```

### Users
```
GET    /api/users                   - List users
POST   /api/users                   - Create user (admin)
GET    /api/users/:userId           - Get user
PUT    /api/users/profile           - Update profile
DELETE /api/users/:userId           - Deactivate user (admin)
```

### Projects
```
GET    /api/projects                - List projects
POST   /api/projects                - Create project
GET    /api/projects/:projectId     - Get project details
PUT    /api/projects/:projectId     - Update project
GET    /api/projects/:projectId/members    - Project members
POST   /api/projects/:projectId/members    - Add member
DELETE /api/projects/:projectId/members/:memberId - Remove member
```

### Orders
```
GET    /api/orders/:orderId                      - Get order
GET    /api/orders/project/:projectId            - List project orders
POST   /api/orders                               - Create order
PUT    /api/orders/:orderId                      - Update order
POST   /api/orders/:orderId/approve              - Approve order
POST   /api/orders/:orderId/reject               - Reject order
```

### SKUs
```
GET    /api/skus                    - List SKUs
POST   /api/skus                    - Create SKU
GET    /api/skus/:skuId             - Get SKU
PUT    /api/skus/:skuId             - Update SKU
GET    /api/skus/search?q=term      - Search SKUs
```

### Inventory
```
GET    /api/inventory/:projectId              - Project inventory
GET    /api/inventory/:projectId/sku/:skuId   - SKU inventory
POST   /api/inventory/:projectId/adjust       - Adjust stock
POST   /api/inventory/:projectId/transfer     - Transfer stock
GET    /api/inventory/:projectId/transactions - Transaction history
GET    /api/inventory/:projectId/low-stock    - Low stock items
```

## Frontend Usage

### Using API Hooks

```typescript
import { useGetAllProjects, useCreateProject } from '@/hooks/useApi';

function Dashboard() {
  // Fetch data with automatic caching
  const { data, isLoading, error } = useGetAllProjects(1, 10);
  
  // Mutations with automatic cache invalidation
  const { mutate: createProject, isPending } = useCreateProject();
  
  const handleCreate = () => {
    createProject(
      { name: 'New Project', location: 'Site A' },
      {
        onSuccess: () => console.log('Created!'),
        onError: (error) => console.error(error),
      }
    );
  };

  return (
    <div>
      {isLoading ? 'Loading...' : data?.projects.map(p => <p key={p.id}>{p.name}</p>)}
    </div>
  );
}
```

### Available Hooks

**Auth:**
- `useLogin()` - Login user
- `useGetProfile()` - Current user profile

**Users:**
- `useGetAllUsers()` - List users
- `useGetUser(userId)` - Get user details
- `useCreateUser()` - Create user
- `useUpdateProfile()` - Update own profile

**Projects:**
- `useGetAllProjects()` - List projects
- `useGetProject(projectId)` - Get project
- `useCreateProject()` - Create project
- `useUpdateProject()` - Update project
- `useGetProjectMembers(projectId)` - Project members
- `useAddProjectMember()` - Add team member

**Orders:**
- `useGetOrder(orderId)` - Get order
- `useGetProjectOrders(projectId)` - Project orders
- `useCreateOrder()` - Create order
- `useApproveOrder()` - Approve order

**SKUs:**
- `useGetAllSKUs()` - List SKUs
- `useGetSKU(skuId)` - Get SKU
- `useCreateSKU()` - Create SKU
- `useSearchSKUs(term)` - Search SKUs

**Inventory:**
- `useGetProjectInventory(projectId)` - Project stock
- `useGetSKUInventory(projectId, skuId)` - SKU stock
- `useAdjustInventory()` - Adjust stock
- `useTransferInventory()` - Transfer between projects
- `useGetInventoryTransactions()` - Transaction history
- `useGetLowStockItems(projectId)` - Low stock alerts

## Environment Variables

### Backend (.env)
```env
DB_SERVER=(LocalDB)\MSSQLLocalDB    # SQL Server instance
DB_DATABASE=StockwellDB             # Database name
DB_TRUST_SERVER_CERTIFICATE=true    # Trust certificate for LocalDB

NODE_ENV=development                 # Environment
PORT=3000                           # API port
API_URL=http://localhost:3000       # API URL

JWT_SECRET=your-secret-key          # JWT signing key
JWT_EXPIRATION=24h                  # Token expiration

CORS_ORIGIN=http://localhost:5173   # Allowed frontend origins
LOG_LEVEL=debug                     # Log verbosity
```

### Frontend (.env.local)
```env
VITE_API_URL=http://localhost:3000  # Backend API URL
```

## Default Admin Account

After migrations complete, login with:
- **Email:** `admin@stockwell.com`
- **Password:** `admin123`

⚠️ **Change these credentials** in production!

## Common Tasks

### View Migration Status
```bash
# In MSSQL
SELECT * FROM migration_history ORDER BY executed_at DESC;
```

### Reset Database
```bash
# Drop all tables (careful!)
DROP TABLE IF EXISTS [<table_name>];
```

Then restart backend to re-migrate.

### Check API Connection
```bash
# Test health endpoint
curl http://localhost:3000/health
```

### View Backend Logs
```bash
# Already displayed in terminal where you ran: npm run dev
# Check for any errors or migration issues
```

## Troubleshooting

### Database connection fails
- ✅ Verify SQL Server is running
- ✅ Check `DB_SERVER` and `DB_DATABASE` in `.env`
- ✅ Ensure database exists or create it

### Frontend can't reach backend
- ✅ Backend running on port 3000?
- ✅ Correct `VITE_API_URL` in frontend `.env.local`
- ✅ No CORS errors in browser console?

### Migrations don't run
- ✅ Check backend logs for SQL errors
- ✅ Query `migration_history` table
- ✅ Manually review migration `.sql` files

### 401/403 Errors
- ✅ Auth token expires? (JWT_EXPIRATION)
- ✅ User has required role?
- ✅ Check role-based middleware

## Security Considerations

- 🔐 Change `JWT_SECRET` in production
- 🔐 Use HTTPS in production (update CORS_ORIGIN)
- 🔐 Hash and salt passwords (bcryptjs)
- 🔐 Validate all inputs (DTOs)
- 🔐 Implement rate limiting
- 🔐 Use environment variables for sensitive data
- 🔐 Enable SQL encryption
- 🔐 Regular backups

## Next Steps

1. ✅ Install dependencies: `npm install`, `npm install axios`
2. ✅ Configure database: Create `StockwellDB` database
3. ✅ Set environment variables in `.env` files
4. ✅ Start backend: `npm run dev` (backend/)
5. ✅ Start frontend: `npm run dev` (root)
6. ✅ Login with admin credentials
7. ✅ Explore API in browser DevTools Network tab
8. ✅ Start building features!

## Support

Check [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed database setup and troubleshooting.
