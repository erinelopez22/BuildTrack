// /api/company-assets — ported from CompanyAssetsController.cs + CompanyAssetService.cs
import { Hono } from 'hono';
import { and, desc, eq, inArray, ne, sql, type SQL } from 'drizzle-orm';
import { db } from '../db';
import { borrowTransactions, companyAssets, profiles, projects } from '../db/schema';
import {
  authMiddleware,
  isAdmin,
  isSuperAdmin,
  type AuthVars,
} from '../lib/auth';
import { requireAdmin, requireWarehouseAdmin } from '../lib/policies';
import { body, isUuid, toDate } from '../lib/http';
import { created, fail, ok } from '../lib/response';
import { num } from '../lib/num';

type Asset = typeof companyAssets.$inferSelect;
type Borrow = typeof borrowTransactions.$inferSelect;

const outstanding = (txns: Borrow[]) =>
  txns
    .filter((t) => t.status !== 'Returned' && t.approvalStatus === 'approved')
    .reduce((s, t) => s + (num(t.borrowedQty) - num(t.returnedQty)), 0);

async function mapAssets(rows: Asset[]) {
  if (rows.length === 0) return [];
  const txns = await db
    .select()
    .from(borrowTransactions)
    .where(inArray(borrowTransactions.assetId, rows.map((r) => r.id)));
  const byAsset = new Map<string, Borrow[]>();
  for (const t of txns) {
    const arr = byAsset.get(t.assetId) ?? [];
    arr.push(t);
    byAsset.set(t.assetId, arr);
  }
  return rows.map((a) => {
    const borrowed = outstanding(byAsset.get(a.id) ?? []);
    return {
      id: a.id,
      assetName: a.assetName,
      assetType: a.assetType ?? undefined,
      assetCode: a.assetCode ?? undefined,
      unit: a.unit ?? undefined,
      totalQuantity: num(a.totalQuantity),
      condition: a.condition ?? undefined,
      notes: a.notes ?? undefined,
      createdBy: a.createdBy ?? undefined,
      createdAt: a.createdAt.toISOString(),
      borrowedQuantity: borrowed,
      availableQuantity: num(a.totalQuantity) - borrowed,
    };
  });
}

async function mapBorrows(rows: Borrow[]) {
  if (rows.length === 0) return [];
  const assetIds = [...new Set(rows.map((r) => r.assetId))];
  const assetNames = new Map(
    (
      await db
        .select({ id: companyAssets.id, name: companyAssets.assetName })
        .from(companyAssets)
        .where(inArray(companyAssets.id, assetIds))
    ).map((a) => [a.id, a.name]),
  );
  const projIds = [
    ...new Set(rows.map((r) => r.projectId).filter((x): x is string => !!x)),
  ];
  const projNames = projIds.length
    ? new Map(
        (
          await db
            .select({ id: projects.id, name: projects.name })
            .from(projects)
            .where(inArray(projects.id, projIds))
        ).map((p) => [p.id, p.name]),
      )
    : new Map<string, string>();
  const peopleIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.borrowedBy, r.approvedBy])
        .filter((x): x is string => !!x),
    ),
  ];
  const names = peopleIds.length
    ? new Map(
        (
          await db
            .select({ id: profiles.id, name: profiles.fullName })
            .from(profiles)
            .where(inArray(profiles.id, peopleIds))
        ).map((p) => [p.id, p.name]),
      )
    : new Map<string, string | null>();

  return rows.map((t) => ({
    id: t.id,
    assetId: t.assetId,
    assetName: assetNames.get(t.assetId) ?? undefined,
    projectId: t.projectId ?? undefined,
    projectName: t.projectId ? (projNames.get(t.projectId) ?? undefined) : undefined,
    borrowedQty: num(t.borrowedQty),
    borrowedBy: t.borrowedBy ?? undefined,
    borrowedByName: t.borrowedBy ? (names.get(t.borrowedBy) ?? undefined) : undefined,
    borrowedAt: t.borrowedAt.toISOString(),
    expectedReturnDate: t.expectedReturnDate?.toISOString() ?? undefined,
    returnedQty: num(t.returnedQty),
    returnedAt: t.returnedAt?.toISOString() ?? undefined,
    returnRemarks: t.returnRemarks ?? undefined,
    status: t.status,
    requestType: t.requestType ?? undefined,
    approvalStatus: t.approvalStatus,
    approvedBy: t.approvedBy ?? undefined,
    approvedByName: t.approvedBy ? (names.get(t.approvedBy) ?? undefined) : undefined,
    approvedAt: t.approvedAt?.toISOString() ?? undefined,
    rejectionRemarks: t.rejectionRemarks ?? undefined,
    createdAt: t.createdAt.toISOString(),
  }));
}

