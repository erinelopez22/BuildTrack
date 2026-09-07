// /api/quotations — ported from QuotationsController.cs + QuotationService.cs
import { Hono } from 'hono';
import { and, desc, eq, inArray, type SQL } from 'drizzle-orm';
import { db } from '../db';
import {
  profiles,
  projectQuotations,
  projects,
  quotationChangeRequests,
  quotationItems,
} from '../db/schema';
import { authMiddleware, type AuthVars } from '../lib/auth';
import { requireOfficeAdmin } from '../lib/policies';
import { body, isUuid } from '../lib/http';
import { created, fail, ok } from '../lib/response';
import { num } from '../lib/num';

type Quotation = typeof projectQuotations.$inferSelect;
type QItem = typeof quotationItems.$inferSelect;
type ChangeRequest = typeof quotationChangeRequests.$inferSelect;

const itemDto = (i: QItem) => ({
  id: i.id,
  quotationId: i.quotationId,
  materialName: i.materialName,
  unit: i.unit ?? undefined,
  quantity: num(i.quantity),
  createdAt: i.createdAt.toISOString(),
  updatedAt: i.updatedAt.toISOString(),
});

async function mapQuotations(rows: Quotation[]) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const items = await db
    .select()
    .from(quotationItems)
    .where(inArray(quotationItems.quotationId, ids));
  const itemsByQ = new Map<string, QItem[]>();
  for (const it of items) {
    const arr = itemsByQ.get(it.quotationId) ?? [];
    arr.push(it);
    itemsByQ.set(it.quotationId, arr);
  }
  const creatorIds = [
    ...new Set(rows.map((r) => r.createdBy).filter((x): x is string => !!x)),
  ];
  const names = new Map<string, string | null>();
  if (creatorIds.length) {
    const p = await db
      .select({ id: profiles.id, name: profiles.fullName })
      .from(profiles)
      .where(inArray(profiles.id, creatorIds));
    for (const x of p) names.set(x.id, x.name);
  }
  const projIds = [...new Set(rows.map((r) => r.projectId))];
  const projNames = new Map<string, string>();
  if (projIds.length) {
    const pr = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(inArray(projects.id, projIds));
    for (const x of pr) projNames.set(x.id, x.name);
  }

  return rows.map((q) => ({
    id: q.id,
    projectId: q.projectId,
    projectName: projNames.get(q.projectId),
    createdBy: q.createdBy ?? undefined,
    createdByName: q.createdBy ? (names.get(q.createdBy) ?? undefined) : undefined,
    notes: q.notes ?? undefined,
    category: q.category ?? undefined,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    items: (itemsByQ.get(q.id) ?? []).map(itemDto),
  }));
}

async function getQuotation(id: string) {
  const [row] = await db
    .select()
    .from(projectQuotations)
    .where(eq(projectQuotations.id, id));
  return row ? (await mapQuotations([row]))[0] : null;
}

async function mapChangeRequests(rows: ChangeRequest[]) {
  if (rows.length === 0) return [];
  const people = [
    ...new Set(
      rows
        .flatMap((r) => [r.requestedBy, r.reviewedBy])
        .filter((x): x is string => !!x),
    ),
  ];
  const names = new Map<string, string | null>();
  if (people.length) {
    const p = await db
      .select({ id: profiles.id, name: profiles.fullName })
      .from(profiles)
      .where(inArray(profiles.id, people));
    for (const x of p) names.set(x.id, x.name);
  }
  const projIds = [...new Set(rows.map((r) => r.projectId))];
  const projNames = new Map<string, string>();
  if (projIds.length) {
    const pr = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(inArray(projects.id, projIds));
    for (const x of pr) projNames.set(x.id, x.name);
  }
  return rows.map((cr) => ({
    id: cr.id,
    projectId: cr.projectId,
    projectName: projNames.get(cr.projectId),
    quotationId: cr.quotationId ?? undefined,
    changeType: cr.changeType ?? undefined,
    status: cr.status,
    requestedBy: cr.requestedBy ?? undefined,
    requestedByName: cr.requestedBy
      ? (names.get(cr.requestedBy) ?? undefined)
      : undefined,
    reviewedBy: cr.reviewedBy ?? undefined,
    reviewedByName: cr.reviewedBy
      ? (names.get(cr.reviewedBy) ?? undefined)
      : undefined,
    reviewedAt: cr.reviewedBy ? cr.updatedAt.toISOString() : undefined,
    reviewRemarks: cr.reviewRemarks ?? undefined,
    payload: cr.payload ?? undefined,
    createdAt: cr.createdAt.toISOString(),
    updatedAt: cr.updatedAt.toISOString(),
  }));
}

export const quotationRoutes = new Hono<{ Variables: AuthVars }>();
quotationRoutes.use('*', authMiddleware);

// ── Change requests (static paths registered before /:id) ────────────────────

quotationRoutes.get('/change-requests', async (c) => {
  const q = c.req.query();
  const conds: SQL[] = [];
  if (isUuid(q.projectId))
    conds.push(eq(quotationChangeRequests.projectId, q.projectId));
  if (q.status) conds.push(eq(quotationChangeRequests.status, q.status));
  const rows = await db
    .select()
    .from(quotationChangeRequests)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(quotationChangeRequests.createdAt));
  return ok(c, await mapChangeRequests(rows));
});

quotationRoutes.post('/change-requests', async (c) => {
  const auth = c.get('auth');
  const b = await body<{
    projectId: string;
    quotationId?: string;
    changeType?: string;
    payload?: string;
  }>(c);
  if (!isUuid(b.projectId)) return fail(c, 'projectId is required.');
  const [row] = await db
    .insert(quotationChangeRequests)
    .values({
      projectId: b.projectId,
      quotationId: isUuid(b.quotationId) ? b.quotationId : null,
      changeType: b.changeType,
      status: 'pending',
      requestedBy: auth.userId,
      payload: b.payload,
    })
    .returning();
  return ok(c, (await mapChangeRequests([row]))[0]);
});

