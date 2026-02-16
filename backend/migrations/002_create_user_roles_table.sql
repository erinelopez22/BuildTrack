-- Migration: Create User Roles table
-- Timestamp: 20260212120100_create_user_roles_table.sql

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_roles' and xtype='U')
BEGIN
    CREATE TABLE user_roles (
        id NVARCHAR(36) PRIMARY KEY,
        user_id NVARCHAR(36) NOT NULL,
        role NVARCHAR(50) NOT NULL,
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        created_by NVARCHAR(36),
        
        CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
    CREATE INDEX idx_user_roles_role ON user_roles(role);
    
    PRINT 'Created user_roles table';
END
ELSE
BEGIN
    PRINT 'user_roles table already exists';
END;
