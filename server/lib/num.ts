// Drizzle returns `numeric` columns as strings; the frontend DTOs (src/lib/apiClient.ts)
// expect `number`. These helpers coerce at the mapping boundary.

export const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const numOrNull = (
  v: string | number | null | undefined,
): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

// numeric columns are written as strings too
export const money = (v: number | null | undefined): string | null =>
  v === null || v === undefined ? null : String(v);
