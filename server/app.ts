// Builds the Hono application. Shared by the Vercel function (api/index.ts) and the
// local dev server (server/devServer.ts).
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AuthVars } from './lib/auth.js';
import { fail } from './lib/response.js';
import { authRoutes } from './routes/auth.js';
import { companyRoutes } from './routes/companies.js';
import { userRoutes } from './routes/users.js';
import { skuRoutes } from './routes/skus.js';
import { projectRoutes } from './routes/projects.js';
import { orderRoutes } from './routes/orders.js';
import { trackingRoutes } from './routes/tracking.js';
import { inventoryRoutes } from './routes/inventory.js';
import { quotationRoutes } from './routes/quotations.js';
import { assetRoutes } from './routes/assets.js';
import { notificationRoutes } from './routes/notifications.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { auditLogRoutes } from './routes/auditLogs.js';
import { fileRoutes } from './routes/files.js';
import { truncateRoutes } from './routes/truncate.js';

export function createApp() {
  const app = new Hono<{ Variables: AuthVars }>().basePath('/api');

  app.use('*', cors({ origin: (o) => o ?? '*', credentials: true }));

  app.get('/health', (c) =>
    c.json({ ok: true, ts: new Date().toISOString() }),
  );

  app.route('/auth', authRoutes);
  app.route('/companies', companyRoutes);
  app.route('/users', userRoutes);
  app.route('/skus', skuRoutes);
  app.route('/projects', projectRoutes);
  app.route('/orders', orderRoutes);
  app.route('/orders', trackingRoutes);
  app.route('/inventory', inventoryRoutes);
  app.route('/quotations', quotationRoutes);
  app.route('/company-assets', assetRoutes);
  app.route('/notifications', notificationRoutes);
  app.route('/dashboard', dashboardRoutes);
  app.route('/audit-logs', auditLogRoutes);
  app.route('/files', fileRoutes);
  app.route('/truncate', truncateRoutes);

  app.notFound((c) =>
    fail(c, `No route for ${c.req.method} ${c.req.path}`, 404),
  );
  app.onError((err, c) => {
    console.error(err);
    return fail(c, 'An unexpected error occurred.', 500);
  });

  return app;
}

export type AppType = ReturnType<typeof createApp>;
