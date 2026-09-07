// /api/orders/:orderId/tracking-assignments — ported from TrackingController.cs + TrackingService.cs
import { Hono, type Context } from 'hono';
import { and, asc, eq, inArray, notInArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  orderItems,
  orderTrackingAssignments,
  orderTrackingMaterials,
  profiles,
  skus,
} from '../db/schema.js';
import { authMiddleware, type AuthVars } from '../lib/auth.js';
import { body, isUuid } from '../lib/http.js';
import { fail, ok } from '../lib/response.js';
import { num } from '../lib/num.js';

type Assignment = typeof orderTrackingAssignments.$inferSelect;

interface EvidenceItem {
  fileUrl: string;
  fileName: string;
  uploadedBy?: string;
  uploadedAt?: string;
}

const parseEvidence = (json: string | null): EvidenceItem[] => {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

async function mapAssignments(rows: Assignment[]) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const mats = await db
    .select({
      m: orderTrackingMaterials,
      skuName: skus.name,
      unit: skus.unitOfMeasure,
      quantityOrdered: orderItems.quantityOrdered,
    })
    .from(orderTrackingMaterials)
    .leftJoin(orderItems, eq(orderItems.id, orderTrackingMaterials.orderItemId))
    .leftJoin(skus, eq(skus.id, orderItems.skuId))
    .where(inArray(orderTrackingMaterials.assignmentId, ids));

  const driverIds = [...new Set(rows.map((r) => r.driverUserId))];
  const creatorIds = [
    ...new Set(rows.map((r) => r.createdBy).filter((x): x is string => !!x)),
  ];
  const people = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      email: profiles.email,
    })
    .from(profiles)
    .where(inArray(profiles.id, [...driverIds, ...creatorIds]));
  const pmap = new Map(people.map((p) => [p.id, p]));

  const matsByAssignment = new Map<string, typeof mats>();
  for (const row of mats) {
    const arr = matsByAssignment.get(row.m.assignmentId) ?? [];
    arr.push(row);
    matsByAssignment.set(row.m.assignmentId, arr);
  }

  return rows.map((a) => ({
    id: a.id,
    orderId: a.orderId,
    driverUserId: a.driverUserId,
    driverName: pmap.get(a.driverUserId)?.fullName ?? undefined,
    driverEmail: pmap.get(a.driverUserId)?.email ?? '',
    plateNumber: a.plateNumber,
    trackingReference: a.trackingReference ?? undefined,
    notes: a.notes ?? undefined,
    trackingStatus: a.trackingStatus,
    arrivedAt: a.arrivedAt?.toISOString() ?? undefined,
    holdRemarks: a.holdRemarks ?? undefined,
    heldAt: a.heldAt?.toISOString() ?? undefined,
    resumeRemarks: a.resumeRemarks ?? undefined,
    resumedAt: a.resumedAt?.toISOString() ?? undefined,
    createdBy: a.createdBy ?? undefined,
    createdByName: a.createdBy
      ? (pmap.get(a.createdBy)?.fullName ?? undefined)
      : undefined,
    createdAt: a.createdAt.toISOString(),
    materials: (matsByAssignment.get(a.id) ?? []).map((row) => ({
      id: row.m.id,
      orderItemId: row.m.orderItemId,
      skuName: row.skuName ?? undefined,
      unit: row.unit ?? undefined,
      assignedQuantity: num(row.m.assignedQuantity),
      quantityOrdered: num(row.quantityOrdered),
    })),
    evidence: parseEvidence(a.evidenceJson),
    receiverEvidence: parseEvidence(a.receiverEvidenceJson),
  }));
}

async function listForOrder(orderId: string) {
  const rows = await db
    .select()
    .from(orderTrackingAssignments)
    .where(eq(orderTrackingAssignments.orderId, orderId))
    .orderBy(asc(orderTrackingAssignments.createdAt));
  return mapAssignments(rows);
}

async function getOne(id: string) {
  const [row] = await db
    .select()
    .from(orderTrackingAssignments)
    .where(eq(orderTrackingAssignments.id, id));
  return row ? (await mapAssignments([row]))[0] : null;
}

export const trackingRoutes = new Hono<{ Variables: AuthVars }>();
trackingRoutes.use('*', authMiddleware);

trackingRoutes.get('/:orderId/tracking-assignments', async (c) => {
  const orderId = c.req.param('orderId');
  if (!isUuid(orderId)) return ok(c, []);
  return ok(c, await listForOrder(orderId));
});

