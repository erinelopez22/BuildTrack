// JWT + password helpers and the Hono auth middleware.
// Ported from backend/BuildTrack.API/Services/Implementations/{JwtService,AuthService}.cs
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { MiddlewareHandler } from 'hono';
import { fail } from './response';

export interface AuthUser {
  userId: string;
  email: string;
  roles: string[];
  companyId: string | null;
}

export type AuthVars = { auth: AuthUser };

const secretKey = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('JWT_SECRET is not configured.');
  return new TextEncoder().encode(s);
};

const accessMinutes = () => Number(process.env.JWT_ACCESS_MINUTES ?? 60);
export const refreshDays = () => Number(process.env.JWT_REFRESH_DAYS ?? 30);

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) =>
  bcrypt.compare(plain, hash);

export const generateRefreshToken = () => randomBytes(64).toString('base64');

export async function signAccessToken(u: AuthUser): Promise<string> {
  return new SignJWT({
    email: u.email,
    roles: u.roles,
    company_id: u.companyId ?? undefined,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(u.userId)
    .setIssuedAt()
    .setIssuer('BuildTrack.API')
    .setAudience('BuildTrack.Frontend')
    .setExpirationTime(`${accessMinutes()}m`)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: 'BuildTrack.API',
      audience: 'BuildTrack.Frontend',
    });
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      email: String(payload.email ?? ''),
      roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
      companyId: (payload.company_id as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

// Requires a valid bearer token. On failure returns the same envelope the .NET
// API used so the client's refresh-and-retry flow in apiClient.ts still fires.
export const authMiddleware: MiddlewareHandler<{ Variables: AuthVars }> = async (
  c,
  next,
) => {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const user = token ? await verifyAccessToken(token) : null;
  if (!user) return fail(c, 'Session expired.', 401);
  c.set('auth', user);
  await next();
};

export const isSuperAdmin = (u: AuthUser) => u.roles.includes('super_admin');
export const isAdmin = (u: AuthUser) =>
  u.roles.includes('super_admin') || u.roles.includes('admin');
