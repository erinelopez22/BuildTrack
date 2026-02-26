# BuildTrack – Complete System Master Prompt

> **App Name:** BuildTrack  
> **Tagline:** Construction Inventory & Order Tracking System  
> **Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Auth + DB + Edge Functions + Storage), TanStack React Query, React Router v6, Recharts, date-fns  
> **Currency:** Philippine Peso (₱ / PHP)  
> **Timezone:** All dates displayed in **Asia/Manila** via `date-fns-tz`

---

## TABLE OF CONTENTS

1. [Authentication & Login](#1-authentication--login)
2. [Role-Based Access Control (RBAC)](#2-role-based-access-control-rbac)
3. [Navigation & Layout](#3-navigation--layout)
4. [Dashboard](#4-dashboard)
5. [Projects](#5-projects)
6. [Project Detail](#6-project-detail)
7. [Order & Tracking (Inventory)](#7-order--tracking-inventory)
8. [View Orders](#8-view-orders)
9. [Quotation Request](#9-quotation-request)
10. [SKU Catalog](#10-sku-catalog)
11. [Equipments & Tools](#11-equipments--tools)
12. [Users & Roles](#12-users--roles)
13. [Active Members](#13-active-members)
14. [Notifications](#14-notifications)
15. [Settings](#15-settings)
16. [Edge Functions](#16-edge-functions)
17. [Database Schema Summary](#17-database-schema-summary)
18. [UI/UX Standards](#18-uiux-standards)
19. [System-Wide Rules](#19-system-wide-rules)

---

## 1. Authentication & Login

**Route:** `/login`  
**Component:** `src/pages/Login.tsx`  
**Auth Provider:** `src/contexts/AuthContext.tsx`

### Login Page
- Centered card layout with BuildTrack logo (HardHat icon) and brand name
- **Fields:** Email, Password
- Sign in via `supabase.auth.signInWithPassword`
- Supports login by email directly
- On success → redirects to `/dashboard`
- If already authenticated → auto-redirect to `/dashboard`
- Loading spinner while checking session

### Auth Context (`AuthProvider`)
- Wraps entire app; provides: `user`, `session`, `profile`, `roles`, `loading`
- Fetches `profiles` and `user_roles` from Supabase on auth state change
- **Exposed helpers:**
  - `signIn(loginId, password)` – looks up email by username if no `@`, then authenticates
  - `signOut()` – signs out and clears state
  - `hasRole(role)`, `isAdmin()`, `isSuperAdmin()`, `isApprover()`, `isOfficeAdmin()`, `isWarehouseAdmin()`, `isProjectEngineer()`, `isChecker()`, `isDriver()`, `isReceiver()`
  - `canCreateOrders()`, `canCreateProjects()`, `canApproveOrders()`, `canProcessLogistics()`, `canReceiveOrders()`, `canManageTeam()`
  - `refreshProfile()`

### Inactivity Timeout
- Hook: `src/hooks/useInactivityTimeout.ts`
- Auto-logs out after period of inactivity

---

## 2. Role-Based Access Control (RBAC)

### Active Roles (8 primary roles)
| Role Key | Display Name | Description |
|---|---|---|
| `super_admin` | Super Admin | Full system access, data reset, delete users |
| `admin` | Admin | Full access except Super Admin-only features |
| `office_admin` | Office Admin | Global project visibility, quotation approval, team management |
| `project_engineer` | Project Engineer | Creates projects (auto-member), full order CRUD, team management in assigned projects |
| `checker` | Checker | Limited nav: Dashboard, Projects, Order & Tracking, View Order, Equipment |
| `warehouse_admin` | Trucking Admin | Limited nav same as Checker; view-only for On Transit; cannot manage quotations or use On Hold/Resume |
| `driver` | Driver | Minimal access for delivery tracking |
| `viewer` | Viewer | Read-only access |

### Mutually Exclusive
- **Office Admin** and **Trucking Admin** (warehouse_admin) are mutually exclusive

### Global Project Visibility
- Super Admin, Admin, and Office Admin see ALL projects
- Other roles only see projects where they are assigned members

### Role Constants
```typescript
// src/types/database.ts
export const ACTIVE_ROLES: AppRole[] = [
  'super_admin', 'admin', 'viewer', 'project_engineer',
  'checker', 'driver', 'office_admin', 'warehouse_admin',
];

export const ROLE_DISPLAY_NAMES: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  office_admin: 'Office Admin',
  warehouse_admin: 'Trucking Admin',
  project_engineer: 'Project Engineer',
  checker: 'Checker',
  driver: 'Driver',
  viewer: 'Viewer',
  // Legacy roles still defined but not actively used:
  project_manager: 'Project Manager',
  procurement: 'Procurement',
  storekeeper: 'Storekeeper',
  site_lead: 'Site Lead',
  approver: 'Approver',
  approval_admin: 'Approval Admin',
  logistics_admin: 'Logistics Admin',
  receiver: 'Receiver',
  tracking_driver: 'Driver',
};
```

---

## 3. Navigation & Layout

### App Layout (`src/components/layout/AppLayout.tsx`)
- Protected route wrapper: redirects to `/login` if not authenticated
- `SidebarProvider` → `AppSidebar` + `SidebarInset` with sticky header containing `SidebarTrigger`
- Main content area with `<Outlet />` for nested routes

### Sidebar (`src/components/layout/AppSidebar.tsx`)
- **Brand:** BuildTrack logo (HardHat icon) + "Inventory System"
- **Main Menu** (role-filtered):

| Nav Item | Route | Visible To |
|---|---|---|
| Dashboard | `/dashboard` | All roles |
| Projects | `/projects` | All roles |
| Order & Tracking | `/inventory` | super_admin, admin, project_engineer, checker, warehouse_admin, office_admin |
| View Orders | `/orders` | super_admin, admin, project_engineer, checker, warehouse_admin, office_admin |
| Quotation Request | `/quotation-requests` | super_admin, admin, project_engineer, office_admin, checker |
| SKU Catalog | `/skus` | super_admin, admin, project_engineer, office_admin, warehouse_admin |
| Equipments & Tools | `/company-assets` | super_admin, admin, project_engineer, checker, office_admin |

- **Administration** (Admin only):

| Nav Item | Route |
|---|---|
| Users & Roles | `/users` |
| Settings | `/settings` |

- **Notifications** link with unread count badge
- **Footer:** User avatar initial, name, email, logout button
- **Super Admin only:** Reset Data button (with confirmation dialog requiring typing "RESET")

### Routes (`src/App.tsx`)
```
/login          → Login page
/               → Redirect to /dashboard
/dashboard      → Dashboard
/projects       → Projects list
/projects/:id   → Project detail
/inventory      → Order & Tracking (project selector → workflow board)
/orders         → View Orders (table + rejected orders)
/skus           → SKU Catalog
/users          → Users & Roles (tabs: Users, Notifications, SMS)
/notifications  → Notifications list
/settings       → Settings (SMS config)
/members        → Active Members
/company-assets → Equipments & Tools
/quotation-requests → Quotation Request
*               → 404 Not Found
```

---

## 4. Dashboard

**Route:** `/dashboard`  
**Component:** `src/pages/Dashboard.tsx`

### Stat Cards (top grid, 4 columns)
| Card | Value | Links To | Visibility |
|---|---|---|---|
| Active Projects | Count of `projects.status = 'active' AND is_hidden = false` | `/projects?status=active` | All |
| Active Orders | Count of orders in active statuses from active projects | `/orders?status=active` | All |
| Total SKUs | Count of `skus.is_active = true` | `/skus` | All |
| Active Members | Count of `profiles.is_active = true` | `/members` | Admin only |

### Orders by Status Chart
- Donut/Pie chart (Recharts `PieChart` with `innerRadius`)
- Color-coded by status:
  - Red: rejected, cancelled
  - Amber/Orange: for_approval, on_hold, partially_received
  - Blue: approved, submitted, preparing, ordered
  - Yellow: in_transit
  - Green: delivered, fully_received
  - Gray: closed, draft

### Recent Orders Table
- Last 5 orders: Order #, Project, Status (StatusBadge), Supplier, Amount (₱)

---

## 5. Projects

**Route:** `/projects`  
**Component:** `src/pages/Projects.tsx`

### Features
- Search by name/code/location
- Filter by status via `?status=` query param (synced with URL)
- Grid of `ProjectCard` components
- Admin-only: "Show Hidden" toggle, Create/Edit/Delete/Restore/Hide actions
- Project Engineer can create projects (via RPC `create_project_with_membership` – auto-becomes member)

### Project Form Modal (`ProjectFormModal`)
- Fields: Name, Description, Location, Start Date, End Date, Status
- Used for both create and edit

### ProjectCard (`src/components/projects/ProjectCard.tsx`)
- Shows: Name, Location, Status badge, Date range
- Clickable → navigates to `/projects/:id`
- Admin dropdown: Edit, Delete/Restore, Hide/Unhide

### Project Statuses
```typescript
type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled' | 'deleted';
```
- Non-super-admins cannot see `deleted` projects
- Hidden projects (`is_hidden = true`) invisible unless admin toggles

---

## 6. Project Detail

**Route:** `/projects/:id`  
**Component:** `src/pages/ProjectDetail.tsx`

### Header
- Back button → `/projects`
- Project switcher dropdown (all accessible projects)
- Status badge + Edit button (admin only)

### Project Info Cards (3-column grid)
- **Location** (MapPin icon)
- **Duration** (Calendar icon) – formatted date range
- **Status** (FileText icon) – StatusBadge

### Progress Section
- Clickable card showing project progress percentage
- Based on quotation materials received vs ordered
- Progress bar (`<Progress>`)
- Click opens `ProjectProgressModal` with detailed breakdown

### Action Buttons
| Button | Action | Visibility |
|---|---|---|
| Quotation | Opens `QuotationModal` | All with edit permission |
| Active Orders | Opens `ActiveOrdersModal` | All |
| Delivered Materials | Opens `DeliveredMaterialsModal` | All |
| Equipments & Tools | Opens borrow/return modal | super_admin, admin, office_admin, project_engineer |

### Tabs
- **Team** (`ProjectTeamTab`) – List members, add/remove (admin, PE, office_admin)
- **Activity** (`ProjectActivityTab`) – Audit log for the project

### Borrow/Return Equipment Modal
- **Borrow Request:** Select asset, enter quantity → submits `equipment_requests` with status `for_approval`
- **Borrowed Items:** Shows currently borrowed items with return request functionality
- Return requests also go through approval flow
- Confirmation dialogs for both borrow and return

### Modals
- `ProjectFormModal` – Edit project
- `QuotationModal` – Create/edit/view quotation materials
- `ActiveOrdersModal` – List of active orders for the project
- `DeliveredMaterialsModal` – Materials delivered to this project
- `ProjectProgressModal` – Detailed progress breakdown

---

## 7. Order & Tracking (Inventory)

**Route:** `/inventory`  
**Component:** `src/pages/Inventory.tsx`

### Flow
1. Shows grid of active (non-deleted, non-hidden) projects as cards
2. Search by name/code/location
3. Clicking a project opens `OrderWorkflowBoard`

### OrderWorkflowBoard (`src/components/orders/OrderWorkflowBoard.tsx`)

#### Workflow Lanes (Kanban-style board)
**Main Workflow (7 lanes):**
| Lane | DB Statuses | Color |
|---|---|---|
| Order Request | `draft`, `for_approval` | Amber |
| Approved | `approved` | Blue |
| Ordered | `submitted` | Blue |
| Preparing | `preparing` | Blue |
| On Transit | `in_transit` | Yellow |
| Delivered | `delivered` | Green |
| Completed | `fully_received`, `closed` | Green |

**Exception Lanes:**
| Lane | DB Statuses | Color |
|---|---|---|
| On-Hold | `on_hold` | Amber |

#### Order Cards (`OrderCard`)
- Displayed in each lane
- Shows: Order #, Supplier, Status, Date

#### Actions per Status
- **Order Request → Approved:** Admin/Approver can approve
- **Approved → Submitted/Ordered:** Status progression
- **Preparing → On Transit:** Assign driver + plate number
- **On Transit → Delivered:** Mark delivered
- **Delivered → Fully Received/Closed:** Mark received
- **Any → On Hold:** Put on hold with reason (not available to warehouse_admin)
- **On Hold → Resume:** Resume with remarks (not available to warehouse_admin)
- **For Approval → Rejected:** Reject with reason (moves to `rejected_orders` table via RPC)

#### Create Order Modal (`CreateOrderModal`)
- Add materials (from quotation or manual entry with auto-SKU creation)
- Set expected delivery date, notes, supplier name
- Creates order + order_items + optional new SKUs
- Logs activity and notifies project members

#### Order Detail Modal (`OrderDetailModal`)
- Full order details, status history, evidence uploads
- Role-based action buttons for status transitions

#### Tracking Assignment (`TrackingAssignmentSection`)
- Assign driver + plate number for transit
- Upload evidence photos (with compression via `imageCompressor.ts`)
- Receiver evidence upload
- Track delivery status: on_transit → arrived → delivered

#### Rejected Orders
- Displayed in a separate table within the workflow board
- Delete permanently via RPC `delete_rejected_order`
- Confirmation dialog required

---

## 8. View Orders

**Route:** `/orders`  
**Component:** `src/pages/Orders.tsx`

### Active Orders Table
**Columns:**
| Column | Content |
|---|---|
| Order # | `order_number` (font-medium) |
| Project | Project name |
| Supplier | `supplier_name` |
| Status | `StatusBadge` component |
| Created | Sortable date column |

**Features:**
- Search by order number, supplier, project name
- Status filter dropdown: All, Active, Order Request, Approved, Ordered, On Transit, Delivered
- URL sync via `?status=` query param
- Sortable by: created_at, expected_delivery_date, total_amount
- Row click opens `OrderDetailModal`

### Rejected Orders Section
**Minimal Table Columns (only 4):**
| Column | Content |
|---|---|
| Order # | `order_number` (font-mono) |
| Project | Project name |
| Rejected Date | Asia/Manila formatted |
| Action | Eye icon button |

**Rejected Order Detail Modal** (opens on action click):
- Order Number, Project Name
- Status badge (Rejected)
- Requested By, Rejected By
- Rejected Date/Time (Asia/Manila)
- Created Date/Time (Asia/Manila)
- Expected Delivery Date
- Rejection Reason (full text, not truncated)
- Notes (full text, not truncated)
- **Materials table:** Material name, Quantity, Unit
- **Admin action:** "Delete Permanently" button (Super Admin/Admin only)
  - Opens confirmation `AlertDialog`
  - Calls RPC `delete_rejected_order`

---

## 9. Quotation Request

**Route:** `/quotation-requests`  
**Component:** `src/pages/QuotationRequests.tsx`

### Two Tabs

#### Tab 1: Existing Quotations
- Search + project filter
- Card list showing: Project name, Creator, Date, Items count, Category (initial/additional)
- Click → View modal with full material list (initial + additional quotations)

#### Tab 2: For Approval
- Badge count of pending requests
- Cards showing pending change requests with:
  - Project name, Requester (name + role), Change type, Status, Date
  - Change summary (e.g., "Create with 5 material(s)")
- **Preview modal:** Shows proposed materials in table
- **Approve/Reject actions** (Admin + Office Admin only):
  - Approve executes the change (create/update/delete quotation + items)
  - Reject with optional remarks
  - Logs activity, notifies project members

### Quotation Change Types
- `create` – New quotation with materials
- `update` – Modify existing materials (add/update quantities)
- `delete` – Remove entire quotation

---

## 10. SKU Catalog

**Route:** `/skus`  
**Component:** `src/pages/SKUs.tsx`

### Features
- CRUD for construction materials SKU catalog
- Search by name/code/brand/category
- Status filter: All, Active, Inactive
- Sortable columns: Name, Created date

### SKU Table Columns
- SKU Code, Name, Unit, Brand, Category, Status (Active/Inactive)

### SKU Form (Add/Edit/View modes)
- **Fields:** Name*, SKU Code (auto-generated), Unit of Measure*, Brand, Category, Description, Min Threshold, Active toggle
- **Duplicate check:** Same name + unit combination for active SKUs

### Permissions
- Admin can: Add, Edit, Delete
- Delete guarded: Cannot delete if referenced in `order_items`
- Project Engineer + Office Admin can insert SKUs (for order creation)

### Unit Options
```
EA, PC, SET, BOX, PACK, ROLL, LTR, KG, BAG, BUNDLE, METER, SQ.M, CU.M,
GAL, DRUM, PAIL, SHEET, LENGTH, TON, PAIR, BTL, SACK, REAM, TIN, TUBE, CAN
```

---

## 11. Equipments & Tools

**Route:** `/company-assets`  
**Component:** `src/pages/CompanyAssets.tsx`

### Access
- super_admin, admin, office_admin, project_engineer, checker

### Top-Level Tabs
1. **Assets** – Main asset cards
2. **History** – Equipment history per project (`EquipmentHistoryTab`)
3. **Borrow Requests** – Pending borrow approvals (`BorrowRequestsTab`)
4. **Return Requests** – Pending return approvals (`ReturnRequestsTab`)

### Assets Tab
- Card grid showing each asset with:
  - Asset name, type (Material/Tool/Equipment), code
  - Total quantity, Available quantity, Borrowed quantity
  - Condition badge (Available/Maintenance/Retired)
  - Unit label
- Search by name/type/code
- Admin actions: Add, Edit, Delete

### Asset Detail Modal (Admin/Super Admin only)
- Click card → shows asset details + request history
- Table of all equipment requests (borrow/return) for that asset
- Approve/Reject pending requests directly

### Asset Form
- **Fields:** Asset Name*, Type (Material/Tool/Equipment), Code, Unit, Total Quantity, Condition, Notes
- Delete guarded: Cannot delete if items currently borrowed

### Borrow Request Flow
1. User submits borrow request from Project Detail page
2. Request appears in "Borrow Requests" tab with status `for_approval`
3. Admin approves → creates `borrow_transactions` record
4. Admin rejects → records rejection reason

### Return Request Flow
1. User submits return request from Project Detail page (quantity + remarks)
2. Request appears in "Return Requests" tab
3. Admin approves → updates `borrow_transactions` (returned_qty, status)
4. Status transitions: Borrowed → Partially Returned → Returned

---

## 12. Users & Roles

**Route:** `/users`  
**Component:** `src/pages/Users.tsx`  
**Access:** Admin and Super Admin only

### Three Tabs

#### Tab 1: Users & Roles

**Users Table – Minimal Columns Only:**
| Column | Content |
|---|---|
| Name | Avatar initial + Full Name |
| Role(s) | Badge list of assigned roles |
| Status | Active/Inactive pill |
| Action | Three-dot menu (⋮) → "View Details" |

- Search by name or email
- No inline edit/delete actions in table

**User Detail Modal** (opens via action menu):

*Read-Only Fields:*
| Field | Source |
|---|---|
| Full Name | `profiles.full_name` |
| Email | `profiles.email` |
| Role(s) | Badges with click-to-remove (admin only) |
| Status | Active/Inactive |
| Date Created | `profiles.created_at` (Asia/Manila) |
| Created By | Creator's full_name from profiles |
| Updated At | `profiles.updated_at` (Asia/Manila) |

*NOT Displayed:* Username, Address (system-wide removal)

*Admin Actions (inside modal):*
| Action | Button | Permission |
|---|---|---|
| Update User | Outline button with Pencil icon | Admin, Super Admin |
| Update Roles | Outline button with UserPlus icon | Admin, Super Admin |
| Delete User | Destructive button with Trash icon | Super Admin only (cannot delete self) |

**Add User Dialog:**
- Fields: Name*, Role* (dropdown), Email* (with duplicate check), Password* (min 6 chars)
- Driver role auto-fills email/password defaults
- Super Admin role assignment restricted to Super Admins
- Creates user via Edge Function `admin-create-user`

**Edit User Dialog:**
- Fields: Full Name (editable), Email (read-only/disabled), Active toggle
- Updates `profiles` table

**Assign Role Dialog:**
- Role dropdown (filtered by permission level)
- Inserts into `user_roles`
- Duplicate role check (DB unique constraint)

**Remove Role:**
- Click role badge in detail modal (with × indicator)
- Guards: Cannot remove own Super Admin role; only Super Admin can remove Super Admin from others

**Delete User:**
- Confirmation `AlertDialog` with warning
- Calls Edge Function `admin-delete-user`
- Permanently removes auth record + profile + roles + memberships

#### Tab 2: Notifications (Email)
- `EmailNotificationsTab` component
- Configure SMTP settings (Gmail)
- Per-user email opt-in toggle
- Test email sending modal

#### Tab 3: SMS Notifications (Super Admin only)
- `SMSNotificationsTab` component
- SMS notification settings and logs

---

## 13. Active Members

**Route:** `/members`  
**Component:** `src/pages/Members.tsx`  
**Access:** Admin only

### Table Columns
| Column | Content |
|---|---|
| Member Name | Avatar + Name + Email subtitle |
| Role | Role badges |
| Assigned Project(s) | Project name badges (max 3 shown + overflow) |
| Status | Active/Inactive badge |

- Search by name, email, role, or project name
- Read-only view (no actions)

---

## 14. Notifications

**Route:** `/notifications`  
**Component:** `src/pages/Notifications.tsx`

### Features
- List of notification cards with type-specific icons
- Unread notifications highlighted with accent border
- "Mark all as read" button
- Click notification → marks as read + navigates based on reference:
  - `order` → `/orders`
  - `project` → `/projects/:id`
- Notification types: order, inventory, low_stock, team, project

### Notification System
- In-app notifications via `notifications` table
- Real-time via `useNotifications` hook (TanStack Query)
- Activity logging via `src/lib/activityLogger.ts`
- Multi-channel: In-app + Email + SMS
- `notifyProjectMembers()` utility sends to all members of a project

---

## 15. Settings

**Route:** `/settings`  
**Component:** `src/pages/Settings.tsx`  
**Access:** Admin only

### SMS Notifications Tab
- Enable/disable SMS toggle
- Twilio configuration: Account SID, Auth Token, Sender Number
- **Event Rules:** Per-event role checkboxes determining who receives SMS for:
  - Order status changes
  - Low stock alerts
  - Delivery received
- Save to `sms_settings` table

---

## 16. Edge Functions

### `admin-create-user`
- Creates Supabase Auth user + profile + user_role
- Input: `{ name, email, password, role }`
- Validates: required fields, role permissions, password length, email uniqueness
- Returns 200 with `{ error }` for business validation errors

### `admin-delete-user`
- Permanently deletes user from Auth + cascading cleanup
- Input: `{ user_id }`
- Super Admin only

### `reset-data`
- Deletes ALL application data except users and roles
- Super Admin only, requires typing "RESET" confirmation

### `send-email-notification`
- Sends email via configured SMTP/provider
- Logs to `email_logs` table

### `send-sms-notification` / `send-sms`
- Sends SMS via Twilio
- Logs to `sms_logs` table

### `send-test-notification`
- Test endpoint for notification delivery verification

---

## 17. Database Schema Summary

### Core Tables

| Table | Purpose |
|---|---|
| `profiles` | User profiles (name, email, phone, status, preferences) |
| `user_roles` | Role assignments (user_id → role) |
| `projects` | Project records (name, location, dates, status, visibility) |
| `project_members` | Project membership (user_id + project_id + role) |
| `project_quotations` | Quotation headers (project_id, category: initial/additional) |
| `quotation_items` | Quotation line items (material_name, unit, quantity) |
| `quotation_change_requests` | Quotation approval workflow (change_type, status, payload) |
| `skus` | Material/SKU catalog (code, name, unit, brand, category) |
| `orders` | Purchase orders (project, supplier, status, amounts) |
| `order_items` | Order line items (sku_id, quantity_ordered, quantity_received) |
| `rejected_orders` | Archived rejected orders (mirrors orders structure) |
| `rejected_order_items` | Archived rejected order items |
| `deliveries` | Delivery records (order_id, dates, carrier) |
| `delivery_items` | Delivery line items (quantity_received, condition) |
| `order_tracking_assignments` | Driver/tracking assignments (driver, plate, status, timestamps) |
| `order_tracking_evidence` | Evidence uploads for tracking |
| `tracking_driver_materials` | Materials assigned per driver trip |
| `receiver_evidence` | Receiver-uploaded evidence |
| `order_evidence` | Order status evidence photos |
| `project_inventory` | Per-project inventory levels (on_hand, reserved, threshold) |
| `inventory_transactions` | Stock movement audit trail |
| `company_assets` | Company equipment/tools catalog |
| `borrow_transactions` | Equipment borrow/return tracking |
| `equipment_requests` | Borrow/return approval workflow |
| `notifications` | In-app notification records |
| `notification_settings` | Email/SMTP configuration |
| `email_logs` | Email delivery logs |
| `sms_settings` | Twilio SMS configuration |
| `sms_logs` | SMS delivery logs |
| `audit_logs` | System audit trail |

### Order Status Flow
```
draft → for_approval → approved → submitted → preparing → in_transit → delivered → fully_received → closed
                     ↘ rejected (moved to rejected_orders table)
                     ↗ on_hold (from any active status, with reason)
```

### Order Status Enum
```typescript
type OrderStatus = 
  'draft' | 'for_approval' | 'approved' | 'submitted' | 'preparing' |
  'ordered' | 'in_transit' | 'delivered' | 'partially_received' |
  'fully_received' | 'closed' | 'cancelled' | 'rejected' | 'on_hold';
```

### Simplified UI Status Mapping
| UI Label | DB Statuses |
|---|---|
| Order Request | draft, for_approval |
| Approved | approved |
| Ordered | submitted, ordered |
| Preparing | preparing |
| On Transit | in_transit |
| Delivered | delivered, partially_received, fully_received, closed |
| Rejected | rejected |
| On-Hold | on_hold |

---

## 18. UI/UX Standards

### Table Design Pattern
- **Minimalist tables:** Show only essential columns (name, status, key identifiers)
- **Detail modals:** All metadata and actions moved to popup modals accessible via row-level action button (⋮ or Eye icon)
- **No page navigation** for viewing details – always overlay modals
- Mobile-responsive with `overflow-x-auto`

### Common Components
| Component | Path | Purpose |
|---|---|---|
| `PageHeader` | `src/components/common/PageHeader.tsx` | Page title + description + optional action button |
| `DataTable` | `src/components/common/DataTable.tsx` | Reusable table with columns config, loading, empty state |
| `EmptyState` | `src/components/common/EmptyState.tsx` | Icon + title + description for empty data |
| `StatusBadge` | `src/components/common/StatusBadge.tsx` | Color-coded status pill/badge |
| `StatCard` | `src/components/dashboard/StatCard.tsx` | Dashboard stat card with icon, value, optional link |

### Design Tokens
- All colors via CSS custom properties (HSL) in `src/index.css`
- Tailwind semantic classes: `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, etc.
- No hardcoded colors in components

### Date/Time Formatting
- All timestamps displayed in **Asia/Manila** timezone
- Format: `MMM dd, yyyy hh:mm a` (e.g., "Jan 15, 2026 02:30 PM")
- Uses `date-fns` + `date-fns-tz` (`toZonedTime`)

### Confirmation Patterns
- Destructive actions (delete, reset) require `AlertDialog` confirmation
- Some critical actions require typing confirmation text (e.g., "RESET")

### Toast Notifications
- Success: green toast
- Error: destructive variant (red)
- Via `useToast()` hook from shadcn/ui

---

## 19. System-Wide Rules

### ❌ Username & Address – REMOVED
- **Username** is NOT required and must NOT be shown anywhere
- **Address** is NOT required and must NOT be shown anywhere
- Do not include username/address in any table, form, modal, or validation

### Activity Logging
- All significant actions logged via `logActivity()` from `src/lib/activityLogger.ts`
- Writes to `audit_logs` table with: action, table_name, record_id, old/new values, user_id

### Notification Service
- `src/lib/notificationService.ts` provides:
  - `notifyProjectMembers()` – Notify all members of a project
  - `formatManilaTime()` – Format dates to Asia/Manila timezone

### Image Compression
- `src/lib/imageCompressor.ts` – Compresses uploaded evidence images before storage
- Tracks original and compressed sizes

### RLS (Row Level Security)
- All tables have RLS policies enforcing:
  - Admin full access where applicable
  - Project-scoped access via `has_project_access()` function
  - User-scoped access for personal data (notifications, profiles)

### Supabase RPC Functions
| Function | Purpose |
|---|---|
| `create_project_with_membership` | Creates project + auto-adds creator as member |
| `reject_order` | Moves order to rejected_orders table |
| `delete_rejected_order` | Permanently deletes rejected order + items |
| `has_project_access` | Checks if user has access to a project |
| `has_role` | Checks if user has a specific role |
| `is_admin` / `is_super_admin` | Admin role checks |
| `is_office_admin` / `is_warehouse_admin` | Specific role checks |
| `can_approve_orders` / `can_create_orders` | Permission checks |
| `get_project_role` | Gets user's role in a specific project |
| `add_project_member` | Adds member to project with role |

---

*End of Master Prompt*
