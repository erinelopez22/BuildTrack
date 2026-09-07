// /api/projects — ported from ProjectsController.cs + ProjectService.cs
import { Hono } from 'hono';
import {
  and,
  desc,
  eq,
  inArray,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  auditLogs,
  orderItems,
  orders,
  profiles,
  projectMembers,
  projectQuotations,
  projects,
  quotationItems,
  skus,
} from '../db/schema.js';
import { authMiddleware, isAdmin, isSuperAdmin, type AuthVars } from '../lib/auth.js';
import { requireAdmin, requireProjectManager } from '../lib/policies.js';
import { body, isUuid, qbool, qint, toDate } from '../lib/http.js';
import { created, fail, ok } from '../lib/response.js';
import { num, numOrNull } from '../lib/num.js';

type Project = typeof projects.$inferSelect;

const DELIVERED_STATUSES = [
  'delivered',
  'fully_received',
  'partially_received',
  'closed',
];

async function decorate(rows: Project[]) {
  if (rows.length === 0) return [];
  const pmIds = [
    ...new Set(rows.map((r) => r.projectManagerId).filter((x): x is string => !!x)),
  ];
  const pmNames = new Map<string, string | null>();
  if (pmIds.length) {
    const pm = await db
      .select({ id: profiles.id, name: profiles.fullName })
      .from(profiles)
      .where(inArray(profiles.id, pmIds));
    for (const p of pm) pmNames.set(p.id, p.name);
  }
  const counts = await db
    .select({
      projectId: projectMembers.projectId,
      n: sql<number>`count(*)::int`,
    })
    .from(projectMembers)
    .where(inArray(projectMembers.projectId, rows.map((r) => r.id)))
    .groupBy(projectMembers.projectId);
  const countMap = new Map(counts.map((r) => [r.projectId, r.n]));

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code ?? undefined,
    location: p.location ?? undefined,
    description: p.description ?? undefined,
    status: p.status,
    startDate: p.startDate?.toISOString() ?? undefined,
    endDate: p.endDate?.toISOString() ?? undefined,
    projectManagerId: p.projectManagerId ?? undefined,
    projectManagerName: p.projectManagerId
      ? (pmNames.get(p.projectManagerId) ?? undefined)
      : undefined,
    estimatedCost: numOrNull(p.estimatedCost) ?? undefined,
    isHidden: p.isHidden,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    createdBy: p.createdBy ?? undefined,
    memberCount: countMap.get(p.id) ?? 0,
  }));
}

async function isMember(projectId: string, userId: string) {
  const [row] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
      ),
    );
  return !!row;
}

export const projectRoutes = new Hono<{ Variables: AuthVars }>();
projectRoutes.use('*', authMiddleware);

projectRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const q = c.req.query();
  const conds: SQL[] = [ne(projects.status, 'deleted')];

  if (!isSuperAdmin(auth) && auth.companyId)
    conds.push(eq(projects.companyId, auth.companyId));

  if (!isAdmin(auth))
    conds.push(
      sql`exists (select 1 from ${projectMembers} pm where pm.project_id = ${projects.id} and pm.user_id = ${auth.userId})`,
    );

  if (!qbool(q.includeHidden)) conds.push(eq(projects.isHidden, false));
  if (q.status) conds.push(eq(projects.status, q.status));
  if (q.search)
    conds.push(
      sql`(${projects.name} ilike ${'%' + q.search + '%'} or ${projects.code} ilike ${'%' + q.search + '%'} or ${projects.location} ilike ${'%' + q.search + '%'})`,
    );

  const rows = await db
    .select()
    .from(projects)
    .where(and(...conds))
    .orderBy(desc(projects.createdAt));
  return ok(c, await decorate(rows));
});

projectRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Project not found.', 404);
  const auth = c.get('auth');
  const [row] = await db.select().from(projects).where(eq(projects.id, id));
  if (!row) return fail(c, 'Project not found.', 404);
  if (!isAdmin(auth) && !(await isMember(id, auth.userId)))
    return fail(c, 'Project not found.', 404);
  return ok(c, (await decorate([row]))[0]);
});

