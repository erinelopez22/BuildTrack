// Small request helpers shared by route modules.
import type { Context } from 'hono';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: string | undefined | null): v is string =>
  !!v && UUID_RE.test(v);

export async function body<T>(c: Context): Promise<Partial<T>> {
  try {
    return (await c.req.json()) as Partial<T>;
  } catch {
    return {};
  }
}

export const qbool = (v: string | undefined): boolean | undefined =>
  v === undefined ? undefined : v === 'true' || v === '1';

export const qint = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

// ISO string | null for nullable timestamp columns
export const iso = (d: Date | null | undefined): string | undefined =>
  d ? d.toISOString() : undefined;

export const toDate = (
  v: string | null | undefined,
): Date | undefined => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};
