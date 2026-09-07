// /api/notifications — ported from NotificationsController.cs + NotificationService.cs
import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { notifications } from '../db/schema';
import { authMiddleware, type AuthVars } from '../lib/auth';
import { isUuid } from '../lib/http';
import { fail, ok } from '../lib/response';

type Notification = typeof notifications.$inferSelect;

const dto = (n: Notification) => ({
  id: n.id,
  userId: n.userId,
  title: n.title,
  message: n.message ?? undefined,
  type: n.type ?? undefined,
  referenceType: n.referenceType ?? undefined,
  referenceId: n.referenceId ?? undefined,
  isRead: n.isRead,
  createdAt: n.createdAt.toISOString(),
});

export const notificationRoutes = new Hono<{ Variables: AuthVars }>();
notificationRoutes.use('*', authMiddleware);

notificationRoutes.put('/read-all', async (c) => {
  const { userId } = c.get('auth');
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
    );
  return ok(c, null, 'All notifications marked as read.');
});

notificationRoutes.get('/', async (c) => {
  const { userId } = c.get('auth');
  const unreadOnly = c.req.query('unreadOnly') === 'true';
  const rows = await db
    .select()
    .from(notifications)
    .where(
      unreadOnly
        ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
        : eq(notifications.userId, userId),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(100);
  return ok(c, rows.map(dto));
});

notificationRoutes.put('/:id/read', async (c) => {
  const id = c.req.param('id');
  const { userId } = c.get('auth');
  if (!isUuid(id)) return fail(c, 'Notification not found.', 404);
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return ok(c, null);
});

notificationRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const { userId } = c.get('auth');
  if (!isUuid(id)) return fail(c, 'Notification not found.', 404);
  await db
    .delete(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return ok(c, null);
});
