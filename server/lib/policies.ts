// Role policies — mirrors the AddPolicy(...) block in backend/BuildTrack.API/Program.cs
import type { MiddlewareHandler } from 'hono';
import type { AuthVars } from './auth';
import { fail } from './response';

const policy =
  (...allowed: string[]): MiddlewareHandler<{ Variables: AuthVars }> =>
  async (c, next) => {
    const { roles } = c.get('auth');
    if (!roles.some((r) => allowed.includes(r)))
      return fail(c, 'Forbidden.', 403);
    await next();
  };

export const requireAdmin = policy('super_admin', 'admin');
export const requireOfficeAdmin = policy('super_admin', 'admin', 'office_admin');
export const requireApprover = policy(
  'super_admin',
  'admin',
  'office_admin',
  'approver',
  'approval_admin',
);
export const requireWarehouseAdmin = policy(
  'super_admin',
  'admin',
  'warehouse_admin',
);
export const requireProjectManager = policy(
  'super_admin',
  'admin',
  'project_manager',
  'project_engineer',
);
export const requireLogistics = policy(
  'super_admin',
  'admin',
  'logistics_admin',
  'tracking_driver',
  'driver',
);
export const requireReceiver = policy(
  'super_admin',
  'admin',
  'receiver',
  'storekeeper',
);
export const requireSuperAdmin = policy('super_admin');

// All assignable roles — backend/BuildTrack.API/Models/Enums/AppRoles.cs
export const ALL_ROLES = [
  'super_admin',
  'admin',
  'office_admin',
  'warehouse_admin',
  'project_manager',
  'procurement',
  'storekeeper',
  'site_lead',
  'viewer',
  'approver',
  'approval_admin',
  'logistics_admin',
  'project_engineer',
  'receiver',
  'tracking_driver',
  'checker',
  'driver',
] as const;

export const isValidRole = (r: string) =>
  (ALL_ROLES as readonly string[]).includes(r);
