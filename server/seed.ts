// Seeds the default company and super-admin — mirrors the startup seed block in
// backend/BuildTrack.API/Program.cs. Safe to run repeatedly.
import './lib/loadEnv';
import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { companies, profiles, userRoles } from './db/schema';
import { hashPassword } from './lib/auth';

const DEFAULT_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  const [existingCompany] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, DEFAULT_COMPANY_ID));

  if (!existingCompany) {
    await db.insert(companies).values({
      id: DEFAULT_COMPANY_ID,
      name: 'BuildTrack',
      isActive: true,
    });
    console.log('✓ Default company "BuildTrack" created');
  } else {
    console.log('• Default company already exists');
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(profiles);

  if (count === 0) {
    const [admin] = await db
      .insert(profiles)
      .values({
        email: 'admin@buildtrack.com',
        username: 'superadmin',
        fullName: 'System Administrator',
        passwordHash: await hashPassword('Admin@123456'),
        smsOptIn: false,
        isActive: true,
        companyId: DEFAULT_COMPANY_ID,
      })
      .returning();

    await db.insert(userRoles).values([
      { userId: admin.id, role: 'super_admin', createdBy: admin.id },
      { userId: admin.id, role: 'admin', createdBy: admin.id },
    ]);
    console.log('✓ Default admin seeded: admin@buildtrack.com / Admin@123456');
  } else {
    console.log(`• ${count} profile(s) already exist — skipping admin seed`);
  }

  console.log('Seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