quotationRoutes.put('/change-requests/:id', requireOfficeAdmin, async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Change request not found.', 404);
  const auth = c.get('auth');
  const b = await body<{ status: string; reviewRemarks?: string }>(c);
  const [cr] = await db
    .select()
    .from(quotationChangeRequests)
    .where(eq(quotationChangeRequests.id, id));
  if (!cr) return fail(c, 'Change request not found.', 404);

  let quotationId = cr.quotationId;

  if (b.status === 'approved' && cr.payload) {
    let payload: {
      items?: { material_name: string; unit?: string; quantity: number }[];
      notes?: string;
      category?: string;
      quotation_id?: string;
    } = {};
    try {
      payload = JSON.parse(cr.payload);
    } catch {
      payload = {};
    }

    if (cr.changeType === 'create' && payload.items) {
      const [q] = await db
        .insert(projectQuotations)
        .values({
          projectId: cr.projectId,
          createdBy: cr.requestedBy,
          notes: payload.notes,
          category: payload.category ?? 'initial',
        })
        .returning();
      if (payload.items.length)
        await db.insert(quotationItems).values(
          payload.items.map((i) => ({
            quotationId: q.id,
            materialName: i.material_name,
            unit: i.unit,
            quantity: String(i.quantity),
          })),
        );
      quotationId = q.id;
    } else if (
      cr.changeType === 'update' &&
      cr.quotationId &&
      payload.items
    ) {
      await db
        .delete(quotationItems)
        .where(eq(quotationItems.quotationId, cr.quotationId));
      if (payload.items.length)
        await db.insert(quotationItems).values(
          payload.items.map((i) => ({
            quotationId: cr.quotationId!,
            materialName: i.material_name,
            unit: i.unit,
            quantity: String(i.quantity),
          })),
        );
      const patch: Partial<Quotation> = { updatedAt: new Date() };
      if (payload.notes != null) patch.notes = payload.notes;
      if (payload.category != null) patch.category = payload.category;
      await db
        .update(projectQuotations)
        .set(patch)
        .where(eq(projectQuotations.id, cr.quotationId));
    } else if (cr.changeType === 'delete') {
      const target = cr.quotationId ?? payload.quotation_id;
      if (target)
        await db
          .delete(projectQuotations)
          .where(eq(projectQuotations.id, target));
    }
  }

  const [updated] = await db
    .update(quotationChangeRequests)
    .set({
      status: b.status,
      reviewedBy: auth.userId,
      reviewRemarks: b.reviewRemarks,
      quotationId,
      updatedAt: new Date(),
    })
    .where(eq(quotationChangeRequests.id, id))
    .returning();
  return ok(c, (await mapChangeRequests([updated]))[0]);
});

// ── Quotations ───────────────────────────────────────────────────────────────

quotationRoutes.get('/', async (c) => {
  const projectId = c.req.query('projectId');
  const rows = await db
    .select()
    .from(projectQuotations)
    .where(
      isUuid(projectId)
        ? eq(projectQuotations.projectId, projectId)
        : undefined,
    )
    .orderBy(desc(projectQuotations.createdAt));
  return ok(c, await mapQuotations(rows));
});

quotationRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Quotation not found.', 404);
  const q = await getQuotation(id);
  if (!q) return fail(c, 'Quotation not found.', 404);
  return ok(c, q);
});

quotationRoutes.post('/', async (c) => {
  const auth = c.get('auth');
  const b = await body<{
    projectId: string;
    notes?: string;
    category?: string;
    items: { materialName: string; unit?: string; quantity: number }[];
  }>(c);
  if (!isUuid(b.projectId)) return fail(c, 'projectId is required.');
  const [q] = await db
    .insert(projectQuotations)
    .values({
      projectId: b.projectId,
      createdBy: auth.userId,
      notes: b.notes,
      category: b.category ?? 'initial',
    })
    .returning();
  if (b.items?.length)
    await db.insert(quotationItems).values(
      b.items.map((i) => ({
        quotationId: q.id,
        materialName: i.materialName,
        unit: i.unit,
        quantity: String(i.quantity),
      })),
    );
  return created(c, await getQuotation(q.id));
});

quotationRoutes.delete('/:id', requireOfficeAdmin, async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Quotation not found.', 404);
  const rows = await db
    .delete(projectQuotations)
    .where(eq(projectQuotations.id, id))
    .returning();
  if (!rows.length) return fail(c, 'Quotation not found.', 404);
  return ok(c, null, 'Quotation deleted.');
});

quotationRoutes.put('/:id/items/:itemId', async (c) => {
  const id = c.req.param('id');
  const itemId = c.req.param('itemId');
  if (!isUuid(id) || !isUuid(itemId)) return fail(c, 'Item not found.', 404);
  const b = await body<{
    materialName?: string;
    unit?: string;
    quantity?: number;
  }>(c);
  const patch: Partial<QItem> = { updatedAt: new Date() };
  if (b.materialName != null) patch.materialName = b.materialName;
  if (b.unit != null) patch.unit = b.unit;
  if (b.quantity != null) patch.quantity = String(b.quantity);

  const [row] = await db
    .update(quotationItems)
    .set(patch)
    .where(
      and(eq(quotationItems.id, itemId), eq(quotationItems.quotationId, id)),
    )
    .returning();
  if (!row) return fail(c, 'Item not found.', 404);
  return ok(c, itemDto(row));
});