projectRoutes.post('/', requireProjectManager, async (c) => {
  const auth = c.get('auth');
  const b = await body<{
    name: string;
    code?: string;
    location?: string;
    description?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    projectManagerId?: string;
    estimatedCost?: number;
    isHidden?: boolean;
  }>(c);
  if (!b.name) return fail(c, 'Name is required.');

  const [row] = await db
    .insert(projects)
    .values({
      name: b.name,
      code: b.code,
      location: b.location,
      description: b.description,
      status: b.status ?? 'active',
      startDate: toDate(b.startDate),
      endDate: toDate(b.endDate),
      projectManagerId: b.projectManagerId ?? null,
      estimatedCost:
        b.estimatedCost != null ? String(b.estimatedCost) : null,
      isHidden: b.isHidden ?? false,
      companyId: auth.companyId ?? null,
      createdBy: auth.userId,
    })
    .returning();

  await db.insert(projectMembers).values({
    projectId: row.id,
    userId: auth.userId,
    role: 'project_manager',
    createdBy: auth.userId,
  });

  return created(c, (await decorate([row]))[0]);
});

projectRoutes.put('/:id', requireProjectManager, async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Project not found.', 404);
  const b = await body<{
    name?: string;
    code?: string;
    location?: string;
    description?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    projectManagerId?: string;
    estimatedCost?: number;
    isHidden?: boolean;
  }>(c);
  const patch: Partial<Project> = { updatedAt: new Date() };
  if (b.name != null) patch.name = b.name;
  if (b.code != null) patch.code = b.code;
  if (b.location != null) patch.location = b.location;
  if (b.description != null) patch.description = b.description;
  if (b.status != null) patch.status = b.status;
  if (b.startDate != null) patch.startDate = toDate(b.startDate) ?? null;
  if (b.endDate != null) patch.endDate = toDate(b.endDate) ?? null;
  if (b.projectManagerId != null) patch.projectManagerId = b.projectManagerId;
  if (b.estimatedCost != null) patch.estimatedCost = String(b.estimatedCost);
  if (b.isHidden != null) patch.isHidden = b.isHidden;

  const [row] = await db
    .update(projects)
    .set(patch)
    .where(eq(projects.id, id))
    .returning();
  if (!row) return fail(c, 'Project not found.', 404);
  return ok(c, (await decorate([row]))[0]);
});

projectRoutes.delete('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Project not found.', 404);
  const [row] = await db
    .update(projects)
    .set({ status: 'deleted', updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  if (!row) return fail(c, 'Project not found.', 404);
  return ok(c, null, 'Project deleted.');
});

// ── Members ──────────────────────────────────────────────────────────────────

const memberDto = (m: {
  id: string;
  projectId: string;
  userId: string;
  role: string | null;
  createdAt: Date;
  fullName: string | null;
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
}) => ({
  id: m.id,
  projectId: m.projectId,
  userId: m.userId,
  role: m.role ?? undefined,
  createdAt: m.createdAt.toISOString(),
  userFullName: m.fullName ?? undefined,
  userEmail: m.email ?? undefined,
  userUsername: m.username ?? undefined,
  userAvatarUrl: m.avatarUrl ?? undefined,
});

projectRoutes.get('/:id/members', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return ok(c, []);
  const rows = await db
    .select({
      id: projectMembers.id,
      projectId: projectMembers.projectId,
      userId: projectMembers.userId,
      role: projectMembers.role,
      createdAt: projectMembers.createdAt,
      fullName: profiles.fullName,
      email: profiles.email,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
    })
    .from(projectMembers)
    .leftJoin(profiles, eq(profiles.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, id));
  return ok(c, rows.map(memberDto));
});

projectRoutes.post('/:id/members', requireProjectManager, async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Project not found.', 404);
  const auth = c.get('auth');
  const b = await body<{ userId: string; role?: string }>(c);
  if (!isUuid(b.userId)) return fail(c, 'userId is required.');

  const [existing] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, id),
        eq(projectMembers.userId, b.userId!),
      ),
    );

  let memberId: string;
  if (existing) {
    await db
      .update(projectMembers)
      .set({ role: b.role ?? null })
      .where(eq(projectMembers.id, existing.id));
    memberId = existing.id;
  } else {
    const [ins] = await db
      .insert(projectMembers)
      .values({
        projectId: id,
        userId: b.userId!,
        role: b.role ?? null,
        createdBy: auth.userId,
      })
      .returning();
    memberId = ins.id;
  }

  const [row] = await db
    .select({
      id: projectMembers.id,
      projectId: projectMembers.projectId,
      userId: projectMembers.userId,
      role: projectMembers.role,
      createdAt: projectMembers.createdAt,
      fullName: profiles.fullName,
      email: profiles.email,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
    })
    .from(projectMembers)
    .leftJoin(profiles, eq(profiles.id, projectMembers.userId))
    .where(eq(projectMembers.id, memberId));
  return ok(c, memberDto(row));
});

