// /api/inventory — ported from InventoryController.cs + InventoryService.cs
import { Hono } from 'hono';
import { and, asc, desc, eq, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  inventoryTransactions,
  profiles,
  projectInventory,
  projects,
  skus,
} from '../db/schema.js';
import { authMiddleware, type AuthVars } from '../lib/auth.js';
import { body, isUuid, qint } from '../lib/http.js';
import { fail, ok } from '../lib/response.js';
import { num } from '../lib/num.js';

export const inventoryRoutes = new Hono<{ Variables: AuthVars }>();
inventoryRoutes.use('*', authMiddleware);

async function listInventory(projectId?: string) {
  const rows = await db
    .select({
      pi: projectInventory,
      skuCode: skus.skuCode,
      skuName: skus.name,
      unit: skus.unitOfMeasure,
      projectName: projects.name,
    })
    .from(projectInventory)
    .leftJoin(skus, eq(skus.id, projectInventory.skuId))
    .leftJoin(projects, eq(projects.id, projectInventory.projectId))
    .where(
      projectId ? eq(projectInventory.projectId, projectId) : undefined,
    )
    .orderBy(asc(skus.name));

  return rows.map((r) => ({
    id: r.pi.id,
    projectId: r.pi.projectId,
    projectName: r.projectName ?? undefined,
    skuId: r.pi.skuId,
    skuCode: r.skuCode ?? undefined,
    skuName: r.skuName ?? undefined,
    unit: r.unit ?? undefined,
    onHand: num(r.pi.onHand),
    reserved: num(r.pi.reserved),
    minThreshold: num(r.pi.minThreshold),
    locationInSite: r.pi.locationInSite ?? undefined,
    updatedAt: r.pi.updatedAt.toISOString(),
  }));
}

inventoryRoutes.get('/', async (c) => {
  const projectId = c.req.query('projectId');
  return ok(c, await listInventory(isUuid(projectId) ? projectId : undefined));
});

inventoryRoutes.get('/project/:projectId', async (c) => {
  const projectId = c.req.param('projectId');
  if (!isUuid(projectId)) return ok(c, []);
  return ok(c, await listInventory(projectId));
});

inventoryRoutes.get('/transactions', async (c) => {
  const q = c.req.query();
  const limit = qint(q.limit, 100);
  const conds: SQL[] = [];
  if (isUuid(q.projectId))
    conds.push(eq(inventoryTransactions.projectId, q.projectId));
  if (isUuid(q.skuId)) conds.push(eq(inventoryTransactions.skuId, q.skuId));

  const rows = await db
    .select({
      t: inventoryTransactions,
      skuCode: skus.skuCode,
      skuName: skus.name,
      projectName: projects.name,
      createdByName: profiles.fullName,
    })
    .from(inventoryTransactions)
    .leftJoin(skus, eq(skus.id, inventoryTransactions.skuId))
    .leftJoin(projects, eq(projects.id, inventoryTransactions.projectId))
    .leftJoin(profiles, eq(profiles.id, inventoryTransactions.createdBy))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(inventoryTransactions.createdAt))
    .limit(limit);

  return ok(
    c,
    rows.map((r) => ({
      id: r.t.id,
      projectId: r.t.projectId,
      projectName: r.projectName ?? undefined,
      skuId: r.t.skuId,
      skuName: r.skuName ?? undefined,
      skuCode: r.skuCode ?? undefined,
      transactionType: r.t.transactionType,
      quantity: num(r.t.quantity),
      quantityBefore: num(r.t.quantityBefore),
      quantityAfter: num(r.t.quantityAfter),
      referenceType: r.t.referenceType ?? undefined,
      referenceId: r.t.referenceId ?? undefined,
      notes: r.t.notes ?? undefined,
      createdBy: r.t.createdBy ?? undefined,
      createdByName: r.createdByName ?? undefined,
      createdAt: r.t.createdAt.toISOString(),
    })),
  );
});

inventoryRoutes.post('/transactions', async (c) => {
  const auth = c.get('auth');
  const b = await body<{
    projectId: string;
    skuId: string;
    transactionType: string;
    quantity: number;
    transferProjectId?: string;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
  }>(c);
  if (!isUuid(b.projectId) || !isUuid(b.skuId) || !b.transactionType)
    return fail(c, 'projectId, skuId and transactionType are required.');

  const qty = Number(b.quantity) || 0;

  const [inv] = await db
    .select()
    .from(projectInventory)
    .where(
      and(
        eq(projectInventory.projectId, b.projectId),
        eq(projectInventory.skuId, b.skuId),
      ),
    );

  const before = inv ? num(inv.onHand) : 0;
  let after: number;
  switch (b.transactionType) {
    case 'stock_in':
    case 'receiving':
    case 'transfer_in':
      after = before + qty;
      break;
    case 'stock_out':
    case 'transfer_out':
      after = before - qty;
      break;
    case 'adjustment':
      after = qty;
      break;
    default:
      after = before + qty;
  }
  if (after < 0) return fail(c, 'Insufficient inventory.');

  if (inv) {
    await db
      .update(projectInventory)
      .set({ onHand: String(after), updatedAt: new Date() })
      .where(eq(projectInventory.id, inv.id));
  } else {
    await db
      .insert(projectInventory)
      .values({
        projectId: b.projectId,
        skuId: b.skuId,
        onHand: String(after),
      });
  }

  const [txn] = await db
    .insert(inventoryTransactions)
    .values({
      projectId: b.projectId,
      skuId: b.skuId,
      transactionType: b.transactionType,
      quantity: String(qty),
      quantityBefore: String(before),
      quantityAfter: String(after),
      referenceType: b.referenceType,
      referenceId: isUuid(b.referenceId) ? b.referenceId : null,
      transferProjectId: isUuid(b.transferProjectId)
        ? b.transferProjectId
        : null,
      notes: b.notes,
      createdBy: auth.userId,
    })
    .returning();

  const [sku] = await db
    .select({ code: skus.skuCode, name: skus.name })
    .from(skus)
    .where(eq(skus.id, b.skuId));

  return ok(c, {
    id: txn.id,
    projectId: txn.projectId,
    skuId: txn.skuId,
    skuName: sku?.name ?? undefined,
    skuCode: sku?.code ?? undefined,
    transactionType: txn.transactionType,
    quantity: num(txn.quantity),
    quantityBefore: num(txn.quantityBefore),
    quantityAfter: num(txn.quantityAfter),
    notes: txn.notes ?? undefined,
    createdBy: txn.createdBy ?? undefined,
    createdAt: txn.createdAt.toISOString(),
  });
});
