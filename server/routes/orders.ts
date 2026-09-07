// /api/orders — ported from OrdersController.cs + OrderService.cs
import { Hono } from 'hono';
import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { orderItems, orders, profiles, projects, skus } from '../db/schema.js';
import { authMiddleware, isSuperAdmin, type AuthVars } from '../lib/auth.js';
import { requireApprover } from '../lib/policies.js';
import { body, isUuid, toDate } from '../lib/http.js';
import { created, fail, ok } from '../lib/response.js';
import { num, numOrNull } from '../lib/num.js';

type Order = typeof orders.$inferSelect;
type OrderItem = typeof orderItems.$inferSelect;

interface CreateItem {
  skuId?: string;
  materialName?: string;
  unit?: string;
  quotationItemId?: string;
  quantityOrdered: number;
  unitPrice?: number;
  notes?: string;
}

async function mapOrders(rows: Order[]) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const items = await db
    .select({
      item: orderItems,
      skuCode: skus.skuCode,
      skuName: skus.name,
      unit: skus.unitOfMeasure,
    })
    .from(orderItems)
    .leftJoin(skus, eq(skus.id, orderItems.skuId))
    .where(inArray(orderItems.orderId, ids));

  const actorIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.createdBy, r.approvedBy, r.rejectedBy])
        .filter((x): x is string => !!x),
    ),
  ];
  const actorNames = new Map<string, string | null>();
  if (actorIds.length) {
    const a = await db
      .select({ id: profiles.id, name: profiles.fullName })
      .from(profiles)
      .where(inArray(profiles.id, actorIds));
    for (const x of a) actorNames.set(x.id, x.name);
  }
  const projIds = [...new Set(rows.map((r) => r.projectId))];
  const projNames = new Map<string, string>();
  if (projIds.length) {
    const p = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(inArray(projects.id, projIds));
    for (const x of p) projNames.set(x.id, x.name);
  }

  const itemsByOrder = new Map<
    string,
    { item: OrderItem; skuCode: string | null; skuName: string | null; unit: string | null }[]
  >();
  for (const row of items) {
    const arr = itemsByOrder.get(row.item.orderId) ?? [];
    arr.push(row);
    itemsByOrder.set(row.item.orderId, arr);
  }

  return rows.map((o) => ({
    id: o.id,
    projectId: o.projectId,
    projectName: projNames.get(o.projectId),
    orderNumber: o.orderNumber,
    orderType: o.orderType ?? undefined,
    status: o.status,
    supplierName: o.supplierName ?? undefined,
    supplierContact: o.supplierContact ?? undefined,
    expectedDeliveryDate: o.expectedDeliveryDate?.toISOString() ?? undefined,
    notes: o.notes ?? undefined,
    totalAmount: numOrNull(o.totalAmount) ?? undefined,
    approvedBy: o.approvedBy ?? undefined,
    approvedByName:
      o.approvedByName ??
      (o.approvedBy ? (actorNames.get(o.approvedBy) ?? undefined) : undefined),
    approvedAt: o.approvedAt?.toISOString() ?? undefined,
    rejectedBy: o.rejectedBy ?? undefined,
    rejectedByName: o.rejectedBy
      ? (actorNames.get(o.rejectedBy) ?? undefined)
      : undefined,
    rejectedAt: o.rejectedAt?.toISOString() ?? undefined,
    rejectionReason: o.rejectionReason ?? undefined,
    createdBy: o.createdBy ?? undefined,
    createdByName: o.createdBy
      ? (actorNames.get(o.createdBy) ?? undefined)
      : undefined,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    onTransitAt: o.onTransitAt?.toISOString() ?? undefined,
    deliveredAt: o.deliveredAt?.toISOString() ?? undefined,
    items: (itemsByOrder.get(o.id) ?? []).map((r) => ({
      id: r.item.id,
      orderId: r.item.orderId,
      skuId: r.item.skuId,
      skuCode: r.skuCode ?? undefined,
      skuName: r.skuName ?? undefined,
      unit: r.unit ?? undefined,
      quotationItemId: r.item.quotationItemId ?? undefined,
      quantityOrdered: num(r.item.quantityOrdered),
      quantityReceived: num(r.item.quantityReceived),
      unitPrice: numOrNull(r.item.unitPrice) ?? undefined,
      notes: r.item.notes ?? undefined,
      createdAt: r.item.createdAt.toISOString(),
    })),
  }));
}

async function getOrder(id: string) {
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  return row ? (await mapOrders([row]))[0] : null;
}

