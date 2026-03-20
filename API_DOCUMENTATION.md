# BuildTrack API Contract & Endpoints Documentation

## Base URL
- **Development**: `http://localhost:7069`
- **Production**: `https://api.buildtrack.com` (to be configured)

## Authentication

### JWT Bearer Token
All endpoints (except `/api/auth/login`) require JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

### Token Structure
```json
{
  "sub": "user-id-guid",
  "email": "user@example.com",
  "role": ["admin", "project_manager"],
  "iat": 1234567890,
  "exp": 1234571490
}
```

### Token Refresh
- Access tokens expire in 60 minutes (configurable)
- Use refresh token to get new access token
- Refresh tokens do not expire in current implementation

---

## Endpoints Catalog

### Authentication Endpoints

#### 1. Login (POST)
**Endpoint**: `POST /api/auth/login`

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "email": "admin@buildtrack.local",
  "password": "Admin123!@#"
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@buildtrack.local",
    "fullName": "Administrator",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "base64-encoded-random-token",
    "expiresIn": 3600,
    "roles": ["super_admin"]
  }
}
```

**Error Response (401)**:
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

#### 2. Logout (POST)
**Endpoint**: `POST /api/auth/logout`

**Authentication**: Required (Bearer Token)

**Response (200)**:
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

#### 3. Refresh Token (POST)
**Endpoint**: `POST /api/auth/refresh`

**Request Body**:
```json
{
  "refreshToken": "base64-encoded-token"
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-token",
    "refreshToken": "new-refresh-token",
    "expiresIn": 3600
  }
}
```

---

### User Endpoints

#### 1. Get Current User (GET)
**Endpoint**: `GET /api/users/me`

**Authentication**: Required

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@buildtrack.local",
    "fullName": "Administrator",
    "username": "admin",
    "phone": "+1234567890",
    "address": "123 Main St",
    "avatarUrl": "https://...",
    "isActive": true,
    "smsOptIn": false,
    "emailOptIn": true,
    "createdAt": "2023-01-15T10:30:00Z",
    "updatedAt": "2023-01-15T10:30:00Z",
    "roles": ["super_admin"]
  }
}
```

---

#### 2. Get User by ID (GET)
**Endpoint**: `GET /api/users/{id}`

**Authentication**: Required

**Parameters**:
- `id` (path): User ID in UUID format

**Response (200)**: Same as Get Current User

---

#### 3. Get All Users (GET)
**Endpoint**: `GET /api/users?page=1&pageSize=10`

**Authentication**: Required

**Query Parameters**:
- `page` (int, default=1): Page number
- `pageSize` (int, default=10): Items per page

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "data": [
      { "id": "...", "email": "user1@buildtrack.local", ... },
      { "id": "...", "email": "user2@buildtrack.local", ... }
    ],
    "total": 25,
    "page": 1,
    "pageSize": 10,
    "totalPages": 3
  }
}
```

---

#### 4. Update User (PUT)
**Endpoint**: `PUT /api/users/{id}`

**Authentication**: Required

**Request Body** (all fields optional):
```json
{
  "fullName": "New Name",
  "username": "newusername",
  "phone": "+9876543210",
  "address": "456 Oak Ave",
  "avatarUrl": "https://...",
  "smsOptIn": true,
  "emailOptIn": false,
  "isActive": true
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": { ... user data ... }
}
```

---

#### 5. Change Password (POST)
**Endpoint**: `POST /api/users/{id}/change-password`

**Authentication**: Required (only user can change own password)

**Request Body**:
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

#### 6. Assign Role to User (POST)
**Endpoint**: `POST /api/users/{id}/roles`

**Authentication**: Required (admin/super_admin only)

**Request Body**:
```json
{
  "role": "project_manager"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Role assigned successfully"
}
```

---

### Project Endpoints

#### 1. Get Project by ID (GET)
**Endpoint**: `GET /api/projects/{id}`

**Authentication**: Required

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Downtown Office Building",
    "code": "PRJ-2024-001",
    "location": "Downtown District",
    "description": "Construction of 50-story office building",
    "status": "active",
    "startDate": "2023-01-15T00:00:00Z",
    "endDate": "2025-12-31T00:00:00Z",
    "projectManagerId": "550e8400-e29b-41d4-a716-446655440000",
    "projectManagerName": "John Doe",
    "estimatedCost": 50000000.00,
    "isHidden": false,
    "createdAt": "2023-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T14:20:00Z"
  }
}
```

