-- Migration: Create Notifications table
-- Timestamp: 20260212121100_create_notifications_table.sql

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notifications' and xtype='U')
BEGIN
    CREATE TABLE notifications (
        id NVARCHAR(36) PRIMARY KEY,
        user_id NVARCHAR(36) NOT NULL,
        title NVARCHAR(255) NOT NULL,
        message NVARCHAR(MAX),
        type NVARCHAR(50),
        reference_type NVARCHAR(50),
        reference_id NVARCHAR(36),
        is_read BIT DEFAULT 0,
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        
        CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    CREATE INDEX idx_notifications_user ON notifications(user_id);
    CREATE INDEX idx_notifications_is_read ON notifications(is_read);
    
    PRINT 'Created notifications table';
END
ELSE
BEGIN
    PRINT 'notifications table already exists';
END;