async function listOrders(
  auth: { companyId: string | null; roles: string[] },
  opts: { status?: string; projectId?: string; search?: string },
) {
  const conds: SQL[] = [];
  if (!isSuperAdmin(auth as never) && auth.companyId) {
    conds.push(
      sql`exists (select 1 from ${projects} p where p.id = ${orders.projectId} and p.company_id = ${auth.companyId})`,
    );
  }
  if (opts.status) {
    const statuses = opts.status.split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length) conds.push(inArray(orders.status, statuses));
  }
  if (opts.projectId) conds.push(eq(orders.projectId, opts.projectId));
  if (opts.search)
    conds.push(
      sql`(${orders.orderNumber} ilike ${'%' + opts.search + '%'} or ${orders.supplierName} ilike ${'%' + opts.search + '%'})`,
    );

  const rows = await db
    .select()
    .from(orders)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(orders.createdAt));
  return mapOrders(rows);
}

async function resolveSkuId(
  item: CreateItem,
  createdBy: string,
): Promise<string | { error: string }> {
  if (isUuid(item.skuId)) return item.skuId;
  if (item.materialName && item.materialName.trim()) {
    const name = item.materialName.trim();
    const [existing] = await db
      .select({ id: skus.id })
      .from(skus)
      .where(sql`lower(${skus.name}) = lower(${name})`)
      .limit(1);
    if (existing) return existing.id;

    let base = name
      .toUpperCase()
      .replace(/[ /\\]/g, '-')
      .replace(/[^A-Z0-9-]/g, '');
    if (base.length > 30) base = base.slice(0, 30);
    if (!base) base = 'MAT';
    const [codeClash] = await db
      .select({ id: skus.id })
      .from(skus)
      .where(eq(skus.skuCode, base));
    const code = codeClash
      ? `${base}-${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`
      : base;

    const [ins] = await db
      .insert(skus)
      .values({
        name,
        skuCode: code,
        unitOfMeasure: item.unit,
        isActive: true,
        createdBy,
      })
      .returning({ id: skus.id });
    return ins.id;
  }
  return { error: 'Each order item must have a SkuId or a MaterialName.' };
}

export const orderRoutes = new Hono<{ Variables: AuthVars }>();
orderRoutes.use('*', authMiddleware);

orderRoutes.get('/', async (c) => {
  const q = c.req.query();
  return ok(
    c,
    await listOrders(c.get('auth'), {
      status: q.status,
      projectId: q.projectId,
      search: q.search,
    }),
  );
});

orderRoutes.get('/project/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  if (!isUuid(projectId)) return ok(c, []);
  return ok(
    c,
    await listOrders(c.get('auth'), {
      projectId,
      status: c.req.query('status'),
    }),
  );
});

orderRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Order not found.', 404);
  const order = await getOrder(id);
  if (!order) return fail(c, 'Order not found.', 404);
  return ok(c, order);
});