projectRoutes.delete('/:id/members/:userId', requireProjectManager, async (c) => {
  const id = c.req.param('id');
  const userId = c.req.param('userId');
  if (!isUuid(id) || !isUuid(userId)) return fail(c, 'Member not found.', 404);
  const rows = await db
    .delete(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, id),
        eq(projectMembers.userId, userId),
      ),
    )
    .returning();
  if (!rows.length) return fail(c, 'Member not found.', 404);
  return ok(c, null, 'Member removed.');
});

// ── Progress ─────────────────────────────────────────────────────────────────

projectRoutes.get('/:id/progress', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Project not found.', 404);
  const [project] = await db.select().from(projects).where(eq(projects.id, id));

  const [quotation] = await db
    .select()
    .from(projectQuotations)
    .where(
      and(
        eq(projectQuotations.projectId, id),
        eq(projectQuotations.category, 'initial'),
      ),
    )
    .limit(1);

  if (!quotation) {
    return ok(c, {
      projectId: id,
      projectName: project?.name ?? '',
      hasQuotation: false,
      materials: [],
      overallProgress: 0,
    });
  }

  const items = await db
    .select()
    .from(quotationItems)
    .where(eq(quotationItems.quotationId, quotation.id));

  const deliveredOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.projectId, id),
        inArray(orders.status, DELIVERED_STATUSES),
      ),
    );
  const deliveredOrderIds = deliveredOrders.map((o) => o.id);

  const deliveredItems = deliveredOrderIds.length
    ? await db
        .select({
          quotationItemId: orderItems.quotationItemId,
          quantityOrdered: orderItems.quantityOrdered,
          skuName: skus.name,
        })
        .from(orderItems)
        .leftJoin(skus, eq(skus.id, orderItems.skuId))
        .where(inArray(orderItems.orderId, deliveredOrderIds))
    : [];

  const materials = items.map((item) => {
    const matched = deliveredItems.filter(
      (oi) =>
        (oi.quotationItemId && oi.quotationItemId === item.id) ||
        (!oi.quotationItemId &&
          (oi.skuName ?? '').toLowerCase() ===
            item.materialName.toLowerCase()),
    );
    const received = matched.reduce(
      (s, oi) => s + num(oi.quantityOrdered),
      0,
    );
    const total = num(item.quantity);
    const progress = total > 0 ? Math.min(100, (received / total) * 100) : 0;
    return {
      quotationItemId: item.id,
      materialName: item.materialName,
      unit: item.unit ?? undefined,
      totalQuantity: total,
      receivedQuantity: received,
      progressPercent: Math.round(progress * 10) / 10,
    };
  });

  const totalQuoted = materials.reduce((s, m) => s + m.totalQuantity, 0);
  const totalReceived = materials.reduce((s, m) => s + m.receivedQuantity, 0);
  const overall =
    totalQuoted > 0
      ? Math.round((totalReceived / totalQuoted) * 1000) / 10
      : 0;

  return ok(c, {
    projectId: id,
    projectName: project?.name ?? '',
    hasQuotation: true,
    materials,
    overallProgress: overall,
  });
});

// ── Activity ─────────────────────────────────────────────────────────────────

projectRoutes.get('/:id/activity', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return ok(c, []);
  const limit = qint(c.req.query('limit'), 50);

  const orderIds = (
    await db.select({ id: orders.id }).from(orders).where(eq(orders.projectId, id))
  ).map((r) => r.id);
  const quotationIds = (
    await db
      .select({ id: projectQuotations.id })
      .from(projectQuotations)
      .where(eq(projectQuotations.projectId, id))
  ).map((r) => r.id);
  const relatedIds = [...orderIds, ...quotationIds, id];

  const rows = await db
    .select({
      id: auditLogs.id,
      tableName: auditLogs.tableName,
      action: auditLogs.action,
      createdAt: auditLogs.createdAt,
      newValues: auditLogs.newValues,
      userName: profiles.fullName,
    })
    .from(auditLogs)
    .leftJoin(profiles, eq(profiles.id, auditLogs.userId))
    .where(
      or(
        inArray(auditLogs.recordId, relatedIds),
        sql`${auditLogs.newValues} like ${'%' + id + '%'}`,
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return ok(
    c,
    rows.map((r) => ({
      id: r.id,
      tableName: r.tableName,
      action: r.action,
      createdAt: r.createdAt.toISOString(),
      userName: r.userName ?? 'System',
      newValues: r.newValues ?? undefined,
    })),
  );
});
