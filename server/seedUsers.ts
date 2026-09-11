// Seeds/repairs 2 test users for every role in ALL_ROLES.
// Idempotent: creates any missing profile AND ensures each has its role grant
// (so re-running also restores role grants that were removed later).
// Run: npx tsx server/seedUsers.ts
import './lib/loadEnv.js';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from './db/index.js';
import { profiles, userRoles } from './db/schema.js';
import { hashPassword } from './lib/auth.js';
import { ALL_ROLES } from './lib/policies.js';

const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const PASSWORD = 'Test@123456';

const titleCase = (role: string) =>
  role
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

async function main() {
  const planned = ALL_ROLES.flatMap((role) =>
    [1, 2].map((n) => ({
      role,
      email: `${role.replace(/_/g, '')}${n}@buildtrack.com`,
      username: `${role}_${n}`,
      fullName: `${titleCase(role)} ${n === 1 ? 'One' : 'Two'}`,
    })),
  );

  const emails = planned.map((p) => p.email);
  const existing = await db
    .select({ id: profiles.id, email: profiles.email })
    .from(profiles)
    .where(inArray(profiles.email, emails));
  const idByEmail = new Map(existing.map((r) => [r.email.toLowerCase(), r.id]));

  // 1. create missing profiles
  const missing = planned.filter((p) => !idByEmail.has(p.email.toLowerCase()));
  if (missing.length) {
    const passwordHash = await hashPassword(PASSWORD);
    const inserted = await db
      .insert(profiles)
      .values(
        missing.map((p) => ({
          email: p.email,
          username: p.username,
          fullName: p.fullName,
          passwordHash,
          smsOptIn: false,
          isActive: true,
          companyId: DEFAULT_COMPANY_ID,
        })),
      )
      .returning({ id: profiles.id, email: profiles.email });
    for (const r of inserted) idByEmail.set(r.email.toLowerCase(), r.id);
    console.log(`✓ Created ${inserted.length} profiles`);
  }

  // 2. ensure the role grant for every planned user
  let grantsAdded = 0;
  for (const p of planned) {
    const userId = idByEmail.get(p.email.toLowerCase());
    if (!userId) continue;
    const [has] = await db
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.role, p.role)));
    if (!has) {
      await db.insert(userRoles).values({ userId, role: p.role });
      grantsAdded++;
    }
    // also make sure the account is active
    await db
      .update(profiles)
      .set({ isActive: true })
      .where(eq(profiles.id, userId));
  }
  console.log(`✓ Ensured role grants (${grantsAdded} added)`);

  console.log('\nRole test accounts (password ' + PASSWORD + '):');
  for (const role of ALL_ROLES) {
    const base = role.replace(/_/g, '');
    console.log(`  ${role.padEnd(17)} ${base}1@buildtrack.com , ${base}2@buildtrack.com`);
  }
  console.log('\nNon-super-admins must pick "BuildTrack" as the company at login.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
