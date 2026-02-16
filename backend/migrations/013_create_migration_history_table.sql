-- Migration: Create Migration History table
-- Timestamp: 20260212121200_create_migration_history_table.sql

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='migration_history' and xtype='U')
BEGIN
    CREATE TABLE migration_history (
        id INT PRIMARY KEY IDENTITY(1,1),
        migration_name NVARCHAR(255) NOT NULL UNIQUE,
        executed_at DATETIME2 DEFAULT GETUTCDATE(),
        duration_ms INT
    );
    
    PRINT 'Created migration_history table';
END
ELSE
BEGIN
    PRINT 'migration_history table already exists';
END;