async function borrowById(id: string) {
  const [row] = await db
    .select()
    .from(borrowTransactions)
    .where(eq(borrowTransactions.id, id));
  return row ? (await mapBorrows([row]))[0] : null;
}

export const assetRoutes = new Hono<{ Variables: AuthVars }>();
assetRoutes.use('*', authMiddleware);

// ── Borrow transactions (static paths first) ─────────────────────────────────

assetRoutes.get('/borrow-transactions', async (c) => {
  const projectId = c.req.query('projectId');
  const rows = await db
    .select()
    .from(borrowTransactions)
    .where(
      isUuid(projectId)
        ? eq(borrowTransactions.projectId, projectId)
        : undefined,
    )
    .orderBy(desc(borrowTransactions.borrowedAt));
  return ok(c, await mapBorrows(rows));
});

assetRoutes.post('/borrow', async (c) => {
  const auth = c.get('auth');
  const admin = isAdmin(auth);
  const b = await body<{
    assetId: string;
    projectId?: string;
    quantity: number;
    expectedReturnDate?: string;
  }>(c);
  if (!isUuid(b.assetId)) return fail(c, 'Asset not found.');
  const [asset] = await db
    .select()
    .from(companyAssets)
    .where(eq(companyAssets.id, b.assetId));
  if (!asset) return fail(c, 'Asset not found.');

  if (!admin) {
    const pending = await db
      .select({ id: borrowTransactions.id })
      .from(borrowTransactions)
      .where(
        and(
          eq(borrowTransactions.assetId, b.assetId),
          eq(borrowTransactions.approvalStatus, 'pending'),
          eq(borrowTransactions.requestType, 'borrow'),
        ),
      );
    if (pending.length)
      return fail(c, 'A request for this asset is already pending approval.');
  }

  const txns = await db
    .select()
    .from(borrowTransactions)
    .where(eq(borrowTransactions.assetId, b.assetId));
  const available = num(asset.totalQuantity) - outstanding(txns);
  const qty = Number(b.quantity) || 0;
  if (qty > available) return fail(c, `Only ${available} units available.`);

  const needsApproval = !admin;
  const [txn] = await db
    .insert(borrowTransactions)
    .values({
      assetId: b.assetId,
      projectId: isUuid(b.projectId) ? b.projectId : null,
      borrowedQty: String(qty),
      borrowedBy: auth.userId,
      borrowedAt: new Date(),
      expectedReturnDate: toDate(b.expectedReturnDate),
      status: needsApproval ? 'Pending' : 'Borrowed',
      requestType: 'borrow',
      approvalStatus: needsApproval ? 'pending' : 'approved',
      approvedBy: needsApproval ? null : auth.userId,
      approvedAt: needsApproval ? null : new Date(),
    })
    .returning();
  return ok(c, await borrowById(txn.id));
});

