// Local API server for development. In production the Vercel function (api/index.ts) is used.
// Run with: npm run dev:api  (reads DATABASE_URL etc. from .env.local / .env)
import './lib/loadEnv.js';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';

const port = Number(process.env.API_PORT ?? 5069);

serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(`BuildTrack API (dev) listening on http://localhost:${info.port}`);
});
