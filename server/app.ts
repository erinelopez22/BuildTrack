// Builds the Hono application. Shared by the Vercel function (api/index.ts) and the
// local dev server (server/devServer.ts).
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AuthVars } from './lib/auth';
import { fail } from './lib/response';
import { authRoutes } from './routes/auth';
import { companyRoutes } from './routes/companies';
import { userRoutes } from './routes/users';
import { skuRoutes } from './routes/skus';
import { projectRoutes } from './routes/projects';
import { orderRoutes } from './routes/orders';
import { trackingRoutes } from './routes/tracking';
import { inventoryRoutes } from './routes/inventory';
import { quotationRoutes } from './routes/quotations';
import { assetRoutes } from './routes/assets';
import { notificationRoutes } from './routes/notifications';
import { dashboardRoutes } from './routes/dashboard';
import { auditLogRoutes } from './routes/auditLogs';
import { fileRoutes } from './routes/files';
import { truncateRoutes } from './routes/truncate';

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