assetRoutes.post('/borrow-transactions/:id/return', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Borrow transaction not found.');
  const auth = c.get('auth');
  const admin = isAdmin(auth);
  const b = await body<{ returnedQty: number; remarks?: string }>(c);
  const [txn] = await db
    .select()
    .from(borrowTransactions)
    .where(eq(borrowTransactions.id, id));
  if (!txn) return fail(c, 'Borrow transaction not found.');

  if (!admin) {
    const pending = await db
      .select({ id: borrowTransactions.id })
      .from(borrowTransactions)
      .where(
        and(
          eq(borrowTransactions.assetId, txn.assetId),
          eq(borrowTransactions.approvalStatus, 'pending'),
          eq(borrowTransactions.requestType, 'return'),
        ),
      );
    if (pending.length)
      return fail(
        c,
        'A return request for this asset is already pending approval.',
      );
  }

  const retQty = Number(b.returnedQty) || 0;

  if (admin) {
    const newReturned = num(txn.returnedQty) + retQty;
    const [updated] = await db
      .update(borrowTransactions)
      .set({
        returnedQty: String(newReturned),
        returnRemarks: b.remarks,
        returnedAt: new Date(),
        status:
          newReturned >= num(txn.borrowedQty) ? 'Returned' : 'Partially Returned',
        updatedAt: new Date(),
      })
      .where(eq(borrowTransactions.id, id))
      .returning();
    return ok(c, (await mapBorrows([updated]))[0]);
  }

  const [ret] = await db
    .insert(borrowTransactions)
    .values({
      assetId: txn.assetId,
      projectId: txn.projectId,
      borrowedQty: String(retQty),
      borrowedBy: auth.userId,
      borrowedAt: txn.borrowedAt,
      returnRemarks: b.remarks,
      status: 'Pending',
      requestType: 'return',
      approvalStatus: 'pending',
    })
    .returning();
  return ok(c, await borrowById(ret.id));
});

assetRoutes.post('/borrow-transactions/:id/approve', requireAdmin, async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Request not found.');
  const auth = c.get('auth');
  const [txn] = await db
    .select()
    .from(borrowTransactions)
    .where(eq(borrowTransactions.id, id));
  if (!txn) return fail(c, 'Request not found.');
  if (txn.approvalStatus !== 'pending')
    return fail(c, 'Request is already processed.');

  let status = txn.status;
  if (txn.requestType === 'borrow') {
    const others = await db
      .select()
      .from(borrowTransactions)
      .where(
        and(
          eq(borrowTransactions.assetId, txn.assetId),
          ne(borrowTransactions.id, txn.id),
        ),
      );
    const [asset] = await db
      .select()
      .from(companyAssets)
      .where(eq(companyAssets.id, txn.assetId));
    const available =
      num(asset?.totalQuantity ?? '0') - outstanding(others);
    if (num(txn.borrowedQty) > available)
      return fail(c, `Only ${available} units available. Cannot approve.`);
    status = 'Borrowed';
  } else if (txn.requestType === 'return') {
    const [orig] = await db
      .select()
      .from(borrowTransactions)
      .where(
        and(
          eq(borrowTransactions.assetId, txn.assetId),
          eq(borrowTransactions.approvalStatus, 'approved'),
          inArray(borrowTransactions.status, ['Borrowed', 'Partially Returned']),
        ),
      )
      .limit(1);
    if (orig) {
      const newReturned = num(orig.returnedQty) + num(txn.borrowedQty);
      await db
        .update(borrowTransactions)
        .set({
          returnedQty: String(newReturned),
          returnRemarks: txn.returnRemarks,
          returnedAt: new Date(),
          status:
            newReturned >= num(orig.borrowedQty)
              ? 'Returned'
              : 'Partially Returned',
          updatedAt: new Date(),
        })
        .where(eq(borrowTransactions.id, orig.id));
    }
    status = 'Returned';
  }

  const [updated] = await db
    .update(borrowTransactions)
    .set({
      status,
      approvalStatus: 'approved',
      approvedBy: auth.userId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(borrowTransactions.id, id))
    .returning();
  return ok(c, (await mapBorrows([updated]))[0]);
});

