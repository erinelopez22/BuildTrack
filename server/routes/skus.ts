// /api/skus — ported from SkusController.cs + SkuService.cs
import { Hono } from 'hono';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { skus } from '../db/schema.js';
import { authMiddleware, isSuperAdmin, type AuthVars } from '../lib/auth.js';
import { requireWarehouseAdmin, requireSuperAdmin } from '../lib/policies.js';
import { body, isUuid, qbool } from '../lib/http.js';
import { created, fail, ok } from '../lib/response.js';
import { num } from '../lib/num.js';
import { constructionMaterials } from '../data/constructionMaterials.js';

type Sku = typeof skus.$inferSelect;

const dto = (s: Sku) => ({
  id: s.id,
  skuCode: s.skuCode,
  name: s.name,
  description: s.description ?? undefined,
  category: s.category ?? undefined,
  unitOfMeasure: s.unitOfMeasure ?? undefined,
  brand: s.brand ?? undefined,
  specifications: s.specifications ?? undefined,
  defaultMinThreshold: num(s.defaultMinThreshold),
  isActive: s.isActive,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

export const skuRoutes = new Hono<{ Variables: AuthVars }>();
skuRoutes.use('*', authMiddleware);

skuRoutes.get('/', async (c) => {
  const auth = c.get('auth');
  const q = c.req.query();
  const conds: SQL[] = [];
  if (!isSuperAdmin(auth) && auth.companyId)
    conds.push(eq(skus.companyId, auth.companyId));
  if (q.search)
    conds.push(
      sql`(${skus.name} ilike ${'%' + q.search + '%'} or ${skus.skuCode} ilike ${'%' + q.search + '%'} or ${skus.category} ilike ${'%' + q.search + '%'})`,
    );
  const active = qbool(q.isActive);
  if (active !== undefined) conds.push(eq(skus.isActive, active));
  if (q.category) conds.push(eq(skus.category, q.category));

  const dir = q.sortOrder?.toLowerCase() === 'desc' ? desc : asc;
  const col =
    q.sortBy?.toLowerCase() === 'sku_code'
      ? skus.skuCode
      : q.sortBy?.toLowerCase() === 'created_at'
        ? skus.createdAt
        : skus.name;

  const rows = await db
    .select()
    .from(skus)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(dir(col));
  return ok(c, rows.map(dto));
});

skuRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'SKU not found.', 404);
  const [row] = await db.select().from(skus).where(eq(skus.id, id));
  if (!row) return fail(c, 'SKU not found.', 404);
  return ok(c, dto(row));
});

skuRoutes.post('/', requireWarehouseAdmin, async (c) => {
  const auth = c.get('auth');
  const b = await body<{
    skuCode: string;
    name: string;
    description?: string;
    category?: string;
    unitOfMeasure?: string;
    brand?: string;
    specifications?: string;
    defaultMinThreshold?: number;
    isActive?: boolean;
  }>(c);
  if (!b.skuCode || !b.name) return fail(c, 'skuCode and name are required.');
  const dupe = await db
    .select({ id: skus.id })
    .from(skus)
    .where(sql`lower(${skus.skuCode}) = lower(${b.skuCode})`);
  if (dupe.length) return fail(c, 'SKU code already exists.');

  const [row] = await db
    .insert(skus)
    .values({
      skuCode: b.skuCode,
      name: (b.name ?? '').toUpperCase(),
      description: b.description?.toUpperCase(),
      category: b.category,
      unitOfMeasure: b.unitOfMeasure?.toLowerCase(),
      brand: b.brand,
      specifications: b.specifications,
      defaultMinThreshold: String(b.defaultMinThreshold ?? 0),
      isActive: b.isActive ?? true,
      createdBy: auth.userId,
      companyId: auth.companyId ?? null,
    })
    .returning();
  return created(c, dto(row));
});

skuRoutes.put('/:id', requireWarehouseAdmin, async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'SKU not found.', 404);
  const b = await body<{
    name?: string;
    description?: string;
    category?: string;
    unitOfMeasure?: string;
    brand?: string;
    specifications?: string;
    defaultMinThreshold?: number;
    isActive?: boolean;
  }>(c);
  const patch: Partial<Sku> = { updatedAt: new Date() };
  if (b.name != null) patch.name = b.name.toUpperCase();
  if (b.description != null) patch.description = b.description.toUpperCase();
  if (b.category != null) patch.category = b.category;
  if (b.unitOfMeasure != null)
    patch.unitOfMeasure = b.unitOfMeasure.toLowerCase();
  if (b.brand != null) patch.brand = b.brand;
  if (b.specifications != null) patch.specifications = b.specifications;
  if (b.defaultMinThreshold != null)
    patch.defaultMinThreshold = String(b.defaultMinThreshold);
  if (b.isActive != null) patch.isActive = b.isActive;

  const [row] = await db
    .update(skus)
    .set(patch)
    .where(eq(skus.id, id))
    .returning();
  if (!row) return fail(c, 'SKU not found.', 404);
  return ok(c, dto(row));
});

skuRoutes.delete('/:id', requireWarehouseAdmin, async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) return fail(c, 'SKU not found.', 404);
  const [row] = await db
    .update(skus)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(skus.id, id))
    .returning();
  if (!row) return fail(c, 'SKU not found.', 404);
  return ok(c, null, 'SKU deleted.');
});

skuRoutes.post('/seed', requireSuperAdmin, async (c) => {
  const auth = c.get('auth');
  const existing = await db
    .select({ name: skus.name, unit: skus.unitOfMeasure })
    .from(skus);
  const have = new Set(existing.map((e) => `${e.name}|${e.unit ?? ''}`));

  let counter = 1;
  const toInsert: (typeof skus.$inferInsert)[] = [];
  for (const m of constructionMaterials) {
    if (have.has(`${m.name}|${m.unit}`)) continue;
    toInsert.push({
      skuCode: `MAT-${String(counter).padStart(4, '0')}`,
      name: m.name,
      description: m.description,
      category: m.category,
      unitOfMeasure: m.unit,
      isActive: true,
      createdBy: auth.userId,
      companyId: auth.companyId ?? null,
    });
    counter++;
  }
  if (toInsert.length) await db.insert(skus).values(toInsert);
  return ok(c, { count: toInsert.length }, `${toInsert.length} materials seeded.`);
});