orderRoutes.post('/', async (c) => {
  const auth = c.get('auth');
  const b = await body<{
    projectId: string;
    orderType?: string;
    supplierName?: string;
    supplierContact?: string;
    expectedDeliveryDate?: string;
    notes?: string;
    items: CreateItem[];
  }>(c);
  if (!isUuid(b.projectId)) return fail(c, 'projectId is required.');
  if (!b.items || b.items.length === 0)
    return fail(c, 'Order must have at least one item.');

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders);
  const d = new Date();
  const orderNumber = `ORD-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

  const resolved: {
    skuId: string;
    quotationItemId: string | null;
    quantityOrdered: number;
    unitPrice: number | null;
    notes: string | null;
  }[] = [];
  for (const it of b.items) {
    const r = await resolveSkuId(it, auth.userId);
    if (typeof r !== 'string') return fail(c, r.error);
    resolved.push({
      skuId: r,
      quotationItemId: isUuid(it.quotationItemId) ? it.quotationItemId : null,
      quantityOrdered: Number(it.quantityOrdered) || 0,
      unitPrice: it.unitPrice != null ? Number(it.unitPrice) : null,
      notes: it.notes ?? null,
    });
  }

  const totalAmount = resolved.reduce(
    (s, i) => s + (i.unitPrice != null ? i.quantityOrdered * i.unitPrice : 0),
    0,
  );

  const [order] = await db
    .insert(orders)
    .values({
      projectId: b.projectId,
      orderNumber,
      orderType: b.orderType,
      status: 'draft',
      supplierName: b.supplierName,
      supplierContact: b.supplierContact,
      expectedDeliveryDate: toDate(b.expectedDeliveryDate),
      notes: b.notes,
      totalAmount: String(totalAmount),
      createdBy: auth.userId,
    })
    .returning();

  await db.insert(orderItems).values(
    resolved.map((r) => ({
      orderId: order.id,
      skuId: r.skuId,
      quotationItemId: r.quotationItemId,
      quantityOrdered: String(r.quantityOrdered),
      unitPrice: r.unitPrice != null ? String(r.unitPrice) : null,
      notes: r.notes,
    })),
  );

  return created(c, await getOrder(order.id));
});

orderRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Order not found.', 404);
  const b = await body<{
    supplierName?: string;
    supplierContact?: string;
    expectedDeliveryDate?: string;
    notes?: string;
    status?: string;
  }>(c);
  const patch: Partial<Order> = { updatedAt: new Date() };
  if (b.supplierName != null) patch.supplierName = b.supplierName;
  if (b.supplierContact != null) patch.supplierContact = b.supplierContact;
  if (b.expectedDeliveryDate != null)
    patch.expectedDeliveryDate = toDate(b.expectedDeliveryDate) ?? null;
  if (b.notes != null) patch.notes = b.notes;
  if (b.status != null) patch.status = b.status;

  const [row] = await db
    .update(orders)
    .set(patch)
    .where(eq(orders.id, id))
    .returning();
  if (!row) return fail(c, 'Order not found.', 404);
  return ok(c, await getOrder(id));
});

orderRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Order not found.', 404);
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  if (!row) return fail(c, 'Order not found.', 404);
  if (row.status === 'draft') {
    await db.delete(orders).where(eq(orders.id, id));
  } else {
    await db
      .update(orders)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(orders.id, id));
  }
  return ok(c, null, 'Order deleted.');
});

orderRoutes.post('/:id/submit', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Order not found.', 404);
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  if (!row || row.status !== 'draft') return fail(c, 'Order not found.', 404);
  await db
    .update(orders)
    .set({ status: 'for_approval', updatedAt: new Date() })
    .where(eq(orders.id, id));
  return ok(c, await getOrder(id));
});

orderRoutes.post('/:id/approve', requireApprover, async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Order not found.', 404);
  const auth = c.get('auth');
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  if (!row) return fail(c, 'Order not found.', 404);
  const [approver] = await db
    .select({ fullName: profiles.fullName, email: profiles.email })
    .from(profiles)
    .where(eq(profiles.id, auth.userId));
  const { notes } = await body<{ notes?: string }>(c);
  await db
    .update(orders)
    .set({
      status: 'approved',
      approvedBy: auth.userId,
      approvedAt: new Date(),
      approvedByName: approver?.fullName ?? approver?.email ?? null,
      notes: notes != null ? `${row.notes ?? ''}\n[Approved] ${notes}` : row.notes,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id));
  return ok(c, await getOrder(id));
});

orderRoutes.post('/:id/reject', requireApprover, async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Order not found.', 404);
  const auth = c.get('auth');
  const { reason } = await body<{ reason: string }>(c);
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  if (!row || (row.status !== 'for_approval' && row.status !== 'draft'))
    return fail(c, 'Order not found.', 404);
  await db
    .update(orders)
    .set({
      status: 'rejected',
      rejectedBy: auth.userId,
      rejectedAt: new Date(),
      rejectionReason: reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id));
  return ok(c, await getOrder(id));
});

orderRoutes.post('/:id/status', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Order not found.', 404);
  const auth = c.get('auth');
  const { status, notes } = await body<{ status: string; notes?: string }>(c);
  if (!status) return fail(c, 'status is required.');
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  if (!row) return fail(c, 'Order not found.', 404);

  const patch: Partial<Order> = { status, updatedAt: new Date() };
  if (notes != null) patch.notes = `${row.notes ?? ''}\n${notes}`;
  if (status === 'approved' && !row.approvedBy) {
    patch.approvedBy = auth.userId;
    patch.approvedAt = new Date();
    const [a] = await db
      .select({ fullName: profiles.fullName, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, auth.userId));
    patch.approvedByName = a?.fullName ?? a?.email ?? null;
  }
  if (status === 'in_transit' && !row.onTransitAt) patch.onTransitAt = new Date();
  if (status === 'delivered' && !row.deliveredAt) patch.deliveredAt = new Date();

  await db.update(orders).set(patch).where(eq(orders.id, id));
  return ok(c, await getOrder(id));
});