assetRoutes.post('/borrow-transactions/:id/reject', requireAdmin, async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Request not found.');
  const auth = c.get('auth');
  const { remarks } = await body<{ remarks?: string }>(c);
  const [txn] = await db
    .select()
    .from(borrowTransactions)
    .where(eq(borrowTransactions.id, id));
  if (!txn) return fail(c, 'Request not found.');
  if (txn.approvalStatus !== 'pending')
    return fail(c, 'Request is already processed.');

  const [updated] = await db
    .update(borrowTransactions)
    .set({
      approvalStatus: 'rejected',
      approvedBy: auth.userId,
      approvedAt: new Date(),
      rejectionRemarks: remarks,
      status: 'Rejected',
      updatedAt: new Date(),
    })
    .where(eq(borrowTransactions.id, id))
    .returning();
  return ok(c, (await mapBorrows([updated]))[0]);
});

// ── Assets ───────────────────────────────────────────────────────────────────

assetRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const q = c.req.query();
  const conds: SQL[] = [];
  if (!isSuperAdmin(auth) && auth.companyId)
    conds.push(eq(companyAssets.companyId, auth.companyId));
  if (q.search)
    conds.push(
      sql`(${companyAssets.assetName} ilike ${'%' + q.search + '%'} or ${companyAssets.assetCode} ilike ${'%' + q.search + '%'})`,
    );
  if (q.assetType) conds.push(eq(companyAssets.assetType, q.assetType));

  const rows = await db
    .select()
    .from(companyAssets)
    .where(conds.length ? and(...conds) : undefined);
  return ok(c, await mapAssets(rows));
});

assetRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Asset not found.', 404);
  const [row] = await db
    .select()
    .from(companyAssets)
    .where(eq(companyAssets.id, id));
  if (!row) return fail(c, 'Asset not found.', 404);
  return ok(c, (await mapAssets([row]))[0]);
});

assetRoutes.get('/:id/borrows', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return ok(c, []);
  const rows = await db
    .select()
    .from(borrowTransactions)
    .where(eq(borrowTransactions.assetId, id))
    .orderBy(desc(borrowTransactions.borrowedAt));
  return ok(c, await mapBorrows(rows));
});

assetRoutes.post('/', requireWarehouseAdmin, async (c) => {
  const auth = c.get('auth');
  const b = await body<{
    assetName: string;
    assetType?: string;
    assetCode?: string;
    unit?: string;
    totalQuantity?: number;
    condition?: string;
    notes?: string;
  }>(c);
  if (!b.assetName) return fail(c, 'assetName is required.');
  const [row] = await db
    .insert(companyAssets)
    .values({
      assetName: b.assetName,
      assetType: b.assetType,
      assetCode: b.assetCode,
      unit: b.unit,
      totalQuantity: String(b.totalQuantity ?? 0),
      condition: b.condition ?? 'Available',
      notes: b.notes,
      createdBy: auth.userId,
      companyId: auth.companyId ?? null,
    })
    .returning();
  return created(c, (await mapAssets([row]))[0]);
});

assetRoutes.put('/:id', requireWarehouseAdmin, async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Asset not found.', 404);
  const b = await body<{
    assetName?: string;
    assetType?: string;
    assetCode?: string;
    unit?: string;
    totalQuantity?: number;
    condition?: string;
    notes?: string;
  }>(c);
  const patch: Partial<Asset> = { updatedAt: new Date() };
  if (b.assetName != null) patch.assetName = b.assetName;
  if (b.assetType != null) patch.assetType = b.assetType;
  if (b.assetCode != null) patch.assetCode = b.assetCode;
  if (b.unit != null) patch.unit = b.unit;
  if (b.totalQuantity != null) patch.totalQuantity = String(b.totalQuantity);
  if (b.condition != null) patch.condition = b.condition;
  if (b.notes != null) patch.notes = b.notes;

  const [row] = await db
    .update(companyAssets)
    .set(patch)
    .where(eq(companyAssets.id, id))
    .returning();
  if (!row) return fail(c, 'Asset not found.', 404);
  return ok(c, (await mapAssets([row]))[0]);
});

assetRoutes.delete('/:id', requireWarehouseAdmin, async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Asset not found.', 404);
  const rows = await db
    .delete(companyAssets)
    .where(eq(companyAssets.id, id))
    .returning();
  if (!rows.length) return fail(c, 'Asset not found.', 404);
  return ok(c, null, 'Asset deleted.');
});