---

#### 2. Get All Projects (GET)
**Endpoint**: `GET /api/projects?page=1&pageSize=10&includeHidden=false`

**Authentication**: Required

**Query Parameters**:
- `page` (int, default=1)
- `pageSize` (int, default=10)
- `includeHidden` (bool, default=false)

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "data": [ ... projects array ... ],
    "total": 15,
    "page": 1,
    "pageSize": 10,
    "totalPages": 2
  }
}
```

---

#### 3. Create Project (POST)
**Endpoint**: `POST /api/projects`

**Authentication**: Required

**Request Body**:
```json
{
  "name": "New Commercial Complex",
  "code": "PRJ-2024-002",
  "location": "Business District",
  "description": "Mixed-use commercial development",
  "startDate": "2024-02-01T00:00:00Z",
  "endDate": "2026-06-30T00:00:00Z",
  "estimatedCost": 75000000.00,
  "initialMemberIds": [
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002"
  ]
}
```

**Response (201)**:
```json
{
  "success": true,
  "message": "Project created successfully",
  "data": { ... project data ... }
}
```

---

#### 4. Update Project (PUT)
**Endpoint**: `PUT /api/projects/{id}`

**Authentication**: Required

**Request Body** (all fields optional):
```json
{
  "name": "Updated Project Name",
  "status": "on_hold",
  "estimatedCost": 80000000.00,
  "isHidden": false
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Project updated successfully",
  "data": { ... project data ... }
}
```

---

#### 5. Delete Project (DELETE)
**Endpoint**: `DELETE /api/projects/{id}`

**Authentication**: Required

**Response (200)**:
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

---

### Order Endpoints

#### 1. Get Order by ID (GET)
**Endpoint**: `GET /api/orders/{id}`

**Authentication**: Required

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "projectId": "660e8400-e29b-41d4-a716-446655440000",
    "projectName": "Downtown Office Building",
    "orderNumber": "ORD-20240115153000",
    "orderType": "Initial Equipment",
    "status": "draft",
    "supplierName": "ABC Construction Supplies",
    "supplierContact": "contact@abc.com",
    "totalAmount": 250000.00,
    "notes": "First order for project kickoff",
    "approvedAt": null,
    "deliveredAt": null,
    "expectedDeliveryDate": "2024-02-15T00:00:00Z",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z",
    "createdByName": "John Manager",
    "lineItems": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440000",
        "skuId": "910e8400-e29b-41d4-a716-446655440000",
        "skuCode": "CEMENT-50KG",
        "skuName": "Portland Cement 50kg Bag",
        "quantity": 500,
        "unitPrice": 12.50,
        "unit": "bag"
      }
    ]
  }
}
```

---

#### 2. Get Orders by Project (GET)
**Endpoint**: `GET /api/orders/project/{projectId}?status=draft&page=1&pageSize=10`

**Authentication**: Required

**Query Parameters**:
- `status` (string, optional): Filter by status (draft, approved, ordered, delivered, etc.)
- `page` (int, default=1)
- `pageSize` (int, default=10)

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "data": [ ... orders array ... ],
    "total": 5,
    "page": 1,
    "pageSize": 10,
    "totalPages": 1
  }
}
```

---

#### 3. Create Order (POST)
**Endpoint**: `POST /api/orders`

**Authentication**: Required

**Request Body**:
```json
{
  "projectId": "660e8400-e29b-41d4-a716-446655440000",
  "orderType": "Materials",
  "supplierName": "ABC Supplies",
  "supplierContact": "contact@abc.com",
  "totalAmount": 150000.00,
  "notes": "Building materials for Phase 1",
  "expectedDeliveryDate": "2024-02-10T00:00:00Z",
  "lineItems": [
    {
      "skuId": "910e8400-e29b-41d4-a716-446655440000",
      "quantity": 500,
      "unitPrice": 12.50
    },
    {
      "skuId": "920e8400-e29b-41d4-a716-446655440000",
      "quantity": 1000,
      "unitPrice": 8.75
    }
  ]
}
```

**Response (201)**:
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": { ... order data ... }
}
```

---

#### 4. Update Order (PUT)
**Endpoint**: `PUT /api/orders/{id}`

**Authentication**: Required

