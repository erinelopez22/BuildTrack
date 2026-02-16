import sql from 'mssql';
import { env } from './environment';
import { logger } from '../utils/logger';

let pool: sql.ConnectionPool | null = null;

export async function initializeDatabase(): Promise<sql.ConnectionPool> {
  if (pool) {
    return pool;
  }

  try {
    const config: sql.config = {
      server: env.db.server!,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      options: env.db.options,
    };
    
    pool = new sql.ConnectionPool(config);

    await pool.connect();
    logger.info('Database connected successfully');
    return pool;
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

export function getDatabase(): sql.ConnectionPool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    logger.info('Database connection closed');
  }
}

export async function query<T>(queryString: string, params?: Record<string, any>): Promise<T[]> {
  const db = getDatabase();
  const request = db.request();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }

  const result = await request.query(queryString);
  return result.recordset as T[];
}

export async function execute<T>(queryString: string, params?: Record<string, any>): Promise<T> {
  const db = getDatabase();
  const request = db.request();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }

  const result = await request.query(queryString);
  return result.recordset[0] as T;
}
