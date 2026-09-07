// /api/companies — ported from CompaniesController.cs + CompanyService.cs
import { Hono } from 'hono';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { companies, profiles } from '../db/schema';
import { authMiddleware, type AuthVars } from '../lib/auth';
import { requireSuperAdmin } from '../lib/policies';
import { body, isUuid } from '../lib/http';
import { created, fail, ok } from '../lib/response';

type Company = typeof companies.$inferSelect;

const dto = (c: Company, userCount: number) => ({
  id: c.id,
  name: c.name,
  address: c.address ?? undefined,
  phone: c.phone ?? undefined,
  email: c.email ?? undefined,
  isActive: c.isActive,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
  userCount,
});

async function withCounts(rows: Company[]) {
  if (rows.length === 0) return [];
  const counts = await db
    .select({
      companyId: profiles.companyId,
      n: sql<number>`count(*)::int`,
    })
    .from(profiles)
    .where(eq(profiles.isActive, true))
    .groupBy(profiles.companyId);
  const map = new Map(counts.map((r) => [r.companyId, r.n]));
  return rows.map((r) => dto(r, map.get(r.id) ?? 0));
}

export const companyRoutes = new Hono<{ Variables: AuthVars }>();

// Public — used by the login page company selector
companyRoutes.get('/list', async (c) => {
  const rows = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.isActive, true))
    .orderBy(asc(companies.name));
  return ok(c, rows);
});

companyRoutes.use('*', authMiddleware, requireSuperAdmin);

companyRoutes.get('/', async (c) => {
  const rows = await db.select().from(companies).orderBy(asc(companies.name));
  return ok(c, await withCounts(rows));
});

companyRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Company not found.', 404);
  const [row] = await db.select().from(companies).where(eq(companies.id, id));
  if (!row) return fail(c, 'Company not found.', 404);
  return ok(c, (await withCounts([row]))[0]);
});

companyRoutes.post('/', async (c) => {
  const b = await body<{
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  }>(c);
  if (!b.name) return fail(c, 'Name is required.');
  const dupe = await db
    .select({ id: companies.id })
    .from(companies)
    .where(sql`lower(${companies.name}) = lower(${b.name})`);
  if (dupe.length) return fail(c, 'Company name already exists.');

  const [row] = await db
    .insert(companies)
    .values({
      name: b.name,
      address: b.address,
      phone: b.phone,
      email: b.email,
    })
    .returning();
  return created(c, dto(row, 0));
});

companyRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Company not found.', 404);
  const b = await body<{
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    isActive?: boolean;
  }>(c);
  const patch: Partial<Company> = { updatedAt: new Date() };
  if (b.name != null) patch.name = b.name;
  if (b.address != null) patch.address = b.address;
  if (b.phone != null) patch.phone = b.phone;
  if (b.email != null) patch.email = b.email;
  if (b.isActive != null) patch.isActive = b.isActive;

  const [row] = await db
    .update(companies)
    .set(patch)
    .where(eq(companies.id, id))
    .returning();
  if (!row) return fail(c, 'Company not found.', 404);
  return ok(c, (await withCounts([row]))[0]);
});

companyRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'Company not found.', 404);
  const [row] = await db
    .update(companies)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(companies.id, id))
    .returning();
  if (!row) return fail(c, 'Company not found.', 404);
  return ok(c, null, 'Company deactivated.');
});
