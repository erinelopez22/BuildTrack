// Drizzle client over the Neon serverless (HTTP) driver.
// Lazily initialised so routes that don't touch the DB (e.g. /api/health) work
// even when DATABASE_URL is absent.
import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

let _db: NeonHttpDatabase<typeof schema> | null = null;

function getDb(): NeonHttpDatabase<typeof schema> {
  if (_db) return _db;
  const connectionString =
    process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '';
  if (!connectionString) {
    throw new Error('DATABASE_URL (or POSTGRES_URL) is not set.');
  }
  _db = drizzle(neon(connectionString), { schema });
  return _db;
}

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get: (_t, prop) => {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const val = real[prop];
    return typeof val === 'function' ? val.bind(real) : val;
  },
});

export { schema };
