// /api/truncate — ported from TruncateController.cs (super_admin only).
// Deletes are ordered to satisfy the restrict FKs (delivery_items / tracking_materials → order_items, *_ → skus).
import { Hono } from 'hono';
import { isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  auditLogs,
  borrowTransactions,
  companyAssets,
  deliveries,
  deliveryItems,
  inventoryTransactions,
  notifications,
  orderItems,
  orderTrackingAssignments,
  orderTrackingMaterials,
  orders,
  projectInventory,
  projectMembers,
  projectQuotations,
  projects,
  quotationChangeRequests,
  quotationItems,
  skus,
} from '../db/schema.js';
import { authMiddleware, type AuthVars } from '../lib/auth.js';
import { requireSuperAdmin } from '../lib/policies.js';
import { ok } from '../lib/response.js';

export const truncateRoutes = new Hono<{ Variables: AuthVars }>();
truncateRoutes.use('*', authMiddleware, requireSuperAdmin);

const wipeOrders = async () => {
  await db.delete(orderTrackingMaterials);
  await db.delete(orderTrackingAssignments);
  await db.delete(deliveryItems);
  await db.delete(deliveries);
  await db.delete(orderItems);
  await db.delete(orders);
};

const wipeInventory = async () => {
  await db.delete(inventoryTransactions);
  await db.delete(projectInventory);
};

const wipeQuotations = async () => {
  await db.delete(quotationChangeRequests);
  await db.delete(quotationItems);
  await db.delete(projectQuotations);
};

truncateRoutes.delete('/projects', async (c) => {
  await wipeOrders();
  await wipeInventory();
  await wipeQuotations();
  await db
    .update(borrowTransactions)
    .set({ projectId: null })
    .where(isNotNull(borrowTransactions.projectId));
  await db.delete(projectMembers);
  await db.delete(projects);
  await db.delete(auditLogs);
  await db.delete(notifications);
  return ok(c, null, 'All projects and related data deleted.');
});

truncateRoutes.delete('/orders', async (c) => {
  await wipeOrders();
  await wipeInventory();
  return ok(c, null, 'All orders and related data deleted.');
});

truncateRoutes.delete('/skus', async (c) => {
  await wipeOrders();
  await wipeInventory();
  await db.delete(skus);
  return ok(c, null, 'All SKUs and related data deleted.');
});

truncateRoutes.delete('/equipment', async (c) => {
  await db.delete(borrowTransactions);
  await db.delete(companyAssets);
  return ok(c, null, 'All equipment and borrow records deleted.');
});

truncateRoutes.delete('/quotations', async (c) => {
  await wipeQuotations();
  return ok(c, null, 'All quotations and change requests deleted.');
});

truncateRoutes.delete('/inventory', async (c) => {
  await wipeInventory();
  return ok(c, null, 'All inventory data deleted.');
});

truncateRoutes.delete('/notifications', async (c) => {
  await db.delete(notifications);
  return ok(c, null, 'All notifications deleted.');
});