**Request Body** (all fields optional):
```json
{
  "supplierName": "Updated Supplier",
  "totalAmount": 175000.00,
  "notes": "Updated notes"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Order updated successfully",
  "data": { ... order data ... }
}
```

---

#### 5. Approve Order (POST)
**Endpoint**: `POST /api/orders/{id}/approve`

**Authentication**: Required (approver roles only)

**Request Body**:
```json
{
  "finalAmount": 165000.00,
  "notes": "Approved for Phase 1"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Order approved successfully"
}
```

---

#### 6. Reject Order (POST)
**Endpoint**: `POST /api/orders/{id}/reject`

**Authentication**: Required (approver roles only)

**Request Body**:
```json
{
  "rejectionReason": "Supplier pricing too high, requesting new quotation"
}
```

**Response (200)**:
```json
{
  "success": true,
  "message": "Order rejected successfully"
}
```

---

#### 7. Delete Order (DELETE)
**Endpoint**: `DELETE /api/orders/{id}`

**Authentication**: Required

**Response (200)**:
```json
{
  "success": true,
  "message": "Order deleted successfully"
}
```

---

## Error Responses

### Standard Error Response (4xx/5xx)
```json
{
  "success": false,
  "message": "Error description",
  "errors": {
    "field1": ["Error for field1"],
    "field2": ["Error for field2"]
  }
}
```

### Common Error Codes

| Status | Message | Reason |
|--------|---------|--------|
| 400 | Bad Request | Invalid input parameters |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | User doesn't have permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists (duplicate) |
| 422 | Unprocessable Entity | Validation error on field |
| 500 | Internal Server Error | Unexpected server error |

---

## Pagination Response Format

All list endpoints return:
```json
{
  "success": true,
  "data": {
    "data": [ ... items ... ],
    "total": 100,
    "page": 1,
    "pageSize": 10,
    "totalPages": 10
  }
}
```

Calculation: `totalPages = (total + pageSize - 1) / pageSize`

---

## Role-Based Access Control

### Available Roles
- `super_admin`: Full system access
- `admin`: Administrative access
- `office_admin`: Office management
- `warehouse_admin`: Warehouse/logistics
- `project_manager`: Project management
- `procurement`: Procurement specialist
- `storekeeper`: Inventory management
- `site_lead`: Site supervision
- `project_engineer`: Engineering
- `checker`: Quality checking
- `driver`: Logistics driver
- `receiver`: Goods receiving
- `viewer`: Read-only access
- `approver`: Order approval
- `tracking_driver`: Tracking driver

### Endpoint Authorization

| Endpoint | Required Roles | Notes |
|----------|---|---|
| POST /api/auth/login | None | Public |
| GET /api/users/me | Any authenticated | Self-access |
| PUT /api/users/{id} | Any authenticated | Self-update only |
| GET /api/users | admin, super_admin | Admin only |
| POST /api/users/{id}/roles | admin, super_admin | Assign roles |
| GET /api/projects | Any authenticated | List projects user can access |
| POST /api/projects | Any authenticated | Create new project |
| POST /api/orders | Roles that can create orders | Project-scoped |
| POST /api/orders/{id}/approve | approver, admin | Approval required |

---

## Rate Limiting (Future Implementation)

Currently not implemented. To be added:
- 100 requests per minute per user
- 1000 requests per minute per IP

---

## API Versioning

Current version: `v1`

Future versions will be: `/api/v2/...`

Backward compatibility maintained for 12 months after new version release.

---

## Testing with cURL

### Login
```bash
curl -X POST http://localhost:7069/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@buildtrack.local","password":"Admin123!@#"}'
```

### Get Current User
```bash
curl -X GET http://localhost:7069/api/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Create Project
```bash
curl -X POST http://localhost:7069/api/projects \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project","code":"TST-001",...}'
```

---

## Testing with Swagger UI

Navigate to: http://localhost:7069/swagger

1. Click "Authorize" button
2. Paste JWT token from login response
3. Use "Try it out" on any endpoint

---

## Performance Metrics

Expected response times (under normal load):
- GET requests: < 100ms
- POST requests: < 200ms
- Database queries with pagination: < 50ms
- Complex joined queries: < 150ms

---

## Support

For API issues:
1. Check error message in response
2. Verify JWT token hasn't expired
3. Check Swagger documentation
4. Review backend logs: `logs/application.log`
