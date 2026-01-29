

## Dashboard, Orders, and Workflow Enhancements

This plan implements clickable dashboard cards with pre-applied filters, a new Active Members feature, globally consistent order status color coding, and an expanded order workflow process.

---

### Step 1: Clickable Dashboard Summary Cards

**1.1 Update StatCard Component**
- Add optional `onClick` and `href` props to `StatCard` component
- Wrap the card content in a clickable element when `onClick` is provided
- Add cursor-pointer styling and subtle hover effect

**1.2 Active Projects Card (Navigate with Filter)**
- Make the "Active Projects" card clickable
- On click, navigate to `/projects?status=active`
- Update the Projects page to read `status` from URL search params
- Auto-apply the filter from URL on page load

**1.3 Open Orders Card (Navigate with Filter)**
- Make the "Open Orders" card clickable (renamed to "Active Orders")
- On click, navigate to `/orders?status=active`
- Update the Orders page to read filters from URL search params
- Note: Current "Open Orders" counts multiple active statuses; this will navigate with a combined active filter

---

### Step 2: New Active Members Dashboard Card

**2.1 Create Members Page**
Create a new page at `/members` displaying:
| Column | Description |
|--------|-------------|
| Member Name | User's full name from profile |
| Role | User's assigned role(s) from user_roles table |
| Assigned Project(s) | Projects the user is a member of via project_members |
| Status | Active/Inactive from profiles.is_active |

**2.2 Dashboard Integration**
- Add new "Active Members" stat card showing total active members count
- Use `Users` icon from lucide-react
- Make the card clickable to navigate to `/members`

**2.3 RBAC Enforcement**
- Only show the card if user has permission to view project members
- Members page checks `isAdmin()` permission before displaying
- Non-admin users see "Access Denied" empty state

**2.4 Data Query**
Count active members by querying profiles where:
- `is_active = true`
- Has at least one project membership OR has a user role

---

### Step 3: Order Status Color Coding (Global)

**3.1 Update StatusBadge Component**
Apply exact color mapping across all locations:

| Status | Color | CSS Variable |
|--------|-------|--------------|
| Rejected | Red | `bg-destructive/10 text-destructive` |
| For Approval | Orange/Amber | `bg-warning/10 text-warning` |
| Approved | Blue | `bg-blue-500/10 text-blue-600` |
| Ordered | Blue (darker shade) | `bg-blue-600/10 text-blue-700` |
| On Transit (in_transit) | Yellow | `bg-amber-400/10 text-amber-600` |
| Delivered/Received | Green | `bg-success/10 text-success` |
| On-hold | Yellow/Amber | `bg-amber-500/10 text-amber-600` |

**3.2 Add CSS Variables for Blue Shades**
Add blue color variables to index.css to support the new color scheme:
- `--blue-light: 210 90% 50%` for Approved
- `--blue-dark: 220 75% 45%` for Ordered

**3.3 Update All Locations**
Ensure consistent styling in:
- Dashboard Recent Orders table
- Orders page table
- Order Workflow Board lanes
- Project Detail order views
- Order Detail modal

---

### Step 4: Order Workflow Process Update

**4.1 Database Migration - New Order Statuses**
Add new statuses to the `order_status` enum:
- `submitted` (Order Submitted - after approval)
- `preparing` (Preparing for Tracking)
- `on_hold` (On-hold status)

Updated workflow sequence:
```text
for_approval → approved → submitted → preparing → in_transit → delivered
                    ↘ rejected
         (any status) → on_hold
```

**4.2 Update TypeScript Types**
Update `src/types/database.ts` OrderStatus type to include:
- `submitted`
- `preparing`
- `on_hold`

**4.3 Update StatusBadge Labels**
New label mapping:
| Database Status | Display Label |
|-----------------|---------------|
| `for_approval` | Order Requested |
| `approved` | Order Approved |
| `submitted` | Order Submitted |
| `preparing` | Preparing for Tracking |
| `in_transit` | On Transit |
| `delivered` | Delivered |
| `rejected` | Rejected |
| `on_hold` | On-hold |

**4.4 Update Workflow Board Lanes**
Expand the workflow board to show 6 main lanes:
1. Order Requested (for_approval)
2. Order Approved (approved)
3. Order Submitted (submitted)
4. Preparing for Tracking (preparing)
5. On Transit (in_transit)
6. Delivered (delivered)

Add a separate section/indicator for:
- Rejected
- On-hold

**4.5 Update Status Transition Rules**
Update `validTransitions` in OrderWorkflowBoard.tsx:
```text
for_approval → approved, rejected, on_hold
approved → submitted, rejected, on_hold
submitted → preparing, on_hold
preparing → in_transit, on_hold
in_transit → delivered, on_hold
delivered → closed
rejected → (no transitions)
on_hold → (return to previous status - admin only)
```

**4.6 Update Orders Page Filter Options**
Add new statuses to filter dropdown:
- Order Requested
- Approved
- Submitted
- Preparing for Tracking
- On Transit
- Delivered
- Rejected
- On-hold

**4.7 Update Dashboard Open Orders Count**
Include new active statuses in the count:
- `for_approval`, `approved`, `submitted`, `preparing`, `in_transit`, `on_hold`

---

### Technical Summary

**Files to Create:**
1. `src/pages/Members.tsx` - New members list page

**Files to Modify:**
1. `src/components/dashboard/StatCard.tsx` - Add onClick prop
2. `src/pages/Dashboard.tsx` - Clickable cards, new members card, updated counts
3. `src/pages/Projects.tsx` - Read URL params for status filter
4. `src/pages/Orders.tsx` - Read URL params for status filter, new statuses
5. `src/components/common/StatusBadge.tsx` - New colors and labels
6. `src/components/orders/OrderWorkflowBoard.tsx` - New lanes and transitions
7. `src/types/database.ts` - New status types
8. `src/index.css` - Blue color variables
9. `src/App.tsx` - Add /members route

**Database Migration:**
- Add `submitted`, `preparing`, `on_hold` to `order_status` enum

---

### Implementation Order
1. Database migration for new statuses
2. Update TypeScript types
3. Update StatusBadge with new colors and labels
4. Make StatCard clickable
5. Update Dashboard with clickable cards
6. Add URL parameter handling to Projects and Orders pages
7. Create Members page
8. Update OrderWorkflowBoard with new lanes and transitions

