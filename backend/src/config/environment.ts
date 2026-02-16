import dotenv from 'dotenv';

dotenv.config();

export const env = {
  // Database
  db: {
    server: process.env.DB_SERVER || '(LocalDB)\\MSSQLLocalDB',
    //port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 1433,
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'Password@01',
    database: process.env.DB_NAME || 'BuildTrack',
    poolSize: process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE) : 10,
    options: {
      encrypt: process.env.NODE_ENV === 'production',
      trustServerCertificate: process.env.NODE_ENV !== 'production',
    },
  },
 
  // Server
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    apiUrl: process.env.API_URL || 'http://localhost:3000',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret-key',
    expiration: process.env.JWT_EXPIRATION || '24h',
  },

  // CORS
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
