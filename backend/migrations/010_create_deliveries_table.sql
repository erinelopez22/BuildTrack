-- Migration: Create Deliveries table
-- Timestamp: 20260212120900_create_deliveries_table.sql

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='deliveries' and xtype='U')
BEGIN
    CREATE TABLE deliveries (
        id NVARCHAR(36) PRIMARY KEY,
        order_id NVARCHAR(36) NOT NULL,
        delivery_number NVARCHAR(100) NOT NULL UNIQUE,
        delivery_date DATETIME2,
        received_date DATETIME2,
        carrier NVARCHAR(255),
        tracking_number NVARCHAR(100),
        notes NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        received_by NVARCHAR(36),
        
        CONSTRAINT fk_deliveries_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_deliveries_receiver FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL
    );
    
    CREATE INDEX idx_deliveries_order ON deliveries(order_id);
    CREATE INDEX idx_deliveries_number ON deliveries(delivery_number);
    
    PRINT 'Created deliveries table';
END
ELSE
BEGIN
    PRINT 'deliveries table already exists';
END;
