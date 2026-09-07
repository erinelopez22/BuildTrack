import './server/lib/loadEnv.js';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Prefer a direct (unpooled) connection for schema operations; the Neon Vercel
    // integration provides DATABASE_URL_UNPOOLED / POSTGRES_URL_NON_POOLING.
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DATABASE_URL ??
      process.env.POSTGRES_URL ??
      '',
  },
});
