// /api/auth — ported from AuthController.cs + AuthService.cs
import { Hono } from 'hono';
import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  companies,
  profiles,
  refreshTokens,
  userRoles,
} from '../db/schema.js';
import {
  authMiddleware,
  generateRefreshToken,
  hashPassword,
  isSuperAdmin as roleIsSuperAdmin,
  refreshDays,
  signAccessToken,
  verifyPassword,
  type AuthVars,
} from '../lib/auth.js';
import { fail, ok } from '../lib/response.js';

type Profile = typeof profiles.$inferSelect;

async function rolesFor(userId: string): Promise<string[]> {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  return rows.map((r) => r.role);
}

async function companyName(id: string | null): Promise<string | null> {
  if (!id) return null;
  const [row] = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, id));
  return row?.name ?? null;
}

function sessionDto(
  p: Profile,
  roles: string[],
  cName: string | null,
  effectiveCompanyId: string | null,
) {
  return {
    id: p.id,
    email: p.email,
    fullName: p.fullName ?? undefined,
    username: p.username ?? undefined,
    avatarUrl: p.avatarUrl ?? undefined,
    phone: p.phone ?? undefined,
    smsOptIn: p.smsOptIn,
    isActive: p.isActive,
    roles,
    companyId: effectiveCompanyId ?? undefined,
    companyName: cName ?? undefined,
  };
}

async function buildAuthResponse(p: Profile, effectiveCompanyId: string | null) {
  const roles = await rolesFor(p.id);
  const cName = await companyName(effectiveCompanyId);
  const accessToken = await signAccessToken({
    userId: p.id,
    email: p.email,
    roles,
    companyId: effectiveCompanyId,
  });
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(
    Date.now() + refreshDays() * 24 * 60 * 60 * 1000,
  );
  await db.insert(refreshTokens).values({
    userId: p.id,
    token: refreshToken,
    expiresAt,
  });
  const accessMinutes = Number(process.env.JWT_ACCESS_MINUTES ?? 60);
  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + accessMinutes * 60 * 1000).toISOString(),
    user: sessionDto(p, roles, cName, effectiveCompanyId),
  };
}

export const authRoutes = new Hono<{ Variables: AuthVars }>();

authRoutes.post('/login', async (c) => {
  const { loginId, password, companyId } = await c.req
    .json<{ loginId?: string; password?: string; companyId?: string | null }>()
    .catch(() => ({}) as Record<string, undefined>);
  if (!loginId || !password) return fail(c, 'Invalid credentials.', 401);

  const [p] = await db
    .select()
    .from(profiles)
    .where(
      or(
        sql`lower(${profiles.email}) = lower(${loginId})`,
        sql`lower(${profiles.username}) = lower(${loginId})`,
      ),
    )
    .limit(1);

  if (!p || !p.isActive) return fail(c, 'Invalid credentials.', 401);
  if (!(await verifyPassword(password, p.passwordHash)))
    return fail(c, 'Invalid credentials.', 401);

  const roles = await rolesFor(p.id);
  const isSuper = roles.includes('super_admin');

  let effectiveCompanyId: string | null;
  if (isSuper) {
    effectiveCompanyId = companyId ?? null;
  } else {
    if (!companyId) return fail(c, 'Invalid credentials.', 401);
    if (p.companyId && p.companyId !== companyId)
      return fail(c, 'Invalid credentials.', 401);
    if (!p.companyId) {
      await db
        .update(profiles)
        .set({ companyId, updatedAt: new Date() })
        .where(eq(profiles.id, p.id));
      p.companyId = companyId;
    }
    effectiveCompanyId = p.companyId;
  }

  return ok(c, await buildAuthResponse(p, effectiveCompanyId));
});

authRoutes.post('/refresh', async (c) => {
  const { refreshToken } = await c.req
    .json<{ refreshToken?: string }>()
    .catch(() => ({}) as { refreshToken?: string });
  if (!refreshToken)
    return fail(c, 'Invalid or expired refresh token.', 401);

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.token, refreshToken),
        eq(refreshTokens.isRevoked, false),
      ),
    )
    .limit(1);

  if (!stored || stored.expiresAt.getTime() < Date.now())
    return fail(c, 'Invalid or expired refresh token.', 401);

  await db
    .update(refreshTokens)
    .set({ isRevoked: true })
    .where(eq(refreshTokens.id, stored.id));

  const [p] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, stored.userId))
    .limit(1);
  if (!p) return fail(c, 'Invalid or expired refresh token.', 401);

  return ok(c, await buildAuthResponse(p, p.companyId));
});

authRoutes.post('/logout', authMiddleware, async (c) => {
  const { userId } = c.get('auth');
  await db
    .update(refreshTokens)
    .set({ isRevoked: true })
    .where(
      and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.isRevoked, false),
      ),
    );
  return ok(c, null, 'Logged out successfully.');
});

authRoutes.get('/me', authMiddleware, async (c) => {
  const { userId } = c.get('auth');
  const [p] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (!p) return fail(c, 'User not found.', 404);
  const roles = await rolesFor(p.id);
  const cName = await companyName(p.companyId);
  return ok(c, sessionDto(p, roles, cName, p.companyId));
});

authRoutes.post('/change-password', authMiddleware, async (c) => {
  const { userId } = c.get('auth');
  const { currentPassword, newPassword } = await c.req
    .json<{ currentPassword?: string; newPassword?: string }>()
    .catch(() => ({}) as Record<string, undefined>);
  if (!currentPassword || !newPassword)
    return fail(c, 'Current password is incorrect.');

  const [p] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (!p || !(await verifyPassword(currentPassword, p.passwordHash)))
    return fail(c, 'Current password is incorrect.');

  await db
    .update(profiles)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(profiles.id, p.id));
  return ok(c, null, 'Password changed successfully.');
});

export { roleIsSuperAdmin };
