// /api/dashboard — ported from DashboardController.cs + DashboardService.cs
import { Hono } from 'hono';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  borrowTransactions,
  companyAssets,
  orders,
  profiles,
  projects,
  quotationChangeRequests,
  skus,
} from '../db/schema.js';
import { authMiddleware, isSuperAdmin, type AuthVars } from '../lib/auth.js';
import { ok } from '../lib/response.js';

export const dashboardRoutes = new Hono<{ Variables: AuthVars }>();
dashboardRoutes.use('*', authMiddleware);

dashboardRoutes.get('/stats', async (c) => {
  const auth = c.get('auth');
  const scoped = !isSuperAdmin(auth) && !!auth.companyId;
  const companyId = auth.companyId!;

  const orderCompanyFilter = scoped
    ? sql`exists (select 1 from ${projects} p where p.id = ${orders.projectId} and p.company_id = ${companyId})`
    : undefined;

  const [activeProjects] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(projects)
    .where(
      and(
        eq(projects.status, 'active'),
        eq(projects.isHidden, false),
        scoped ? eq(projects.companyId, companyId) : undefined,
      ),
    );

  const [pendingOrders] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(
        or(eq(orders.status, 'for_approval'), eq(orders.status, 'draft')),
        orderCompanyFilter,
      ),
    );

  const [totalUsers] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(profiles)
    .where(
      and(
        eq(profiles.isActive, true),
        scoped ? eq(profiles.companyId, companyId) : undefined,
      ),
    );

  const ordersByStatus = await db
    .select({ status: orders.status, count: sql<number>`count(*)::int` })
    .from(orders)
    .where(orderCompanyFilter)
    .groupBy(orders.status);

  const recentOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      supplierName: orders.supplierName,
      createdAt: orders.createdAt,
      projectName: projects.name,
    })
    .from(orders)
    .leftJoin(projects, eq(projects.id, orders.projectId))
    .where(orderCompanyFilter)
    .orderBy(desc(orders.createdAt))
    .limit(10);

  const [stockItems] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(skus)
    .where(scoped ? eq(skus.companyId, companyId) : undefined);

  const [totalAssets] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(companyAssets)
    .where(scoped ? eq(companyAssets.companyId, companyId) : undefined);

  const [pendingQuotationRequests] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(quotationChangeRequests)
    .where(eq(quotationChangeRequests.status, 'pending'));

  const [pendingBorrowReturnRequests] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(borrowTransactions)
    .where(
      inArray(borrowTransactions.status, ['Borrowed', 'Partially Returned']),
    );

  return ok(c, {
    activeProjects: activeProjects.n,
    pendingOrders: pendingOrders.n,
    stockItems: stockItems.n,
    totalUsers: totalUsers.n,
    totalAssets: totalAssets.n,
    pendingQuotationRequests: pendingQuotationRequests.n,
    pendingBorrowReturnRequests: pendingBorrowReturnRequests.n,
    ordersByStatus: ordersByStatus.map((r) => ({
      status: r.status,
      count: r.count,
    })),
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      projectName: o.projectName ?? undefined,
      supplierName: o.supplierName ?? undefined,
      createdAt: o.createdAt.toISOString(),
    })),
  });
});
