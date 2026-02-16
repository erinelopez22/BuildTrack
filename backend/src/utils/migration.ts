import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { getDatabase } from '../config/database';
import { logger } from './logger';

export async function runMigrations(): Promise<void> {
  try {
    const db = getDatabase();
    const migrationsDir = path.join(process.cwd(), 'migrations');

    // Get list of migration files
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      logger.info('No migration files found');
      return;
    }

    logger.info(`Found ${migrationFiles.length} migration files`);

    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file);
      const migrationName = file;

      try {
        // Check if migration already executed
        const checkSql = `
          SELECT COUNT(*) as count FROM migration_history 
          WHERE migration_name = @migrationName
        `;
        
        const request = db.request();
        request.input('migrationName', migrationName);
        const result = await request.query(checkSql);

        if ((result.recordset[0] as any).count > 0) {
          logger.info(`Migration already executed: ${migrationName}`);
          continue;
        }

        // Read and execute migration
        const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
        const startTime = Date.now();

        const req = db.request();
        await req.query(migrationSql);

        const duration = Date.now() - startTime;

        // Record migration in history
        const recordSql = `
          INSERT INTO migration_history (migration_name, duration_ms)
          VALUES (@migrationName, @duration)
        `;
        
        const historyRequest = db.request();
        historyRequest.input('migrationName', migrationName);
        historyRequest.input('duration', duration);
        await historyRequest.query(recordSql);

        logger.info(`Executed migration: ${migrationName} (${duration}ms)`);
      } catch (error) {
        logger.error(`Failed to execute migration ${migrationName}:`, error);
        throw error;
      }
    }

    logger.info('All migrations executed successfully');
  } catch (error) {
    logger.error('Migration runner failed:', error);
    throw error;
  }
}
