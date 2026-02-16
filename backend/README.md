# Stockwell Backend

MSSQL-powered REST API backend for the Stockwell inventory management system.

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration (database, environment)
│   ├── controllers/     # HTTP request handlers
│   ├── dto/             # Data Transfer Objects
│   ├── middleware/      # Express middleware (auth, error handling)
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic layer
│   ├── utils/           # Utility functions (logger, validators)
│   ├── app.ts          # Express app setup
│   └── server.ts       # Server entry point
├── package.json
├── tsconfig.json
└── .env.example
```

## Installation

```bash
cd backend
npm install
```

## Configuration

1. Copy `.env.example` to `.env`
2. Update database connection details:

```env
DB_SERVER=your-mssql-server
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=YourPassword
DB_NAME=BuildTrack
```

3. Update JWT secret and other settings

## Development

```bash
npm run dev
```

Server runs on `http://localhost:3000`

## Production Build

```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get current user
- `POST /api/auth/change-password` - Change password

### Users
- `GET /api/users` - List all users
- `POST /api/users` - Create user (admin only)
- `GET /api/users/:userId` - Get user details
- `PUT /api/users/profile` - Update profile
- `DELETE /api/users/:userId` - Deactivate user (admin only)

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/:projectId` - Get project details
- `PUT /api/projects/:projectId` - Update project
- `GET /api/projects/:projectId/members` - Get project members
- `POST /api/projects/:projectId/members` - Add member
- `DELETE /api/projects/:projectId/members/:memberId` - Remove member

### Orders
- `GET /api/orders/:orderId` - Get order details
- `GET /api/orders/project/:projectId` - Get project orders
- `POST /api/orders` - Create order
- `PUT /api/orders/:orderId` - Update order
- `POST /api/orders/:orderId/approve` - Approve order
- `POST /api/orders/:orderId/reject` - Reject order

### SKUs
- `GET /api/skus` - List SKUs
- `POST /api/skus` - Create SKU
- `GET /api/skus/:skuId` - Get SKU details
- `PUT /api/skus/:skuId` - Update SKU
- `GET /api/skus/search?q=term` - Search SKUs

### Inventory
- `GET /api/inventory/:projectId` - Get project inventory
- `GET /api/inventory/:projectId/sku/:skuId` - Get SKU inventory
- `POST /api/inventory/:projectId/adjust` - Adjust stock
- `POST /api/inventory/:projectId/transfer` - Transfer stock
- `GET /api/inventory/:projectId/transactions` - Get transactions
- `GET /api/inventory/:projectId/low-stock` - Get low stock items

## Architecture

### DTOs (Data Transfer Objects)
Define request/response contracts and handle validation.

### Services
Encapsulate business logic and database operations.

### Controllers
Handle HTTP requests and delegate to services.

### Middleware
- `authMiddleware` - JWT verification
- `roleMiddleware` - Role-based access control
- `errorHandler` - Centralized error handling

### Database
MSSQL connection pool with query utilities.
