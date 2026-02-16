import app from './app';
import { initializeDatabase } from './config/database';
import { env } from './config/environment';
import { logger } from './utils/logger';
import { runMigrations } from './utils/migration';

const PORT = env.server.port;

async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();
    logger.info('Database initialized');

    // Run migrations
    await runMigrations();
    logger.info('Migrations completed');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${env.server.nodeEnv}`);
      logger.info(`API URL: ${env.server.apiUrl}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    
    // In development mode, provide helpful instructions
    if (env.server.nodeEnv === 'development') {
      console.log('\n');
      console.log('='.repeat(70));
      console.log('DATABASE CONNECTION FAILED');
      console.log('='.repeat(70));
      console.log('\nTo run the backend locally, you need a Microsoft SQL Server instance.');
      console.log('\nOptions:');
      console.log('1. Windows/Local: Install SQL Server Express or use LocalDB');
      console.log('2. Docker: Run the official SQL Server container:');
      console.log('   docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=YourStrong!Passw0rd" \\');
      console.log('     -p 1433:1433 mcr.microsoft.com/mssql/server:2022-latest');
      console.log('\n3. Azure: Use Azure SQL Database');
      console.log('\nThen update your .env file with the connection details:');
      console.log('  DB_SERVER=<your-server>');
      console.log('  DB_NAME=BuildTrack');
      console.log('  DB_USER=<your-username>');
      console.log('  DB_PASSWORD=<your-password>');
      console.log('='.repeat(70) + '\n');
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

startServer();
