#!/usr/bin/env node

/**
 * Verification script to test database connection and migrations
 * Run this after starting the backend to verify everything is working
 */

import sql from 'mssql';
import { env } from '../src/config/environment';

async function verifySetup() {
  console.log('\n🔍 Stockwell Setup Verification\n');

  try {
    // Test database connection
    console.log('1. Testing database connection...');
    const pool = new sql.ConnectionPool({
      server: env.db.server as string,
      database: env.db.database as string,
      options: env.db.options,
    });

    await pool.connect();
    console.log('   ✅ Database connection successful');

    // Check if migration history table exists
    console.log('\n2. Checking database schema...');
    const request = pool.request();
    const result = await request.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);

    const tables = (result.recordset as any[]).map((r) => r.TABLE_NAME);
    console.log(`   ✅ Found ${tables.length} tables:`);
    tables.forEach((t) => console.log(`      - ${t}`));

    // Check migrations
    console.log('\n3. Checking migrations...');
    const migrationRequest = pool.request();
    const migrationResult = await migrationRequest.query(
      'SELECT migration_name, executed_at FROM migration_history ORDER BY executed_at'
    );

    if ((migrationResult.recordset as any[]).length > 0) {
      console.log('   ✅ Migrations executed:');
      (migrationResult.recordset as any[]).forEach((m) => {
        console.log(`      - ${m.migration_name} (${new Date(m.executed_at).toLocaleString()})`);
      });
    } else {
      console.log('   ⚠️  No migrations found');
    }

    // Check if admin user exists
    console.log('\n4. Checking admin user...');
    const userRequest = pool.request();
    const userResult = await userRequest.query(
      "SELECT id, email FROM users WHERE email = 'admin@stockwell.com'"
    );

    if ((userResult.recordset as any[]).length > 0) {
      console.log('   ✅ Admin user exists');
      console.log(`      - Email: admin@stockwell.com`);
      console.log(`      - ID: ${(userResult.recordset[0] as any).id}`);
    } else {
      console.log('   ⚠️  Admin user not found. Run seed script.');
    }

    // Summary
    console.log('\n✨ Verification Summary:');
    console.log(`   Database: ${env.db.database}`);
    console.log(`   Server: ${env.db.server}`);
    console.log(`   Tables: ${tables.length}`);
    console.log(`   Migrations: ${(migrationResult.recordset as any[]).length}`);
    console.log(`   API Port: ${env.server.port}`);
    console.log(`   API URL: ${env.server.apiUrl}`);

    console.log('\n🚀 Setup looks good! Your backend is ready.\n');

    await pool.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification failed:\n');
    console.error(error);
    console.log('\n📋 Troubleshooting:');
    console.log('   1. Ensure SQL Server is running');
    console.log('   2. Check your .env file configuration');
    console.log('   3. Verify database exists: CREATE DATABASE StockwellDB');
    console.log('   4. Run backend migrations: npm run dev\n');

    process.exit(1);
  }
}

verifySetup();