trackingRoutes.post('/:orderId/tracking-assignments', async (c) => {
  const orderId = c.req.param('orderId');
  if (!isUuid(orderId)) return fail(c, 'Order not found.', 404);
  const auth = c.get('auth');
  const b = await body<{
    assignments: {
      driverUserId: string;
      plateNumber: string;
      trackingReference?: string;
      notes?: string;
      materials: { orderItemId: string; assignedQuantity: number }[];
      evidence?: EvidenceItem[];
    }[];
  }>(c);
  const assignments = b.assignments ?? [];

  const existing = await db
    .select()
    .from(orderTrackingAssignments)
    .where(eq(orderTrackingAssignments.orderId, orderId));
  const byDriver = new Map(existing.map((a) => [a.driverUserId, a]));

  for (const item of assignments) {
    const evidenceJson =
      item.evidence && item.evidence.length
        ? JSON.stringify(item.evidence)
        : null;
    const current = byDriver.get(item.driverUserId);

    if (current) {
      await db
        .update(orderTrackingAssignments)
        .set({
          plateNumber: item.plateNumber,
          trackingReference: item.trackingReference,
          notes: item.notes,
          evidenceJson,
        })
        .where(eq(orderTrackingAssignments.id, current.id));
      await db
        .delete(orderTrackingMaterials)
        .where(eq(orderTrackingMaterials.assignmentId, current.id));
      if (item.materials.length)
        await db.insert(orderTrackingMaterials).values(
          item.materials.map((m) => ({
            assignmentId: current.id,
            orderItemId: m.orderItemId,
            assignedQuantity: String(m.assignedQuantity),
          })),
        );
    } else {
      const [ins] = await db
        .insert(orderTrackingAssignments)
        .values({
          orderId,
          driverUserId: item.driverUserId,
          plateNumber: item.plateNumber,
          trackingReference: item.trackingReference,
          notes: item.notes,
          trackingStatus: 'on_transit',
          createdBy: auth.userId,
          evidenceJson,
        })
        .returning();
      if (item.materials.length)
        await db.insert(orderTrackingMaterials).values(
          item.materials.map((m) => ({
            assignmentId: ins.id,
            orderItemId: m.orderItemId,
            assignedQuantity: String(m.assignedQuantity),
          })),
        );
    }
  }

  const keepDriverIds = assignments.map((a) => a.driverUserId);
  if (keepDriverIds.length) {
    await db
      .delete(orderTrackingAssignments)
      .where(
        and(
          eq(orderTrackingAssignments.orderId, orderId),
          notInArray(orderTrackingAssignments.driverUserId, keepDriverIds),
        ),
      );
  } else {
    await db
      .delete(orderTrackingAssignments)
      .where(eq(orderTrackingAssignments.orderId, orderId));
  }

  return ok(c, await listForOrder(orderId));
});

async function patchAssignment(
  c: Context<{ Variables: AuthVars }>,
  set: Partial<Assignment>,
) {
  const assignmentId = c.req.param('assignmentId');
  if (!isUuid(assignmentId)) return fail(c, 'Assignment not found', 404);
  const [row] = await db
    .update(orderTrackingAssignments)
    .set(set)
    .where(eq(orderTrackingAssignments.id, assignmentId))
    .returning();
  if (!row) return fail(c, 'Assignment not found', 404);
  return ok(c, await getOne(assignmentId));
}

trackingRoutes.put(
  '/:orderId/tracking-assignments/:assignmentId/arrived',
  (c) =>
    patchAssignment(c, { trackingStatus: 'arrived', arrivedAt: new Date() }),
);

trackingRoutes.put(
  '/:orderId/tracking-assignments/:assignmentId/hold',
  async (c) => {
    const { remarks } = await body<{ remarks?: string }>(c);
    return patchAssignment(c, {
      trackingStatus: 'on_hold',
      holdRemarks: remarks ?? null,
      heldAt: new Date(),
    });
  },
);

trackingRoutes.put(
  '/:orderId/tracking-assignments/:assignmentId/resume',
  async (c) => {
    const { remarks } = await body<{ remarks?: string }>(c);
    return patchAssignment(c, {
      trackingStatus: 'on_transit',
      resumeRemarks: remarks ?? null,
      resumedAt: new Date(),
    });
  },
);

trackingRoutes.put(
  '/:orderId/tracking-assignments/:assignmentId/remarks',
  async (c) => {
    const { remarks } = await body<{ remarks?: string }>(c);
    return patchAssignment(c, { notes: remarks ?? null });
  },
);

trackingRoutes.put(
  '/:orderId/tracking-assignments/:assignmentId/receiver-evidence',
  async (c) => {
    const { evidence } = await body<{ evidence: EvidenceItem[] }>(c);
    return patchAssignment(c, {
      receiverEvidenceJson:
        evidence && evidence.length ? JSON.stringify(evidence) : null,
    });
  },
);
