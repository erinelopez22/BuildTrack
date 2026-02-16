-- Migration: Create Delivery Items table
-- Timestamp: 20260212121000_create_delivery_items_table.sql

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='delivery_items' and xtype='U')
BEGIN
    CREATE TABLE delivery_items (
        id NVARCHAR(36) PRIMARY KEY,
        delivery_id NVARCHAR(36) NOT NULL,
        order_item_id NVARCHAR(36) NOT NULL,
        quantity_received INT NOT NULL,
        condition NVARCHAR(50),
        notes NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        
        CONSTRAINT fk_delivery_items_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
        CONSTRAINT fk_delivery_items_order FOREIGN KEY (order_item_id) REFERENCES order_items(id)
    );
    
    CREATE INDEX idx_delivery_items_delivery ON delivery_items(delivery_id);
    
    PRINT 'Created delivery_items table';
END
ELSE
BEGIN
    PRINT 'delivery_items table already exists';
END;
