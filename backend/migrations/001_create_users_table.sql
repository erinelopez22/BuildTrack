-- Migration: Create Users table
-- Timestamp: 20260212120000_create_users_table.sql

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' and xtype='U')
BEGIN
    CREATE TABLE users (
        id NVARCHAR(36) PRIMARY KEY,
        email NVARCHAR(255) NOT NULL UNIQUE,
        full_name NVARCHAR(255),
        phone NVARCHAR(20),
        avatar_url NVARCHAR(MAX),
        password_hash NVARCHAR(MAX),
        sms_opt_in BIT DEFAULT 0,
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        updated_at DATETIME2 DEFAULT GETUTCDATE()
    );
    
    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_users_is_active ON users(is_active);
    
    PRINT 'Created users table';
END
ELSE
BEGIN
    PRINT 'users table already exists';
END;
