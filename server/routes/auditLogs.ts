// /api/audit-logs — ported from AuditLogsController.cs + AuditLogService.cs
import { Hono } from 'hono';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLogs, profiles } from '../db/schema.js';
import { authMiddleware, type AuthVars } from '../lib/auth.js';
import { body, isUuid, qint } from '../lib/http.js';
import { ok } from '../lib/response.js';

export const auditLogRoutes = new Hono<{ Variables: AuthVars }>();

// POST is anonymous — the frontend logs client-side actions directly.
auditLogRoutes.post('/', async (c) => {
  const b = await body<{
    tableName: string;
    recordId?: string;
    action: string;
    oldValues?: string;
    newValues?: string;
    userId?: string;
  }>(c);
  if (!b.tableName || !b.action) return ok(c, null);
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    null;
  await db.insert(auditLogs).values({
    tableName: b.tableName,
    recordId: isUuid(b.recordId) ? b.recordId : null,
    action: b.action,
    oldValues: b.oldValues,
    newValues: b.newValues,
    userId: isUuid(b.userId) ? b.userId : null,
    ipAddress: ip,
  });
  return ok(c, null);
});

auditLogRoutes.get('/', authMiddleware, async (c) => {
  const q = c.req.query();
  const limit = qint(q.limit, 100);
  const conds: SQL[] = [];
  if (q.tableName) conds.push(eq(auditLogs.tableName, q.tableName));
  if (isUuid(q.recordId)) conds.push(eq(auditLogs.recordId, q.recordId));
  if (isUuid(q.userId)) conds.push(eq(auditLogs.userId, q.userId));

  const rows = await db
    .select({
      id: auditLogs.id,
      tableName: auditLogs.tableName,
      recordId: auditLogs.recordId,
      action: auditLogs.action,
      oldValues: auditLogs.oldValues,
      newValues: auditLogs.newValues,
      userId: auditLogs.userId,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      userName: profiles.fullName,
    })
    .from(auditLogs)
    .leftJoin(profiles, eq(profiles.id, auditLogs.userId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return ok(
    c,
    rows.map((r) => ({
      id: r.id,
      tableName: r.tableName,
      recordId: r.recordId ?? undefined,
      action: r.action,
      oldValues: r.oldValues ?? undefined,
      newValues: r.newValues ?? undefined,
      userId: r.userId ?? undefined,
      userName: r.userName ?? undefined,
      ipAddress: r.ipAddress ?? undefined,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});
