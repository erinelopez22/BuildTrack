// /api/users — ported from UsersController.cs + UserService.cs
import { Hono } from 'hono';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { companies, profiles, userRoles } from '../db/schema.js';
import {
  authMiddleware,
  hashPassword,
  isAdmin,
  isSuperAdmin,
  type AuthVars,
} from '../lib/auth.js';
import { requireAdmin, isValidRole } from '../lib/policies.js';
import { body, isUuid } from '../lib/http.js';
import { created, fail, ok } from '../lib/response.js';

type Profile = typeof profiles.$inferSelect;

async function rolesByUser(ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({ userId: userRoles.userId, role: userRoles.role })
    .from(userRoles)
    .where(inArray(userRoles.userId, ids));
  for (const r of rows) {
    const arr = map.get(r.userId) ?? [];
    arr.push(r.role);
    map.set(r.userId, arr);
  }
  return map;
}

async function companyNames(
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const clean = [...new Set(ids.filter((x): x is string => !!x))];
  if (clean.length === 0) return new Map();
  const rows = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(inArray(companies.id, clean));
  return new Map(rows.map((r) => [r.id, r.name]));
}

const dto = (
  p: Profile,
  roles: string[],
  cName: string | undefined,
) => ({
  id: p.id,
  email: p.email,
  fullName: p.fullName ?? undefined,
  username: p.username ?? undefined,
  address: p.address ?? undefined,
  phone: p.phone ?? undefined,
  avatarUrl: p.avatarUrl ?? undefined,
  smsOptIn: p.smsOptIn,
  isActive: p.isActive,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
  createdBy: p.createdBy ?? undefined,
  roles,
  companyId: p.companyId ?? undefined,
  companyName: cName,
});

async function mapMany(rows: Profile[]) {
  const roles = await rolesByUser(rows.map((r) => r.id));
  const names = await companyNames(rows.map((r) => r.companyId));
  return rows.map((r) =>
    dto(r, roles.get(r.id) ?? [], r.companyId ? names.get(r.companyId) : undefined),
  );
}

async function mapOne(row: Profile) {
  return (await mapMany([row]))[0];
}

export const userRoutes = new Hono<{ Variables: AuthVars }>();
userRoutes.use('*', authMiddleware);

userRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const where =
    !isSuperAdmin(auth) && auth.companyId
      ? eq(profiles.companyId, auth.companyId)
      : undefined;
  const rows = await db
    .select()
    .from(profiles)
    .where(where)
    .orderBy(asc(profiles.fullName));
  return ok(c, await mapMany(rows));
});

userRoutes.get('/me', async (c) => {
  const { userId } = c.get('auth');
  const [row] = await db.select().from(profiles).where(eq(profiles.id, userId));
  if (!row) return fail(c, 'User not found.', 404);
  return ok(c, await mapOne(row));
});

userRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'User not found.', 404);
  const [row] = await db.select().from(profiles).where(eq(profiles.id, id));
  if (!row) return fail(c, 'User not found.', 404);
  return ok(c, await mapOne(row));
});

userRoutes.post('/', requireAdmin, async (c) => {
  const auth = c.get('auth');
  const b = await body<{
    email: string;
    password: string;
    fullName: string;
    username?: string;
    phone?: string;
    address?: string;
    smsOptIn?: boolean;
    role?: string;
    companyId?: string;
  }>(c);
  if (!b.email || !b.password || !b.fullName)
    return fail(c, 'email, password and fullName are required.');

  const email = b.email.toLowerCase();
  const emailDupe = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(sql`lower(${profiles.email}) = ${email}`);
  if (emailDupe.length) return fail(c, 'Email already in use.');

  if (b.username) {
    const uDupe = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(sql`lower(${profiles.username}) = lower(${b.username})`);
    if (uDupe.length) return fail(c, 'Username already in use.');
  }

  const companyId = isSuperAdmin(auth)
    ? (b.companyId ?? auth.companyId)
    : auth.companyId;

  const [row] = await db
    .insert(profiles)
    .values({
      email,
      passwordHash: await hashPassword(b.password),
      fullName: b.fullName,
      username: b.username,
      phone: b.phone,
      address: b.address,
      smsOptIn: b.smsOptIn ?? false,
      companyId: companyId ?? null,
      createdBy: auth.userId,
    })
    .returning();

  if (b.role) {
    await db
      .insert(userRoles)
      .values({ userId: row.id, role: b.role, createdBy: auth.userId });
  }
  return created(c, await mapOne(row));
});

userRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'User not found.', 404);
  const auth = c.get('auth');
  if (!isAdmin(auth) && auth.userId !== id) return fail(c, 'Forbidden.', 403);

  const b = await body<{
    fullName?: string;
    username?: string;
    phone?: string;
    address?: string;
    avatarUrl?: string;
    smsOptIn?: boolean;
    isActive?: boolean;
    companyId?: string | null;
  }>(c);

  const patch: Partial<Profile> = { updatedAt: new Date() };
  if (b.fullName != null) patch.fullName = b.fullName;
  if (b.username != null) patch.username = b.username;
  if (b.phone != null) patch.phone = b.phone;
  if (b.address != null) patch.address = b.address;
  if (b.avatarUrl != null) patch.avatarUrl = b.avatarUrl;
  if (b.smsOptIn != null) patch.smsOptIn = b.smsOptIn;
  if (b.isActive != null) patch.isActive = b.isActive;
  if (b.companyId != null && isSuperAdmin(auth)) patch.companyId = b.companyId;

  const [row] = await db
    .update(profiles)
    .set(patch)
    .where(eq(profiles.id, id))
    .returning();
  if (!row) return fail(c, 'User not found.', 404);
  return ok(c, await mapOne(row));
});

userRoutes.delete('/:id', requireAdmin, async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'User not found.', 404);
  const [row] = await db
    .update(profiles)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(profiles.id, id))
    .returning();
  if (!row) return fail(c, 'User not found.', 404);
  return ok(c, null, 'User deleted.');
});

userRoutes.get('/:id/roles', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return ok(c, []);
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, id));
  return ok(c, rows.map((r) => r.role));
});

userRoutes.post('/:id/roles', requireAdmin, async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'User not found.', 404);
  const { role } = await body<{ role: string }>(c);
  if (!role || !isValidRole(role)) return fail(c, `Invalid role: ${role}`);
  const exists = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(and(eq(userRoles.userId, id), eq(userRoles.role, role)));
  if (!exists.length) {
    await db
      .insert(userRoles)
      .values({ userId: id, role, createdBy: c.get('auth').userId });
  }
  return ok(c, null, 'Role assigned.');
});

userRoutes.delete('/:id/roles/:role', requireAdmin, async (c) => {
  const id = c.req.param('id');
  const role = c.req.param('role');
  if (!isUuid(id)) return fail(c, 'User not found.', 404);
  await db
    .delete(userRoles)
    .where(and(eq(userRoles.userId, id), eq(userRoles.role, role)));
  return ok(c, null, 'Role removed.');
});
