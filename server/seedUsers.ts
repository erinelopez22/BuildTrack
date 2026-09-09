// Seeds 2 test users for every role in AppRoles — one account per (role, index).
// Idempotent: skips any email that already exists. Run: npx tsx server/seedUsers.ts
import './lib/loadEnv.js';
import { inArray } from 'drizzle-orm';
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
  const existing = new Set(
    (
      await db
        .select({ email: profiles.email })
        .from(profiles)
        .where(inArray(profiles.email, emails))
    ).map((r) => r.email.toLowerCase()),
  );

  const toCreate = planned.filter((p) => !existing.has(p.email.toLowerCase()));

  if (toCreate.length === 0) {
    console.log('• All role test users already exist — nothing to do.');
  } else {
    const passwordHash = await hashPassword(PASSWORD);
    const inserted = await db
      .insert(profiles)
      .values(
        toCreate.map((p) => ({
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

    const idByEmail = new Map(
      inserted.map((r) => [r.email.toLowerCase(), r.id]),
    );
    await db.insert(userRoles).values(
      toCreate.map((p) => ({
        userId: idByEmail.get(p.email.toLowerCase())!,
        role: p.role,
      })),
    );

    console.log(`✓ Created ${toCreate.length} users (password: ${PASSWORD})`);
  }

  console.log('\nRole test accounts:');
  for (const role of ALL_ROLES) {
    console.log(
      `  ${role.padEnd(16)}  ${role.replace(/_/g, '')}1@buildtrack.com , ${role.replace(/_/g, '')}2@buildtrack.com`,
    );
  }
  console.log(`\nAll use password: ${PASSWORD}`);
  console.log('Non-super-admins must pick "BuildTrack" as the company at login.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
